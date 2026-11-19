import { Router } from "express";
import {
  approveCriterion,
  generateCriteria,
  getCriterion,
  listCriteria,
  rejectCriterion,
} from "./acceptance.controller.js";
import { aiRateLimit } from "../../middleware/rate-limit.js";

export const requirementAcceptanceRouter = Router({ mergeParams: true });
requirementAcceptanceRouter.post(
  "/acceptance-criteria/generate",
  aiRateLimit,
  generateCriteria,
);
requirementAcceptanceRouter.get("/acceptance-criteria", listCriteria);

export const acceptanceRouter = Router();
acceptanceRouter.get("/:criterionId", getCriterion);
acceptanceRouter.post("/:criterionId/approve", approveCriterion);
acceptanceRouter.post("/:criterionId/reject", rejectCriterion);
