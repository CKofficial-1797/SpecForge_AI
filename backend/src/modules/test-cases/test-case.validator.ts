import { createHash } from "node:crypto";
import type { GeneratedTestCase } from "./test-cases.schema.js";

export interface TestCaseFinding {
  code: string;
  severity: "ERROR" | "WARNING" | "INFO";
  message: string;
  field?: string;
}

export function validateTestCase(
  value: GeneratedTestCase,
  criterion: { id: string; given: string; when: string; then: string },
  peers: Array<
    Pick<
      GeneratedTestCase,
      "title" | "testType" | "testSteps" | "expectedResult"
    >
  > = [],
): TestCaseFinding[] {
  const findings: TestCaseFinding[] = [];
  if (value.acceptanceCriterionId !== criterion.id)
    findings.push({
      code: "INVALID_CRITERION_REFERENCE",
      severity: "ERROR",
      message: "Test case does not reference its supplied approved criterion",
      field: "acceptanceCriterionId",
    });
  if (!value.title.trim())
    findings.push({
      code: "TITLE_REQUIRED",
      severity: "ERROR",
      message: "Title is required",
      field: "title",
    });
  if (!value.description.trim())
    findings.push({
      code: "DESCRIPTION_REQUIRED",
      severity: "ERROR",
      message: "Description is required",
      field: "description",
    });
  if (
    !value.testSteps.length ||
    value.testSteps.some((step) => step.trim().length < 3)
  )
    findings.push({
      code: "MEANINGFUL_STEPS_REQUIRED",
      severity: "ERROR",
      message: "Provide at least one meaningful test step",
      field: "testSteps",
    });
  if (!value.expectedResult.trim())
    findings.push({
      code: "EXPECTED_RESULT_REQUIRED",
      severity: "ERROR",
      message: "Expected result is required",
      field: "expectedResult",
    });
  const criterionText = `${criterion.given} ${criterion.when} ${criterion.then}`;
  if (!isScenarioSupported(value.testType, criterionText))
    findings.push({
      code: "UNSUPPORTED_TEST_SCENARIO",
      severity: "ERROR",
      message: `The approved criterion does not explicitly support a ${value.testType.toLowerCase()} scenario`,
      field: "testType",
    });
  const sourceNumbers = extractNumbers(criterionText);
  const resultNumbers = extractNumbers(
    [
      value.title,
      value.description,
      ...value.preconditions,
      ...value.testSteps,
      ...value.testData.map(({ value: dataValue }) => dataValue),
      value.expectedResult,
    ].join(" "),
  );
  if (resultNumbers.some((number) => !sourceNumbers.includes(number)))
    findings.push({
      code: "UNSUPPORTED_NUMERICAL_CLAIM",
      severity: "ERROR",
      message:
        "Test case introduces a number or status code absent from the approved criterion",
      field: "expectedResult",
    });
  const sourceTokens = new Set(tokens(criterionText));
  const expectedTokens = tokens(value.expectedResult).filter(
    (token) => token.length > 3,
  );
  if (
    expectedTokens.length &&
    !expectedTokens.some((token) => sourceTokens.has(token))
  )
    findings.push({
      code: "EXPECTED_RESULT_NEEDS_REVIEW",
      severity: "WARNING",
      message:
        "Expected result has no clear lexical overlap with the approved criterion; verify that it does not add behavior",
      field: "expectedResult",
    });
  if (
    value.testData.some(({ value: dataValue }) => {
      const normalizedValue = dataValue.normalize("NFKC").toLocaleLowerCase();
      const normalizedSource = criterionText
        .normalize("NFKC")
        .toLocaleLowerCase();
      return (
        !/^\[[^\]]{1,120}\]$/.test(dataValue) &&
        !normalizedSource.includes(normalizedValue)
      );
    })
  )
    findings.push({
      code: "UNSUPPORTED_TEST_DATA",
      severity: "ERROR",
      message:
        "Concrete test data is not stated in the approved criterion; use a symbolic placeholder or clarify the requirement",
      field: "testData",
    });
  if (
    new Set(
      value.testData.map((entry) =>
        entry.name.normalize("NFKC").toLocaleLowerCase(),
      ),
    ).size !== value.testData.length
  )
    findings.push({
      code: "DUPLICATE_TEST_DATA_NAME",
      severity: "ERROR",
      message: "Test data names must be unique",
      field: "testData",
    });
  const currentFingerprint = testCaseFingerprint(value);
  if (peers.some((peer) => testCaseFingerprint(peer) === currentFingerprint))
    findings.push({
      code: "DUPLICATE_TEST_CASE",
      severity: "ERROR",
      message:
        "A duplicate test case already exists for this acceptance criterion",
      field: "title",
    });
  return findings;
}

export function isScenarioSupported(testType: string, source: string) {
  const text = source.normalize("NFKC").toLocaleLowerCase();
  const signals: Record<string, RegExp> = {
    NEGATIVE:
      /\b(not|cannot|can't|invalid|incorrect|without|denied|unsuccessful|unauthorized|error)\b/,
    BOUNDARY:
      /\b(limit|maximum|minimum|range|boundary|threshold|at least|at most|less than|greater than)\b/,
    VALIDATION:
      /\b(valid|invalid|required|format|length|field|input|constraint)\b/,
    FAILURE:
      /\b(fail|failure|error|unavailable|timeout|reject|denied|unsuccessful)\b/,
    AUTHORIZATION:
      /\b(authoriz|permission|role|privilege|access control|allowed|forbidden|restricted)\b/,
    RECOVERY:
      /\b(recover|retry|restore|resume|reconnect|connection|continue)\b/,
  };
  const signal = signals[testType];
  return !signal || signal.test(text);
}

export function testCaseFingerprint(
  value: Pick<
    GeneratedTestCase,
    "title" | "testType" | "testSteps" | "expectedResult"
  >,
) {
  const normalize = (part: string) =>
    part
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  return createHash("sha256")
    .update(
      [value.title, value.testType, ...value.testSteps, value.expectedResult]
        .map(normalize)
        .join("|"),
    )
    .digest("hex");
}
function tokens(value: string) {
  return (
    value
      .normalize("NFKC")
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}
function extractNumbers(value: string): string[] {
  const result = value.match(/\b\d+(?:\.\d+)?%?\b/g);
  return result ? Array.from(result) : [];
}
