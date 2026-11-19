import { apiRequest } from "./api";

export type ProjectStatus = "ACTIVE" | "ARCHIVED";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ProjectInput {
  name: string;
  description?: string | null;
}

export async function listProjects(params: {
  page: number;
  pageSize: number;
  status?: ProjectStatus;
}): Promise<Page<Project>> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    ...(params.status ? { status: params.status } : {}),
  });
  return apiRequest(`/projects?${query}`);
}

export async function getProject(projectId: string): Promise<Project> {
  const response = await apiRequest<{ data: Project }>(
    `/projects/${projectId}`,
  );
  return response.data;
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const response = await apiRequest<{ data: Project }>("/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function updateProject(
  projectId: string,
  input: ProjectInput,
): Promise<Project> {
  const response = await apiRequest<{ data: Project }>(
    `/projects/${projectId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return response.data;
}

export async function archiveProject(projectId: string): Promise<Project> {
  const response = await apiRequest<{ data: Project }>(
    `/projects/${projectId}/archive`,
    { method: "PATCH" },
  );
  return response.data;
}
