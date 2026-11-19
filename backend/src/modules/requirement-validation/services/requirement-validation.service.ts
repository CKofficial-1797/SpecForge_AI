import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../config/database.js";
import { ApiError } from "../../../utils/api-error.js";
import { createValidationContext } from "../engine/validation-context.js";
import { executeValidation } from "../engine/validation-engine.js";
import { validationReportSchema } from "../schemas/validation-result.schema.js";
import type { ValidationReport } from "../validation.types.js";

export async function validateRequirement(requirementId: string) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Requirement" WHERE "id" = CAST(${requirementId} AS UUID) FOR SHARE
    `;
    if (locked.length === 0) {
      throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
    }
    const requirement = await tx.requirement.findUnique({
      where: { id: requirementId },
    });
    if (!requirement) {
      throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
    }
    const project = await tx.project.findUnique({
      where: { id: requirement.projectId },
      select: { id: true },
    });
    const related = await tx.requirement.findMany({
      where: { projectId: requirement.projectId, id: { not: requirementId } },
      select: {
        id: true,
        requirementKey: true,
        title: true,
        description: true,
      },
      orderBy: { id: "asc" },
    });
    const context = createValidationContext({
      requirement,
      relatedRequirements: related,
      projectExists: project !== null,
    });
    const report = executeValidation(context);
    const saved = await tx.validationReport.create({
      data: {
        requirementId,
        requirementVersion: requirement.currentVersion,
        ruleSetVersion: report.ruleSetVersion,
        reportData: report as unknown as Prisma.InputJsonValue,
      },
    });
    return saved;
  });
}

export async function listValidationReports(
  requirementId: string,
  page: number,
  pageSize: number,
) {
  await ensureRequirement(requirementId);
  const where = { requirementId };
  const [data, total] = await prisma.$transaction([
    prisma.validationReport.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.validationReport.count({ where }),
  ]);
  const history = data.map((item) => {
    const parsed = validationReportSchema.safeParse(item.reportData);
    if (!parsed.success) {
      console.error(
        "Stored validation history report failed schema validation",
        {
          reportId: item.id,
          issues: parsed.error.issues,
        },
      );
      throw new ApiError(
        500,
        "VALIDATION_REPORT_UNAVAILABLE",
        "Validation history is unavailable",
      );
    }
    return {
      id: item.id,
      requirementVersion: item.requirementVersion,
      ruleSetVersion: item.ruleSetVersion,
      createdAt: item.createdAt,
      summary: parsed.data.summary,
    };
  });
  return {
    data: history,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getValidationReport(
  requirementId: string,
  reportId: string,
) {
  await ensureRequirement(requirementId);
  const report = await prisma.validationReport.findFirst({
    where: { id: reportId, requirementId },
  });
  if (!report) {
    throw new ApiError(
      404,
      "VALIDATION_REPORT_NOT_FOUND",
      "Validation report not found",
    );
  }
  const parsedReport = validationReportSchema.safeParse(report.reportData);
  if (!parsedReport.success) {
    console.error("Stored validation report failed schema validation", {
      reportId,
      issues: parsedReport.error.issues,
    });
    throw new ApiError(
      500,
      "VALIDATION_REPORT_UNAVAILABLE",
      "Validation report is unavailable",
    );
  }
  return { ...report, reportData: parsedReport.data };
}

export async function getProjectValidationSummary(projectId: string) {
  return prisma.$transaction(
    async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!project)
        throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found");
      const requirements = await tx.requirement.findMany({
        where: { projectId },
        select: { id: true, currentVersion: true },
        orderBy: { id: "asc" },
      });
      if (requirements.length === 0) {
        return {
          projectId,
          requirementsTotal: 0,
          requirementsAnalyzed: 0,
          requirementsWithErrors: 0,
          requirementsWithWarnings: 0,
          requirementsWithoutFindings: 0,
          requirementsNotAnalyzed: 0,
        };
      }
      const currentReports = await tx.validationReport.findMany({
        where: {
          OR: requirements.map(({ id, currentVersion }) => ({
            requirementId: id,
            requirementVersion: currentVersion,
          })),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          requirementId: true,
          requirementVersion: true,
          reportData: true,
        },
      });
      const currentVersions = new Map(
        requirements.map(({ id, currentVersion }) => [id, currentVersion]),
      );
      const latest = new Map<string, ValidationReport>();
      for (const stored of currentReports) {
        if (latest.has(stored.requirementId)) continue;
        if (
          currentVersions.get(stored.requirementId) !==
          stored.requirementVersion
        )
          continue;
        const parsed = validationReportSchema.safeParse(stored.reportData);
        if (!parsed.success) {
          console.error(
            "Stored validation summary report failed schema validation",
            {
              requirementId: stored.requirementId,
              issues: parsed.error.issues,
            },
          );
          continue;
        }
        latest.set(stored.requirementId, parsed.data);
      }
      const reports = [...latest.values()];
      return {
        projectId,
        requirementsTotal: requirements.length,
        requirementsAnalyzed: reports.length,
        requirementsWithErrors: reports.filter(
          (report) => report.summary.errors > 0,
        ).length,
        requirementsWithWarnings: reports.filter(
          (report) => report.summary.warnings > 0,
        ).length,
        requirementsWithoutFindings: reports.filter(
          (report) => report.findings.length === 0,
        ).length,
        requirementsNotAnalyzed: requirements.length - reports.length,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

async function ensureRequirement(requirementId: string) {
  const exists = await prisma.requirement.findUnique({
    where: { id: requirementId },
    select: { id: true },
  });
  if (!exists)
    throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
}
