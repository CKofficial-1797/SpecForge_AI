import { Router } from "express";
import { projectRequirementRouter } from "../requirements/requirement.routes.js";
import {
  archiveProject,
  createProject,
  getProject,
  listProjects,
  updateProject,
} from "./project.controller.js";
import { validationProjectRouter } from "../requirement-validation/validation.routes.js";

export const projectRouter = Router();
projectRouter.use("/:projectId/requirements", projectRequirementRouter);
projectRouter.use("/:projectId", validationProjectRouter);
projectRouter.get("/", listProjects);
projectRouter.post("/", createProject);
projectRouter.get("/:projectId", getProject);
projectRouter.patch("/:projectId", updateProject);
projectRouter.patch("/:projectId/archive", archiveProject);
