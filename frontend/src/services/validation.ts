import { apiRequest } from "./api";
import type { Page } from "./projects";

export type FindingCategory =
  | "COMPLETENESS"
  | "CLARITY"
  | "MEASURABILITY"
  | "STRUCTURE"
  | "CONSISTENCY"
  | "DUPLICATION";
export type FindingSeverity = "ERROR" | "WARNING" | "INFO";

export interface ValidationFinding {
  ruleId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: string;
  recommendation: string;
  affectedField?: string;
  relatedRequirements?: {
    requirementId: string;
    requirementKey: string;
    title: string;
  }[];
}

export interface ValidationReportData {
  requirementId: string;
  requirementVersion: number;
  analyzedAt: string;
  ruleSetVersion: string;
  summary: {
    errors: number;
    warnings: number;
    informationalFindings: number;
    passedRules: number;
    rulesWithIssues: number;
    skippedRules: number;
  };
  ruleResults: {
    ruleId: string;
    ruleName: string;
    executionStatus: "PASSED" | "ISSUES_FOUND" | "SKIPPED";
    findings: ValidationFinding[];
    explanation: string;
  }[];
  findings: ValidationFinding[];
  suggestedNextActions: string[];
}

export interface ValidationReportRecord {
  id: string;
  requirementId: string;
  requirementVersion: number;
  ruleSetVersion: string;
  reportData: ValidationReportData;
  createdAt: string;
}

export interface ValidationHistoryItem {
  id: string;
  requirementVersion: number;
  ruleSetVersion: string;
  createdAt: string;
  summary: ValidationReportData["summary"];
}

export interface ProjectValidationSummary {
  projectId: string;
  requirementsTotal: number;
  requirementsAnalyzed: number;
  requirementsWithErrors: number;
  requirementsWithWarnings: number;
  requirementsWithoutFindings: number;
  requirementsNotAnalyzed: number;
}

export async function runValidation(
  requirementId: string,
): Promise<ValidationReportRecord> {
  const response = await apiRequest<{ data: ValidationReportRecord }>(
    `/requirements/${requirementId}/validate`,
    { method: "POST" },
  );
  return response.data;
}

export async function listValidationReports(
  requirementId: string,
  params: { page: number; pageSize: number },
): Promise<Page<ValidationHistoryItem>> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  return apiRequest(
    `/requirements/${requirementId}/validation-reports?${query}`,
  );
}

export async function getValidationReport(
  requirementId: string,
  reportId: string,
): Promise<ValidationReportRecord> {
  const response = await apiRequest<{ data: ValidationReportRecord }>(
    `/requirements/${requirementId}/validation-reports/${reportId}`,
  );
  return response.data;
}

export async function getProjectValidationSummary(
  projectId: string,
): Promise<ProjectValidationSummary> {
  const response = await apiRequest<{ data: ProjectValidationSummary }>(
    `/projects/${projectId}/validation-summary`,
  );
  return response.data;
}
