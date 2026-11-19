import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    exclude: [
      "tests/database.integration.test.ts",
      "**/node_modules/**",
      "**/dist/**",
    ],
  },
});
