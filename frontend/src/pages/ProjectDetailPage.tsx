import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../components/Modal";
import { ProjectForm } from "../components/ProjectForm";
import { RequirementForm } from "../components/RequirementForm";
import { RequestState } from "../components/RequestState";
import { ProjectValidationSummary } from "../components/ProjectValidationSummary";
import { TraceabilityCoverage } from "../components/TraceabilityCoverage";
import { ApiRequestError } from "../services/api";
import {
  archiveProject,
  getProject,
  updateProject,
  type ProjectInput,
} from "../services/projects";
import {
  createRequirement,
  listRequirements,
  type RequirementInput,
} from "../services/requirements";
import { getProjectValidationSummary } from "../services/validation";

export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const client = useQueryClient();
  const navigate = useNavigate();
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
  });
  const requirements = useQuery({
    queryKey: ["requirements", projectId, page],
    queryFn: () => listRequirements(projectId, { page, pageSize: 20 }),
    enabled: !!projectId,
  });
  const validationSummary = useQuery({
    queryKey: ["project-validation-summary", projectId],
    queryFn: () => getProjectValidationSummary(projectId),
    enabled: !!projectId,
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["project", projectId] }),
      client.invalidateQueries({ queryKey: ["projects"] }),
      client.invalidateQueries({ queryKey: ["requirements", projectId] }),
      client.invalidateQueries({
        queryKey: ["project-validation-summary", projectId],
      }),
    ]);
  };
  const edit = useMutation({
    mutationFn: (input: ProjectInput) => updateProject(projectId, input),
    onSuccess: async () => {
      await refresh();
      setEditing(false);
    },
  });
  const archive = useMutation({
    mutationFn: () => archiveProject(projectId),
    onSuccess: async () => {
      await refresh();
      navigate("/projects");
    },
  });
  const create = useMutation({
    mutationFn: (input: RequirementInput) =>
      createRequirement(projectId, input),
    onSuccess: async () => {
      await refresh();
      setCreating(false);
    },
  });
  const issue = [
    project.error,
    requirements.error,
    validationSummary.error,
    edit.error,
    archive.error,
    create.error,
  ].find(Boolean);
  return (
    <section className="page-container">
      <Link className="back-link" to="/projects">
        ← Projects
      </Link>
      <RequestState loading={project.isLoading} error={project.error} />
      {project.data && (
        <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">PROJECT</p>
              <h1>{project.data.name}</h1>
              <p className="page-subtitle">
                {project.data.description || "No description"}
              </p>
              <span className={`pill ${project.data.status.toLowerCase()}`}>
                {project.data.status}
              </span>
            </div>
            <div className="button-row">
              <button
                className="button button-secondary"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              {project.data.status !== "ARCHIVED" && (
                <button
                  className="button button-secondary"
                  disabled={archive.isPending}
                  onClick={() => {
                    if (window.confirm("Archive this project?"))
                      archive.mutate();
                  }}
                >
                  Archive
                </button>
              )}
            </div>
          </div>
          <div className="section-heading">
            <div>
              <h2>Requirements</h2>
              <p>Specifications tracked in this project.</p>
            </div>
            <button
              className="button button-primary"
              disabled={project.data.status === "ARCHIVED"}
              onClick={() => setCreating(true)}
            >
              New requirement
            </button>
          </div>
          <RequestState
            loading={validationSummary.isLoading}
            error={validationSummary.error}
          />
          {validationSummary.data && (
            <ProjectValidationSummary summary={validationSummary.data} />
          )}
          <TraceabilityCoverage projectId={projectId} />
          <RequestState
            loading={requirements.isLoading}
            error={requirements.error}
            empty={requirements.data?.data.length === 0}
            emptyMessage="No requirements in this project yet."
          />
          {!!requirements.data?.data.length && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Title</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Version</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.data.data.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link
                          className="key-link"
                          to={`/requirements/${item.id}`}
                        >
                          {item.requirementKey}
                        </Link>
                      </td>
                      <td>
                        <Link to={`/requirements/${item.id}`}>
                          {item.title}
                        </Link>
                      </td>
                      <td>{item.priority}</td>
                      <td>
                        <span className={`pill ${item.status.toLowerCase()}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>v{item.currentVersion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {requirements.data && requirements.data.pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="button button-secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {requirements.data.pagination.totalPages}
              </span>
              <button
                className="button button-secondary"
                disabled={page >= requirements.data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
          {issue && (
            <p role="alert" className="inline-error">
              {issue instanceof ApiRequestError && issue.status === 409
                ? "This item changed in another session. Refresh and try again."
                : (issue as Error).message}
            </p>
          )}
          {editing && (
            <Modal title="Edit project" onClose={() => setEditing(false)}>
              <ProjectForm
                project={project.data}
                busy={edit.isPending}
                error={edit.error?.message}
                onCancel={() => setEditing(false)}
                onSave={(input) => edit.mutate(input)}
              />
            </Modal>
          )}
          {creating && (
            <Modal title="New requirement" onClose={() => setCreating(false)}>
              <RequirementForm
                busy={create.isPending}
                error={create.error?.message}
                onCancel={() => setCreating(false)}
                onSave={(value) => create.mutate(value as RequirementInput)}
              />
            </Modal>
          )}
        </>
      )}
    </section>
  );
}
