import { describe, expect, it } from "vitest";
import {
  validateRefinementOutput,
  type RefinementContext,
} from "./refinement.service.js";

const context: RefinementContext = {
  requirement: {
    id: "00000000-0000-4000-8000-000000000001",
    version: 2,
    title: "Sign in",
    description: "Users sign in with valid credentials.",
    priority: "HIGH",
  },
  project: { name: "Demo", description: null },
  related: [],
  answeredClarifications: [
    {
      questionId: "00000000-0000-4000-8000-000000000002",
      question: "Can inactive users sign in?",
      reason: "Not stated.",
      answerId: "00000000-0000-4000-8000-000000000003",
      answer: "No, inactive users cannot sign in.",
      revisionNumber: 2,
    },
  ],
};
const output = {
  proposedTitle: "Active user sign in",
  proposedDescription:
    "Active users can sign in with valid credentials. Inactive users cannot sign in.",
  changeSummary: "Clarified active account behavior",
  appliedClarifications: [
    {
      questionId: context.answeredClarifications[0]!.questionId,
      answerId: context.answeredClarifications[0]!.answerId,
      changeExplanation: "Added the explicit inactive account restriction.",
    },
  ],
  remainingAmbiguities: [],
  unresolvedQuestions: [],
  assumptions: [],
  warnings: [],
};
describe("refinement output contract", () => {
  it("accepts exact supplied question and answer references", () => {
    expect(validateRefinementOutput(JSON.stringify(output), context)).toEqual(
      output,
    );
  });
  it("rejects malformed output and unknown or unanswered references", () => {
    expect(() => validateRefinementOutput("{", context)).toThrow();
    expect(() =>
      validateRefinementOutput(
        JSON.stringify({
          ...output,
          appliedClarifications: [
            {
              ...output.appliedClarifications[0],
              answerId: "00000000-0000-4000-8000-000000000004",
            },
          ],
        }),
        context,
      ),
    ).toThrow();
    expect(() =>
      validateRefinementOutput(
        JSON.stringify({ ...output, unexpected: true }),
        context,
      ),
    ).toThrow();
  });
  it("rejects a valid JSON echo of the input context instead of a refinement", () => {
    expect(() =>
      validateRefinementOutput(JSON.stringify(context), context),
    ).toThrow();
  });
});
