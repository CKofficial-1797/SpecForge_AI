import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as aiApi from "../services/ai";
import * as workflowApi from "../services/refinement";
import { RefinementWorkflow } from "./RefinementWorkflow";

const question: workflowApi.ClarificationQuestion = {
  id: "question-1",
  requirementId: "requirement-1",
  sourceAnalysisId: "analysis-1",
  question: "Should inactive users sign in?",
  reason: "The behavior is not stated.",
  relatedRequirementIds: [],
  status: "OPEN",
  answers: [],
  sourceAnalysis: { requirementVersion: 1 },
};
function renderWorkflow() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RefinementWorkflow requirementId="requirement-1" currentVersion={1} />
    </QueryClientProvider>,
  );
}
describe("clarification and refinement workflow UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(aiApi, "getAiHealth").mockResolvedValue({
      enabled: false,
      available: false,
      modelAvailable: false,
      model: null,
    });
    vi.spyOn(aiApi, "listAiAnalyses").mockResolvedValue({
      data: [
        {
          id: "analysis-1",
          requirementVersion: 1,
          modelName: null,
          promptVersion: "1.0.0",
          status: "SUCCEEDED",
          outputData: null,
          errorCode: null,
          createdAt: "2026-11-20T00:00:00.000Z",
          durationMs: null,
        },
      ],
    });
    vi.spyOn(workflowApi, "listClarifications").mockResolvedValue([question]);
    vi.spyOn(workflowApi, "listRefinementDrafts").mockResolvedValue([]);
    vi.spyOn(workflowApi, "listAcceptanceCriteria").mockResolvedValue([]);
  });
  it("keeps answer submission available when optional AI is down", async () => {
    const submit = vi
      .spyOn(workflowApi, "submitClarificationAnswer")
      .mockResolvedValue({
        id: "answer-1",
        answer: "No, inactive users cannot sign in.",
        revisionNumber: 1,
        isCurrent: true,
        answeredAt: "2026-11-20T00:00:00.000Z",
      });
    renderWorkflow();
    const answer = await screen.findByRole("textbox", {
      name: "Answer: Should inactive users sign in?",
    });
    fireEvent.change(answer, {
      target: { value: "No, inactive users cannot sign in." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        "question-1",
        "No, inactive users cannot sign in.",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Generate criteria" }),
    ).toBeDisabled();
  });
  it("shows dismissed questions as unresolved and prevents approval of unresolved criteria", async () => {
    vi.spyOn(workflowApi, "listClarifications").mockResolvedValue([
      { ...question, status: "DISMISSED" },
    ]);
    vi.spyOn(workflowApi, "listAcceptanceCriteria").mockResolvedValue([
      {
        id: "criterion-1",
        requirementId: "requirement-1",
        sourceRequirementVersion: 1,
        title: "Account sign in",
        given: "An account exists.",
        when: "A user signs in.",
        then: "The user is authenticated.",
        isResolved: false,
        notes: ["Account status is unspecified."],
        status: "DRAFT",
        isHistorical: false,
      },
    ]);
    renderWorkflow();
    expect(
      await screen.findByText(/Dismissed questions are still unresolved/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve criterion" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Account status is unspecified/),
    ).toBeInTheDocument();
  });
});
