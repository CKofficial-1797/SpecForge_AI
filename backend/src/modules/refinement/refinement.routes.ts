import { Router } from "express";
import {
  approveDraft,
  generateDraft,
  getDraft,
  listDrafts,
  rejectDraft,
} from "./refinement.controller.js";
import { aiRateLimit } from "../../middleware/rate-limit.js";

export const requirementRefinementRouter = Router({ mergeParams: true });
requirementRefinementRouter.post(
  "/refinement-drafts",
  aiRateLimit,
  generateDraft,
);
requirementRefinementRouter.get("/refinement-drafts", listDrafts);

export const refinementRouter = Router();
refinementRouter.get("/:draftId", getDraft);
refinementRouter.post("/:draftId/approve", approveDraft);
refinementRouter.post("/:draftId/reject", rejectDraft);
