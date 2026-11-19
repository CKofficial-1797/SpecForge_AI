import { prisma } from "../../../config/database.js";
import { ApiError } from "../../../utils/api-error.js";
import { requirementAnalysisSchema } from "../schemas/requirement-analysis.schema.js";
import type { OllamaClient } from "../client/ollama.types.js";
import { analyzeRequirement } from "../harness/analysis-orchestrator.js";

export { analyzeRequirement };
export async function listAnalyses(
  requirementId: string,
  page: number,
  pageSize: number,
) {
  await ensureRequirement(requirementId);
  const where = { requirementId };
  const [items, total] = await prisma.$transaction([
    prisma.aiAnalysis.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.aiAnalysis.count({ where }),
  ]);
  return {
    data: items.map(toSafeRecord),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
export async function getAnalysis(requirementId: string, analysisId: string) {
  await ensureRequirement(requirementId);
  const item = await prisma.aiAnalysis.findFirst({
    where: { id: analysisId, requirementId },
  });
  if (!item)
    throw new ApiError(404, "AI_ANALYSIS_NOT_FOUND", "AI analysis not found");
  return toSafeRecord(item);
}
function toSafeRecord(
  item: Awaited<ReturnType<typeof prisma.aiAnalysis.findFirstOrThrow>>,
) {
  let outputData = null;
  if (item.status === "SUCCEEDED") {
    const parsed = requirementAnalysisSchema.safeParse(item.outputData);
    if (!parsed.success)
      throw new ApiError(
        500,
        "AI_ANALYSIS_UNAVAILABLE",
        "Saved AI analysis is unavailable",
      );
    outputData = parsed.data;
  }
  return {
    ...item,
    outputData,
    errorCode: item.status === "SUCCEEDED" ? null : item.errorCode,
  };
}
async function ensureRequirement(requirementId: string) {
  if (
    !(await prisma.requirement.findUnique({
      where: { id: requirementId },
      select: { id: true },
    }))
  )
    throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
}
export type { OllamaClient };
