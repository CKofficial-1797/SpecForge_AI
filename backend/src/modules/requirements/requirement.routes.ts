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

export const projectRequirementRouter = Router({ mergeParams: true });
projectRequirementRouter.get("/", listRequirements);
projectRequirementRouter.post("/", createRequirement);

export const requirementRouter = Router();
requirementRouter.use("/:requirementId", validationRequirementRouter);
requirementRouter.use("/:requirementId", requirementAiRouter);
requirementRouter.get(
  "/:requirementId/versions/:versionNumber",
  getRequirementVersion,
);
requirementRouter.get("/:requirementId/versions", listRequirementVersions);
requirementRouter.patch("/:requirementId/archive", archiveRequirement);
requirementRouter.get("/:requirementId", getRequirement);
requirementRouter.patch("/:requirementId", updateRequirement);
