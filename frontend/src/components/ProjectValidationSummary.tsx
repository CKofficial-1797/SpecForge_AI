import type { ProjectValidationSummary as Summary } from "../services/validation";

export function ProjectValidationSummary({ summary }: { summary: Summary }) {
  return (
    <section
      className="validation-summary"
      aria-label="Project validation summary"
    >
      <div className="summary-heading">
        <div>
          <h2>Validation overview</h2>
          <p>
            Based on the latest saved report for each current requirement
            version.
          </p>
        </div>
        <strong>
          {summary.requirementsAnalyzed} / {summary.requirementsTotal} analyzed
        </strong>
      </div>
      <div className="summary-grid">
        <div>
          <strong>{summary.requirementsWithErrors}</strong>
          <span>Requirements with errors</span>
        </div>
        <div>
          <strong>{summary.requirementsWithWarnings}</strong>
          <span>Requirements with warnings</span>
        </div>
        <div>
          <strong>{summary.requirementsWithoutFindings}</strong>
          <span>Without findings</span>
        </div>
        <div>
          <strong>{summary.requirementsNotAnalyzed}</strong>
          <span>Not analyzed</span>
        </div>
      </div>
    </section>
  );
}
