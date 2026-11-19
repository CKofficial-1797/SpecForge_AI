import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../components/Modal";
import { RequirementForm } from "../components/RequirementForm";
import { RequestState } from "../components/RequestState";
import { ValidationReportView } from "../components/ValidationReportView";
import { ApiRequestError } from "../services/api";
import { getProject } from "../services/projects";
import {
  archiveRequirement,
  getRequirement,
  getRequirementVersion,
  listRequirementVersions,
  updateRequirement,
  type RequirementUpdate,
} from "../services/requirements";
import {
  getValidationReport,
  listValidationReports,
  runValidation,
} from "../services/validation";

export function RequirementDetailPage() {
  const { requirementId = "" } = useParams();
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState<number | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  useEffect(() => {
    setSelectedReportId(null);
    setHistoryPage(1);
  }, [requirementId]);
  const client = useQueryClient();
  const item = useQuery({
    queryKey: ["requirement", requirementId],
    queryFn: () => getRequirement(requirementId),
    enabled: !!requirementId,
  });
  const versions = useQuery({
    queryKey: ["requirement-versions", requirementId],
    queryFn: () => listRequirementVersions(requirementId),
    enabled: !!requirementId,
  });
  const validationHistory = useQuery({
    queryKey: ["validation-reports", requirementId, historyPage],
    queryFn: () =>
      listValidationReports(requirementId, { page: historyPage, pageSize: 10 }),
    enabled: !!requirementId,
  });
  const activeReportId =
    selectedReportId ?? validationHistory.data?.data[0]?.id ?? null;
  const activeReport = useQuery({
    queryKey: ["validation-report", requirementId, activeReportId],
    queryFn: () => getValidationReport(requirementId, activeReportId!),
    enabled: !!activeReportId,
  });
  const project = useQuery({
    queryKey: ["project", item.data?.projectId],
    queryFn: () => getProject(item.data!.projectId),
    enabled: !!item.data?.projectId,
  });
  const selectedVersion = useQuery({
    queryKey: ["requirement-version", requirementId, version],
    queryFn: () => getRequirementVersion(requirementId, version!),
    enabled: version !== null,
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["requirement", requirementId] }),
      client.invalidateQueries({
        queryKey: ["requirement-versions", requirementId],
      }),
      client.invalidateQueries({ queryKey: ["requirements"] }),
      client.invalidateQueries({
        queryKey: ["validation-reports", requirementId],
      }),
      client.invalidateQueries({
        queryKey: ["project-validation-summary", item.data?.projectId],
      }),
    ]);
  };
  const update = useMutation({
    mutationFn: (input: RequirementUpdate) =>
      updateRequirement(requirementId, input),
    onSuccess: async () => {
      await refresh();
      setEditing(false);
    },
  });
  const archive = useMutation({
    mutationFn: () => archiveRequirement(requirementId),
    onSuccess: refresh,
  });
  const validation = useMutation({
    mutationFn: () => runValidation(requirementId),
    onSuccess: async (record) => {
      setSelectedReportId(record.id);
      setHistoryPage(1);
      await Promise.all([
        client.invalidateQueries({
          queryKey: ["validation-reports", requirementId],
        }),
        client.invalidateQueries({
          queryKey: ["project-validation-summary", item.data?.projectId],
        }),
      ]);
    },
  });
  const error = update.error ?? archive.error;
  return (
    <section className="page-container">
      {item.data && (
        <Link className="back-link" to={`/projects/${item.data.projectId}`}>
          ← {project.data?.name ?? "Project"}
        </Link>
      )}
      <RequestState loading={item.isLoading} error={item.error} />
      {item.data && (
        <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                REQUIREMENT · {item.data.requirementKey}
              </p>
              <h1>{item.data.title}</h1>
              <p className="page-subtitle">{item.data.description}</p>
              <div className="pill-row">
                <span className={`pill ${item.data.priority.toLowerCase()}`}>
                  {item.data.priority}
                </span>
                <span className={`pill ${item.data.status.toLowerCase()}`}>
                  {item.data.status}
                </span>
                <span className="pill">Version {item.data.currentVersion}</span>
              </div>
            </div>
            <div className="button-row">
              <button
                className="button button-secondary"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              {item.data.status !== "ARCHIVED" && (
                <button
                  className="button button-secondary"
                  disabled={archive.isPending}
                  onClick={() => {
                    if (window.confirm("Archive this requirement?"))
                      archive.mutate();
                  }}
                >
                  Archive
                </button>
              )}
            </div>
          </div>
          {error && (
            <p role="alert" className="inline-error">
              {error instanceof ApiRequestError && error.status === 409
                ? "This requirement changed in another session. Reload the page before editing again."
                : error.message}
            </p>
          )}
          <section
            className="validation-section"
            aria-labelledby="validation-title"
          >
            <div className="section-heading validation-section-heading">
              <div>
                <h2 id="validation-title">Requirement validation</h2>
                <p>
                  Deterministic checks provide review findings, not a quality
                  score.
                </p>
              </div>
              <button
                className="button button-primary"
                disabled={validation.isPending}
                onClick={() => validation.mutate()}
              >
                {validation.isPending ? "Validating…" : "Run validation"}
              </button>
            </div>
            {validation.isSuccess && (
              <p className="validation-success" role="status">
                Validation finished and the report was saved for version{" "}
                {validation.data.requirementVersion}.
              </p>
            )}
            {validation.error && (
              <div className="validation-error" role="alert">
                <span>{validation.error.message}</span>
                <button
                  className="button button-secondary"
                  onClick={() => validation.mutate()}
                >
                  Retry
                </button>
              </div>
            )}
            {validationHistory.isError && (
              <div className="validation-error" role="alert">
                <span>{validationHistory.error.message}</span>
                <button
                  className="button button-secondary"
                  onClick={() => void validationHistory.refetch()}
                >
                  Retry history
                </button>
              </div>
            )}
            {validationHistory.data?.data.length ? (
              <div className="validation-history-layout">
                <div
                  className="validation-history-list"
                  aria-label="Validation history"
                >
                  {validationHistory.data.data.map((entry, index) => (
                    <button
                      key={entry.id}
                      className={`validation-history-row${entry.id === activeReportId ? " selected" : ""}`}
                      aria-pressed={entry.id === activeReportId}
                      onClick={() => setSelectedReportId(entry.id)}
                    >
                      <strong>
                        {historyPage === 1 && index === 0
                          ? "Latest report"
                          : "Saved report"}{" "}
                        · v{entry.requirementVersion}
                      </strong>
                      <span>{new Date(entry.createdAt).toLocaleString()}</span>
                      <small>
                        Rule set {entry.ruleSetVersion} · {entry.summary.errors}{" "}
                        errors · {entry.summary.warnings} warnings
                      </small>
                    </button>
                  ))}
                  {validationHistory.data.pagination.totalPages > 1 && (
                    <div className="history-pagination">
                      <button
                        className="button button-secondary"
                        disabled={historyPage <= 1}
                        onClick={() => setHistoryPage(historyPage - 1)}
                      >
                        Previous
                      </button>
                      <span>
                        Page {historyPage} of{" "}
                        {validationHistory.data.pagination.totalPages}
                      </span>
                      <button
                        className="button button-secondary"
                        disabled={
                          historyPage >=
                          validationHistory.data.pagination.totalPages
                        }
                        onClick={() => setHistoryPage(historyPage + 1)}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
                <div className="validation-report-panel">
                  <RequestState
                    loading={activeReport.isLoading}
                    error={activeReport.error}
                  />
                  {activeReport.data && (
                    <>
                      {item.data &&
                        activeReport.data.requirementVersion !==
                          item.data.currentVersion && (
                          <p className="stale-report-note" role="status">
                            This saved report covers version{" "}
                            {activeReport.data.requirementVersion}; the current
                            requirement is version {item.data.currentVersion}.
                            Run validation to analyze the current version.
                          </p>
                        )}
                      <ValidationReportView record={activeReport.data} />
                    </>
                  )}
                </div>
              </div>
            ) : (
              <RequestState
                loading={validationHistory.isLoading}
                empty={!validationHistory.isLoading && !validationHistory.error}
                emptyMessage="No validation reports yet. Run validation to save the first report."
              />
            )}
          </section>
          <div className="section-heading">
            <div>
              <h2>Version history</h2>
              <p>Each version preserves title, description, and priority.</p>
            </div>
          </div>
          <RequestState
            loading={versions.isLoading}
            error={versions.error}
            empty={versions.data?.data.length === 0}
            emptyMessage="No versions are available."
          />
          {!!versions.data?.data.length && (
            <div className="version-list">
              {versions.data.data.map((entry) => (
                <button
                  className="version-row"
                  key={entry.id}
                  onClick={() => setVersion(entry.versionNumber)}
                >
                  <span>
                    <strong>Version {entry.versionNumber}</strong>
                    <small>{new Date(entry.createdAt).toLocaleString()}</small>
                  </span>
                  <span>{entry.changeSummary || "Initial version"}</span>
                  <span className="version-link">View →</span>
                </button>
              ))}
            </div>
          )}
          {editing && (
            <Modal title="Edit requirement" onClose={() => setEditing(false)}>
              <RequirementForm
                requirement={item.data}
                busy={update.isPending}
                error={update.error?.message}
                onCancel={() => setEditing(false)}
                onSave={(value) => update.mutate(value as RequirementUpdate)}
              />
            </Modal>
          )}
          {version !== null && (
            <Modal
              title={`Requirement version ${version}`}
              onClose={() => setVersion(null)}
            >
              <RequestState
                loading={selectedVersion.isLoading}
                error={selectedVersion.error}
              />
              {selectedVersion.data && (
                <article className="version-detail">
                  <p className="eyebrow">
                    {selectedVersion.data.priority} ·{" "}
                    {new Date(selectedVersion.data.createdAt).toLocaleString()}
                  </p>
                  <h3>{selectedVersion.data.title}</h3>
                  <p className="preserve-lines">
                    {selectedVersion.data.description}
                  </p>
                  <p className="change-summary">
                    {selectedVersion.data.changeSummary || "Initial version"}
                  </p>
                </article>
              )}
            </Modal>
          )}
        </>
      )}
    </section>
  );
}
