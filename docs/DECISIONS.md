# Engineering decisions

Labels distinguish approved requirements, implementation defaults, and open questions.

## Approved

- React, TypeScript, Vite, Tailwind CSS, React Router, and TanStack Query for the frontend.
- Node.js, Express, TypeScript, and Zod for the backend.
- PostgreSQL through local Docker Compose with Prisma; no managed database in current scope.
- Prisma ORM 7 with its PostgreSQL driver adapter and Zod 4 for validation; these versions address advisories in older releases and fit the Node.js 22+ target.
- Modular monolith with separate frontend and backend packages.
- AI remains excluded from Phase 3. Deterministic checks run without a model and their outputs are reviewable by people.
- Deterministic validation, AI analysis, and human approval have separate responsibilities.

## Engineering defaults

- PostgreSQL 17 Alpine for local Compose, Node 22 Alpine for runtime images.
- Local non-secret convenience values in `.env.example`; deployment credentials supplied separately.
- Health response: `{ "status": "ok", "service": "specforge-api" }`.
- Compose host ports: 5432 PostgreSQL, 3000 API, and 8080 frontend.
- Prisma CLI config falls back to the non-secret local sample URL when `DATABASE_URL` is absent so client generation and schema validation work from a fresh checkout. The API itself still requires an explicit valid `DATABASE_URL` at startup.
- Validation rule-set version is `1.0.0`; increment it when rule behavior or default rule configuration changes. Each persisted report stores its rule-set version and exact requirement version.
- Validation reports are stored as JSONB because the app retrieves complete historical reports; findings do not need independent relational queries.

## Phase 3 validation decisions

- Deterministic validation precedes AI so basic requirement checks remain reproducible and available without a model.
- Reports use finding counts and per-rule outcomes, not a quality score or percentage that would imply unsupported precision.
- Vague-language, measurability, actor/action, outcome, and failure-condition rules are conservative heuristics. They report warnings with evidence and recommendations, not proof of defects.
- Duplicate detection is exact after Unicode/case/whitespace/punctuation normalization; near-duplicate matching is deferred because a broad similarity threshold could mislead.
- Conflict detection only compares explicit, supported authentication and session-duration patterns. Every detected conflict is labeled potential and includes both requirement references for human review.
- A report is immutable application history for one requirement version. Requirement edits do not alter old reports; analysis of a new version creates a new report.

## Phase 4 AI decisions

- Ollama is the local-only inference boundary; the backend sends no requirement content to a cloud LLM provider. Direct HTTP keeps the dependency surface small and model execution optional.
- Qwen2.5 Instruct is the initial model family to evaluate, but no tag is the application default. `OLLAMA_MODEL` stays unset and `OLLAMA_ENABLED=false` until a developer verifies local Ollama/model compatibility and resource fit.
- Prompt and output schema are separately versioned. Requirement content is untrusted data; instructions remain in the system message, output is independently validated, references are restricted to supplied same-project context, and generated instructions are never executed. Prompt wording alone does not prevent injection.
- AI output is advisory and remains separate from deterministic reports. Human review is required; the AI cannot approve, edit, or set business behavior.
- The AI uses a bounded relational context rather than embeddings or full-project data. It excludes archived requirements and records exact version references.
- Confidence is model-reported, not calibrated probability. Semantic coverage and contradiction detection are incomplete; evidence validation is conservative and not proof that every paraphrase is grounded.

## Phase 5 workflow decisions

- Clarification answers are append-only revisions. Editing an answer preserves the old text and marks only the latest revision current. Dismissal is a distinct terminal state and is never treated as an answer.
- Repeated imports deduplicate only exact normalized question wording from the same source analysis. The same wording from a different analysis is retained with its own source reference.
- Refinement is stored as a proposal against an exact base requirement version. A human approval is required; a stale proposal returns conflict. Approval and canonical requirement version creation share one transaction using the existing expected-version update helper. Assumptions or unresolved questions prevent approval.
- Rejection leaves canonical requirement content and versions unchanged. Without authentication there is no invented reviewer account; `reviewedBy` stays null while timestamps are retained.
- Acceptance criteria are separate version-bound records and start as drafts. Each criterion requires individual review. Unresolved criteria cannot be approved; older approved criteria remain intact and are labeled historical when a newer requirement version exists.
- Acceptance generation is blocked until outstanding questions are handled and answers for the current version have been incorporated into an approved refinement. Criteria come only from the canonical version and do not receive clarification answers that are not yet part of it.

## Phase 6 test generation decisions

- Test cases are generated only from database-selected resolved acceptance criteria whose status is `APPROVED` and whose source requirement version is current. Unsupported criterion references are rejected; PostgreSQL composite foreign keys preserve the exact criterion, requirement version, and generation-run relationship.
- Test cases begin as drafts. Human approval is separate from AI generation and deterministic validation. Edits are allowed only on drafts and preserve the prior content in revision snapshots. Historical cases remain traceable and cannot be approved.
- The Phase 4 Ollama client is reused. No second provider, model installation, live model requirement, or hardcoded fixture output was added. Mock responses are used only in tests.
- The deterministic validator checks structural completeness, duplicate content, source state/version, duplicate test data names, expected-result wording, and unsupported numeric values. Lexical grounding is only a conservative review signal; it cannot prove semantic correctness, so warnings remain for people to assess.
- Context and output sizes are bounded. Generation history records safe failure status and error codes; AI unavailability never creates fabricated cases.

## Open questions

- What production deployment target and secret-management approach should be supported?
- Should health represent process readiness only or database reachability?
- What authentication and authorization model is desired for future workflows?

## Deferred

Authentication, generated test plans, vector search, background queues, CI deployment, and production hosting remain deferred.
