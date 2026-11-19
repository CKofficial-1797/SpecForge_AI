import { describe, expect, it } from "vitest";
import { validateAcceptanceOutput } from "./acceptance.service.js";

const criterion = {
  title: "Sign in",
  given: "An active account exists.",
  when: "The user enters valid credentials.",
  then: "The user gains access.",
  unresolvedDetails: [],
};
describe("acceptance criteria output contract", () => {
  it("accepts explicit Given/When/Then content", () => {
    expect(
      validateAcceptanceOutput(
        JSON.stringify({ criteria: [criterion], limitations: [] }),
      ).criteria,
    ).toEqual([criterion]);
  });
  it("rejects malformed, incomplete, empty, and unexpected output", () => {
    expect(() => validateAcceptanceOutput("not JSON")).toThrow();
    expect(
      () =>
        validateAcceptanceOutput(
          JSON.stringify({
            criteria: [{ ...criterion, given: "   " }],
            limitations: [],
          }),
        ).criteria,
    ).toThrow();
    expect(() =>
      validateAcceptanceOutput(
        JSON.stringify({
          criteria: [{ ...criterion, when: "" }],
          limitations: [],
        }),
      ),
    ).toThrow();
    expect(() =>
      validateAcceptanceOutput(
        JSON.stringify({
          criteria: [{ ...criterion, then: "" }],
          limitations: [],
        }),
      ),
    ).toThrow();
    expect(() =>
      validateAcceptanceOutput(
        JSON.stringify({
          criteria: [criterion],
          limitations: [],
          generatedId: "fake",
        }),
      ),
    ).toThrow();
  });
});
