import type { ErrorRequestHandler } from "express";
import { ApiError } from "../utils/api-error.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  if (isRecord(error) && error.code === "P2002") {
    res.status(409).json({
      error: {
        code: "RESOURCE_CONFLICT",
        message: "A resource with those values already exists",
      },
    });
    return;
  }

  if (isRecord(error) && error.code === "P2003") {
    res.status(409).json({
      error: {
        code: "RELATED_RESOURCE_CONFLICT",
        message: "The operation conflicts with related records",
      },
    });
    return;
  }

  if (isRecord(error) && error.code === "P2025") {
    res.status(404).json({
      error: { code: "RESOURCE_NOT_FOUND", message: "Resource not found" },
    });
    return;
  }

  if (isRecord(error) && error.type === "entity.parse.failed") {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Request body is not valid JSON",
      },
    });
    return;
  }

  console.error("Unhandled API error", error);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
  });
};

function isRecord(value: unknown): value is { code?: unknown; type?: unknown } {
  return typeof value === "object" && value !== null && "code" in value;
}
