import { env } from "../../../config/env.js";
import { OllamaError } from "../client/ollama.client.js";
import type { OllamaClient } from "../client/ollama.types.js";
import { AI_SCHEMA_VERSION } from "../ai.constants.js";
import { REQUIREMENT_ANALYSIS_PROMPT_VERSION } from "../prompts/prompt-version.js";
import { buildAnalysisMessages } from "../prompts/requirement-analysis.prompt.js";
import { buildAnalysisContext } from "./analysis-context.builder.js";
import { validateAiOutput } from "./output-guard.js";
import { prisma } from "../../../config/database.js";
import { ApiError } from "../../../utils/api-error.js";
import { RULE_SET_VERSION } from "../../requirement-validation/validation.constants.js";
import { validateRequirement } from "../../requirement-validation/services/requirement-validation.service.js";
import { validationReportSchema } from "../../requirement-validation/schemas/validation-result.schema.js";

const inFlight = new Map<
  string,
  Promise<Awaited<ReturnType<typeof runAnalysis>>>
>();
export function analyzeRequirement(
  requirementId: string,
  client: OllamaClient,
) {
  const active = inFlight.get(requirementId);
  if (active) return active;
  const pending = runAnalysis(requirementId, client).finally(() =>
    inFlight.delete(requirementId),
  );
  inFlight.set(requirementId, pending);
  return pending;
}
async function runAnalysis(requirementId: string, client: OllamaClient) {
  const context = await buildAnalysisContext(requirementId);
  const deterministicReport = await getOrRunDeterministicReport(
    requirementId,
    context.target.version,
  );
  const supplied = [context.target, ...context.related];
  const record = await prisma.aiAnalysis.create({
    data: {
      requirementId,
      requirementVersion: context.target.version,
      modelName: env.OLLAMA_MODEL ?? null,
      promptVersion: REQUIREMENT_ANALYSIS_PROMPT_VERSION,
      schemaVersion: AI_SCHEMA_VERSION,
      ruleSetVersion: RULE_SET_VERSION,
      status: "PENDING",
      contextVersions: supplied.map(({ id, version }) => ({ id, version })),
    },
  });
  if (!env.OLLAMA_ENABLED || !env.OLLAMA_MODEL) {
    await prisma.aiAnalysis.update({
      where: { id: record.id },
      data: {
        status: "UNAVAILABLE",
        errorCode: "AI_NOT_CONFIGURED",
        completedAt: new Date(),
      },
    });
    throw new ApiError(
      503,
      "AI_UNAVAILABLE",
      "AI analysis is not configured. Set OLLAMA_ENABLED and OLLAMA_MODEL after verifying a local Ollama model.",
    );
  }
  const started = Date.now();
  await prisma.aiAnalysis.update({
    where: { id: record.id },
    data: { status: "RUNNING" },
  });
  try {
    const raw = await client.generate({
      model: env.OLLAMA_MODEL,
      messages: buildAnalysisMessages(context),
    });
    const output = validateAiOutput(raw, context);
    const saved = await prisma.aiAnalysis.update({
      where: { id: record.id },
      data: {
        status: "SUCCEEDED",
        outputData: output,
        completedAt: new Date(),
        durationMs: Date.now() - started,
      },
    });
    return { analysis: saved, deterministicReport };
  } catch (error) {
    const code =
      error instanceof OllamaError
        ? error.code
        : error instanceof Error && "safeCode" in error
          ? String(error.safeCode)
          : "AI_ANALYSIS_FAILED";
    const status =
      error instanceof OllamaError && error.code === "AI_UNAVAILABLE"
        ? "UNAVAILABLE"
        : "FAILED";
    await prisma.aiAnalysis.update({
      where: { id: record.id },
      data: {
        status,
        errorCode: code.slice(0, 80),
        completedAt: new Date(),
        durationMs: Date.now() - started,
      },
    });
    if (error instanceof OllamaError)
      throw new ApiError(error.status, error.code, error.message);
    throw new ApiError(
      502,
      "AI_OUTPUT_INVALID",
      "AI response could not be safely validated",
    );
  }
}

async function getOrRunDeterministicReport(
  requirementId: string,
  requirementVersion: number,
) {
  const stored = await prisma.validationReport.findFirst({
    where: { requirementId, requirementVersion },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  if (stored) {
    const parsed = validationReportSchema.safeParse(stored.reportData);
    if (parsed.success)
      return {
        id: stored.id,
        requirementVersion: stored.requirementVersion,
        ruleSetVersion: stored.ruleSetVersion,
        reportData: parsed.data,
      };
  }
  const report = await validateRequirement(requirementId);
  if (report.requirementVersion !== requirementVersion)
    throw new ApiError(
      409,
      "VERSION_CONFLICT",
      "The requirement changed during analysis setup. Reload and retry.",
    );
  const parsed = validationReportSchema.safeParse(report.reportData);
  if (!parsed.success)
    throw new ApiError(
      500,
      "VALIDATION_REPORT_UNAVAILABLE",
      "Deterministic validation report is unavailable",
    );
  return {
    id: report.id,
    requirementVersion: report.requirementVersion,
    ruleSetVersion: report.ruleSetVersion,
    reportData: parsed.data,
  };
}
