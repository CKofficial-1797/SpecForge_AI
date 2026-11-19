import { apiRequest } from "./api";
import type { AcceptanceCriterion } from "./refinement";

export type TestType =
  | "POSITIVE"
  | "NEGATIVE"
  | "BOUNDARY"
  | "VALIDATION"
  | "FAILURE"
  | "AUTHORIZATION"
  | "RECOVERY";
export type TestPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TestStatus = "DRAFT" | "APPROVED" | "REJECTED" | "SUPERSEDED";
export interface TestCaseFinding {
  code: string;
  severity: "ERROR" | "WARNING" | "INFO";
  message: string;
  field?: string;
}
export interface TestCaseRecord {
  id: string;
  requirementId: string;
  acceptanceCriterionId: string;
  generationRunId: string;
  sourceRequirementVersion: number;
  revisionNumber: number;
  title: string;
  description: string;
  testType: TestType;
  preconditions: string[];
  testSteps: string[];
  testData: Array<{ name: string; value: string }>;
  expectedResult: string;
  priority: TestPriority;
  status: TestStatus;
  isHistorical: boolean;
  acceptanceCriterion: AcceptanceCriterion;
  generationRun?: {
    id: string;
    modelName: string | null;
    promptVersion: string;
    createdAt: string;
  };
}
export interface TestGenerationRun {
  id: string;
  sourceRequirementVersion: number;
  sourceAcceptanceCriterionIds: string[];
  modelName: string | null;
  promptVersion: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "UNAVAILABLE";
  limitations: string[];
  errorCode: string | null;
  createdAt: string;
  _count: { testCases: number };
}
const data = <T>(path: string, init?: RequestInit) =>
  apiRequest<{ data: T }>(path, init).then((response) => response.data);
export const listTestCases = (id: string) =>
  data<TestCaseRecord[]>(`/requirements/${id}/test-cases`);
export const listTestGenerationRuns = (id: string) =>
  data<TestGenerationRun[]>(`/requirements/${id}/test-generation-runs`);
export const generateTestCases = (id: string) =>
  data<{ run: TestGenerationRun; testCases: TestCaseRecord[] }>(
    `/requirements/${id}/test-cases/generate`,
    { method: "POST" },
  );
export const validateTestCase = (id: string) =>
  data<{
    testCaseId: string;
    sourceRequirementVersion: number;
    findings: TestCaseFinding[];
    canApprove: boolean;
  }>(`/test-cases/${id}/validate`, { method: "POST" });
export const updateTestCase = (
  id: string,
  input: Partial<
    Pick<
      TestCaseRecord,
      "title" | "description" | "expectedResult" | "priority"
    >
  >,
) =>
  data<TestCaseRecord>(`/test-cases/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
export const approveTestCase = (id: string) =>
  data<TestCaseRecord>(`/test-cases/${id}/approve`, { method: "POST" });
export const rejectTestCase = (id: string) =>
  data<TestCaseRecord>(`/test-cases/${id}/reject`, { method: "POST" });
