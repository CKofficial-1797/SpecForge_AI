import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseRequest } from "../../utils/parse-request.js";
import {
  emptyBody,
  requirementParams,
  testCaseParams,
} from "./test-cases.schema.js";
import * as service from "./test-cases.service.js";

export const generate: RequestHandler = asyncHandler(async (req, res) => {
  const { requirementId } = parseRequest(requirementParams, req.params);
  parseRequest(emptyBody, req.body);
  res
    .status(201)
    .json({ data: await service.generateTestCases(requirementId) });
});
export const list: RequestHandler = asyncHandler(async (req, res) => {
  const { requirementId } = parseRequest(requirementParams, req.params);
  res.status(200).json({ data: await service.listTestCases(requirementId) });
});
export const history: RequestHandler = asyncHandler(async (req, res) => {
  const { requirementId } = parseRequest(requirementParams, req.params);
  res
    .status(200)
    .json({ data: await service.listGenerationRuns(requirementId) });
});
export const detail: RequestHandler = asyncHandler(async (req, res) => {
  const { testCaseId } = parseRequest(testCaseParams, req.params);
  res.status(200).json({ data: await service.getTestCase(testCaseId) });
});
export const update: RequestHandler = asyncHandler(async (req, res) => {
  const { testCaseId } = parseRequest(testCaseParams, req.params);
  res
    .status(200)
    .json({ data: await service.updateDraftTestCase(testCaseId, req.body) });
});
export const validate: RequestHandler = asyncHandler(async (req, res) => {
  const { testCaseId } = parseRequest(testCaseParams, req.params);
  parseRequest(emptyBody, req.body);
  res
    .status(200)
    .json({ data: await service.validateSavedTestCase(testCaseId) });
});
export const approve: RequestHandler = asyncHandler(async (req, res) => {
  const { testCaseId } = parseRequest(testCaseParams, req.params);
  parseRequest(emptyBody, req.body);
  res
    .status(200)
    .json({ data: await service.transitionTestCase(testCaseId, "APPROVED") });
});
export const reject: RequestHandler = asyncHandler(async (req, res) => {
  const { testCaseId } = parseRequest(testCaseParams, req.params);
  parseRequest(emptyBody, req.body);
  res
    .status(200)
    .json({ data: await service.transitionTestCase(testCaseId, "REJECTED") });
});
export const revisions: RequestHandler = asyncHandler(async (req, res) => {
  const { testCaseId } = parseRequest(testCaseParams, req.params);
  res
    .status(200)
    .json({ data: await service.getTestCaseRevisions(testCaseId) });
});
