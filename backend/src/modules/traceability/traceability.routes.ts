import { Router } from "express";
import * as controller from "./traceability.controller.js";

export const traceabilityProjectRouter = Router({ mergeParams: true });
traceabilityProjectRouter.get("/traceability", controller.projectMatrix);
traceabilityProjectRouter.get("/coverage-summary", controller.coverageSummary);
traceabilityProjectRouter.get("/coverage-gaps", controller.coverageGaps);
traceabilityProjectRouter.get(
  "/approval-overview",
  controller.approvalOverview,
);

export const requirementTraceabilityRouter = Router({ mergeParams: true });
requirementTraceabilityRouter.get("/traceability", controller.requirementTrace);

export const acceptanceTraceabilityRouter = Router();
acceptanceTraceabilityRouter.get(
  "/:criterionId/traceability",
  controller.criterionTrace,
);

export const testCaseTraceabilityRouter = Router();
testCaseTraceabilityRouter.get(
  "/:testCaseId/traceability",
  controller.testCaseTrace,
);
