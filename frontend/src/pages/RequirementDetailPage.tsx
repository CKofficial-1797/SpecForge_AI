import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../components/Modal";
import { RequirementForm } from "../components/RequirementForm";
import { RequestState } from "../components/RequestState";
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

export function RequirementDetailPage() {
  const { requirementId = "" } = useParams();
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState<number | null>(null);
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
