import { ApiError } from "../../utils/api-error.js";
import { TEST_GENERATION_MAX_OUTPUT_BYTES } from "./test-cases.constants.js";
import { testGenerationOutputSchema } from "./test-cases.schema.js";
import type { TestGenerationContext } from "./test-generation.prompt.js";
import { isScenarioSupported } from "./test-case.validator.js";

export function validateTestGenerationOutput(
  raw: string,
  context: TestGenerationContext,
) {
  if (Buffer.byteLength(raw, "utf8") > TEST_GENERATION_MAX_OUTPUT_BYTES)
    throw invalid("AI test generation output is too large");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw invalid("AI test generation output is malformed");
  }
  const parsed = testGenerationOutputSchema.safeParse(data);
  if (!parsed.success)
    throw invalid("AI test generation output did not pass schema validation");
  const supplied = new Map(
    context.approvedAcceptanceCriteria.map((criterion) => [
      criterion.id,
      criterion,
    ]),
  );
  const seen = new Set<string>();
  for (const testCase of parsed.data.testCases) {
    const criterion = supplied.get(testCase.acceptanceCriterionId);
    if (!criterion)
      throw invalid(
        "AI output referenced an acceptance criterion outside the supplied approved context",
      );
    if (
      !isScenarioSupported(
        testCase.testType,
        `${criterion.given} ${criterion.when} ${criterion.then}`,
      )
    )
      throw invalid(
        `AI output classified a ${testCase.testType.toLowerCase()} scenario that is unsupported by its criterion`,
      );
    const key =
      testCase.acceptanceCriterionId +
      "\u0000" +
      testCase.title.normalize("NFKC").toLocaleLowerCase().trim();
    if (seen.has(key)) throw invalid("AI output contains duplicate test cases");
    seen.add(key);
    for (const item of testCase.testData) {
      const normalizedValue = item.value.normalize("NFKC").toLocaleLowerCase();
      const sourceText =
        `${criterion.title} ${criterion.given} ${criterion.when} ${criterion.then}`
          .normalize("NFKC")
          .toLocaleLowerCase();
      if (
        !/^\[[^\]]{1,120}\]$/.test(item.value) &&
        !sourceText.includes(normalizedValue)
      )
        throw invalid(
          "AI output introduced concrete test data not stated in the approved criterion; use a symbolic placeholder or explain the limitation",
        );
    }
    const sourceNumbers = extractNumbers(criterion.then);
    const resultNumbers = extractNumbers(testCase.expectedResult);
    if (resultNumbers.some((number) => !sourceNumbers.includes(number)))
      throw invalid(
        "AI output introduced a numerical value or status code not stated in the approved criterion",
      );
  }
  return parsed.data;
}
function invalid(message: string) {
  return new ApiError(502, "TEST_GENERATION_OUTPUT_INVALID", message);
}
function extractNumbers(value: string): string[] {
  const result = value.match(/\b\d+(?:\.\d+)?%?\b/g);
  return result ? Array.from(result) : [];
}
