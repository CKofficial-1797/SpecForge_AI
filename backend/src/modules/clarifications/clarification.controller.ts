import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseRequest } from "../../utils/parse-request.js";
import {
  answerBody,
  answerParams,
  clarificationListQuery,
  importQuestionsBody,
  questionParams,
  requirementParams,
} from "./clarification.schema.js";
import * as service from "./clarification.service.js";

export const importQuestions: RequestHandler = asyncHandler(
  async (req, res) => {
    const { requirementId } = parseRequest(requirementParams, req.params);
    const { analysisId } = parseRequest(importQuestionsBody, req.body);
    res.status(200).json({
      data: await service.importAnalysisQuestions(requirementId, analysisId),
    });
  },
);
export const listQuestions: RequestHandler = asyncHandler(async (req, res) => {
  const { requirementId } = parseRequest(requirementParams, req.params);
  const query = parseRequest(clarificationListQuery, req.query);
  res
    .status(200)
    .json({ data: await service.listQuestions(requirementId, query.status) });
});
export const getQuestion: RequestHandler = asyncHandler(async (req, res) => {
  const { questionId } = parseRequest(questionParams, req.params);
  res.status(200).json({ data: await service.getQuestion(questionId) });
});
export const submitAnswer: RequestHandler = asyncHandler(async (req, res) => {
  const { questionId } = parseRequest(questionParams, req.params);
  const { answer } = parseRequest(answerBody, req.body);
  res
    .status(201)
    .json({ data: await service.submitAnswer(questionId, answer) });
});
export const editAnswer: RequestHandler = asyncHandler(async (req, res) => {
  const { questionId, answerId } = parseRequest(answerParams, req.params);
  const { answer } = parseRequest(answerBody, req.body);
  res
    .status(200)
    .json({ data: await service.editAnswer(questionId, answerId, answer) });
});
export const dismissQuestion: RequestHandler = asyncHandler(
  async (req, res) => {
    const { questionId } = parseRequest(questionParams, req.params);
    res.status(200).json({ data: await service.dismissQuestion(questionId) });
  },
);
