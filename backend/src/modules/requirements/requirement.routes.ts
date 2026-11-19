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

export const projectRequirementRouter = Router({ mergeParams: true });
projectRequirementRouter.get("/", listRequirements);
projectRequirementRouter.post("/", createRequirement);

export const requirementRouter = Router();
requirementRouter.get(
  "/:requirementId/versions/:versionNumber",
  getRequirementVersion,
);
requirementRouter.get("/:requirementId/versions", listRequirementVersions);
requirementRouter.patch("/:requirementId/archive", archiveRequirement);
requirementRouter.get("/:requirementId", getRequirement);
requirementRouter.patch("/:requirementId", updateRequirement);
