import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseRequest } from "../../utils/parse-request.js";
import {
  createProjectSchema,
  listProjectsQuerySchema,
  projectIdParamsSchema,
  updateProjectSchema,
} from "./project.schema.js";
import * as projectService from "./project.service.js";

export const createProject: RequestHandler = asyncHandler(async (req, res) => {
  const input = parseRequest(createProjectSchema, req.body);
  const project = await projectService.createProject(input);
  res.status(201).json({ data: project });
});

export const listProjects: RequestHandler = asyncHandler(async (req, res) => {
  const query = parseRequest(listProjectsQuerySchema, req.query);
  res.status(200).json(await projectService.listProjects(query));
});

export const getProject: RequestHandler = asyncHandler(async (req, res) => {
  const { projectId } = parseRequest(projectIdParamsSchema, req.params);
  const project = await projectService.getProject(projectId);
  res.status(200).json({ data: project });
});

export const updateProject: RequestHandler = asyncHandler(async (req, res) => {
  const { projectId } = parseRequest(projectIdParamsSchema, req.params);
  const input = parseRequest(updateProjectSchema, req.body);
  const project = await projectService.updateProject(projectId, input);
  res.status(200).json({ data: project });
});

export const archiveProject: RequestHandler = asyncHandler(async (req, res) => {
  const { projectId } = parseRequest(projectIdParamsSchema, req.params);
  const project = await projectService.archiveProject(projectId);
  res.status(200).json({ data: project });
});
