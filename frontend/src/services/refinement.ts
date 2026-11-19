import { apiRequest } from "./api";
import type { AiAnalysis } from "./ai";

export interface ClarificationAnswer {
  id: string;
  answer: string;
  revisionNumber: number;
  isCurrent: boolean;
  answeredAt: string;
}
export interface ClarificationQuestion {
  id: string;
  requirementId: string;
  sourceAnalysisId: string;
  question: string;
  reason: string;
  relatedRequirementIds: string[];
  status: "OPEN" | "ANSWERED" | "DISMISSED";
  answers: ClarificationAnswer[];
  sourceAnalysis?: { requirementVersion: number };
}
export interface RefinementOutput {
  proposedTitle: string;
  proposedDescription: string;
  changeSummary: string;
  appliedClarifications: Array<{
    questionId: string;
    answerId: string;
    changeExplanation: string;
  }>;
  remainingAmbiguities: string[];
  unresolvedQuestions: string[];
  assumptions: string[];
  warnings: string[];
}
export interface RefinementDraft {
  id: string;
  requirementId: string;
  baseRequirementVersion: number;
  sourceAnalysisId: string;
  proposedTitle: string;
  proposedDescription: string;
  changeSummary: string;
  structuredOutput: RefinementOutput;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SUPERSEDED";
  isStale: boolean;
  baseVersion?: {
    title: string;
    description: string;
    priority: string;
    versionNumber: number;
  };
}
export interface AcceptanceCriterion {
  id: string;
  requirementId: string;
  sourceRequirementVersion: number;
  title: string;
  given: string;
  when: string;
  then: string;
  isResolved: boolean;
  notes: string[];
  status: "DRAFT" | "APPROVED" | "REJECTED" | "SUPERSEDED";
  isHistorical: boolean;
}
const data = <T>(path: string, init?: RequestInit) =>
  apiRequest<{ data: T }>(path, init).then((response) => response.data);
export const listClarifications = (id: string) =>
  data<ClarificationQuestion[]>(`/requirements/${id}/clarifications`);
export const importClarifications = (id: string, analysisId: string) =>
  data<ClarificationQuestion[]>(`/requirements/${id}/clarifications/import`, {
    method: "POST",
    body: JSON.stringify({ analysisId }),
  });
export const submitClarificationAnswer = (id: string, answer: string) =>
  data<ClarificationAnswer>(`/clarifications/${id}/answers`, {
    method: "POST",
    body: JSON.stringify({ answer }),
  });
export const editClarificationAnswer = (
  id: string,
  answerId: string,
  answer: string,
) =>
  data<ClarificationAnswer>(`/clarifications/${id}/answers/${answerId}`, {
    method: "PATCH",
    body: JSON.stringify({ answer }),
  });
export const dismissClarification = (id: string) =>
  data<ClarificationQuestion>(`/clarifications/${id}/dismiss`, {
    method: "PATCH",
  });
export const listRefinementDrafts = (id: string) =>
  data<RefinementDraft[]>(`/requirements/${id}/refinement-drafts`);
export const generateRefinement = (id: string, sourceAnalysisId: string) =>
  data<RefinementDraft>(`/requirements/${id}/refinement-drafts`, {
    method: "POST",
    body: JSON.stringify({ sourceAnalysisId }),
  });
export const approveRefinement = (id: string) =>
  data<RefinementDraft>(`/refinement-drafts/${id}/approve`, { method: "POST" });
export const rejectRefinement = (id: string) =>
  data<RefinementDraft>(`/refinement-drafts/${id}/reject`, { method: "POST" });
export const listAcceptanceCriteria = (id: string) =>
  data<AcceptanceCriterion[]>(`/requirements/${id}/acceptance-criteria`);
export const generateAcceptanceCriteria = (id: string) =>
  data<AcceptanceCriterion[]>(
    `/requirements/${id}/acceptance-criteria/generate`,
    { method: "POST" },
  );
export const approveCriterion = (id: string) =>
  data<AcceptanceCriterion>(`/acceptance-criteria/${id}/approve`, {
    method: "POST",
  });
export const rejectCriterion = (id: string) =>
  data<AcceptanceCriterion>(`/acceptance-criteria/${id}/reject`, {
    method: "POST",
  });
export type { AiAnalysis };
