import { Router } from "express";
import {
  approveDraft,
  generateDraft,
  getDraft,
  listDrafts,
  rejectDraft,
} from "./refinement.controller.js";

export const requirementRefinementRouter = Router({ mergeParams: true });
requirementRefinementRouter.post("/refinement-drafts", generateDraft);
requirementRefinementRouter.get("/refinement-drafts", listDrafts);

export const refinementRouter = Router();
refinementRouter.get("/:draftId", getDraft);
refinementRouter.post("/:draftId/approve", approveDraft);
refinementRouter.post("/:draftId/reject", rejectDraft);
