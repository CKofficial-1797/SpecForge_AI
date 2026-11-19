import { Router } from "express";
import {
  approve,
  detail,
  generate,
  history,
  list,
  reject,
  revisions,
  update,
  validate,
} from "./test-cases.controller.js";
import { aiRateLimit } from "../../middleware/rate-limit.js";

export const requirementTestCasesRouter = Router({ mergeParams: true });
requirementTestCasesRouter.post("/test-cases/generate", aiRateLimit, generate);
requirementTestCasesRouter.get("/test-cases", list);
requirementTestCasesRouter.get("/test-generation-runs", history);

export const testCaseRouter = Router();
testCaseRouter.get("/:testCaseId/revisions", revisions);
testCaseRouter.post("/:testCaseId/validate", validate);
testCaseRouter.post("/:testCaseId/approve", approve);
testCaseRouter.post("/:testCaseId/reject", reject);
testCaseRouter.get("/:testCaseId", detail);
testCaseRouter.patch("/:testCaseId", update);
