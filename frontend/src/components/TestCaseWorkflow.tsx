import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAiHealth } from "../services/ai";
import { listAcceptanceCriteria } from "../services/refinement";
import {
  approveTestCase,
  generateTestCases,
  listTestCases,
  listTestGenerationRuns,
  rejectTestCase,
  updateTestCase,
  validateTestCase,
  type TestCaseFinding,
  type TestCaseRecord,
} from "../services/testCases";

export function TestCaseWorkflow({
  requirementId,
  currentVersion,
}: {
  requirementId: string;
  currentVersion: number;
}) {
  const client = useQueryClient();
  const [findings, setFindings] = useState<Record<string, TestCaseFinding[]>>(
    {},
  );
  const [approvalChecks, setApprovalChecks] = useState<Record<string, boolean>>(
    {},
  );
  const [edits, setEdits] = useState<
    Record<
      string,
      { title: string; description: string; expectedResult: string }
    >
  >({});
  const health = useQuery({
    queryKey: ["ai-health"],
    queryFn: getAiHealth,
    refetchInterval: 30000,
  });
  const cases = useQuery({
    queryKey: ["test-cases", requirementId],
    queryFn: () => listTestCases(requirementId),
  });
  const criteria = useQuery({
    queryKey: ["acceptance-criteria", requirementId],
    queryFn: () => listAcceptanceCriteria(requirementId),
  });
  const runs = useQuery({
    queryKey: ["test-generation-runs", requirementId],
    queryFn: () => listTestGenerationRuns(requirementId),
  });
  const refresh = async () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["test-cases", requirementId] }),
      client.invalidateQueries({
        queryKey: ["test-generation-runs", requirementId],
      }),
    ]);
  const generation = useMutation({
    mutationFn: () => generateTestCases(requirementId),
    onSettled: refresh,
  });
  const update = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { title: string; description: string; expectedResult: string };
    }) => updateTestCase(id, input),
    onSettled: refresh,
  });
  const approve = useMutation({
    mutationFn: (id: string) => approveTestCase(id),
    onSettled: refresh,
  });
  const reject = useMutation({
    mutationFn: (id: string) => rejectTestCase(id),
    onSettled: refresh,
  });
  const validate = useMutation({
    mutationFn: (id: string) => validateTestCase(id),
    onSuccess: (result) => {
      setFindings((current) => ({
        ...current,
        [result.testCaseId]: result.findings,
      }));
      setApprovalChecks((current) => ({
        ...current,
        [result.testCaseId]: result.canApprove,
      }));
    },
  });
  const available = health.data?.available && health.data.modelAvailable;
  const error =
    generation.error ?? update.error ?? approve.error ?? reject.error;
  const editCase = (
    id: string,
    value: { title: string; description: string; expectedResult: string },
  ) => {
    setEdits((all) => ({ ...all, [id]: value }));
    setApprovalChecks((all) => withoutKey(all, id));
    setFindings((all) => withoutKey(all, id));
  };

  return (
    <section
      className="validation-section test-case-section"
      aria-labelledby="test-cases-title"
    >
      <div className="section-heading validation-section-heading">
        <div>
          <h2 id="test-cases-title">Test cases</h2>
          <p>
            Generated only from approved criteria for requirement version{" "}
            {currentVersion}. Every generated case stays a draft until reviewed.
          </p>
        </div>
        <button
          className="button button-primary"
          disabled={!available || generation.isPending}
          onClick={() => generation.mutate()}
        >
          {generation.isPending ? "Generating…" : "Generate test cases"}
        </button>
      </div>
      {health.isLoading ? (
        <p className="ai-health-note">Checking local AI availability…</p>
      ) : !available ? (
        <p className="ai-health-note unavailable">
          Live generation needs the configured local Ollama runtime and model.
          Existing test cases and approved criteria remain available.
        </p>
      ) : (
        <p className="ai-health-note">
          Local model available: {health.data?.model ?? "configured model"}
        </p>
      )}
      {health.isError && (
        <p className="ai-health-note unavailable">
          AI availability could not be checked. Live generation is unavailable
          until the local runtime is reachable.
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error.message}
        </p>
      )}
      {generation.data && (
        <p className="workflow-note" role="status">
          Generation completed with {generation.data.testCases.length} draft
          test case(s). Review before approval.
        </p>
      )}
      <div
        className="test-case-history"
        aria-label="Approved acceptance criteria"
      >
        <strong>Approved acceptance criteria for the current version</strong>
        {criteria.data
          ?.filter(
            (criterion) =>
              criterion.status === "APPROVED" &&
              criterion.sourceRequirementVersion === currentVersion,
          )
          .map((criterion) => (
            <div className="test-case-source" key={criterion.id}>
              <strong>{criterion.title}</strong>
              <p>Given {criterion.given}</p>
              <p>When {criterion.when}</p>
              <p>Then {criterion.then}</p>
              <small>{criterion.id}</small>
            </div>
          ))}
        {!criteria.data?.some(
          (criterion) =>
            criterion.status === "APPROVED" &&
            criterion.sourceRequirementVersion === currentVersion,
        ) && (
          <p>
            No approved criteria are available for this requirement version.
          </p>
        )}
      </div>
      <div className="test-case-history" aria-label="Test generation history">
        <strong>Generation history</strong>
        {runs.data?.length ? (
          runs.data.map((run) => (
            <div key={run.id}>
              <p>
                v{run.sourceRequirementVersion} · {run.status} ·{" "}
                {run._count.testCases} case(s) ·{" "}
                {run.modelName ?? "model not configured"} · prompt{" "}
                {run.promptVersion}
                {run.errorCode ? ` · ${run.errorCode}` : ""}
              </p>
              {run.limitations.map((limitation, index) => (
                <small key={`${run.id}-limitation-${index}`}>
                  Limitation: {limitation}
                </small>
              ))}
            </div>
          ))
        ) : (
          <p>No test generation runs yet.</p>
        )}
      </div>
      {cases.isLoading && <p className="workflow-note">Loading test cases…</p>}
      {cases.error && (
        <p className="inline-error" role="alert">
          {cases.error.message}
        </p>
      )}
      {!cases.isLoading && cases.data?.length === 0 && (
        <p className="validation-empty">No test cases have been generated.</p>
      )}
      {cases.data?.map((testCase) => (
        <div id={`test-case-${testCase.id}`} key={testCase.id}>
          <TestCaseCard
            key={testCase.id}
            testCase={testCase}
            edit={
              edits[testCase.id] ?? {
                title: testCase.title,
                description: testCase.description,
                expectedResult: testCase.expectedResult,
              }
            }
            findings={findings[testCase.id] ?? []}
            canApprove={approvalChecks[testCase.id]}
            busy={
              update.isPending ||
              approve.isPending ||
              reject.isPending ||
              validate.isPending
            }
            onEdit={(value) => editCase(testCase.id, value)}
            onSave={() =>
              update.mutate({
                id: testCase.id,
                input: edits[testCase.id] ?? {
                  title: testCase.title,
                  description: testCase.description,
                  expectedResult: testCase.expectedResult,
                },
              })
            }
            onValidate={() => validate.mutate(testCase.id)}
            onApprove={() => approve.mutate(testCase.id)}
            onReject={() => reject.mutate(testCase.id)}
          />
        </div>
      ))}
    </section>
  );
}

function withoutKey<T>(values: Record<string, T>, key: string) {
  const remaining = { ...values };
  delete remaining[key];
  return remaining;
}

function TestCaseCard({
  testCase,
  edit,
  findings,
  canApprove,
  busy,
  onEdit,
  onSave,
  onValidate,
  onApprove,
  onReject,
}: {
  testCase: TestCaseRecord;
  edit: { title: string; description: string; expectedResult: string };
  findings: TestCaseFinding[];
  canApprove?: boolean;
  busy: boolean;
  onEdit: (value: {
    title: string;
    description: string;
    expectedResult: string;
  }) => void;
  onSave: () => void;
  onValidate: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <article className="workflow-card test-case-card">
      <div className="workflow-card-top">
        <strong>{testCase.title}</strong>
        <span className={`workflow-status ${testCase.status.toLowerCase()}`}>
          {testCase.status}
        </span>
      </div>
      <small>
        {testCase.testType} · {testCase.priority} · source requirement v
        {testCase.sourceRequirementVersion}
        {testCase.isHistorical ? " · historical" : " · current"} · criterion{" "}
        {testCase.acceptanceCriterionId}
      </small>
      <div className="test-case-source">
        <strong>{testCase.acceptanceCriterion.title}</strong>
        <p>Given {testCase.acceptanceCriterion.given}</p>
        <p>When {testCase.acceptanceCriterion.when}</p>
        <p>Then {testCase.acceptanceCriterion.then}</p>
      </div>
      {testCase.status === "DRAFT" ? (
        <div className="test-case-edit">
          <label>
            Title
            <input
              value={edit.title}
              onChange={(event) =>
                onEdit({ ...edit, title: event.target.value })
              }
            />
          </label>
          <label>
            Description
            <textarea
              value={edit.description}
              onChange={(event) =>
                onEdit({ ...edit, description: event.target.value })
              }
            />
          </label>
          <label>
            Expected result
            <textarea
              value={edit.expectedResult}
              onChange={(event) =>
                onEdit({ ...edit, expectedResult: event.target.value })
              }
            />
          </label>
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={onSave}
          >
            Save draft edits
          </button>
        </div>
      ) : (
        <p>{testCase.description}</p>
      )}
      <div className="test-case-preconditions">
        <strong>Preconditions</strong>
        {testCase.preconditions.length ? (
          <ul>
            {testCase.preconditions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <span> None specified.</span>
        )}
      </div>
      <p>
        <strong>Test steps</strong>
      </p>
      <ol>
        {testCase.testSteps.map((step, index) => (
          <li key={`${index}-${step}`}>{step}</li>
        ))}
      </ol>
      {testCase.testData.length > 0 && (
        <p>
          <strong>Test data</strong>{" "}
          {testCase.testData
            .map(({ name, value }) => `${name}: ${value}`)
            .join(" · ")}
        </p>
      )}
      <p>
        <strong>Expected result</strong> {testCase.expectedResult}
      </p>
      <small>
        Generated by {testCase.generationRun?.modelName ?? "local model"} ·
        prompt {testCase.generationRun?.promptVersion ?? "—"} · revision{" "}
        {testCase.revisionNumber}
      </small>
      {findings.length > 0 && (
        <div
          className="test-validation-findings"
          aria-label="Deterministic validation findings"
        >
          <strong>Deterministic validation findings</strong>
          {findings.map((finding, index) => (
            <p
              className={`severity-label severity-${finding.severity.toLowerCase()}`}
              key={`${finding.code}-${index}`}
            >
              {finding.severity} · {finding.message}
            </p>
          ))}
        </div>
      )}
      {testCase.status === "DRAFT" && (
        <div className="workflow-actions">
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={onValidate}
          >
            Validate draft
          </button>
          <button
            className="button button-primary"
            disabled={busy || canApprove !== true || testCase.isHistorical}
            onClick={onApprove}
          >
            Approve test case
          </button>
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={onReject}
          >
            Reject
          </button>
        </div>
      )}
    </article>
  );
}
