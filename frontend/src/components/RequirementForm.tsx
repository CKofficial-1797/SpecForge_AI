import { useState, type FormEvent } from "react";
import type {
  Requirement,
  RequirementInput,
  RequirementPriority,
  RequirementStatus,
  RequirementUpdate,
} from "../services/requirements";

type RequirementFormValue = RequirementInput | RequirementUpdate;

interface RequirementFormProps {
  requirement?: Requirement;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onSave: (input: RequirementFormValue) => void;
}

const priorities: RequirementPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statuses: RequirementStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];

export function RequirementForm({
  requirement,
  busy,
  error,
  onCancel,
  onSave,
}: RequirementFormProps) {
  const [requirementKey, setRequirementKey] = useState(
    requirement?.requirementKey ?? "",
  );
  const [title, setTitle] = useState(requirement?.title ?? "");
  const [description, setDescription] = useState(
    requirement?.description ?? "",
  );
  const [priority, setPriority] = useState<RequirementPriority>(
    requirement?.priority ?? "MEDIUM",
  );
  const [status, setStatus] = useState<RequirementStatus>(
    requirement?.status ?? "DRAFT",
  );
  const [changeSummary, setChangeSummary] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields: RequirementInput = {
      requirementKey: requirementKey.trim(),
      title: title.trim(),
      description: description.trim(),
      priority,
    };
    if (requirement) {
      onSave({
        ...fields,
        status,
        expectedVersion: requirement.currentVersion,
        changeSummary: changeSummary.trim() || null,
      });
    } else {
      onSave({ ...fields, status: status === "ARCHIVED" ? "DRAFT" : status });
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <label className="field-label">
        Requirement key
        <input
          autoFocus
          maxLength={80}
          required
          value={requirementKey}
          onChange={(event) => setRequirementKey(event.target.value)}
        />
      </label>
      <label className="field-label">
        Title
        <input
          maxLength={180}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="field-label">
        Description
        <textarea
          required
          maxLength={20000}
          rows={5}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <div className="form-grid">
        <label className="field-label">
          Priority
          <select
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as RequirementPriority)
            }
          >
            {priorities.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Status
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as RequirementStatus)
            }
          >
            {statuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      {requirement && (
        <label className="field-label">
          Change summary <span className="optional-label">Optional</span>
          <input
            maxLength={1000}
            value={changeSummary}
            onChange={(event) => setChangeSummary(event.target.value)}
            placeholder="Describe what changed"
          />
        </label>
      )}
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
          {busy
            ? "Saving…"
            : requirement
              ? "Save changes"
              : "Create requirement"}
        </button>
      </div>
    </form>
  );
}
