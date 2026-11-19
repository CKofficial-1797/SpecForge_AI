import {
  AI_MAX_FINDINGS,
  AI_MAX_QUESTIONS,
  AI_OUTPUT_MAX_BYTES,
} from "../ai.constants.js";
import {
  requirementAnalysisSchema,
  type RequirementAnalysis,
} from "../schemas/requirement-analysis.schema.js";
import type { AnalysisContext } from "../harness/analysis-context.builder.js";

export class InvalidAiOutputError extends Error {
  constructor(readonly safeCode: string) {
    super("AI response did not pass validation");
  }
}
export function validateAiOutput(
  raw: string,
  context: AnalysisContext,
): RequirementAnalysis {
  if (Buffer.byteLength(raw, "utf8") > AI_OUTPUT_MAX_BYTES)
    throw new InvalidAiOutputError("AI_OUTPUT_TOO_LARGE");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new InvalidAiOutputError("AI_MALFORMED_JSON");
  }
  const parsed = requirementAnalysisSchema.safeParse(json);
  if (!parsed.success) throw new InvalidAiOutputError("AI_SCHEMA_INVALID");
  const allowed = new Set([
    context.target.id,
    ...context.related.map((item) => item.id),
  ]);
  const haystack = [context.target, ...context.related]
    .map((item) => `${item.title}\n${item.description}`)
    .join("\n")
    .toLocaleLowerCase();
  const duplicateKeys = new Set<string>();
  for (const finding of parsed.data.findings) {
    if (finding.affectedRequirementIds.some((id) => !allowed.has(id)))
      throw new InvalidAiOutputError("AI_UNSUPPORTED_REFERENCE");
    const quoted = [
      ...finding.evidence.matchAll(/[“"‘']([^”"’']{4,})[”"’']/g),
    ].map((match) => match[1].toLocaleLowerCase());
    if (quoted.some((quote) => !haystack.includes(quote)))
      throw new InvalidAiOutputError("AI_UNGROUNDED_EVIDENCE");
    const key = [
      finding.category,
      normalize(finding.title),
      normalize(finding.description),
      [...finding.affectedRequirementIds].sort().join(","),
    ].join("|");
    if (duplicateKeys.has(key))
      throw new InvalidAiOutputError("AI_DUPLICATE_FINDING");
    duplicateKeys.add(key);
  }
  for (const question of parsed.data.clarificationQuestions) {
    if (question.relatedRequirementIds.some((id) => !allowed.has(id)))
      throw new InvalidAiOutputError("AI_UNSUPPORTED_REFERENCE");
  }
  if (
    parsed.data.findings.length > AI_MAX_FINDINGS ||
    parsed.data.clarificationQuestions.length > AI_MAX_QUESTIONS
  )
    throw new InvalidAiOutputError("AI_OUTPUT_LIMIT_EXCEEDED");
  return parsed.data;
}
function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
