import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { frontendOrigins } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { apiRouter } from "./routes/index.js";

export const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: frontendOrigins }));
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);
app.use("/api", apiRouter);
app.use((_req, res) =>
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Route not found" } }),
);
app.use(errorHandler as ErrorRequestHandler);
