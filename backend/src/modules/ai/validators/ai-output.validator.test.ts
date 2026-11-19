import { describe, expect, it } from "vitest";
import { validateAiOutput } from "./ai-output.validator.js";
import type { AnalysisContext } from "../harness/analysis-context.builder.js";

const context: AnalysisContext = {
  target: {
    id: "00000000-0000-4000-8000-000000000001",
    version: 1,
    key: "REQ-1",
    title: "Login",
    description: "Inactive users cannot log in.",
    priority: "HIGH",
  },
  related: [],
};
const valid = {
  summary: "The stated login constraint lacks the behavior for locked users.",
  findings: [
    {
      basis: "MISSING",
      category: "MISSING_CONDITION",
      severity: "WARNING",
      title: "Locked account behavior is unspecified",
      description:
        "The text covers inactive accounts, but does not state what happens to locked accounts.",
      evidence: "Inactive users cannot log in.",
      recommendation: "Clarify whether locked accounts can authenticate.",
      affectedRequirementIds: [context.target.id],
      confidence: "MEDIUM",
    },
  ],
  clarificationQuestions: [
    {
      question: "Should locked accounts be allowed to authenticate?",
      reason: "The supplied requirement does not address locked accounts.",
      relatedRequirementIds: [context.target.id],
    },
  ],
  limitations: ["Only supplied requirements were assessed."],
};
describe("AI output guard", () => {
  it("accepts schema-valid output grounded in supplied context", () => {
    expect(validateAiOutput(JSON.stringify(valid), context)).toEqual(valid);
  });
  it("rejects malformed JSON, unsupported IDs, invalid categories, and fabricated quotations", () => {
    expect(() => validateAiOutput("{", context)).toThrow();
    expect(() =>
      validateAiOutput(
        JSON.stringify({
          ...valid,
          findings: [{ ...valid.findings[0], category: "MADE_UP" }],
        }),
        context,
      ),
    ).toThrow();
    expect(() =>
      validateAiOutput(
        JSON.stringify({
          ...valid,
          findings: [
            {
              ...valid.findings[0],
              affectedRequirementIds: ["00000000-0000-4000-8000-000000000002"],
            },
          ],
        }),
        context,
      ),
    ).toThrow();
    expect(() =>
      validateAiOutput(
        JSON.stringify({
          ...valid,
          findings: [
            {
              ...valid.findings[0],
              evidence: "‘Users can wire money without limits’",
            },
          ],
        }),
        context,
      ),
    ).toThrow();
  });
  it("rejects unexpected keys and duplicate findings", () => {
    expect(() =>
      validateAiOutput(JSON.stringify({ ...valid, surprise: true }), context),
    ).toThrow();
    expect(() =>
      validateAiOutput(
        JSON.stringify({
          ...valid,
          findings: [valid.findings[0], valid.findings[0]],
        }),
        context,
      ),
    ).toThrow();
  });
});
