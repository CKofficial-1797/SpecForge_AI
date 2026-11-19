import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAiHealth, listAiAnalyses } from "../services/ai";
import {
  approveCriterion,
  approveRefinement,
  dismissClarification,
  editClarificationAnswer,
  generateAcceptanceCriteria,
  generateRefinement,
  importClarifications,
  listAcceptanceCriteria,
  listClarifications,
  listRefinementDrafts,
  rejectCriterion,
  rejectRefinement,
  submitClarificationAnswer,
} from "../services/refinement";

export function RefinementWorkflow({
  requirementId,
  currentVersion,
}: {
  requirementId: string;
  currentVersion: number;
}) {
  const client = useQueryClient();
  const [analysisId, setAnalysisId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [editingAnswers, setEditingAnswers] = useState<Record<string, boolean>>(
    {},
  );
  const analyses = useQuery({
    queryKey: ["ai-analyses", requirementId],
    queryFn: () => listAiAnalyses(requirementId),
  });
  const health = useQuery({
    queryKey: ["ai-health"],
    queryFn: getAiHealth,
    refetchInterval: 30000,
  });
  const questions = useQuery({
    queryKey: ["clarifications", requirementId],
    queryFn: () => listClarifications(requirementId),
  });
  const drafts = useQuery({
    queryKey: ["refinement-drafts", requirementId],
    queryFn: () => listRefinementDrafts(requirementId),
  });
  const criteria = useQuery({
    queryKey: ["acceptance-criteria", requirementId],
    queryFn: () => listAcceptanceCriteria(requirementId),
  });
  const latestSuccessful = analyses.data?.data.find(
    (entry) => entry.status === "SUCCEEDED",
  );
  const selectedAnalysisId = analysisId || latestSuccessful?.id || "";
  useEffect(() => {
    if (
      analysisId &&
      !analyses.data?.data.some(
        (entry) => entry.id === analysisId && entry.status === "SUCCEEDED",
      )
    )
      setAnalysisId("");
  }, [analysisId, analyses.data]);
  const refresh = async () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["ai-analyses", requirementId] }),
      client.invalidateQueries({ queryKey: ["clarifications", requirementId] }),
      client.invalidateQueries({
        queryKey: ["refinement-drafts", requirementId],
      }),
      client.invalidateQueries({
        queryKey: ["acceptance-criteria", requirementId],
      }),
      client.invalidateQueries({ queryKey: ["requirement", requirementId] }),
      client.invalidateQueries({
        queryKey: ["requirement-versions", requirementId],
      }),
    ]);
  const importMutation = useMutation({
    mutationFn: () => importClarifications(requirementId, selectedAnalysisId),
    onSettled: refresh,
  });
  const answerMutation = useMutation({
    mutationFn: ({
      questionId,
      answer,
    }: {
      questionId: string;
      answer: string;
    }) => submitClarificationAnswer(questionId, answer),
    onSettled: refresh,
  });
  const editMutation = useMutation({
    mutationFn: ({
      questionId,
      answerId,
      answer,
    }: {
      questionId: string;
      answerId: string;
      answer: string;
    }) => editClarificationAnswer(questionId, answerId, answer),
    onSuccess: (_saved, variables) => {
      setEditingAnswers((prev) => ({ ...prev, [variables.questionId]: false }));
      setAnswers((prev) => ({ ...prev, [variables.questionId]: "" }));
      void refresh();
    },
    onError: refresh,
  });
  const dismissMutation = useMutation({
    mutationFn: dismissClarification,
    onSettled: refresh,
  });
  const refinementMutation = useMutation({
    mutationFn: () => generateRefinement(requirementId, selectedAnalysisId),
    onSettled: refresh,
  });
  const approveDraftMutation = useMutation({
    mutationFn: approveRefinement,
    onSettled: refresh,
  });
  const rejectDraftMutation = useMutation({
    mutationFn: rejectRefinement,
    onSettled: refresh,
  });
  const generateCriteriaMutation = useMutation({
    mutationFn: () => generateAcceptanceCriteria(requirementId),
    onSettled: refresh,
  });
  const approveCriterionMutation = useMutation({
    mutationFn: approveCriterion,
    onSettled: refresh,
  });
  const rejectCriterionMutation = useMutation({
    mutationFn: rejectCriterion,
    onSettled: refresh,
  });
  const errors = [
    importMutation,
    answerMutation,
    editMutation,
    dismissMutation,
    refinementMutation,
    approveDraftMutation,
    rejectDraftMutation,
    generateCriteriaMutation,
    approveCriterionMutation,
    rejectCriterionMutation,
  ]
    .map((mutation) => mutation.error)
    .filter((error): error is Error => error instanceof Error);

  return (
    <div className="workflow-stack">
      <section
        className="workflow-panel"
        aria-labelledby="clarifications-title"
      >
        <div className="workflow-heading">
          <div>
            <h3 id="clarifications-title">Clarification questions</h3>
            <p>
              Imported only from a validated saved AI analysis. Answers are
              versioned and never treated as instructions.
            </p>
          </div>
          <div className="workflow-actions">
            {analyses.data?.data.some(
              (entry) => entry.status === "SUCCEEDED",
            ) && (
              <select
                aria-label="Source AI analysis"
                value={selectedAnalysisId}
                onChange={(event) => setAnalysisId(event.target.value)}
              >
                {analyses.data.data
                  .filter((entry) => entry.status === "SUCCEEDED")
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      v{entry.requirementVersion} ·{" "}
                      {new Date(entry.createdAt).toLocaleString()} ·{" "}
                      {entry.id.slice(0, 8)}
                    </option>
                  ))}
              </select>
            )}
            <button
              className="button button-secondary"
              disabled={!selectedAnalysisId || importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              {importMutation.isPending ? "Importing…" : "Import questions"}
            </button>
          </div>
        </div>
        <WorkflowState
          loading={questions.isLoading}
          error={questions.error}
          empty={
            !questions.isLoading && !questions.error && !questions.data?.length
          }
          emptyText="No clarification questions have been imported."
        />
        {questions.data?.map((question) => {
          const currentAnswer = question.answers.find(
            (answer) => answer.isCurrent,
          );
          return (
            <article className="workflow-card" key={question.id}>
              <div className="workflow-card-top">
                <strong>{question.question}</strong>
                <span
                  className={`workflow-status ${question.status.toLowerCase()}`}
                >
                  {question.status}
                </span>
              </div>
              <p>{question.reason}</p>
              <small>
                Source analysis · version{" "}
                {question.sourceAnalysis?.requirementVersion ?? "—"} ·{" "}
                {question.sourceAnalysisId}
              </small>
              {question.relatedRequirementIds.length > 0 && (
                <small>
                  Related requirements ·{" "}
                  {question.relatedRequirementIds.join(", ")}
                </small>
              )}
              {question.answers.length > 0 && (
                <div className="answer-history">
                  <strong>Answer history</strong>
                  {question.answers.map((answer) => (
                    <p
                      className={answer.isCurrent ? "current-answer" : ""}
                      key={answer.id}
                    >
                      Revision {answer.revisionNumber}
                      {answer.isCurrent ? " · current" : ""} ·{" "}
                      {new Date(answer.answeredAt).toLocaleString()}
                      <br />
                      {answer.answer}
                    </p>
                  ))}
                </div>
              )}
              {question.status === "OPEN" && (
                <div className="answer-form">
                  <textarea
                    aria-label={`Answer: ${question.question}`}
                    maxLength={5000}
                    value={answers[question.id] ?? ""}
                    onChange={(event) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [question.id]: event.target.value,
                      }))
                    }
                    placeholder="Enter an explicit product-owner answer"
                  />
                  <div className="workflow-actions">
                    <button
                      className="button button-primary"
                      disabled={
                        !answers[question.id]?.trim() ||
                        answerMutation.isPending
                      }
                      onClick={() =>
                        answerMutation.mutate({
                          questionId: question.id,
                          answer: answers[question.id]!,
                        })
                      }
                    >
                      Submit answer
                    </button>
                    <button
                      className="button button-secondary"
                      disabled={dismissMutation.isPending}
                      onClick={() => dismissMutation.mutate(question.id)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              {question.status === "ANSWERED" && currentAnswer && (
                <div className="answer-form">
                  <button
                    className="button button-secondary"
                    onClick={() => {
                      setAnswers((prev) => ({
                        ...prev,
                        [question.id]: currentAnswer.answer,
                      }));
                      setEditingAnswers((prev) => ({
                        ...prev,
                        [question.id]: !prev[question.id],
                      }));
                    }}
                  >
                    {editingAnswers[question.id]
                      ? "Cancel edit"
                      : "Edit latest answer"}
                  </button>
                  {editingAnswers[question.id] && (
                    <>
                      <textarea
                        aria-label="Edit answer"
                        maxLength={5000}
                        value={answers[question.id] ?? ""}
                        onChange={(event) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [question.id]: event.target.value,
                          }))
                        }
                      />
                      <button
                        className="button button-primary"
                        disabled={
                          !answers[question.id]?.trim() ||
                          editMutation.isPending
                        }
                        onClick={() =>
                          editMutation.mutate({
                            questionId: question.id,
                            answerId: currentAnswer.id,
                            answer: answers[question.id]!,
                          })
                        }
                      >
                        Save as new revision
                      </button>
                    </>
                  )}
                </div>
              )}
              {question.status === "DISMISSED" && (
                <p className="workflow-note">
                  Dismissed questions are still unresolved and will not be
                  treated as answered.
                </p>
              )}
            </article>
          );
        })}
      </section>

      <section className="workflow-panel" aria-labelledby="refinement-title">
        <div className="workflow-heading">
          <div>
            <h3 id="refinement-title">Requirement refinement</h3>
            <p>
              Review the proposal against its original version. Approval creates
              a new immutable version; assumptions or unresolved questions block
              approval.
            </p>
          </div>
          <button
            className="button button-primary"
            disabled={
              !health.data?.available ||
              !selectedAnalysisId ||
              refinementMutation.isPending
            }
            onClick={() => refinementMutation.mutate()}
          >
            {refinementMutation.isPending
              ? "Generating draft…"
              : "Generate refinement draft"}
          </button>
        </div>
        <WorkflowState
          loading={drafts.isLoading}
          error={drafts.error}
          empty={!drafts.isLoading && !drafts.error && !drafts.data?.length}
          emptyText="No refinement drafts yet."
        />
        {drafts.data?.map((draft) => (
          <article className="workflow-card" key={draft.id}>
            <div className="workflow-card-top">
              <strong>
                Draft based on version {draft.baseRequirementVersion}
              </strong>
              <span className={`workflow-status ${draft.status.toLowerCase()}`}>
                {draft.status.replaceAll("_", " ")}
              </span>
            </div>
            {draft.isStale && (
              <p className="workflow-warning">
                Stale draft · current requirement is version {currentVersion}.
                It cannot be approved.
              </p>
            )}
            {draft.baseVersion && (
              <div className="proposal-grid">
                <div>
                  <small>Original · v{draft.baseRequirementVersion}</small>
                  <h4>{draft.baseVersion.title}</h4>
                  <p>{draft.baseVersion.description}</p>
                </div>
                <div>
                  <small>Proposed</small>
                  <h4>{draft.proposedTitle}</h4>
                  <p>{draft.proposedDescription}</p>
                </div>
              </div>
            )}
            <p>
              <strong>Change summary:</strong> {draft.changeSummary}
            </p>
            {draft.structuredOutput.appliedClarifications.length > 0 && (
              <>
                <strong>Applied answers</strong>
                <ul>
                  {draft.structuredOutput.appliedClarifications.map((item) => (
                    <li key={item.answerId}>
                      Question {item.questionId} · answer {item.answerId}:{" "}
                      {item.changeExplanation}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <OutputList
              title="Remaining ambiguities"
              items={draft.structuredOutput.remainingAmbiguities}
            />
            <OutputList
              title="Unresolved questions"
              items={draft.structuredOutput.unresolvedQuestions}
            />
            <OutputList
              title="Assumptions"
              items={draft.structuredOutput.assumptions}
            />
            <OutputList
              title="Warnings"
              items={draft.structuredOutput.warnings}
            />
            {draft.status === "PENDING_REVIEW" && (
              <div className="workflow-actions">
                <button
                  className="button button-primary"
                  disabled={
                    draft.isStale ||
                    draft.structuredOutput.assumptions.length > 0 ||
                    draft.structuredOutput.unresolvedQuestions.length > 0 ||
                    approveDraftMutation.isPending
                  }
                  onClick={() => approveDraftMutation.mutate(draft.id)}
                >
                  Approve and create version
                </button>
                <button
                  className="button button-secondary"
                  disabled={rejectDraftMutation.isPending}
                  onClick={() => rejectDraftMutation.mutate(draft.id)}
                >
                  Reject draft
                </button>
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="workflow-panel" aria-labelledby="criteria-title">
        <div className="workflow-heading">
          <div>
            <h3 id="criteria-title">Acceptance criteria</h3>
            <p>
              Generated from the exact current requirement version. Every
              criterion remains a draft until individually approved.
            </p>
          </div>
          <button
            className="button button-primary"
            disabled={
              !health.data?.available || generateCriteriaMutation.isPending
            }
            onClick={() => generateCriteriaMutation.mutate()}
          >
            {generateCriteriaMutation.isPending
              ? "Generating…"
              : "Generate criteria"}
          </button>
        </div>
        <WorkflowState
          loading={criteria.isLoading}
          error={criteria.error}
          empty={
            !criteria.isLoading && !criteria.error && !criteria.data?.length
          }
          emptyText="No acceptance criteria have been generated."
        />
        {criteria.data?.map((criterion) => (
          <article
            id={`acceptance-criterion-${criterion.id}`}
            className="workflow-card criterion-card"
            key={criterion.id}
          >
            <div className="workflow-card-top">
              <strong>{criterion.title}</strong>
              <span
                className={`workflow-status ${criterion.status.toLowerCase()}`}
              >
                {criterion.status}
              </span>
            </div>
            <small>
              Source requirement version {criterion.sourceRequirementVersion}
              {criterion.isHistorical ? " · historical" : " · current"}
            </small>
            <div className="gwt-row">
              <div>
                <b>Given</b>
                <p>{criterion.given}</p>
              </div>
              <div>
                <b>When</b>
                <p>{criterion.when}</p>
              </div>
              <div>
                <b>Then</b>
                <p>{criterion.then}</p>
              </div>
            </div>
            {!criterion.isResolved && (
              <p className="workflow-warning">
                Unresolved · {criterion.notes.join("; ")}
              </p>
            )}
            {criterion.status === "DRAFT" && (
              <div className="workflow-actions">
                <button
                  className="button button-primary"
                  disabled={
                    !criterion.isResolved ||
                    criterion.isHistorical ||
                    approveCriterionMutation.isPending
                  }
                  onClick={() => approveCriterionMutation.mutate(criterion.id)}
                >
                  Approve criterion
                </button>
                <button
                  className="button button-secondary"
                  disabled={rejectCriterionMutation.isPending}
                  onClick={() => rejectCriterionMutation.mutate(criterion.id)}
                >
                  Reject criterion
                </button>
              </div>
            )}
          </article>
        ))}
      </section>
      {errors.map((error, index) => (
        <p
          className="inline-error"
          role="alert"
          key={`${error.message}-${index}`}
        >
          {error.message}
        </p>
      ))}
    </div>
  );
}

function WorkflowState({
  loading,
  error,
  empty,
  emptyText,
}: {
  loading: boolean;
  error: Error | null;
  empty: boolean;
  emptyText: string;
}) {
  if (loading) return <p className="workflow-note">Loading…</p>;
  if (error)
    return (
      <p className="inline-error" role="alert">
        {error.message}
      </p>
    );
  if (empty) return <p className="validation-empty">{emptyText}</p>;
  return null;
}
function OutputList({ title, items }: { title: string; items: string[] }) {
  return items.length ? (
    <div className="output-list">
      <strong>{title}</strong>
      <ul>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  ) : null;
}
