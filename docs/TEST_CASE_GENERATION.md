# AI test case generation

Phase 6 generates reviewable test case drafts from resolved, **approved acceptance criteria on the current requirement version**. The service builds its own context from PostgreSQL; clients cannot submit criteria or trusted source IDs. Criteria are bounded to 30 per run and 32 KB of serialized context. The model receives requirement ID/version metadata and approved criteria only, never requirement prose. The versioned prompt is `1.0.0` and treats criterion text as untrusted data.

The existing `OllamaClient` boundary is reused. The model name is `OLLAMA_MODEL`; no provider or model is installed by this feature. When the local runtime is disabled, unreachable, or missing the model, a generation run records `UNAVAILABLE` or `FAILED`, the API returns a controlled error, and no test case is created. Successful model output is parsed as strict JSON, checked with Zod, checked against the exact supplied approved criterion IDs, bounded by size and count, and screened for unsupported scenario categories, invented numeric claims, concrete unsupported test data, and duplicate cases. Any model output remains untrusted after these checks.

## Review lifecycle

Generated test cases start as `DRAFT`. A reviewer can edit a draft; each edit records a JSON snapshot of the previous revision and increments its revision number. The deterministic validator checks structure, source criterion state, requirement-version freshness, test-data names, duplicate content, expected result evidence, and numerical claims. Errors block approval; grounding warnings remain visible for human review. Approval locks the requirement and case, rechecks its current version and approved criterion, and transitions only a valid draft to `APPROVED`. Drafts can instead be `REJECTED`. Historical cases keep their original requirement version and are never presented as current after a requirement change.

## API

- `POST /api/requirements/:requirementId/test-cases/generate` — generate from current approved criteria.
- `GET /api/requirements/:requirementId/test-cases` — list test cases and source criterion details.
- `GET /api/requirements/:requirementId/test-generation-runs` — generation history, source IDs, prompt/model metadata, status and limitations.
- `GET /api/test-cases/:testCaseId` — case, exact source version, criterion, run and edit revisions.
- `PATCH /api/test-cases/:testCaseId` — edit a draft only.
- `POST /api/test-cases/:testCaseId/validate` — return deterministic findings and approval eligibility.
- `POST /api/test-cases/:testCaseId/approve` and `/reject` — explicit human review transitions.
- `GET /api/test-cases/:testCaseId/revisions` — prior edit snapshots.

## Testing and limitations

CI uses clearly identified mock `OllamaClient` fixtures and does not require Ollama or download models. PostgreSQL workflow tests use the isolated `specforge_test` database. No live Ollama inference has been verified in this environment. Deterministic text grounding is conservative: lexical overlap and numeric checks can flag paraphrases for human review, and cannot prove semantic correctness. There is no authentication yet, so reviewer identity is not populated.
