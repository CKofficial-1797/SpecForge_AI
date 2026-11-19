import { describe, expect, it } from "vitest";
import {
  testCaseFingerprint,
  validateTestCase,
} from "./test-case.validator.js";

const criterion = {
  id: "11111111-1111-4111-8111-111111111111",
  given: "An active user exists",
  when: "The user signs in",
  then: "The user sees the profile",
};
const sample = {
  acceptanceCriterionId: criterion.id,
  title: "Active user can sign in",
  description: "Confirm a user can sign in and see the profile.",
  testType: "POSITIVE" as const,
  preconditions: ["An active user exists"],
  testSteps: ["Submit the sign-in form"],
  testData: [{ name: "account", value: "[active user account]" }],
  expectedResult: "The user sees the profile",
  priority: "MEDIUM" as const,
};

describe("deterministic test case validation", () => {
  it("accepts a grounded, complete test case", () => {
    expect(validateTestCase(sample, criterion)).toEqual([]);
  });
  it("blocks invented numbers and detects duplicates", () => {
    const invented = {
      ...sample,
      expectedResult: "The user sees the profile within 2 seconds",
    };
    expect(
      validateTestCase(invented, criterion).map((finding) => finding.code),
    ).toContain("UNSUPPORTED_NUMERICAL_CLAIM");
    expect(
      validateTestCase(
        { ...sample, testSteps: ["Wait 2 seconds"] },
        criterion,
      ).map(({ code }) => code),
    ).toContain("UNSUPPORTED_NUMERICAL_CLAIM");
    expect(
      validateTestCase(
        { ...sample, testData: [{ name: "password", value: "secret123" }] },
        criterion,
      ).map(({ code }) => code),
    ).toContain("UNSUPPORTED_TEST_DATA");
    expect(
      validateTestCase(sample, criterion, [sample]).map(
        (finding) => finding.code,
      ),
    ).toContain("DUPLICATE_TEST_CASE");
  });
  it("returns a review warning for unsupported paraphrase", () => {
    expect(
      validateTestCase(
        { ...sample, expectedResult: "A dashboard opens" },
        criterion,
      ).map(({ severity }) => severity),
    ).toContain("WARNING");
  });
  it("blocks scenario categories that the approved criterion does not support", () => {
    expect(
      validateTestCase({ ...sample, testType: "AUTHORIZATION" }, criterion).map(
        ({ code }) => code,
      ),
    ).toContain("UNSUPPORTED_TEST_SCENARIO");
  });
  it("fingerprints normalized content deterministically", () => {
    expect(testCaseFingerprint(sample)).toBe(
      testCaseFingerprint({ ...sample, title: " ACTIVE USER CAN SIGN IN! " }),
    );
  });
});
