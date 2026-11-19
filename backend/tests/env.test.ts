import { describe, expect, it } from "vitest";
import { envSchema } from "../src/config/env.js";

describe("environment configuration", () => {
  it("accepts valid configuration and applies defaults", () => {
    const result = envSchema.safeParse({
      DATABASE_URL: "postgresql://specforge:secret@localhost:5432/specforge",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(3000);
      expect(result.data.OLLAMA_TIMEOUT_MS).toBe(180000);
    }
  });

  it("rejects a missing or invalid database URL", () => {
    expect(envSchema.safeParse({ PORT: "not-a-port" }).success).toBe(false);
  });
});
