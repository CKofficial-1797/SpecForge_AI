import { apiRequest } from "./api";
import type { Page } from "./projects";

export interface CoverageValue {
  status: "APPLICABLE" | "NOT_APPLICABLE";
  eligibleCriteria: number;
  coveredCriteria: number;
  uncoveredCriteria: number;
  percentage: number | null;
}
export interface TraceGap {
  code: string;
  requirementId: string;
  requirementKey: string;
  requirementTitle: string;
  requirementVersion: number;
  acceptanceCriterionId?: string;
  acceptanceCriterionTitle?: string;
  testCaseId?: string;
  message: string;
  recommendation: string;
}
export interface TraceSummary {
  projectId: string;
  counts: Record<string, number>;
  coverage: CoverageValue;
  historicalCoverage: CoverageValue;
  pendingApprovals: {
    refinements: number;
    acceptanceCriteria: number;
    testCases: number;
    total: number;
  };
  approvedArtifacts: {
    refinements: number;
    acceptanceCriteria: number;
    testCases: number;
    total: number;
  };
  rejectedArtifacts: {
    refinements: number;
    acceptanceCriteria: number;
    testCases: number;
    total: number;
  };
}
export interface ApprovalOverview {
  projectId: string;
  pending: {
    refinementDrafts: number;
    acceptanceCriteria: number;
    testCases: number;
    total: number;
  };
  approved: {
    refinementDrafts: number;
    acceptanceCriteria: number;
    testCases: number;
    total: number;
  };
  rejected: {
    refinementDrafts: number;
    acceptanceCriteria: number;
    testCases: number;
    total: number;
  };
  stale: {
    refinementDrafts: number;
    acceptanceCriteria: number;
    testCases: number;
  };
  items: Record<
    string,
    Array<{
      id: string;
      requirementId: string;
      requirementKey: string;
      requirementTitle: string;
      title: string;
    }>
  >;
}
export interface TraceRequirementRow {
  requirement: {
    id: string;
    requirementKey: string;
    title: string;
    currentVersion: number;
    status: string;
  };
  coverage: CoverageValue;
  coverageStatus: string;
  counts: Record<string, number>;
  gaps: TraceGap[];
  acceptanceCriteria: Array<{
    id: string;
    title: string;
    sourceRequirementVersion: number;
    status: string;
    traceabilityStatus: string;
    testCases: Array<{
      id: string;
      title: string;
      status: string;
      sourceRequirementVersion: number;
      traceabilityStatus: string;
    }>;
  }>;
}
export async function getTraceSummary(projectId: string) {
  return (
    await apiRequest<{ data: TraceSummary }>(
      `/projects/${projectId}/coverage-summary`,
    )
  ).data;
}
export async function getApprovalOverview(projectId: string) {
  return (
    await apiRequest<{ data: ApprovalOverview }>(
      `/projects/${projectId}/approval-overview`,
    )
  ).data;
}
export async function getTraceability(
  projectId: string,
  page: number,
  pageSize = 20,
) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return apiRequest<{
    data: TraceRequirementRow[];
    pagination: Page<TraceRequirementRow>["pagination"];
  }>(`/projects/${projectId}/traceability?${query}`);
}
export async function getTraceGaps(
  projectId: string,
  page: number,
  pageSize = 20,
) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return apiRequest<{
    data: TraceGap[];
    requirements: Array<{
      requirementId: string;
      requirementKey: string;
      gapCount: number;
    }>;
    pagination: Page<TraceGap>["pagination"];
  }>(`/projects/${projectId}/coverage-gaps?${query}`);
}
