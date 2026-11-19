# SpecForge development handoff

## Project and phase

- **Project:** SpecForge — From Requirements to Reliable Software.
- **Current phase:** Phase 6 test case generation and validation implemented; live Ollama execution remains unverified.
- **Last updated:** 2026-11-20.
- **Objective:** Build traceable requirement quality workflows through AI-assisted, human-reviewed test case drafts.
- **Branch and remote:** `main`; `origin` is `https://github.com/CKofficial-1797/SpecForge_AI.git`.
- **Phase 1 commit:** `85acb98 chore: initialize project foundation`.
- **Phase 2 commit:** `19134a7 feat: add project and requirement management`, pushed to `origin/main` with author `CKofficial-1797 <sanjaygorain1797@gmail.com>`.
- **Phase 3 commit:** `2d0c7fb feat: add deterministic requirement validation`, pushed to `origin/main`.
- **Phase 4 commit:** `66212e2 feat: add local AI requirement analysis`, pushed to `origin/main` with author `CKofficial-1797 <sanjaygorain1797@gmail.com>`.
- **Phase 5 commit:** `5847a3a feat: add clarification and acceptance criteria workflows`, pushed to `origin/main` with author `CKofficial-1797 <sanjaygorain1797@gmail.com>`.
- **Current Git status:** Phase 6 changes are uncommitted on `main`. No Phase 6 commit or push has been made.

## Previous phase history

The repository began empty and was initialized on `main`. Phase 1 created the React/Vite frontend, Express/TypeScript API, Prisma 7/PostgreSQL configuration, Compose services, CI, and engineering documentation. Phase 2 added Project, Requirement, and RequirementVersion models, migrations, CRUD/archive APIs, immutable versions, expected-version concurrency checks, and project/requirement screens. Requirement title, description, and priority edits create versions; key and status edits do not. Phase 1 and Phase 2 commits remain intact and pushed.

Before Phase 3 implementation, the working tree was clean at pushed commit `19134a7`. Regression checks passed: frontend 1 test, backend 8 tests, database integration 5 tests, typecheck, and lint. No Phase 1 or Phase 2 blocker was found. Some Phase 2 handoff text was stale about the push status; this file corrects it.

## Phase 3 implementation

- Added a pure deterministic engine with a fixed nine-rule registry, explicit configuration, stable rule order, per-rule `PASSED` / `ISSUES_FOUND` / `SKIPPED` outcomes, rule-failure isolation, safe failure explanations, finding deduplication, and Zod report validation.
- Rule-set version is `1.0.0`; increment it when rule behavior or default configuration changes.
- Rules: required fields/project association; configured vague terminology; conservative measurable conditions; actor identification; action identification; relevant outcome conditions; contextual failure/boundary conditions; exact normalized duplicate detection; and narrow explicit authentication/session-duration conflict detection.
- Findings include rule ID, category, severity, title, description, evidence, recommendation, and applicable field/reference metadata. Reports include actual finding/rule counts and next actions, with no arbitrary score.
- Added JSONB `ValidationReport` rows with report creation time, rule-set version, and exact requirement version. A composite foreign key enforces `(requirementId, requirementVersion)` against `RequirementVersion`. Validation locks the requirement while reading and saving the report. There are no report update/delete endpoints.
- Added server-side validation, paginated report-history, saved-report detail, and project-summary APIs. Request bodies do not supply trusted findings. Project summaries count only saved reports for each requirement's current version.
- Added requirement detail validation and history UI, plus a project validation summary. UI includes finding evidence/recommendations, severity labels, stale-version notices, history paging, and loading/error/empty/retry states.
- Added migrations `20261119185544_phase3_validation_reports` and `20261119191551_phase3_validation_report_version_fk`.
- Phase 3 implementation was committed and pushed as `2d0c7fb`.

## Phase 4 implementation

- Added optional direct Ollama chat client (`/api/chat`) with configurable base URL, model, timeout, bounded retries, JSON format request, safe failure mapping, tags health check, and injected client boundary for tests.
- AI remains disabled by default. The machine check found no Ollama executable/endpoint, about 15.3 GiB RAM, and no listed GPU adapter. Per user choice, no model default is locked; `OLLAMA_MODEL` is blank and must be configured after local verification. No Ollama/model was installed or downloaded.
- Added versioned prompt and strict Zod schema, controlled current-version target plus bounded same-project non-archived relational context, untrusted-input separation, explicit/missing/inference/uncertainty basis labels, output byte/schema/reference/quoted-evidence/duplicate guardrails, and no generated instruction execution.
- Added persisted JSONB `AiAnalysis` records with exact target version FK, context version references, model/prompt/schema/rule versions, status, safe error code, and execution timestamps/duration.
- Added `/api/ai/health`, `POST /api/requirements/:requirementId/analyze`, and paginated history/detail routes. Successful analyze requests run or retrieve the current-version deterministic report and return it separately beside the AI analysis. Failed AI outputs are never saved as successful.
- Added separate semantic AI section and health state on requirement detail. Confidence is labeled as a model estimate. Analysis remains synchronous and request timeout is bounded by `OLLAMA_TIMEOUT_MS`.
- Migration: `20261120103000_phase4_ai_analysis`.
- Mocked client/output guard tests added. Real model execution is unverified because Ollama is unavailable.

## Phase 5 implementation

- Added `ClarificationQuestion` and append-only `ClarificationAnswer` revision models. Questions are source-analysis-bound and requirement-bound by composite FK. Same-analysis normalized question fingerprints make repeated imports idempotent while identical wording from another analysis remains traceable. A partial unique index enforces one current answer; submit/edit/dismiss use row locks and explicit state transitions.
- Added refinement draft persistence tied to the exact base requirement version and source analysis. The versioned prompt uses original and same-project non-archived version context plus latest answered Q/A pairs only. The application adds open/dismissed questions to saved unresolved output, validates every applied question/answer pair, and blocks approval when assumptions or unresolved questions remain.
- Refactored requirement update into a transaction helper shared by normal edits and draft approval. Approval locks the requirement and draft, rejects stale/no-op drafts, creates a new immutable content version, approves the draft, and supersedes competing pending drafts in one transaction. Rejection never changes requirement content. `reviewedBy` is null because authentication does not exist.
- Added acceptance criteria generation from canonical current requirement versions, with versioned prompt, strict G/W/T schema, output size limits, deterministic duplicate fingerprints, unresolved-detail state, and source-version FKs. Clarification answers from the current version must first be incorporated by an approved refinement. Each criterion remains an individual draft until approved/rejected; unresolved or historical criteria cannot be approved. Old criteria remain stored and are marked historical on read.
- Added clarification import/list/detail/answer/edit/dismiss APIs; refinement generation/list/detail/approve/reject APIs; and criteria generate/list/detail/approve/reject APIs. Added a requirement detail workflow section for Q/A history, refinement review, stale warnings, and individual G/W/T review.
- Migration: `20261120143000_phase5_clarification_refinement_criteria`, applied to local `specforge` and isolated `specforge_test` databases.
- Refinement prompt version `1.0.0`; acceptance criteria prompt version `1.0.0`. No local model is configured, so generation was verified through injected mocks, not a real Ollama run.

## Phase 6 implementation

- Reused the Phase 4 `OllamaClient`; no new provider or dependency was added. Test prompt version and schema version are `1.0.0`.
- Added bounded database-built context from only resolved, approved acceptance criteria for the current requirement version. Archived requirements are rejected; context is limited to 30 criteria and 32 KB. The model receives only requirement ID/version metadata and approved criterion contents. Model output is strict JSON, limited to 48 KB / 60 test cases, and checked against supplied criterion IDs, unsupported scenario categories, invented numeric claims, unsupported concrete test data, and duplicate case content.
- Added deterministic test-case findings for required fields and meaningful steps, expected-result grounding, unexpected numerical claims, duplicate test data names, duplicate cases, approved criterion state, and exact current requirement version. Errors block approval; warnings are retained for human review.
- Added test generation run history (source criterion IDs/version, model, prompt, status, limitations, safe error code, duration), draft test cases, and JSON revision snapshots. Composite database foreign keys bind each case to its source criterion, exact requirement version, and generation run. Case edits snapshot prior values and are allowed only while draft.
- Added transactional approval/rejection transitions. Approval locks the requirement and case, confirms the generation run succeeded, validates criteria and current version, and rejects deterministic errors. Reviewer identity remains null because authentication is not implemented.
- Added API endpoints for generation, listing, generation history, detail, draft edit, validation, approval/rejection, and revision history. Added a Test Cases section on the requirement detail screen with approved criteria, Ollama availability, generation history, traceability, findings, draft editing, and human review.
- Migration: `20261121100000_phase6_test_case_generation`.
- Live Ollama inference remains unverified because Ollama is not installed/configured. The successful generation paths were exercised with test-only mock fixtures.

## Known limitations

- Vague-language, measurability, actor/action, outcome, and failure/boundary checks are conservative heuristics. They may miss issues or raise warnings that need human judgment; they are not proof of requirement quality.
- Duplicate detection matches exact normalized title and description after Unicode, case, punctuation, and whitespace normalization. Near-duplicate similarity is not implemented.
- Conflict detection supports only explicit authentication and session-duration patterns. It does not detect arbitrary semantic contradictions. Detected conflicts are potential conflicts and require human review.
- Backend health reports process status and does not query PostgreSQL.
- Phase 3 remote CI has not yet been verified through a GitHub Actions run.
- Deterministic expected-result grounding uses number checks and conservative lexical overlap. It cannot prove semantic correctness; warnings require human review.

## Validation results

- Phase 1/2 regression before Phase 3: unit tests passed (frontend 1, backend 8); integration passed (5 tests); typecheck and lint passed.
- Phase 3 `npm run test`: passed (frontend 3 tests; backend 22 tests).
- `npm run test:integration --workspace backend` with `TEST_DATABASE_URL` on `specforge_test`: passed (4 files, 9 tests), including report persistence, immutable historical results, current-version summaries, scoped report access, ignored client findings, and simulated report-persistence failure handling.
- `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run format:check`: passed.
- `npx prisma validate --schema prisma/schema.prisma`: passed.
- Phase 3 migrations were applied to local development and isolated test databases.
- `docker compose config --quiet`: passed. Docker images rebuilt and all services started; backend logs reported four migrations and no pending migrations.
- Live smoke checks: API health returned `{ "status": "ok", "service": "specforge-api" }`; `/api/projects` returned an empty paginated list; a missing requirement validation route returned 404; frontend `/projects` returned HTTP 200.
- GitHub Actions was not run remotely for Phase 3.

## Phase 4 validation results

- `npm run test`: passed after Phase 4 (frontend 3 tests; backend 33 tests).
- Integration regression against isolated `specforge_test`: passed after Phase 4 (5 files, 12 tests), including same-project context filtering, exact target version, successful mocked persistence/history, invalid output rejection, and unavailable handling.
- `npm run typecheck`: passed.
- `npm run lint`: passed after removing one unused test import.
- `npm run build`: passed for backend and frontend.
- `npm run format:check`: passed.
- `npx prisma validate --schema prisma/schema.prisma`: passed.
- Phase 4 migration applied successfully to both local `specforge` and isolated `specforge_test` databases; integration regression passed after migration.
- No live Ollama/model verification; mocked tests passed only.

## Phase 5 validation results

- `npm run test`: passed (frontend 5 tests; backend 39 tests).
- `npm run test:integration --workspace backend` on isolated `specforge_test`: passed (6 files, 15 tests), including import idempotence, same-project reference validation, answer revisions/transitions, refinement approval/rejection/stale conflict/transaction rollback, and acceptance criteria lifecycle/version history.
- `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run format:check`: passed.
- `npx prisma validate --schema prisma/schema.prisma`: passed; Phase 5 migration applied to local `specforge` and isolated `specforge_test` databases.
- `docker compose config --quiet` and `docker compose build`: passed for backend and frontend images.
- `git diff --check`: passed; only Git's routine CRLF normalization warnings were reported.
- Live Ollama execution remains unverified; ordinary tests use injected mock clients.

## Phase 6 validation results

- Prior-phase baseline `npm run test`: frontend 5 and backend 39 tests passed after rerunning with local socket access.
- Prior-phase integration baseline against isolated `specforge_test`: 6 files, 15 tests passed.
- `npm run test`: passed (frontend 4 files / 9 tests; backend 14 files / 49 tests). The two API tests requiring local sockets were run with local socket access.
- `npm run test:integration --workspace backend` with `TEST_DATABASE_URL` pointing at isolated `specforge_test`: passed (7 files / 19 tests).
- Phase 6 migration `20261121100000_phase6_test_case_generation` applied to both local `specforge` and isolated `specforge_test` databases.
- `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run format:check`: passed.
- `npx prisma validate --schema prisma/schema.prisma` and `docker compose config --quiet`: passed.
- `git diff --check`: passed; Git emitted only routine LF-to-CRLF normalization warnings.
- Docker image build and GitHub Actions were not run for Phase 6.
- Ollama remains unavailable; there is no claim of real model inference.

## Relevant files

- Engine, rules, contract, routes, and service: `backend/src/modules/requirement-validation/`.
- Unit tests: `backend/src/modules/requirement-validation/rules/validation-rules.test.ts`, `backend/src/modules/requirement-validation/engine/validation-engine.test.ts`.
- Integration tests: `backend/tests/integration/validation.test.ts`.
- UI and API client: `frontend/src/components/ValidationReportView.tsx`, `frontend/src/components/ProjectValidationSummary.tsx`, `frontend/src/pages/RequirementDetailPage.tsx`, `frontend/src/pages/ProjectDetailPage.tsx`, `frontend/src/services/validation.ts`.
- Schema/migrations: `prisma/schema.prisma`, `prisma/migrations/20261119185544_phase3_validation_reports/`, `prisma/migrations/20261119191551_phase3_validation_report_version_fk/`.
- Test generation: `backend/src/modules/test-cases/`, `backend/tests/integration/test-cases.test.ts`, `frontend/src/components/TestCaseWorkflow.tsx`, `frontend/src/services/testCases.ts`, `docs/TEST_CASE_GENERATION.md`.

## Git and next steps

- Current branch is `main`, tracking `origin/main` at Phase 5 commit `5847a3a`; Phase 6 changes are local and uncommitted.
- Proposed Phase 6 commit: `feat: add AI-assisted test case generation and review`. Do not commit or push without explicit approval.
- **Phase 7 starting point:** the reviewed Phase 6 implementation after this commit is approved. Do not start Phase 7 unless explicitly instructed.
