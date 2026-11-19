import { Router } from "express";
import {
  dismissQuestion,
  editAnswer,
  getQuestion,
  importQuestions,
  listQuestions,
  submitAnswer,
} from "./clarification.controller.js";

export const requirementClarificationRouter = Router({ mergeParams: true });
requirementClarificationRouter.post("/clarifications/import", importQuestions);
requirementClarificationRouter.get("/clarifications", listQuestions);

export const clarificationRouter = Router();
clarificationRouter.get("/:questionId", getQuestion);
clarificationRouter.post("/:questionId/answers", submitAnswer);
clarificationRouter.patch("/:questionId/answers/:answerId", editAnswer);
clarificationRouter.patch("/:questionId/dismiss", dismissQuestion);
