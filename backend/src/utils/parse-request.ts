import { z } from "zod";
import { ApiError } from "./api-error.js";

export function parseRequest<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed", {
      issues: result.error.issues.map(({ path, message, code }) => ({
        path: path.join("."),
        message,
        code,
      })),
    });
  }
  return result.data;
}
