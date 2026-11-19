# Phase 7: traceability, coverage, and approval overview

SpecForge keeps direct database links from a requirement to its immutable version, acceptance criteria, test generation run, and test cases. Composite foreign keys bind criteria and test cases to the same requirement and source version. There is no traceability migration because those links and constraints were introduced by the earlier phases.

## API

- `GET /api/projects/:projectId/traceability?page=1&pageSize=20` returns a paginated requirement-to-version-to-criterion-to-test-case matrix. Requirement rows are paginated before related records are batch loaded.
- `GET /api/projects/:projectId/coverage-summary` returns compact project-wide counters and coverage values.
- `GET /api/projects/:projectId/coverage-gaps?page=1&pageSize=20` returns gaps for the same page of requirements as the matrix.
- `GET /api/projects/:projectId/approval-overview` returns pending, approved, rejected, and stale workflow counts plus a bounded list of current pending items.
- `GET /api/requirements/:requirementId/traceability`, `GET /api/acceptance-criteria/:criterionId/traceability`, and `GET /api/test-cases/:testCaseId/traceability` return scoped trace chains.

Responses use the existing `{ data }` envelope, with pagination metadata on lists. UUIDs and page inputs are validated. Missing projects and artifacts return the existing structured 404 response. Matrix and summary queries are project scoped.

## Coverage definition

The denominator is the number of approved acceptance criteria attached to the current version of a non-archived requirement with a valid requirement/version relationship. The numerator is the number of distinct denominator criteria with at least one approved test case on the same requirement and exact version, with valid criterion and generation-run relationships. Multiple approved cases for one criterion count once. The percentage is rounded to one decimal place. With no eligible criteria the status is `NOT_APPLICABLE` and percentage is `null`, never 100%.

Historical coverage is reported separately for historical requirement versions and never contributes to current coverage. Criteria and test cases retain distinct approval state and traceability state (`CURRENT`, `HISTORICAL`, `STALE`, `SUPERSEDED`, or `INVALID`). Archived requirements remain inspectable, but do not contribute to project current coverage. Coverage gaps are advisory workflow guidance, not changes to approval state.

`staleArtifacts` includes historical criteria, older-version test cases, and pending refinement drafts based on an older version. `invalidArtifacts` counts inconsistent or missing source links; database constraints normally prevent these states. It is reported as an integrity signal rather than silently repaired.

## UI and limits

Project details show current and historical coverage, pending approvals, stale artifacts, the paginated matrix, and actionable gaps. Requirement links lead to the existing workflow sections; criterion and test case cards have stable anchors. Human approval remains the only way to accept generated or refined content. Approval identities remain unavailable because authentication has not been implemented.

The matrix pages requirements (20 by default, up to 100). Summary endpoints aggregate compact identifiers and grouped counts rather than loading descriptions or every artifact body. The database schema's composite foreign keys remain the primary cross-project integrity control.
