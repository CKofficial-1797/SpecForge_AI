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
  const allowed = new Set(
    [context.target.id, ...context.related.map((item) => item.id)].map((id) =>
      id.toLocaleLowerCase(),
    ),
  );
  const serialized = JSON.stringify(parsed.data);
  const unsupportedId = serialized
    .match(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi)
    ?.find((id) => !allowed.has(id.toLocaleLowerCase()));
  if (unsupportedId) throw new InvalidAiOutputError("AI_UNSUPPORTED_REFERENCE");
  const sourceText = [context.target, ...context.related]
    .map((item) => `${item.key}\n${item.title}\n${item.description}`)
    .join("\n");
  const sourceCredentialMarkers = sourceText.match(
    /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|[A-Za-z0-9_-]*(?:SECRET|TOKEN|API[_-]?KEY|PASSWORD|PASSWD)[A-Za-z0-9_-]{4,})\b/gi,
  );
  if (
    sourceCredentialMarkers?.some((marker) =>
      serialized.toLocaleLowerCase().includes(marker.toLocaleLowerCase()),
    )
  )
    throw new InvalidAiOutputError("AI_SENSITIVE_CONTENT_ECHO");
  const haystack = [context.target, ...context.related]
    .map((item) => `${item.title}\n${item.description}`)
    .join("\n")
    .toLocaleLowerCase();
  const duplicateKeys = new Set<string>();
  for (const finding of parsed.data.findings) {
    if (
      finding.affectedRequirementIds.some(
        (id) => !allowed.has(id.toLocaleLowerCase()),
      )
    )
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
    if (
      question.relatedRequirementIds.some(
        (id) => !allowed.has(id.toLocaleLowerCase()),
      )
    )
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
