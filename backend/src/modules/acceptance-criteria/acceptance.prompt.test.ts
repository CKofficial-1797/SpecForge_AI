import { describe, expect, it } from "vitest";
import { buildAcceptanceMessages } from "./acceptance.prompt.js";

describe("acceptance criteria prompt", () => {
  it("preserves explicit non-disclosure and negation constraints", () => {
    const [system] = buildAcceptanceMessages({
      requirementId: "requirement-id",
      version: 1,
      title: "Password reset",
      description:
        "For an unregistered email, show a generic acknowledgement that does not reveal whether an account exists.",
      priority: "HIGH",
    });

    expect(system?.content).toContain(
      "Preserve stated values and negations exactly",
    );
    expect(system?.content).toContain("Copy source phrases verbatim");
    expect(system?.content).toContain(
      "must not state that an account exists or that no account exists",
    );
  });
});
