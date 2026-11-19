import { Router } from "express";
import {
  archiveRequirement,
  createRequirement,
  getRequirement,
  getRequirementVersion,
  listRequirementVersions,
  listRequirements,
  updateRequirement,
} from "./requirement.controller.js";
import { validationRequirementRouter } from "../requirement-validation/validation.routes.js";
import { requirementAiRouter } from "../ai/ai.routes.js";
import { requirementClarificationRouter } from "../clarifications/clarification.routes.js";
import { requirementAcceptanceRouter } from "../acceptance-criteria/acceptance.routes.js";
import { requirementRefinementRouter } from "../refinement/refinement.routes.js";
import { requirementTestCasesRouter } from "../test-cases/test-cases.routes.js";
import { requirementTraceabilityRouter } from "../traceability/traceability.routes.js";

export const projectRequirementRouter = Router({ mergeParams: true });
projectRequirementRouter.get("/", listRequirements);
projectRequirementRouter.post("/", createRequirement);

export const requirementRouter = Router();
requirementRouter.use("/:requirementId", validationRequirementRouter);
requirementRouter.use("/:requirementId", requirementAiRouter);
requirementRouter.use("/:requirementId", requirementClarificationRouter);
requirementRouter.use("/:requirementId", requirementAcceptanceRouter);
requirementRouter.use("/:requirementId", requirementRefinementRouter);
requirementRouter.use("/:requirementId", requirementTestCasesRouter);
requirementRouter.use("/:requirementId", requirementTraceabilityRouter);
requirementRouter.get(
  "/:requirementId/versions/:versionNumber",
  getRequirementVersion,
);
requirementRouter.get("/:requirementId/versions", listRequirementVersions);
requirementRouter.patch("/:requirementId/archive", archiveRequirement);
requirementRouter.get("/:requirementId", getRequirement);
requirementRouter.patch("/:requirementId", updateRequirement);
