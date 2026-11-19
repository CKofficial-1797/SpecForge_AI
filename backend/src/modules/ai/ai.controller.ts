import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseRequest } from "../../utils/parse-request.js";
import { HttpOllamaClient } from "./client/ollama.client.js";
import {
  aiAnalysisParamsSchema,
  aiHistoryQuerySchema,
  requirementAnalysisParamsSchema,
} from "./ai.schema.js";
import { getAiHealth } from "./services/ai-health.service.js";
import * as service from "./services/requirement-analysis.service.js";
const client = new HttpOllamaClient();
export const aiHealth: RequestHandler = asyncHandler(async (_req, res) => {
  res.status(200).json({ data: await getAiHealth(client) });
});
export const runAnalysis: RequestHandler = asyncHandler(async (req, res) => {
  const { requirementId } = parseRequest(
    requirementAnalysisParamsSchema,
    req.params,
  );
  res
    .status(201)
    .json({ data: await service.analyzeRequirement(requirementId, client) });
});
export const listAnalyses: RequestHandler = asyncHandler(async (req, res) => {
  const { requirementId } = parseRequest(
    requirementAnalysisParamsSchema,
    req.params,
  );
  const query = parseRequest(aiHistoryQuerySchema, req.query);
  res
    .status(200)
    .json(
      await service.listAnalyses(requirementId, query.page, query.pageSize),
    );
});
export const getAnalysis: RequestHandler = asyncHandler(async (req, res) => {
  const { requirementId, analysisId } = parseRequest(
    aiAnalysisParamsSchema,
    req.params,
  );
  res
    .status(200)
    .json({ data: await service.getAnalysis(requirementId, analysisId) });
});
