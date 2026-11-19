import "dotenv/config";
import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  FRONTEND_ORIGINS: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
export const frontendOrigins = env.FRONTEND_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
