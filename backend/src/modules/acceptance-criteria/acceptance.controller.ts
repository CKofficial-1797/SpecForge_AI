import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseRequest } from "../../utils/parse-request.js";
import {
  acceptanceRequirementParams,
  criterionParams,
} from "./acceptance.schema.js";
import * as service from "./acceptance.service.js";

export const generateCriteria: RequestHandler = asyncHandler(
  async (req, res) => {
    const { requirementId } = parseRequest(
      acceptanceRequirementParams,
      req.params,
    );
    res
      .status(201)
      .json({ data: await service.generateAcceptanceCriteria(requirementId) });
  },
);
export const listCriteria: RequestHandler = asyncHandler(async (req, res) => {
  const { requirementId } = parseRequest(
    acceptanceRequirementParams,
    req.params,
  );
  res
    .status(200)
    .json({ data: await service.listAcceptanceCriteria(requirementId) });
});
export const getCriterion: RequestHandler = asyncHandler(async (req, res) => {
  const { criterionId } = parseRequest(criterionParams, req.params);
  res
    .status(200)
    .json({ data: await service.getAcceptanceCriterion(criterionId) });
});
export const approveCriterion: RequestHandler = asyncHandler(
  async (req, res) => {
    const { criterionId } = parseRequest(criterionParams, req.params);
    res
      .status(200)
      .json({ data: await service.approveAcceptanceCriterion(criterionId) });
  },
);
export const rejectCriterion: RequestHandler = asyncHandler(
  async (req, res) => {
    const { criterionId } = parseRequest(criterionParams, req.params);
    res
      .status(200)
      .json({ data: await service.rejectAcceptanceCriterion(criterionId) });
  },
);
