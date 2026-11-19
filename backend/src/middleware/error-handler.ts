import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const message =
    error instanceof Error ? error.message : "Unexpected server error";
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message } });
};
