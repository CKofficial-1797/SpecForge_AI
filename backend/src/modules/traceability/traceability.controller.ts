import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseRequest } from "../../utils/parse-request.js";
import * as service from "./traceability.service.js";
import {
  acceptanceTraceabilityParams,
  projectTraceabilityParams,
  requirementTraceabilityParams,
  testCaseTraceabilityParams,
  traceabilityPageQuery,
} from "./traceability.schema.js";

export const projectMatrix: RequestHandler = asyncHandler(async (req, res) => {
  const params = parseRequest(projectTraceabilityParams, req.params);
  const query = parseRequest(traceabilityPageQuery, req.query);
  res
    .status(200)
    .json(await service.getProjectTraceability(params.projectId, query));
});
export const coverageSummary: RequestHandler = asyncHandler(
  async (req, res) => {
    const { projectId } = parseRequest(projectTraceabilityParams, req.params);
    res
      .status(200)
      .json({ data: await service.getProjectCoverageSummary(projectId) });
  },
);
export const coverageGaps: RequestHandler = asyncHandler(async (req, res) => {
  const params = parseRequest(projectTraceabilityParams, req.params);
  const query = parseRequest(traceabilityPageQuery, req.query);
  res
    .status(200)
    .json(await service.getProjectCoverageGaps(params.projectId, query));
});
export const approvalOverview: RequestHandler = asyncHandler(
  async (req, res) => {
    const { projectId } = parseRequest(projectTraceabilityParams, req.params);
    res
      .status(200)
      .json({ data: await service.getProjectApprovalOverview(projectId) });
  },
);
export const requirementTrace: RequestHandler = asyncHandler(
  async (req, res) => {
    const { requirementId } = parseRequest(
      requirementTraceabilityParams,
      req.params,
    );
    res
      .status(200)
      .json({ data: await service.getRequirementTraceability(requirementId) });
  },
);
export const criterionTrace: RequestHandler = asyncHandler(async (req, res) => {
  const { criterionId } = parseRequest(
    acceptanceTraceabilityParams,
    req.params,
  );
  res.status(200).json({
    data: await service.getAcceptanceCriterionTraceability(criterionId),
  });
});
export const testCaseTrace: RequestHandler = asyncHandler(async (req, res) => {
  const { testCaseId } = parseRequest(testCaseTraceabilityParams, req.params);
  res
    .status(200)
    .json({ data: await service.getTestCaseTraceability(testCaseId) });
});
