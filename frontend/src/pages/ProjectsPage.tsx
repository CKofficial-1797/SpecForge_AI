import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../components/Modal";
import { ProjectForm } from "../components/ProjectForm";
import { RequestState } from "../components/RequestState";
import { ApiRequestError } from "../services/api";
import {
  createProject,
  listProjects,
  type ProjectInput,
} from "../services/projects";

export function ProjectsPage() {
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["projects", page],
    queryFn: () => listProjects({ page, pageSize: 20 }),
  });
  const mutation = useMutation({
    mutationFn: (input: ProjectInput) => createProject(input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["projects"] });
      setCreating(false);
    },
  });
  const err = mutation.error;
  return (
    <section className="page-container">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Projects</h1>
          <p className="page-subtitle">Organize requirements by project.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setCreating(true)}
        >
          New project
        </button>
      </div>
      <RequestState
        loading={query.isLoading}
        error={query.error}
        empty={query.data?.data.length === 0}
        emptyMessage="No projects yet. Create one to start managing requirements."
      />
      {!!query.data?.data.length && (
        <div className="card-list">
          {query.data.data.map((project) => (
            <Link
              className="project-card"
              to={`/projects/${project.id}`}
              key={project.id}
            >
              <div>
                <h2>{project.name}</h2>
                <p>{project.description || "No description"}</p>
              </div>
              <span className={`pill ${project.status.toLowerCase()}`}>
                {project.status}
              </span>
            </Link>
          ))}
        </div>
      )}
      {query.data && query.data.pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="button button-secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {query.data.pagination.totalPages}
          </span>
          <button
            className="button button-secondary"
            disabled={page >= query.data.pagination.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
      {creating && (
        <Modal title="Create project" onClose={() => setCreating(false)}>
          <ProjectForm
            busy={mutation.isPending}
            error={err instanceof ApiRequestError ? err.message : err?.message}
            onCancel={() => setCreating(false)}
            onSave={(input) => mutation.mutate(input)}
          />
        </Modal>
      )}
    </section>
  );
}
