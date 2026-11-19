import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseRequest } from "../../utils/parse-request.js";
import {
  createRequirementSchema,
  listRequirementsQuerySchema,
  projectIdParamsSchema,
  requirementIdParamsSchema,
  updateRequirementSchema,
  versionParamsSchema,
} from "./requirement.schema.js";
import * as requirementService from "./requirement.service.js";

export const createRequirement: RequestHandler = asyncHandler(
  async (req, res) => {
    const { projectId } = parseRequest(projectIdParamsSchema, req.params);
    const input = parseRequest(createRequirementSchema, req.body);
    const requirement = await requirementService.createRequirement(
      projectId,
      input,
    );
    res.status(201).json({ data: requirement });
  },
);

export const listRequirements: RequestHandler = asyncHandler(
  async (req, res) => {
    const { projectId } = parseRequest(projectIdParamsSchema, req.params);
    const query = parseRequest(listRequirementsQuerySchema, req.query);
    res
      .status(200)
      .json(await requirementService.listRequirements(projectId, query));
  },
);

export const getRequirement: RequestHandler = asyncHandler(async (req, res) => {
  const { requirementId } = parseRequest(requirementIdParamsSchema, req.params);
  const requirement = await requirementService.getRequirement(requirementId);
  res.status(200).json({ data: requirement });
});

export const updateRequirement: RequestHandler = asyncHandler(
  async (req, res) => {
    const { requirementId } = parseRequest(
      requirementIdParamsSchema,
      req.params,
    );
    const input = parseRequest(updateRequirementSchema, req.body);
    const requirement = await requirementService.updateRequirement(
      requirementId,
      input,
    );
    res.status(200).json({ data: requirement });
  },
);

export const archiveRequirement: RequestHandler = asyncHandler(
  async (req, res) => {
    const { requirementId } = parseRequest(
      requirementIdParamsSchema,
      req.params,
    );
    const requirement =
      await requirementService.archiveRequirement(requirementId);
    res.status(200).json({ data: requirement });
  },
);

export const listRequirementVersions: RequestHandler = asyncHandler(
  async (req, res) => {
    const { requirementId } = parseRequest(
      requirementIdParamsSchema,
      req.params,
    );
    const query = parseRequest(
      listRequirementsQuerySchema.pick({ page: true, pageSize: true }),
      req.query,
    );
    const versions = await requirementService.listRequirementVersions(
      requirementId,
      query.page,
      query.pageSize,
    );
    res.status(200).json(versions);
  },
);

export const getRequirementVersion: RequestHandler = asyncHandler(
  async (req, res) => {
    const { requirementId, versionNumber } = parseRequest(
      versionParamsSchema,
      req.params,
    );
    const version = await requirementService.getRequirementVersion(
      requirementId,
      versionNumber,
    );
    res.status(200).json({ data: version });
  },
);
