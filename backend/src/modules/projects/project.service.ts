import type { ProjectStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../../config/database.js";
import { ApiError } from "../../utils/api-error.js";
import type {
  CreateProjectInput,
  ListProjectsQuery,
  UpdateProjectInput,
} from "./project.schema.js";

export async function createProject(input: CreateProjectInput) {
  return prisma.project.create({
    data: {
      name: input.name,
      description: input.description ?? null,
    },
  });
}

export async function listProjects(query: ListProjectsQuery) {
  const where = query.status ? { status: query.status as ProjectStatus } : {};
  const skip = (query.page - 1) * query.pageSize;
  const [data, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip,
      take: query.pageSize,
    }),
    prisma.project.count({ where }),
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

export async function getProject(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project)
    throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found");
  return project;
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
) {
  try {
    return await prisma.project.update({
      where: { id: projectId },
      data: input,
    });
  } catch (error) {
    if (isRecord(error) && error.code === "P2025") {
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found");
    }
    throw error;
  }
}

export async function archiveProject(projectId: string) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Project" WHERE "id" = CAST(${projectId} AS UUID) FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found");
    }
    const project = await tx.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found");
    }
    if (project.status === "ARCHIVED") return project;
    return tx.project.update({
      where: { id: projectId },
      data: { status: "ARCHIVED" },
    });
  });
}

function isRecord(value: unknown): value is { code?: unknown } {
  return typeof value === "object" && value !== null && "code" in value;
}
