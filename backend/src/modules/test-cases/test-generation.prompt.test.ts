import { describe, expect, it } from "vitest";
import {
  buildTestGenerationMessages,
  TEST_GENERATION_OUTPUT_JSON_SCHEMA,
} from "./test-generation.prompt.js";

describe("test generation prompt", () => {
  it("requires source wording, exact enums, and structured test data", () => {
    const [system] = buildTestGenerationMessages({
      requirement: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        version: 1,
      },
      approvedAcceptanceCriteria: [],
    });
    expect(system!.content).toContain("copy its When into one testSteps entry");
    expect(system!.content).toContain(
      "Do not add setup steps such as logging in",
    );
    expect(system!.content).toContain(
      '"testData": [{ "name": "descriptive name"',
    );
    expect(system!.content).toContain("POSITIVE, NEGATIVE, BOUNDARY");
    expect(TEST_GENERATION_OUTPUT_JSON_SCHEMA).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
  });
});
