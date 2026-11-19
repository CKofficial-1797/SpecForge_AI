import { Router } from "express";
import {
  getProjectValidationSummary,
  getValidationReport,
  listValidationReports,
  validateRequirement,
} from "./validation.controller.js";

export const validationProjectRouter = Router({ mergeParams: true });
validationProjectRouter.get("/validation-summary", getProjectValidationSummary);

export const validationRequirementRouter = Router({ mergeParams: true });
validationRequirementRouter.post("/validate", validateRequirement);
validationRequirementRouter.get("/validation-reports", listValidationReports);
validationRequirementRouter.get(
  "/validation-reports/:reportId",
  getValidationReport,
);
