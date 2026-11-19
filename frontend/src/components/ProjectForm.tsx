import { useState, type FormEvent } from "react";
import type { Project, ProjectInput } from "../services/projects";

interface ProjectFormProps {
  project?: Project;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onSave: (input: ProjectInput) => void;
}

export function ProjectForm({
  project,
  busy,
  error,
  onCancel,
  onSave,
}: ProjectFormProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ name: name.trim(), description: description.trim() || null });
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <label className="field-label">
        Project name
        <input
          autoFocus
          maxLength={120}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="field-label">
        Description <span className="optional-label">Optional</span>
        <textarea
          maxLength={2000}
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? "Saving…" : project ? "Save changes" : "Create project"}
        </button>
      </div>
    </form>
  );
}
