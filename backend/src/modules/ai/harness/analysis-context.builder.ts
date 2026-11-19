import { env } from "../../../config/env.js";
import { prisma } from "../../../config/database.js";
import { ApiError } from "../../../utils/api-error.js";

export interface AnalysisContext {
  target: {
    id: string;
    version: number;
    key: string;
    title: string;
    description: string;
    priority: string;
  };
  related: Array<{
    id: string;
    version: number;
    key: string;
    title: string;
    description: string;
    priority: string;
  }>;
}
export async function buildAnalysisContext(
  requirementId: string,
): Promise<AnalysisContext> {
  const target = await prisma.requirement.findUnique({
    where: { id: requirementId },
  });
  if (!target)
    throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
  const targetVersion = await prisma.requirementVersion.findUnique({
    where: {
      requirementId_versionNumber: {
        requirementId,
        versionNumber: target.currentVersion,
      },
    },
  });
  if (!targetVersion)
    throw new ApiError(
      500,
      "AI_CONTEXT_UNAVAILABLE",
      "Requirement version is unavailable",
    );
  const rows = await prisma.requirement.findMany({
    where: {
      projectId: target.projectId,
      id: { not: requirementId },
      status: { not: "ARCHIVED" },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: env.AI_CONTEXT_MAX_RELATED,
    select: {
      id: true,
      requirementKey: true,
      title: true,
      description: true,
      priority: true,
      currentVersion: true,
    },
  });
  const related = await Promise.all(
    rows.map(async (row) => {
      const version = await prisma.requirementVersion.findUnique({
        where: {
          requirementId_versionNumber: {
            requirementId: row.id,
            versionNumber: row.currentVersion,
          },
        },
      });
      if (!version) return null;
      return {
        id: row.id,
        version: version.versionNumber,
        key: row.requirementKey,
        title: version.title,
        description: version.description,
        priority: version.priority,
      };
    }),
  );
  const context: AnalysisContext = {
    target: {
      id: target.id,
      version: targetVersion.versionNumber,
      key: target.requirementKey,
      title: targetVersion.title,
      description: targetVersion.description,
      priority: targetVersion.priority,
    },
    related: related.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    ),
  };
  while (
    JSON.stringify(context).length > env.AI_CONTEXT_MAX_CHARS &&
    context.related.length
  )
    context.related.pop();
  if (JSON.stringify(context).length > env.AI_CONTEXT_MAX_CHARS)
    throw new ApiError(
      413,
      "AI_CONTEXT_TOO_LARGE",
      "Requirement is too large for semantic analysis",
    );
  return context;
}
