import { apiRequest } from "./api";
export interface AiFinding {
  basis: "EXPLICIT" | "MISSING" | "INFERENCE" | "UNCERTAINTY";
  category: string;
  severity: string;
  title: string;
  description: string;
  evidence: string;
  recommendation: string;
  affectedRequirementIds: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
}
export interface AiOutput {
  summary: string;
  findings: AiFinding[];
  clarificationQuestions: Array<{
    question: string;
    reason: string;
    relatedRequirementIds: string[];
  }>;
  limitations: string[];
}
export interface AiAnalysis {
  id: string;
  requirementVersion: number;
  modelName: string | null;
  promptVersion: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "UNAVAILABLE";
  outputData: AiOutput | null;
  errorCode: string | null;
  createdAt: string;
  durationMs: number | null;
}
export interface AiHealth {
  enabled: boolean;
  available: boolean;
  modelAvailable: boolean;
  model: string | null;
}
export async function getAiHealth(): Promise<AiHealth> {
  return (await apiRequest<{ data: AiHealth }>("/ai/health")).data;
}
export async function analyzeRequirement(
  id: string,
): Promise<{ analysis: AiAnalysis; deterministicReport: unknown }> {
  return (
    await apiRequest<{
      data: { analysis: AiAnalysis; deterministicReport: unknown };
    }>(`/requirements/${id}/analyze`, {
      method: "POST",
    })
  ).data;
}
export async function listAiAnalyses(
  id: string,
): Promise<{ data: AiAnalysis[] }> {
  return apiRequest(`/requirements/${id}/ai-analyses?page=1&pageSize=50`);
}
