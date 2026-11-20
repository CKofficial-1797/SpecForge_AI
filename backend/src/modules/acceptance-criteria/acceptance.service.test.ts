import { describe, expect, it } from "vitest";
import { validateAcceptanceOutput } from "./acceptance.service.js";

const criterion = {
  title: "Sign in",
  given: "Sign in. An active account exists.",
  when: "The user enters valid credentials.",
  then: "The user gains access.",
  unresolvedDetails: [],
};
const sourceText =
  "Sign in. An active account exists. The user enters valid credentials. The user gains access.";
describe("acceptance criteria output contract", () => {
  it("accepts explicit Given/When/Then content", () => {
    expect(
      validateAcceptanceOutput(
        JSON.stringify({ criteria: [criterion], limitations: [] }),
        sourceText,
      ).criteria,
    ).toEqual([criterion]);
  });
  it("rejects malformed, incomplete, empty, and unexpected output", () => {
    expect(() => validateAcceptanceOutput("not JSON", sourceText)).toThrow();
    expect(
      () =>
        validateAcceptanceOutput(
          JSON.stringify({
            criteria: [{ ...criterion, given: "   " }],
            limitations: [],
          }),
          sourceText,
        ).criteria,
    ).toThrow();
    expect(() =>
      validateAcceptanceOutput(
        JSON.stringify({ acceptanceCriteria: [criterion] }),
        sourceText,
      ),
    ).toThrow();
    expect(() =>
      validateAcceptanceOutput(
        JSON.stringify({
          criteria: [{ ...criterion, when: "" }],
          limitations: [],
        }),
        sourceText,
      ),
    ).toThrow();
    expect(() =>
      validateAcceptanceOutput(
        JSON.stringify({
          criteria: [{ ...criterion, then: "" }],
          limitations: [],
        }),
        sourceText,
      ),
    ).toThrow();
    expect(() =>
      validateAcceptanceOutput(
        JSON.stringify({
          criteria: [criterion],
          limitations: [],
          generatedId: "fake",
        }),
        sourceText,
      ),
    ).toThrow();
  });
  it("rejects a valid schema that adds an unsupported acceptance condition", () => {
    const unsupported = {
      ...criterion,
      then: "The system enforces password complexity requirements.",
    };
    expect(() =>
      validateAcceptanceOutput(
        JSON.stringify({ criteria: [unsupported], limitations: [] }),
        sourceText,
      ),
    ).toThrow(/not grounded/);
  });
});
