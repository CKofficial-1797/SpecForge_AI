import { Router } from "express";
import {
  aiHealth,
  getAnalysis,
  listAnalyses,
  runAnalysis,
} from "./ai.controller.js";
export const aiRouter = Router();
aiRouter.get("/health", aiHealth);
export const requirementAiRouter = Router({ mergeParams: true });
requirementAiRouter.post("/analyze", runAnalysis);
requirementAiRouter.get("/ai-analyses", listAnalyses);
requirementAiRouter.get("/ai-analyses/:analysisId", getAnalysis);
