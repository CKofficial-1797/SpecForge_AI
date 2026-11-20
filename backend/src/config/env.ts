import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env"),
});

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  FRONTEND_ORIGINS: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().url(),
  AI_PROVIDER: z.enum(["ollama", "ollama-cloud"]).default("ollama"),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_API_KEY: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || undefined : value),
    z.string().min(1).optional(),
  ),
  OLLAMA_MODEL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  // Retained for local-mode backwards compatibility; cloud mode is enabled by its key.
  OLLAMA_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  OLLAMA_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(300000)
    .default(180000),
  OLLAMA_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
  AI_CONTEXT_MAX_RELATED: z.coerce.number().int().min(0).max(20).default(8),
  AI_CONTEXT_MAX_CHARS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(100000)
    .default(24000),
});

export const env = envSchema.parse(process.env);
export const frontendOrigins = env.FRONTEND_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const isAiConfigured = Boolean(
  env.OLLAMA_MODEL &&
  (env.AI_PROVIDER === "ollama" ? env.OLLAMA_ENABLED : env.OLLAMA_API_KEY),
);
