import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as aiApi from "../services/ai";
import * as testApi from "../services/testCases";
import * as refinementApi from "../services/refinement";
import { TestCaseWorkflow } from "./TestCaseWorkflow";

const criterion = {
  id: "criterion-1",
  requirementId: "requirement-1",
  sourceRequirementVersion: 1,
  title: "User sees profile",
  given: "An active user exists",
  when: "The user signs in",
  then: "The user's profile is shown",
  isResolved: true,
  notes: [],
  status: "APPROVED" as const,
  isHistorical: false,
};
const testCase: testApi.TestCaseRecord = {
  id: "case-1",
  requirementId: "requirement-1",
  acceptanceCriterionId: criterion.id,
  generationRunId: "run-1",
  sourceRequirementVersion: 1,
  revisionNumber: 1,
  title: "Active user sees profile",
  description: "Verify profile after sign-in.",
  testType: "POSITIVE",
  preconditions: ["An active user exists"],
  testSteps: ["Submit sign-in form"],
  testData: [],
  expectedResult: "The user's profile is shown",
  priority: "HIGH",
  status: "DRAFT",
  isHistorical: false,
  acceptanceCriterion: criterion,
  generationRun: {
    id: "run-1",
    modelName: "fixture-model",
    promptVersion: "1.0.0",
    createdAt: "2026-11-21T00:00:00.000Z",
  },
};
function renderWorkflow() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TestCaseWorkflow requirementId="requirement-1" currentVersion={1} />
    </QueryClientProvider>,
  );
}
describe("test case workflow UI", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(aiApi, "getAiHealth").mockResolvedValue({
      enabled: true,
      available: true,
      modelAvailable: true,
      model: "fixture-model",
      provider: "ollama",
      modelAvailabilityKnown: true,
    });
    vi.spyOn(testApi, "listTestCases").mockResolvedValue([testCase]);
    vi.spyOn(testApi, "listTestGenerationRuns").mockResolvedValue([]);
    vi.spyOn(refinementApi, "listAcceptanceCriteria").mockResolvedValue([
      criterion,
    ]);
  });
  it("shows test traceability and allows approval only after deterministic validation", async () => {
    const validate = vi.spyOn(testApi, "validateTestCase").mockResolvedValue({
      testCaseId: "case-1",
      sourceRequirementVersion: 1,
      findings: [
        {
          code: "EXPECTED_RESULT_NEEDS_REVIEW",
          severity: "WARNING",
          message: "Check expected result grounding",
        },
      ],
      canApprove: true,
    });
    const approve = vi
      .spyOn(testApi, "approveTestCase")
      .mockResolvedValue({ ...testCase, status: "APPROVED" });
    renderWorkflow();
    expect(
      (await screen.findAllByText("User sees profile")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/source requirement v1/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve test case" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Validate draft" }));
    await waitFor(() => expect(validate).toHaveBeenCalledWith("case-1"));
    expect(
      await screen.findByText(/Check expected result grounding/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve test case" }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith("case-1"));
  });
  it("shows an explicit unavailable state and disables generation", async () => {
    vi.spyOn(aiApi, "getAiHealth").mockResolvedValue({
      enabled: false,
      available: false,
      modelAvailable: false,
      model: null,
      provider: "ollama",
      modelAvailabilityKnown: true,
    });
    renderWorkflow();
    expect(
      await screen.findByText(
        /Live generation needs a configured AI provider and model/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate test cases" }),
    ).toBeDisabled();
  });
  it("allows explicit rejection of a generated draft", async () => {
    const reject = vi
      .spyOn(testApi, "rejectTestCase")
      .mockResolvedValue({ ...testCase, status: "REJECTED" });
    renderWorkflow();
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    await waitFor(() => expect(reject).toHaveBeenCalledWith("case-1"));
  });
  it("exposes an analyzing state while generation is in progress", async () => {
    let finish!: (value: {
      run: testApi.TestGenerationRun;
      testCases: testApi.TestCaseRecord[];
    }) => void;
    vi.spyOn(testApi, "generateTestCases").mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderWorkflow();
    const button = await screen.findByRole("button", {
      name: "Generate test cases",
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(
      await screen.findByRole("button", { name: "Generating…" }),
    ).toBeInTheDocument();
    finish({
      run: {
        id: "run-1",
        sourceRequirementVersion: 1,
        sourceAcceptanceCriterionIds: [criterion.id],
        modelName: "fixture-model",
        promptVersion: "1.0.0",
        status: "SUCCEEDED",
        limitations: [],
        errorCode: null,
        createdAt: "2026-11-21T00:00:00.000Z",
        _count: { testCases: 1 },
      },
      testCases: [testCase],
    });
  });
});
