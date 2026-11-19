import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseRequest } from "../../utils/parse-request.js";
import {
  validationHistoryQuerySchema,
  validationProjectParamsSchema,
  validationReportParamsSchema,
  validationRequirementParamsSchema,
} from "./validation.schema.js";
import * as validationService from "./services/requirement-validation.service.js";

export const validateRequirement: RequestHandler = asyncHandler(
  async (req, res) => {
    const { requirementId } = parseRequest(
      validationRequirementParamsSchema,
      req.params,
    );
    const report = await validationService.validateRequirement(requirementId);
    res.status(201).json({ data: report });
  },
);

export const listValidationReports: RequestHandler = asyncHandler(
  async (req, res) => {
    const { requirementId } = parseRequest(
      validationRequirementParamsSchema,
      req.params,
    );
    const query = parseRequest(validationHistoryQuerySchema, req.query);
    res
      .status(200)
      .json(
        await validationService.listValidationReports(
          requirementId,
          query.page,
          query.pageSize,
        ),
      );
  },
);

export const getValidationReport: RequestHandler = asyncHandler(
  async (req, res) => {
    const { requirementId, reportId } = parseRequest(
      validationReportParamsSchema,
      req.params,
    );
    const report = await validationService.getValidationReport(
      requirementId,
      reportId,
    );
    res.status(200).json({ data: report });
  },
);

export const getProjectValidationSummary: RequestHandler = asyncHandler(
  async (req, res) => {
    const { projectId } = parseRequest(
      validationProjectParamsSchema,
      req.params,
    );
    const summary =
      await validationService.getProjectValidationSummary(projectId);
    res.status(200).json({ data: summary });
  },
);
