import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { ApiError } from "../../utils/api-error.js";
import {
  calculateRequirementTraceability,
  makeCoverage,
  type RequirementTraceability,
  type TraceCriterion,
  type TraceRequirement,
  type TraceTestCase,
  type TraceGenerationRun,
} from "./coverage.calculator.js";
import type { TraceabilityPageQuery } from "./traceability.schema.js";

export async function getProjectTraceability(
  projectId: string,
  page: TraceabilityPageQuery,
) {
  return prisma.$transaction(
    async (tx) => {
      await requireProject(tx, projectId);
      const where = { projectId };
      const [requirements, total] = await Promise.all([
        tx.requirement.findMany({
          where,
          select: {
            id: true,
            projectId: true,
            requirementKey: true,
            title: true,
            status: true,
            currentVersion: true,
          },
          orderBy: [{ requirementKey: "asc" }, { id: "asc" }],
          skip: (page.page - 1) * page.pageSize,
          take: page.pageSize,
        }),
        tx.requirement.count({ where }),
      ]);
      const data = await loadRequirementRows(tx, requirements);
      return {
        data,
        pagination: pagination(page, total),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function getRequirementTraceability(requirementId: string) {
  return prisma.$transaction(
    async (tx) => {
      const requirement = await tx.requirement.findUnique({
        where: { id: requirementId },
        select: {
          id: true,
          projectId: true,
          requirementKey: true,
          title: true,
          status: true,
          currentVersion: true,
        },
      });
      if (!requirement)
        throw new ApiError(
          404,
          "REQUIREMENT_NOT_FOUND",
          "Requirement not found",
        );
      const [row] = await loadRequirementRows(tx, [requirement]);
      return row!;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function getAcceptanceCriterionTraceability(criterionId: string) {
  const criterion = await prisma.acceptanceCriterion.findUnique({
    where: { id: criterionId },
    select: { id: true, requirementId: true },
  });
  if (!criterion)
    throw new ApiError(
      404,
      "ACCEPTANCE_CRITERION_NOT_FOUND",
      "Acceptance criterion not found",
    );
  const requirement = await getRequirementTraceability(criterion.requirementId);
  const trace = requirement.acceptanceCriteria.find(
    (item) => item.id === criterionId,
  );
  if (!trace)
    throw new ApiError(
      404,
      "ACCEPTANCE_CRITERION_NOT_FOUND",
      "Acceptance criterion not found",
    );
  return {
    requirement: requirement.requirement,
    criterion: trace,
    coverage: {
      ...requirement.coverage,
      criterionCovered: trace.covered,
    },
  };
}

export async function getTestCaseTraceability(testCaseId: string) {
  const testCase = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    select: { id: true, requirementId: true },
  });
  if (!testCase)
    throw new ApiError(404, "TEST_CASE_NOT_FOUND", "Test case not found");
  const requirement = await getRequirementTraceability(testCase.requirementId);
  const trace =
    requirement.acceptanceCriteria.flatMap((criterion) =>
      criterion.testCases.filter((item) => item.id === testCaseId),
    )[0] ??
    requirement.orphanedTestCases.find((item) => item.id === testCaseId);
  if (!trace)
    throw new ApiError(404, "TEST_CASE_NOT_FOUND", "Test case not found");
  const criterion = requirement.acceptanceCriteria.find(
    (item) => item.id === trace.acceptanceCriterionId,
  );
  return {
    requirement: requirement.requirement,
    requirementVersion: trace.sourceRequirementVersion,
    acceptanceCriterion: criterion ?? null,
    testCase: trace,
  };
}

export async function getProjectCoverageGaps(
  projectId: string,
  page: TraceabilityPageQuery,
) {
  const traceability = await getProjectTraceability(projectId, page);
  return {
    data: traceability.data.flatMap((item) => item.gaps),
    requirements: traceability.data.map((item) => ({
      requirementId: item.requirement.id,
      requirementKey: item.requirement.requirementKey,
      gapCount: item.gaps.length,
    })),
    pagination: traceability.pagination,
  };
}

export async function getProjectCoverageSummary(projectId: string) {
  return prisma.$transaction(
    async (tx) => {
      await requireProject(tx, projectId);
      const requirements = await tx.requirement.findMany({
        where: { projectId },
        select: { id: true, currentVersion: true, status: true },
      });
      const ids = requirements.map(({ id }) => id);
      if (ids.length === 0) return emptyProjectSummary(projectId);

      const [criteriaGroups, caseGroups, validApprovedCases, integrity] =
        await Promise.all([
          tx.acceptanceCriterion.groupBy({
            by: ["requirementId", "sourceRequirementVersion", "status"],
            where: { requirementId: { in: ids } },
            _count: { _all: true },
          }),
          tx.testCase.groupBy({
            by: ["requirementId", "sourceRequirementVersion", "status"],
            where: { requirementId: { in: ids } },
            _count: { _all: true },
          }),
          tx.testCase.groupBy({
            by: [
              "requirementId",
              "sourceRequirementVersion",
              "acceptanceCriterionId",
            ],
            where: {
              requirementId: { in: ids },
              status: "APPROVED",
              acceptanceCriterion: { is: { status: "APPROVED" } },
            },
            _count: { _all: true },
          }),
          countInvalidRelationships(tx, projectId),
        ]);
      const reqById = new Map(requirements.map((item) => [item.id, item]));
      const activeRequirements = requirements.filter(
        (item) => item.status !== "ARCHIVED",
      );
      let eligible = 0;
      let currentCovered = 0;
      let historicalEligible = 0;
      let historicalCovered = 0;
      for (const group of criteriaGroups) {
        const requirement = reqById.get(group.requirementId);
        if (!requirement || requirement.status === "ARCHIVED") continue;
        if (
          group.sourceRequirementVersion === requirement.currentVersion &&
          group.status === "APPROVED"
        )
          eligible += group._count._all;
        if (
          group.sourceRequirementVersion < requirement.currentVersion &&
          group.status === "APPROVED"
        )
          historicalEligible += group._count._all;
      }
      const currentApproved = new Set<string>();
      const historicalApproved = new Set<string>();
      for (const group of validApprovedCases) {
        const requirement = reqById.get(group.requirementId);
        if (!requirement || requirement.status === "ARCHIVED") continue;
        const key = `${group.requirementId}:${group.sourceRequirementVersion}:${group.acceptanceCriterionId}`;
        if (group.sourceRequirementVersion === requirement.currentVersion)
          currentApproved.add(key);
        else if (group.sourceRequirementVersion < requirement.currentVersion)
          historicalApproved.add(key);
      }
      const eligibleCurrentIds = new Set(
        (
          await tx.acceptanceCriterion.findMany({
            where: {
              requirementId: { in: activeRequirements.map(({ id }) => id) },
              status: "APPROVED",
            },
            select: {
              id: true,
              requirementId: true,
              sourceRequirementVersion: true,
            },
          })
        )
          .filter(
            (criterion) =>
              reqById.get(criterion.requirementId)?.currentVersion ===
              criterion.sourceRequirementVersion,
          )
          .map(
            ({ id, requirementId, sourceRequirementVersion }) =>
              `${requirementId}:${sourceRequirementVersion}:${id}`,
          ),
      );
      currentCovered = [...currentApproved].filter((key) =>
        eligibleCurrentIds.has(key),
      ).length;
      const eligibleHistoricalIds = new Set(
        (
          await tx.acceptanceCriterion.findMany({
            where: {
              requirementId: { in: activeRequirements.map(({ id }) => id) },
              status: "APPROVED",
            },
            select: {
              id: true,
              requirementId: true,
              sourceRequirementVersion: true,
            },
          })
        )
          .filter(
            (criterion) =>
              criterion.sourceRequirementVersion <
              (reqById.get(criterion.requirementId)?.currentVersion ?? 0),
          )
          .map(
            ({ id, requirementId, sourceRequirementVersion }) =>
              `${requirementId}:${sourceRequirementVersion}:${id}`,
          ),
      );
      historicalCovered = [...historicalApproved].filter((key) =>
        eligibleHistoricalIds.has(key),
      ).length;
      const currentStatusCount = (
        status: string,
        table: typeof criteriaGroups | typeof caseGroups,
      ) =>
        table.reduce((sum, group) => {
          const requirement = reqById.get(group.requirementId);
          return (
            sum +
            (requirement &&
            requirement.status !== "ARCHIVED" &&
            group.sourceRequirementVersion === requirement.currentVersion &&
            group.status === status
              ? group._count._all
              : 0)
          );
        }, 0);
      const allCaseStatusCount = (status: string) =>
        caseGroups.reduce(
          (sum, group) =>
            sum + (group.status === status ? group._count._all : 0),
          0,
        );
      const historicalCriteria = criteriaGroups.reduce((sum, group) => {
        const requirement = reqById.get(group.requirementId);
        return (
          sum +
          (requirement &&
          group.sourceRequirementVersion < requirement.currentVersion
            ? group._count._all
            : 0)
        );
      }, 0);
      const staleCases = caseGroups.reduce((sum, group) => {
        const requirement = reqById.get(group.requirementId);
        return (
          sum +
          (requirement &&
          group.sourceRequirementVersion < requirement.currentVersion
            ? group._count._all
            : 0)
        );
      }, 0);
      const refinementGroups = await tx.refinementDraft.groupBy({
        by: ["requirementId", "baseRequirementVersion", "status"],
        where: { requirementId: { in: ids } },
        _count: { _all: true },
      });
      const refinementCounts = approvalCounts(
        refinementGroups,
        reqById,
        "baseRequirementVersion",
        "PENDING_REVIEW",
      );
      const criteriaCounts = approvalCounts(
        criteriaGroups,
        reqById,
        "sourceRequirementVersion",
        "DRAFT",
      );
      const testCaseCounts = approvalCounts(
        caseGroups,
        reqById,
        "sourceRequirementVersion",
        "DRAFT",
      );
      const staleRefinementCount = refinementGroups.reduce((sum, group) => {
        const requirement = reqById.get(group.requirementId);
        return (
          sum +
          (requirement &&
          group.baseRequirementVersion < requirement.currentVersion &&
          group.status === "PENDING_REVIEW"
            ? group._count._all
            : 0)
        );
      }, 0);
      const pendingApprovals = {
        refinements: refinementCounts.pending,
        acceptanceCriteria: criteriaCounts.pending,
        testCases: testCaseCounts.pending,
        total:
          refinementCounts.pending +
          criteriaCounts.pending +
          testCaseCounts.pending,
      };
      const approvedArtifacts = {
        refinements: refinementCounts.approved,
        acceptanceCriteria: criteriaGroups.reduce(
          (sum, group) =>
            sum + (group.status === "APPROVED" ? group._count._all : 0),
          0,
        ),
        testCases: allCaseStatusCount("APPROVED"),
      };
      const rejectedArtifacts = {
        refinements: refinementCounts.rejected,
        acceptanceCriteria: criteriaGroups.reduce(
          (sum, group) =>
            sum + (group.status === "REJECTED" ? group._count._all : 0),
          0,
        ),
        testCases: allCaseStatusCount("REJECTED"),
      };
      const totalCriteria = criteriaGroups.reduce(
        (sum, group) => sum + group._count._all,
        0,
      );
      const totalTestCases = caseGroups.reduce(
        (sum, group) => sum + group._count._all,
        0,
      );
      const currentTestCases =
        currentStatusCount("DRAFT", caseGroups) +
        currentStatusCount("APPROVED", caseGroups) +
        currentStatusCount("REJECTED", caseGroups) +
        currentStatusCount("SUPERSEDED", caseGroups);
      return {
        projectId,
        counts: {
          totalRequirements: requirements.length,
          currentRequirements: activeRequirements.length,
          totalAcceptanceCriteria: totalCriteria,
          approvedAcceptanceCriteria: eligible,
          totalTestCases,
          currentTestCases,
          approvedTestCases: approvedArtifacts.testCases,
          currentApprovedTestCases: currentStatusCount("APPROVED", caseGroups),
          draftTestCases: currentStatusCount("DRAFT", caseGroups),
          rejectedTestCases: currentStatusCount("REJECTED", caseGroups),
          coveredCriteria: currentCovered,
          uncoveredCriteria: Math.max(0, eligible - currentCovered),
          staleArtifacts:
            historicalCriteria + staleCases + staleRefinementCount,
          invalidArtifacts: integrity,
        },
        coverage: makeCoverage(eligible, currentCovered),
        historicalCoverage: makeCoverage(historicalEligible, historicalCovered),
        pendingApprovals,
        approvedArtifacts: {
          ...approvedArtifacts,
          total:
            approvedArtifacts.refinements +
            approvedArtifacts.acceptanceCriteria +
            approvedArtifacts.testCases,
        },
        rejectedArtifacts: {
          ...rejectedArtifacts,
          total:
            rejectedArtifacts.refinements +
            rejectedArtifacts.acceptanceCriteria +
            rejectedArtifacts.testCases,
        },
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function getProjectApprovalOverview(projectId: string) {
  return prisma.$transaction(
    async (tx) => {
      await requireProject(tx, projectId);
      const requirements = await tx.requirement.findMany({
        where: { projectId },
        select: { id: true, currentVersion: true, status: true },
      });
      const ids = requirements.map(({ id }) => id);
      const current = new Map(requirements.map((item) => [item.id, item]));
      const [refinementGroups, criteriaGroups, testCaseGroups] =
        await Promise.all([
          tx.refinementDraft.groupBy({
            by: ["requirementId", "baseRequirementVersion", "status"],
            where: { requirementId: { in: ids } },
            _count: { _all: true },
          }),
          tx.acceptanceCriterion.groupBy({
            by: ["requirementId", "sourceRequirementVersion", "status"],
            where: { requirementId: { in: ids } },
            _count: { _all: true },
          }),
          tx.testCase.groupBy({
            by: ["requirementId", "sourceRequirementVersion", "status"],
            where: { requirementId: { in: ids } },
            _count: { _all: true },
          }),
        ]);
      const pending = {
        refinementDrafts: currentCount(
          refinementGroups,
          current,
          "PENDING_REVIEW",
          "baseRequirementVersion",
        ),
        acceptanceCriteria: currentCount(
          criteriaGroups,
          current,
          "DRAFT",
          "sourceRequirementVersion",
        ),
        testCases: currentCount(
          testCaseGroups,
          current,
          "DRAFT",
          "sourceRequirementVersion",
        ),
      };
      const stale = {
        refinementDrafts: stalePendingCount(
          refinementGroups,
          current,
          "PENDING_REVIEW",
          "baseRequirementVersion",
        ),
        acceptanceCriteria: staleGroupCount(
          criteriaGroups,
          current,
          "sourceRequirementVersion",
        ),
        testCases: staleGroupCount(
          testCaseGroups,
          current,
          "sourceRequirementVersion",
        ),
      };
      const approved = {
        refinementDrafts: sumStatus(refinementGroups, "APPROVED"),
        acceptanceCriteria: sumStatus(criteriaGroups, "APPROVED"),
        testCases: sumStatus(testCaseGroups, "APPROVED"),
      };
      const rejected = {
        refinementDrafts: sumStatus(refinementGroups, "REJECTED"),
        acceptanceCriteria: sumStatus(criteriaGroups, "REJECTED"),
        testCases: sumStatus(testCaseGroups, "REJECTED"),
      };
      const [refinementItems, criterionItems, testCaseItems] =
        await Promise.all([
          tx.refinementDraft.findMany({
            where: { status: "PENDING_REVIEW", requirement: { projectId } },
            include: {
              requirement: {
                select: {
                  requirementKey: true,
                  title: true,
                  currentVersion: true,
                  status: true,
                },
              },
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 20,
          }),
          tx.acceptanceCriterion.findMany({
            where: { status: "DRAFT", requirement: { projectId } },
            select: {
              id: true,
              requirementId: true,
              sourceRequirementVersion: true,
              title: true,
              requirement: {
                select: {
                  requirementKey: true,
                  title: true,
                  currentVersion: true,
                  status: true,
                },
              },
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 100,
          }),
          tx.testCase.findMany({
            where: { status: "DRAFT", requirement: { projectId } },
            select: {
              id: true,
              requirementId: true,
              acceptanceCriterionId: true,
              sourceRequirementVersion: true,
              title: true,
              requirement: {
                select: {
                  requirementKey: true,
                  title: true,
                  currentVersion: true,
                  status: true,
                },
              },
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 20,
          }),
        ]);
      const criterionCurrent = criterionItems.filter(
        (item) =>
          item.requirement.status !== "ARCHIVED" &&
          item.sourceRequirementVersion === item.requirement.currentVersion,
      );
      const testCaseCurrent = testCaseItems.filter(
        (item) =>
          item.requirement.status !== "ARCHIVED" &&
          item.sourceRequirementVersion === item.requirement.currentVersion,
      );
      const refinementsCurrent = refinementItems.filter(
        (item) =>
          item.requirement.status !== "ARCHIVED" &&
          item.baseRequirementVersion === item.requirement.currentVersion,
      );
      return {
        projectId,
        pending: {
          ...pending,
          total:
            pending.refinementDrafts +
            pending.acceptanceCriteria +
            pending.testCases,
        },
        approved: {
          ...approved,
          total:
            approved.refinementDrafts +
            approved.acceptanceCriteria +
            approved.testCases,
        },
        rejected: {
          ...rejected,
          total:
            rejected.refinementDrafts +
            rejected.acceptanceCriteria +
            rejected.testCases,
        },
        stale,
        items: {
          refinementDrafts: refinementsCurrent.map((item) => ({
            id: item.id,
            requirementId: item.requirementId,
            requirementKey: item.requirement.requirementKey,
            requirementTitle: item.requirement.title,
            title: item.proposedTitle,
            baseRequirementVersion: item.baseRequirementVersion,
          })),
          acceptanceCriteria: criterionCurrent.map((item) => ({
            id: item.id,
            requirementId: item.requirementId,
            requirementKey: item.requirement.requirementKey,
            requirementTitle: item.requirement.title,
            title: item.title,
            sourceRequirementVersion: item.sourceRequirementVersion,
          })),
          testCases: testCaseCurrent.map((item) => ({
            id: item.id,
            requirementId: item.requirementId,
            requirementKey: item.requirement.requirementKey,
            requirementTitle: item.requirement.title,
            title: item.title,
            acceptanceCriterionId: item.acceptanceCriterionId,
            sourceRequirementVersion: item.sourceRequirementVersion,
          })),
        },
        truncated: {
          refinementDrafts:
            pending.refinementDrafts > refinementsCurrent.length,
          acceptanceCriteria:
            pending.acceptanceCriteria > criterionCurrent.length,
          testCases: pending.testCases > testCaseCurrent.length,
        },
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

async function loadRequirementRows(
  tx: Prisma.TransactionClient,
  requirements: Array<TraceRequirement>,
): Promise<RequirementTraceability[]> {
  if (requirements.length === 0) return [];
  const ids = requirements.map(({ id }) => id);
  const [versions, criteria, testCases] = await Promise.all([
    tx.requirementVersion.findMany({
      where: { requirementId: { in: ids } },
      select: { requirementId: true, versionNumber: true },
      orderBy: [{ requirementId: "asc" }, { versionNumber: "asc" }],
    }),
    tx.acceptanceCriterion.findMany({
      where: { requirementId: { in: ids } },
      orderBy: [
        { sourceRequirementVersion: "desc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    }),
    tx.testCase.findMany({
      where: { requirementId: { in: ids } },
      include: {
        generationRun: {
          select: {
            id: true,
            requirementId: true,
            sourceRequirementVersion: true,
            status: true,
          },
        },
      },
      orderBy: [
        { sourceRequirementVersion: "desc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    }),
  ]);
  const versionsByRequirement = new Map<string, number[]>();
  for (const version of versions) {
    const list = versionsByRequirement.get(version.requirementId) ?? [];
    list.push(version.versionNumber);
    versionsByRequirement.set(version.requirementId, list);
  }
  const criteriaByRequirement = groupBy(criteria, (item) => item.requirementId);
  const casesByRequirement = groupBy(testCases, (item) => item.requirementId);
  return requirements.map((requirement) =>
    calculateRequirementTraceability({
      requirement,
      requirementVersions: versionsByRequirement.get(requirement.id) ?? [],
      acceptanceCriteria: (criteriaByRequirement.get(requirement.id) ??
        []) as TraceCriterion[],
      testCases: (casesByRequirement.get(requirement.id) ?? []).map((item) => ({
        ...item,
        generationRun: item.generationRun as TraceGenerationRun | null,
      })) as TraceTestCase[],
    }),
  );
}

async function requireProject(tx: Prisma.TransactionClient, projectId: string) {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project)
    throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found");
}

async function countInvalidRelationships(
  tx: Prisma.TransactionClient,
  projectId: string,
) {
  const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
    SELECT
      (SELECT COUNT(*) FROM "AcceptanceCriterion" ac
       JOIN "Requirement" r ON r."id" = ac."requirementId"
       LEFT JOIN "RequirementVersion" rv
         ON rv."requirementId" = ac."requirementId"
        AND rv."versionNumber" = ac."sourceRequirementVersion"
       WHERE r."projectId" = CAST(${projectId} AS UUID)
         AND rv."id" IS NULL)
      +
      (SELECT COUNT(*) FROM "TestCase" tc
       JOIN "Requirement" r ON r."id" = tc."requirementId"
       LEFT JOIN "AcceptanceCriterion" ac
         ON ac."id" = tc."acceptanceCriterionId"
        AND ac."requirementId" = tc."requirementId"
        AND ac."sourceRequirementVersion" = tc."sourceRequirementVersion"
       LEFT JOIN "RequirementVersion" rv
         ON rv."requirementId" = tc."requirementId"
        AND rv."versionNumber" = tc."sourceRequirementVersion"
       LEFT JOIN "TestGenerationRun" gr
         ON gr."id" = tc."generationRunId"
        AND gr."requirementId" = tc."requirementId"
        AND gr."sourceRequirementVersion" = tc."sourceRequirementVersion"
       WHERE r."projectId" = CAST(${projectId} AS UUID)
         AND (ac."id" IS NULL OR rv."id" IS NULL OR gr."id" IS NULL))
      AS "count"
  `;
  return Number(rows[0]?.count ?? 0n);
}

type StatusGroup = {
  status: string;
  _count: { _all: number };
  requirementId: string;
};
type VersionedStatusGroup = StatusGroup & Record<string, unknown>;
function currentCount<T extends VersionedStatusGroup>(
  groups: T[],
  requirements: Map<string, { currentVersion: number; status: string }>,
  status: string,
  versionField: "baseRequirementVersion" | "sourceRequirementVersion",
) {
  return groups.reduce((sum, item) => {
    const requirement = requirements.get(item.requirementId);
    return (
      sum +
      (requirement &&
      requirement.status !== "ARCHIVED" &&
      item.status === status &&
      item[versionField] === requirement.currentVersion
        ? item._count._all
        : 0)
    );
  }, 0);
}
function stalePendingCount<T extends VersionedStatusGroup>(
  groups: T[],
  requirements: Map<string, { currentVersion: number; status: string }>,
  status: string,
  versionField: "baseRequirementVersion" | "sourceRequirementVersion",
) {
  return groups.reduce((sum, item) => {
    const requirement = requirements.get(item.requirementId);
    return (
      sum +
      (requirement &&
      item.status === status &&
      (item[versionField] as number) < requirement.currentVersion
        ? item._count._all
        : 0)
    );
  }, 0);
}
function staleGroupCount<T extends VersionedStatusGroup>(
  groups: T[],
  requirements: Map<string, { currentVersion: number; status: string }>,
  versionField: "baseRequirementVersion" | "sourceRequirementVersion",
) {
  return groups.reduce((sum, item) => {
    const requirement = requirements.get(item.requirementId);
    return (
      sum +
      (requirement &&
      (item[versionField] as number) < requirement.currentVersion
        ? item._count._all
        : 0)
    );
  }, 0);
}
function sumStatus(groups: StatusGroup[], status: string) {
  return groups.reduce(
    (sum, item) => sum + (item.status === status ? item._count._all : 0),
    0,
  );
}
function approvalCounts<T extends VersionedStatusGroup>(
  groups: T[],
  requirements: Map<string, { currentVersion: number; status: string }>,
  versionField: "baseRequirementVersion" | "sourceRequirementVersion",
  pendingStatus: string,
) {
  return {
    pending: currentCount(groups, requirements, pendingStatus, versionField),
    approved: sumStatus(groups, "APPROVED"),
    rejected: sumStatus(groups, "REJECTED"),
  };
}
function pagination(page: TraceabilityPageQuery, total: number) {
  return {
    page: page.page,
    pageSize: page.pageSize,
    total,
    totalPages: Math.ceil(total / page.pageSize),
  };
}
function groupBy<T, K extends string>(items: T[], key: (item: T) => K) {
  const result = new Map<K, T[]>();
  for (const item of items) {
    const value = key(item);
    const list = result.get(value) ?? [];
    list.push(item);
    result.set(value, list);
  }
  return result;
}
function emptyProjectSummary(projectId: string) {
  return {
    projectId,
    counts: {
      totalRequirements: 0,
      currentRequirements: 0,
      totalAcceptanceCriteria: 0,
      approvedAcceptanceCriteria: 0,
      totalTestCases: 0,
      currentTestCases: 0,
      approvedTestCases: 0,
      currentApprovedTestCases: 0,
      draftTestCases: 0,
      rejectedTestCases: 0,
      coveredCriteria: 0,
      uncoveredCriteria: 0,
      staleArtifacts: 0,
      invalidArtifacts: 0,
    },
    coverage: makeCoverage(0, 0),
    historicalCoverage: makeCoverage(0, 0),
    pendingApprovals: {
      refinements: 0,
      acceptanceCriteria: 0,
      testCases: 0,
      total: 0,
    },
    approvedArtifacts: {
      refinements: 0,
      acceptanceCriteria: 0,
      testCases: 0,
      total: 0,
    },
    rejectedArtifacts: {
      refinements: 0,
      acceptanceCriteria: 0,
      testCases: 0,
      total: 0,
    },
  };
}
