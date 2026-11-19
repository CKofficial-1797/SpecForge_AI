# Architecture

## Application structure

SpecForge is a modular monolith. The browser application and API are separate packages with independent build/runtime boundaries, not separate business services. PostgreSQL is the planned persistent store, accessed through Prisma.

```text
Browser → React frontend → Express API → Prisma → PostgreSQL
                                      ↘ optional local Ollama
```

## Responsibilities and planned boundaries

- **Frontend:** React Router screens for project/requirement management, version history, validation, optional AI analysis, clarification/refinement review, and acceptance criteria review. TanStack Query manages API state.
- **Backend:** HTTP boundary and modular project/requirement services with Zod validation, pagination, filtering, error mapping, and transactional writes.
- **Database:** PostgreSQL stores projects, requirements, and immutable content versions through Prisma migrations.
- **Validation engine:** pure rule functions receive a requirement, same-project related requirements, and explicit rule configuration. A fixed registry runs nine rules in stable order and the Zod contract validates the final report.
- **Validation service:** loads and locks the current requirement version, runs the engine, and stores the validated report in the same transaction. HTTP controllers never supply trusted findings.
- **Validation reports:** JSONB rows are associated with requirement ID, exact content version, rule-set version, and creation timestamp. The application exposes no update or delete endpoint for reports.
- **AI service:** optional structured semantic analysis through a typed Ollama HTTP boundary. Prompt construction, Zod schema, output guard, context builder, orchestration, and application persistence have separate responsibilities. Ollama is never required for API startup or deterministic validation.
- **Human review:** deterministic findings, AI findings, clarifications, requirement refinements, and acceptance criteria remain separate reviewable records. Approval is an explicit server-controlled transition.

Requirement versions snapshot title, description, and priority. Key and status are mutable metadata and do not create versions. Versioned updates lock the requirement row, check `expectedVersion`, then update the current record and insert the next snapshot in one transaction. Validation acquires a shared row lock while it reads the current content and inserts its report, preventing a concurrent edit from changing the content during analysis. A report remains tied to its saved version after later edits.

The rule registry contains checks for required fields/project association, configured vague phrases, measurable conditions, actor and action language, outcome conditions, contextual failure/boundary conditions, exact normalized duplicates, and explicit authentication/session-duration conflicts. Findings carry category, severity, evidence, recommendation, and related requirement references. The engine has no numeric quality score. Failed rules are logged and marked `SKIPPED` with a safe explanation rather than appearing to pass. Exact duplicates normalize Unicode, case, whitespace, and punctuation; near-duplicate similarity is not implemented. Conflict checks do not claim general semantic contradiction detection.

## Optional AI semantic analysis

`backend/src/modules/ai` implements a direct `/api/chat` Ollama client with bounded timeout/retry behavior, model health checks, versioned system prompt, strict Zod output contract, bounded relational context builder, output guard, and orchestration. Ollama is disabled unless explicitly configured; no model download is part of startup. `OLLAMA_MODEL` has no assumed default because local hardware and Ollama availability must be verified by each developer.

The context builder loads the target's exact current `RequirementVersion` and a configurable maximum of non-archived requirements from the same project, ordered deterministically and clipped to a total character budget. The prompt keeps system instruction separate from JSON-delimited untrusted requirement content, requests no secrets, and warns that requirement text is data. This is defense in depth, not a claim of prompt-injection immunity. Model output is byte-limited, parsed as JSON, checked against strict Zod enums/shape/length bounds, checked for duplicate findings and supplied IDs, and checked for clearly fabricated quoted evidence. Each finding labels its basis as explicit, missing, inference, or uncertainty. Validated output alone is stored as JSONB. Failure rows contain only status and a bounded safe code. Each row stores target and context versions, configured model, prompt/schema/rule versions, status, duration, and timestamps. A composite foreign key binds analysis to its exact target version.

Deterministic and AI results use separate endpoints, storage, and UI sections. AI cannot alter requirements, validation results, or status. Health at `/api/ai/health` reports the optional dependency without affecting `/api/health`. Failed/unavailable analyses are not presented as results; existing successful history remains readable. Analysis is synchronous and bounded by the configured Ollama timeout; queue-based execution is deferred unless observed model latency exceeds the HTTP lifecycle.

## Clarifications, refinement, and acceptance criteria

`ClarificationQuestion` rows are imported only from successful, schema-valid persisted analyses. The source analysis and requirement association are enforced together by a composite foreign key. A normalized SHA-256 question fingerprint is unique within one requirement and one source analysis; repeated imports are idempotent while identical wording from separate analyses remains traceable to each source. Related requirement references are checked against the source analysis context and same project before import.

`ClarificationAnswer` stores each submitted answer as a revision. A partial unique index allows only one current answer per question. Answer edits atomically mark the old revision non-current and add a new revision. Questions use only `OPEN → ANSWERED`, `OPEN → DISMISSED`, and `ANSWERED → ANSWERED` when an answer revision changes; dismissed questions cannot be answered or reopened. Dismissed/open questions remain unresolved for generation.

Refinement prompts include the exact source requirement version, project constraints, same-project non-archived related versions from the saved analysis context, and only latest answers to answered questions. Unanswered/dismissed question text is not sent as resolved context; the server adds it to the saved proposal's unresolved list. The output schema checks question/answer pairs against supplied current answer IDs and requires every supplied answer to be explicitly accounted for. Drafts store prompt version, structured proposal, source analysis, and exact base version. Approval locks the requirement and draft, rejects stale bases, rejects assumptions/unresolved questions, validates no-op/content constraints, calls the shared expected-version requirement update transaction, creates a version snapshot, approves the draft, and supersedes other pending drafts atomically. Rejection leaves the canonical requirement untouched. Reviewer identity stays nullable because authentication is not implemented.

Acceptance criteria are generated only from the exact current requirement version after open/dismissed clarifications are resolved and answered clarification sets have been incorporated through an approved refinement. Strict schema, byte limits, non-empty Given/When/Then fields, deterministic duplicate fingerprints, and version foreign keys guard persistence. Each record starts as `DRAFT`, stores model/prompt provenance, and can be individually approved or rejected. Unresolved details cannot be approved; historical records retain their source version and are flagged at read time rather than rewritten.

Refinement prompt version and acceptance prompt version are recorded with their records. Both prompts treat requirement/answer text as untrusted input, delimit JSON context, escape delimiter characters, and require uncertainty reporting. Prompt wording is not a complete prompt-injection defense; output schemas, database reference checks, status transitions, and human approval remain separate safeguards.

The project validation summary uses only saved reports whose `requirementVersion` equals the current requirement version. Older reports remain available in requirement history but do not count as analysis of changed content. The modular monolith keeps deployment simple; background queues, Redis, vector stores, microservices, and autonomous agents remain outside scope.

## Test case generation

`backend/src/modules/test-cases` reuses the Phase 4 `OllamaClient`. Its context builder reads the current immutable requirement version and only resolved `APPROVED` acceptance criteria attached to that version. The builder rejects archived requirements, bounds context to 30 criteria and 32 KB, and supplies no client-provided text. Only requirement ID/version metadata and approved criteria enter the prompt. The prompt is versioned `1.0.0`; output uses a strict Zod contract with allowlisted test types and priorities, size/count limits, supplied criterion reference checks, numeric claim and scenario relevance checks, unsupported concrete test-data rejection, and deterministic duplicate detection.

`TestGenerationRun` records exact source criterion IDs, requirement version, model and prompt provenance, status, duration, limitations, and safe error code. `TestCase` has composite foreign keys to the exact requirement version, source criterion, and generation run, so cross-requirement/version links are rejected by PostgreSQL. A generated case starts `DRAFT`; editable fields are snapshotted into `TestCaseRevision` before each edit. Deterministic validation remains distinct from model output and review status. Approval locks both requirement and case, then checks current-version identity, approved/resolved criterion state, successful generation, and deterministic errors inside a transaction. A warning requires human attention but does not alone block approval. Stale cases remain historical and cannot be approved.

The requirement detail screen keeps generated suggestions, deterministic findings, and human decision state visible as distinct concepts. If Ollama is unavailable, the API persists a safe failed/unavailable run and returns an error without test cases. CI uses mocked client fixtures; live Ollama inference has not been verified. See [test generation API and prompt contract](TEST_CASE_GENERATION.md).

# Traceability and coverage (Phase 7)

The traceability module reads the existing composite requirement/version/criterion/generation-run relationships. It computes current and historical coverage without mutating approval state. Project matrix rows are paginated at the requirement level and related artifacts are loaded in batches. Project summaries use grouped counts and compact identifiers. A pure coverage calculator defines eligibility, uniqueness, stale status, and gap codes; the existing deterministic validation and AI/test generation findings remain separate.

The matrix, summary, gap, approval, and per-artifact trace endpoints are mounted under the existing project, requirement, criterion, and test-case routers. PostgreSQL composite foreign keys prevent cross-project and mismatched-version links. `INVALID` remains visible as an integrity signal for legacy/corrupt data; the application does not repair it automatically. There is no Phase 7 migration.

# Security and operations (Phase 8)

API requests receive correlation IDs and structured logs exclude query values, request bodies, and prompt content. The API and Nginx set baseline security headers; request size and per-process request rates are bounded. Health endpoints separate application liveness, database readiness, and optional Ollama status. Ollama output is capped before parsing, then passes existing strict schemas and semantic/reference checks.

Authentication and project ownership/roles do not exist. All resource routes are currently addressable by UUID without a user principal; therefore, the API must remain restricted to a trusted local network until authorization is added. No authentication architecture or role model was introduced in Phase 8 per the user's decision to defer it. See `SECURITY.md`, `docs/RELIABILITY.md`, and `docs/AI_EVALUATION.md`.
