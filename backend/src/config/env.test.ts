import { describe, expect, it } from "vitest";
import { envSchema } from "./env.js";

const base = { DATABASE_URL: "postgresql://localhost/specforge" };

describe("AI provider configuration", () => {
  it("selects local Ollama by default and accepts an explicit cloud provider", () => {
    expect(envSchema.parse(base).AI_PROVIDER).toBe("ollama");
    expect(
      envSchema.parse({ ...base, AI_PROVIDER: "ollama-cloud" }).AI_PROVIDER,
    ).toBe("ollama-cloud");
  });

  it("rejects unsupported providers during startup parsing", () => {
    expect(
      envSchema.safeParse({ ...base, AI_PROVIDER: "openai" }).success,
    ).toBe(false);
  });

  it("normalizes an empty cloud key as missing without echoing credentials", () => {
    expect(
      envSchema.parse({
        ...base,
        AI_PROVIDER: "ollama-cloud",
        OLLAMA_API_KEY: "",
      }).OLLAMA_API_KEY,
    ).toBeUndefined();
    expect(
      envSchema.parse({
        ...base,
        AI_PROVIDER: "ollama-cloud",
        OLLAMA_API_KEY: "   ",
      }).OLLAMA_API_KEY,
    ).toBeUndefined();
    expect(
      envSchema.parse({
        ...base,
        AI_PROVIDER: "ollama-cloud",
        OLLAMA_API_KEY: "key-for-test",
      }).OLLAMA_API_KEY,
    ).toBe("key-for-test");
  });
});
