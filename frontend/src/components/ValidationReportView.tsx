import type { ValidationReportRecord } from "../services/validation";

export function ValidationReportView({
  record,
}: {
  record: ValidationReportRecord;
}) {
  const { reportData } = record;
  return (
    <div className="validation-report">
      <div className="validation-report-meta">
        <span>Requirement version {record.requirementVersion}</span>
        <span>Rule set {record.ruleSetVersion}</span>
        <span>Analyzed {new Date(record.createdAt).toLocaleString()}</span>
      </div>
      <div className="validation-counts" aria-label="Validation finding counts">
        <div>
          <strong>{reportData.summary.errors}</strong>
          <span>Errors</span>
        </div>
        <div>
          <strong>{reportData.summary.warnings}</strong>
          <span>Warnings</span>
        </div>
        <div>
          <strong>{reportData.summary.passedRules}</strong>
          <span>Passed checks</span>
        </div>
        <div>
          <strong>{reportData.summary.skippedRules}</strong>
          <span>Skipped checks</span>
        </div>
      </div>
      <h3>Findings</h3>
      {reportData.findings.length === 0 ? (
        <p className="validation-empty">
          No findings were produced by the configured checks for this version.
        </p>
      ) : (
        <div className="finding-list">
          {reportData.findings.map((finding, index) => (
            <article
              className="finding-card"
              key={`${finding.ruleId}-${index}`}
            >
              <div className="finding-heading">
                <span
                  className={`severity-label severity-${finding.severity.toLowerCase()}`}
                >
                  {finding.severity}
                </span>
                <span className="finding-rule">{finding.ruleId}</span>
                <span className="finding-category">{finding.category}</span>
              </div>
              <h4>{finding.title}</h4>
              <p>{finding.description}</p>
              <p className="finding-evidence">
                <strong>Evidence:</strong> {finding.evidence}
              </p>
              <p className="finding-recommendation">
                <strong>Next step:</strong> {finding.recommendation}
              </p>
              {finding.relatedRequirements?.map((related) => (
                <p key={related.requirementId} className="related-reference">
                  Related: {related.requirementKey} — {related.title}
                </p>
              ))}
            </article>
          ))}
        </div>
      )}
      {reportData.suggestedNextActions.length > 0 && (
        <div className="next-actions">
          <h3>Suggested next actions</h3>
          <ul>
            {reportData.suggestedNextActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
