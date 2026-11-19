import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseRequest } from "../../utils/parse-request.js";
import {
  generateRefinementBody,
  refinementDraftParams,
  refinementParams,
} from "./refinement.schema.js";
import * as service from "./refinement.service.js";

export const generateDraft: RequestHandler = asyncHandler(async (req, res) => {
  const { requirementId } = parseRequest(refinementParams, req.params);
  const { sourceAnalysisId } = parseRequest(generateRefinementBody, req.body);
  res.status(201).json({
    data: await service.createRefinementDraft(requirementId, sourceAnalysisId),
  });
});
export const listDrafts: RequestHandler = asyncHandler(async (req, res) => {
  const { requirementId } = parseRequest(refinementParams, req.params);
  res
    .status(200)
    .json({ data: await service.listRefinementDrafts(requirementId) });
});
export const getDraft: RequestHandler = asyncHandler(async (req, res) => {
  const { draftId } = parseRequest(refinementDraftParams, req.params);
  res.status(200).json({ data: await service.getRefinementDraft(draftId) });
});
export const approveDraft: RequestHandler = asyncHandler(async (req, res) => {
  const { draftId } = parseRequest(refinementDraftParams, req.params);
  res.status(200).json({ data: await service.approveRefinementDraft(draftId) });
});
export const rejectDraft: RequestHandler = asyncHandler(async (req, res) => {
  const { draftId } = parseRequest(refinementDraftParams, req.params);
  res.status(200).json({ data: await service.rejectRefinementDraft(draftId) });
});
