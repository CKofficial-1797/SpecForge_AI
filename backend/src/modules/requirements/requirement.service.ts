import type {
  RequirementPriority,
  RequirementStatus,
} from "../../generated/prisma/enums.js";
import { prisma } from "../../config/database.js";
import { ApiError } from "../../utils/api-error.js";
import type {
  CreateRequirementInput,
  ListRequirementsQuery,
  UpdateRequirementInput,
} from "./requirement.schema.js";
import {
  changedMetadataFields,
  changedVersionFields,
} from "./requirement-versioning.js";

export async function createRequirement(
  projectId: string,
  input: CreateRequirementInput,
) {
  return prisma.$transaction(async (tx) => {
    const projects = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Project" WHERE "id" = CAST(${projectId} AS UUID) FOR UPDATE
    `;
    if (projects.length === 0) {
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found");
    }
    const project = await tx.project.findUnique({ where: { id: projectId } });
    if (!project)
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found");
    if (project.status === "ARCHIVED") {
      throw new ApiError(
        409,
        "PROJECT_ARCHIVED",
        "New requirements cannot be added to an archived project",
      );
    }

    return tx.requirement.create({
      data: {
        projectId,
        requirementKey: input.requirementKey,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        versions: {
          create: {
            versionNumber: 1,
            title: input.title,
            description: input.description,
            priority: input.priority,
            changeSummary: "Initial version",
          },
        },
      },
    });
  });
}

export async function listRequirements(
  projectId: string,
  query: ListRequirementsQuery,
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project)
    throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found");

  const where = {
    projectId,
    ...(query.status ? { status: query.status as RequirementStatus } : {}),
    ...(query.priority
      ? { priority: query.priority as RequirementPriority }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [data, total] = await prisma.$transaction([
    prisma.requirement.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip,
      take: query.pageSize,
    }),
    prisma.requirement.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getRequirement(requirementId: string) {
  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
  });
  if (!requirement) {
    throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
  }
  return requirement;
}

export async function updateRequirement(
  requirementId: string,
  input: UpdateRequirementInput,
) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Requirement" WHERE "id" = CAST(${requirementId} AS UUID) FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
    }

    const current = await tx.requirement.findUnique({
      where: { id: requirementId },
    });
    if (!current) {
      throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
    }
    if (current.currentVersion !== input.expectedVersion) {
      throw versionConflict(input.expectedVersion, current.currentVersion);
    }

    const versionChanges = changedVersionFields(current, input);
    const metadataChanges = changedMetadataFields(current, input);
    if (versionChanges.length === 0 && metadataChanges.length === 0) {
      return current;
    }

    const nextTitle = input.title ?? current.title;
    const nextDescription = input.description ?? current.description;
    const nextPriority = input.priority ?? current.priority;
    const nextVersion =
      current.currentVersion + (versionChanges.length > 0 ? 1 : 0);

    await tx.requirement.update({
      where: { id: requirementId },
      data: {
        ...(input.requirementKey === undefined
          ? {}
          : { requirementKey: input.requirementKey }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(versionChanges.includes("title") ? { title: nextTitle } : {}),
        ...(versionChanges.includes("description")
          ? { description: nextDescription }
          : {}),
        ...(versionChanges.includes("priority")
          ? { priority: nextPriority }
          : {}),
        ...(versionChanges.length > 0 ? { currentVersion: nextVersion } : {}),
      },
    });

    if (versionChanges.length > 0) {
      await tx.requirementVersion.create({
        data: {
          requirementId,
          versionNumber: nextVersion,
          title: nextTitle,
          description: nextDescription,
          priority: nextPriority,
          changeSummary: input.changeSummary ?? null,
        },
      });
    }

    return tx.requirement.findUniqueOrThrow({ where: { id: requirementId } });
  });
}

export async function archiveRequirement(requirementId: string) {
  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
  });
  if (!requirement) {
    throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
  }
  if (requirement.status === "ARCHIVED") return requirement;
  return prisma.requirement.update({
    where: { id: requirementId },
    data: { status: "ARCHIVED" },
  });
}

export async function listRequirementVersions(
  requirementId: string,
  page: number,
  pageSize: number,
) {
  await getRequirement(requirementId);
  const skip = (page - 1) * pageSize;
  const where = { requirementId };
  const [data, total] = await prisma.$transaction([
    prisma.requirementVersion.findMany({
      where,
      orderBy: { versionNumber: "asc" },
      skip,
      take: pageSize,
    }),
    prisma.requirementVersion.count({ where }),
  ]);
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getRequirementVersion(
  requirementId: string,
  versionNumber: number,
) {
  await getRequirement(requirementId);
  const version = await prisma.requirementVersion.findUnique({
    where: { requirementId_versionNumber: { requirementId, versionNumber } },
  });
  if (!version) {
    throw new ApiError(
      404,
      "VERSION_NOT_FOUND",
      "Requirement version not found",
    );
  }
  return version;
}

function versionConflict(expectedVersion: number, currentVersion: number) {
  return new ApiError(
    409,
    "VERSION_CONFLICT",
    "This requirement changed after it was opened. Reload it before saving.",
    { expectedVersion, currentVersion },
  );
}
