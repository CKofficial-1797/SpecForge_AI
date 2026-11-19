import { apiRequest } from "./api";
import type { Page } from "./projects";

export type RequirementPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RequirementStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface Requirement {
  id: string;
  projectId: string;
  requirementKey: string;
  title: string;
  description: string;
  priority: RequirementPriority;
  status: RequirementStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementVersion {
  id: string;
  requirementId: string;
  versionNumber: number;
  title: string;
  description: string;
  priority: RequirementPriority;
  changeSummary: string | null;
  createdAt: string;
}

export interface RequirementInput {
  requirementKey: string;
  title: string;
  description: string;
  priority: RequirementPriority;
  status?: Exclude<RequirementStatus, "ARCHIVED">;
}

export interface RequirementUpdate extends Omit<RequirementInput, "status"> {
  expectedVersion: number;
  status?: RequirementStatus;
  changeSummary?: string | null;
}

export async function listRequirements(
  projectId: string,
  params: {
    page: number;
    pageSize: number;
    status?: RequirementStatus;
    priority?: RequirementPriority;
  },
): Promise<Page<Requirement>> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    ...(params.status ? { status: params.status } : {}),
    ...(params.priority ? { priority: params.priority } : {}),
  });
  return apiRequest(`/projects/${projectId}/requirements?${query}`);
}

export async function createRequirement(
  projectId: string,
  input: RequirementInput,
): Promise<Requirement> {
  const response = await apiRequest<{ data: Requirement }>(
    `/projects/${projectId}/requirements`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return response.data;
}

export async function getRequirement(
  requirementId: string,
): Promise<Requirement> {
  const response = await apiRequest<{ data: Requirement }>(
    `/requirements/${requirementId}`,
  );
  return response.data;
}

export async function updateRequirement(
  requirementId: string,
  input: RequirementUpdate,
): Promise<Requirement> {
  const response = await apiRequest<{ data: Requirement }>(
    `/requirements/${requirementId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return response.data;
}

export async function archiveRequirement(
  requirementId: string,
): Promise<Requirement> {
  const response = await apiRequest<{ data: Requirement }>(
    `/requirements/${requirementId}/archive`,
    { method: "PATCH" },
  );
  return response.data;
}

export async function listRequirementVersions(
  requirementId: string,
): Promise<Page<RequirementVersion>> {
  return apiRequest(
    `/requirements/${requirementId}/versions?page=1&pageSize=100`,
  );
}

export async function getRequirementVersion(
  requirementId: string,
  versionNumber: number,
): Promise<RequirementVersion> {
  const response = await apiRequest<{ data: RequirementVersion }>(
    `/requirements/${requirementId}/versions/${versionNumber}`,
  );
  return response.data;
}
