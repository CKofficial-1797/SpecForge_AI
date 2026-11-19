import { readFile } from "node:fs/promises";
import "dotenv/config";
import type { AnalysisContext } from "../src/modules/ai/harness/analysis-context.builder.js";

// This script does not connect to PostgreSQL; satisfy the shared app config only
// when the evaluator is run without a DATABASE_URL in its environment.
process.env.DATABASE_URL ??= "postgresql://localhost/specforge-evaluation";
const { env } = await import("../src/config/env.js");
const { HttpOllamaClient } =
  await import("../src/modules/ai/client/ollama.client.js");
const { buildAnalysisMessages } =
  await import("../src/modules/ai/prompts/requirement-analysis.prompt.js");
const { validateAiOutput } =
  await import("../src/modules/ai/validators/ai-output.validator.js");

interface EvaluationCase {
  id: string;
  target: AnalysisContext["target"];
  related: AnalysisContext["related"];
  expectedCategories: string[];
  expectedQuestionTopics: string[];
  mustNotClaim: string[];
  sensitiveMarkers?: string[];
}

const dataset = JSON.parse(
  await readFile(
    new URL("../tests/fixtures/ai-evaluation.v1.json", import.meta.url),
    "utf8",
  ),
) as { datasetVersion: string; promptVersion: string; cases: EvaluationCase[] };

if (!env.OLLAMA_ENABLED || !env.OLLAMA_MODEL) {
  console.log(
    JSON.stringify(
      {
        status: "BLOCKED",
        reason:
          "Set OLLAMA_ENABLED=true and OLLAMA_MODEL after installing and verifying a local model.",
        model: env.OLLAMA_MODEL ?? null,
        datasetVersion: dataset.datasetVersion,
        promptVersion: dataset.promptVersion,
        sampleSize: 0,
      },
      null,
      2,
    ),
  );
  process.exitCode = 2;
} else {
  const client = new HttpOllamaClient();
  const outcomes: Array<{
    caseId: string;
    expectedCategories: string[];
    expectedQuestionTopics: string[];
    inferenceCompleted: boolean;
    schemaValid: boolean;
    unsupportedReference: boolean;
    duplicateOutput: boolean;
    secretMarkerLeak: boolean;
    latencyMs: number | null;
    observedCategories: string[];
    clarificationQuestions: string[];
    findingTitles: string[];
    safeErrorCode?: string;
  }> = [];
  for (const item of dataset.cases) {
    const context: AnalysisContext = {
      target: item.target,
      related: item.related,
    };
    const started = Date.now();
    let inferenceLatencyMs = 0;
    let raw: string;
    try {
      raw = await client.generate({
        model: env.OLLAMA_MODEL,
        messages: buildAnalysisMessages(context),
      });
      inferenceLatencyMs = Date.now() - started;
    } catch (error) {
      outcomes.push({
        caseId: item.id,
        expectedCategories: item.expectedCategories,
        expectedQuestionTopics: item.expectedQuestionTopics,
        inferenceCompleted: false,
        schemaValid: false,
        unsupportedReference: false,
        duplicateOutput: false,
        secretMarkerLeak: false,
        latencyMs: Date.now() - started,
        observedCategories: [],
        clarificationQuestions: [],
        findingTitles: [],
        safeErrorCode:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "AI_UNAVAILABLE",
      });
      continue;
    }
    try {
      const parsed = validateAiOutput(raw, context);
      const serialized = JSON.stringify(parsed).toLocaleLowerCase();
      outcomes.push({
        caseId: item.id,
        inferenceCompleted: true,
        schemaValid: true,
        unsupportedReference: false,
        duplicateOutput: false,
        secretMarkerLeak: (item.sensitiveMarkers ?? []).some((phrase) =>
          serialized.includes(phrase.toLocaleLowerCase()),
        ),
        expectedCategories: item.expectedCategories,
        expectedQuestionTopics: item.expectedQuestionTopics,
        latencyMs: inferenceLatencyMs,
        observedCategories: parsed.findings.map(({ category }) => category),
        clarificationQuestions: parsed.clarificationQuestions.map(
          ({ question }) => question,
        ),
        findingTitles: parsed.findings.map(({ title }) => title),
      });
    } catch (error) {
      const safeErrorCode =
        error instanceof Error && "safeCode" in error
          ? String(error.safeCode)
          : "AI_OUTPUT_INVALID";
      outcomes.push({
        caseId: item.id,
        inferenceCompleted: true,
        schemaValid: false,
        unsupportedReference: safeErrorCode === "AI_UNSUPPORTED_REFERENCE",
        duplicateOutput: safeErrorCode === "AI_DUPLICATE_FINDING",
        secretMarkerLeak: (item.sensitiveMarkers ?? []).some((phrase) =>
          raw.toLocaleLowerCase().includes(phrase.toLocaleLowerCase()),
        ),
        expectedCategories: item.expectedCategories,
        expectedQuestionTopics: item.expectedQuestionTopics,
        latencyMs: inferenceLatencyMs,
        observedCategories: [],
        clarificationQuestions: [],
        findingTitles: [],
        safeErrorCode,
      });
    }
  }
  const count = outcomes.length;
  const ratio = (value: number) =>
    count ? Math.round((value / count) * 1000) / 10 : null;
  const expectedCount = outcomes.reduce(
    (sum, item) => sum + item.expectedCategories.length,
    0,
  );
  const observedCount = outcomes.reduce(
    (sum, item) => sum + item.observedCategories.length,
    0,
  );
  const truePositive = outcomes.reduce(
    (sum, item) =>
      sum +
      item.expectedCategories.filter((category) =>
        item.observedCategories.includes(category),
      ).length,
    0,
  );
  const precision = observedCount
    ? Math.round((truePositive / observedCount) * 1000) / 10
    : null;
  const recall = expectedCount
    ? Math.round((truePositive / expectedCount) * 1000) / 10
    : null;
  const latencies = outcomes
    .flatMap((item) =>
      item.inferenceCompleted && item.latencyMs !== null
        ? [item.latencyMs]
        : [],
    )
    .sort((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        status: "COMPLETED",
        datasetVersion: dataset.datasetVersion,
        promptVersion: dataset.promptVersion,
        expectedLabelReviewStatus: "PENDING_HUMAN_REVIEW",
        model: env.OLLAMA_MODEL,
        sampleSize: count,
        metrics: {
          structuredOutputValidityPercent: ratio(
            outcomes.filter((item) => item.schemaValid).length,
          ),
          unsupportedReferenceRatePercent: ratio(
            outcomes.filter((item) => item.unsupportedReference).length,
          ),
          duplicateResponseRatePercent: ratio(
            outcomes.filter((item) => item.duplicateOutput).length,
          ),
          secretMarkerLeakRatePercent: ratio(
            outcomes.filter((item) => item.secretMarkerLeak).length,
          ),
          aiSuccessRatePercent: ratio(
            outcomes.filter((item) => item.schemaValid).length,
          ),
          meanInferenceLatencyMs: latencies.length
            ? Math.round(
                latencies.reduce((sum, value) => sum + value, 0) /
                  latencies.length,
              )
            : null,
          p95InferenceLatencyMs: latencies.length
            ? latencies[Math.ceil(latencies.length * 0.95) - 1]
            : null,
          provisionalCategoryPrecisionPercent: precision,
          provisionalCategoryRecallPercent: recall,
          clarificationRelevance:
            "Requires human scoring; see docs/AI_EVALUATION.md",
          questionTopicCoveragePercent:
            "Requires human scoring; see docs/AI_EVALUATION.md",
          unsupportedAssumptionRate:
            "Requires human scoring; see docs/AI_EVALUATION.md",
        },
        cases: outcomes,
      },
      null,
      2,
    ),
  );
  if (outcomes.some((item) => !item.schemaValid || item.secretMarkerLeak))
    process.exitCode = 1;
}
