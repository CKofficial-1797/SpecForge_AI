import { describe, expect, it } from "vitest";
import { validateTestGenerationOutput } from "./test-output.validator.js";
import type { TestGenerationContext } from "./test-generation.prompt.js";

const context: TestGenerationContext = {
  requirement: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", version: 2 },
  approvedAcceptanceCriteria: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Active sign in",
      given: "An active user exists",
      when: "The user signs in",
      then: "The user sees the profile",
    },
  ],
};
const valid = {
  testCases: [
    {
      acceptanceCriterionId: "11111111-1111-4111-8111-111111111111",
      title: "Profile after sign-in",
      description: "Verify the profile after sign-in.",
      testType: "POSITIVE",
      preconditions: ["An active user exists"],
      testSteps: ["The user signs in"],
      testData: [{ name: "user", value: "[active user account]" }],
      expectedResult: "The user sees the profile",
      priority: "HIGH",
    },
  ],
  limitations: [],
};

describe("test generation output guard", () => {
  it("accepts valid schema output and keeps explicit limitations", () => {
    expect(
      validateTestGenerationOutput(
        JSON.stringify({
          ...valid,
          limitations: ["No password policy was supplied."],
        }),
        context,
      ).limitations,
    ).toHaveLength(1);
  });
  it("rejects malformed, incomplete, unexpected, and unsupported output", () => {
    for (const raw of [
      "{",
      JSON.stringify({
        ...valid,
        testCases: [{ ...valid.testCases[0], expectedResult: undefined }],
      }),
      JSON.stringify({ ...valid, unexpected: true }),
      JSON.stringify({
        ...valid,
        testCases: [{ ...valid.testCases[0], testType: "GUESS" }],
      }),
    ])
      expect(() => validateTestGenerationOutput(raw, context)).toThrow();
  });
  it("rejects natural-language enums and string test data from the previous model output", () => {
    expect(() =>
      validateTestGenerationOutput(
        JSON.stringify({
          testCases: [
            {
              ...valid.testCases[0],
              testType: "Functional",
              testData: ["new_email@example.com"],
              priority: "High",
            },
          ],
          limitations: [],
        }),
        context,
      ),
    ).toThrow();
  });
  it("rejects unsupplied criteria, fabricated numbers, and duplicate entries", () => {
    expect(() =>
      validateTestGenerationOutput(
        JSON.stringify({
          ...valid,
          testCases: [
            {
              ...valid.testCases[0],
              acceptanceCriterionId: "22222222-2222-4222-8222-222222222222",
            },
          ],
        }),
        context,
      ),
    ).toThrow(/outside the supplied/);
    expect(() =>
      validateTestGenerationOutput(
        JSON.stringify({
          ...valid,
          testCases: [
            {
              ...valid.testCases[0],
              expectedResult: "The profile appears within 3 seconds",
            },
          ],
        }),
        context,
      ),
    ).toThrow(/numerical value/);
    expect(() =>
      validateTestGenerationOutput(
        JSON.stringify({
          ...valid,
          testCases: [valid.testCases[0], valid.testCases[0]],
        }),
        context,
      ),
    ).toThrow(/duplicate/);
  });
  it("rejects concrete test data that was not supplied by the criterion", () => {
    const unsupported = {
      ...valid,
      testCases: [
        {
          ...valid.testCases[0]!,
          testData: [{ name: "password", value: "invented-secret-123" }],
        },
      ],
    };
    expect(() =>
      validateTestGenerationOutput(JSON.stringify(unsupported), context),
    ).toThrow(/concrete test data/);
  });
  it("rejects UI navigation and controls absent from the criterion", () => {
    const unsupported = {
      ...valid,
      testCases: [
        {
          ...valid.testCases[0]!,
          description: "Verify the profile after sign-in.",
          title: "Profile after sign-in",
          preconditions: [],
          testSteps: ["Navigate to account settings and click the save button"],
          testData: [],
          expectedResult: "The user sees the profile",
        },
      ],
    };
    expect(() =>
      validateTestGenerationOutput(JSON.stringify(unsupported), context),
    ).toThrow(/not grounded/);
  });
  it("rejects authorization scenarios when the accepted criterion has no permission behavior", () => {
    const unsupported = {
      ...valid,
      testCases: [{ ...valid.testCases[0]!, testType: "AUTHORIZATION" }],
    };
    expect(() =>
      validateTestGenerationOutput(JSON.stringify(unsupported), context),
    ).toThrow(/unsupported by its criterion/);
  });
});
