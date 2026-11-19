import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { RequestState } from "./RequestState";
import {
  getApprovalOverview,
  getTraceGaps,
  getTraceability,
  getTraceSummary,
} from "../services/traceability";

function CoverageText({
  status,
  percentage,
  coveredCriteria,
  eligibleCriteria,
}: {
  status: string;
  percentage: number | null;
  coveredCriteria: number;
  eligibleCriteria: number;
}) {
  return status === "NOT_APPLICABLE" || percentage === null ? (
    <>Not applicable · no approved criteria</>
  ) : (
    <>
      {percentage}% · {coveredCriteria} of {eligibleCriteria} criteria covered
    </>
  );
}

export function TraceabilityCoverage({ projectId }: { projectId: string }) {
  const summary = useQuery({
    queryKey: ["trace-summary", projectId],
    queryFn: () => getTraceSummary(projectId),
  });
  const approval = useQuery({
    queryKey: ["approval-overview", projectId],
    queryFn: () => getApprovalOverview(projectId),
  });
  const matrix = useQuery({
    queryKey: ["traceability", projectId, 1],
    queryFn: () => getTraceability(projectId, 1),
  });
  const gaps = useQuery({
    queryKey: ["trace-gaps", projectId, 1],
    queryFn: () => getTraceGaps(projectId, 1),
  });
  return (
    <section
      className="traceability-section"
      aria-label="Traceability and coverage"
    >
      <div className="summary-heading">
        <div>
          <h2>Traceability &amp; coverage</h2>
          <p>
            Requirement versions link reviewed acceptance criteria to generated
            test cases.
          </p>
        </div>
      </div>
      <RequestState
        loading={
          summary.isLoading ||
          approval.isLoading ||
          matrix.isLoading ||
          gaps.isLoading
        }
        error={summary.error || approval.error || matrix.error || gaps.error}
      />
      {summary.data && approval.data && (
        <>
          <div className="traceability-metrics">
            <article>
              <span>Current coverage</span>
              <strong>
                <CoverageText {...summary.data.coverage} />
              </strong>
            </article>
            <article>
              <span>Criteria awaiting approval</span>
              <strong>{approval.data.pending.acceptanceCriteria}</strong>
            </article>
            <article>
              <span>Test cases awaiting approval</span>
              <strong>{approval.data.pending.testCases}</strong>
            </article>
            <article>
              <span>Refinements awaiting approval</span>
              <strong>{approval.data.pending.refinementDrafts}</strong>
            </article>
            <article>
              <span>Historical coverage</span>
              <strong>
                <CoverageText {...summary.data.historicalCoverage} />
              </strong>
            </article>
            <article>
              <span>Stale artifacts</span>
              <strong>{summary.data.counts.staleArtifacts}</strong>
            </article>
          </div>
          <details className="traceability-details">
            <summary>
              Approval overview ({approval.data.pending.total} pending)
            </summary>
            <p>
              Approved: {approval.data.approved.total} · Rejected:{" "}
              {approval.data.rejected.total} · Current items are listed below.
            </p>
            {Object.entries(approval.data.items).map(([kind, items]) => (
              <div key={kind}>
                <h3>
                  {kind.replace(
                    /[A-Z]/g,
                    (letter) => ` ${letter.toLowerCase()}`,
                  )}
                </h3>
                {items.length ? (
                  <ul>
                    {items.map((item) => (
                      <li key={item.id}>
                        <Link to={`/requirements/${item.requirementId}`}>
                          {item.requirementKey}: {item.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>None awaiting review.</p>
                )}
              </div>
            ))}
          </details>
        </>
      )}
      {matrix.data && (
        <details className="traceability-details">
          <summary>
            Traceability matrix ({matrix.data.pagination.total} requirements)
          </summary>
          {matrix.data.data.map((row) => (
            <article className="traceability-row" key={row.requirement.id}>
              <h3>
                <Link to={`/requirements/${row.requirement.id}`}>
                  {row.requirement.requirementKey}: {row.requirement.title}
                </Link>{" "}
                <small>v{row.requirement.currentVersion}</small>
              </h3>
              <p>
                {row.coverageStatus.replaceAll("_", " ")} ·{" "}
                <CoverageText {...row.coverage} />
              </p>
              {row.acceptanceCriteria.map((criterion) => (
                <div className="traceability-criterion" key={criterion.id}>
                  <strong>
                    <Link
                      to={`/requirements/${row.requirement.id}#acceptance-criterion-${criterion.id}`}
                    >
                      {criterion.title}
                    </Link>
                  </strong>{" "}
                  <span>
                    {criterion.status} · {criterion.traceabilityStatus} ·{" "}
                    {criterion.testCases.length} test cases
                  </span>
                  {criterion.testCases.map((testCase) => (
                    <p key={testCase.id}>
                      <Link
                        to={`/requirements/${row.requirement.id}#test-case-${testCase.id}`}
                      >
                        {testCase.title}
                      </Link>{" "}
                      — {testCase.status}, {testCase.traceabilityStatus}
                    </p>
                  ))}
                </div>
              ))}
            </article>
          ))}
        </details>
      )}
      {gaps.data && (
        <details
          className="traceability-details"
          open={gaps.data.data.length > 0}
        >
          <summary>
            Coverage gaps ({gaps.data.data.length} on this page)
          </summary>
          {gaps.data.data.length ? (
            <ul>
              {gaps.data.data.map((gap, index) => (
                <li
                  key={`${gap.code}-${gap.acceptanceCriterionId ?? gap.testCaseId ?? gap.requirementId}-${index}`}
                >
                  <Link to={`/requirements/${gap.requirementId}`}>
                    {gap.requirementKey}: {gap.message}
                  </Link>
                  <p>{gap.recommendation}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No coverage gaps on this page.</p>
          )}
        </details>
      )}
    </section>
  );
}
