import { describe, expect, it } from "vitest";
import { findUnsupportedTerms } from "./source-grounding.validator.js";

describe("source grounding terms", () => {
  it("accepts a narrow account-association paraphrase when account is in source", () => {
    expect(
      findUnsupportedTerms(
        "an associated email address",
        "the email address on the user's account",
      ),
    ).toEqual([]);
  });

  it("keeps unsupported validity and delivery timing claims", () => {
    expect(
      findUnsupportedTerms(
        "a valid email address delivered within 15 minutes",
        "the user provides an email address; the link expires after 15 minutes",
      ),
    ).toEqual(expect.arrayContaining(["valid", "delivered", "within"]));
  });
});
