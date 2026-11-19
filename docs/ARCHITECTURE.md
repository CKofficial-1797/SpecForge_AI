# Architecture

## Application structure

SpecForge is a modular monolith. The browser application and API are separate packages with independent build/runtime boundaries, not separate business services. PostgreSQL is the planned persistent store, accessed through Prisma.

```text
Browser → React frontend → Express API → Prisma → PostgreSQL
                                      ↘ optional local Ollama
```

## Responsibilities and planned boundaries

- **Frontend:** React Router screens for project lists/details, requirement editing, and read-only version history. TanStack Query manages API state.
- **Backend:** HTTP boundary and modular project/requirement services with Zod validation, pagination, filtering, error mapping, and transactional writes.
- **Database:** PostgreSQL stores projects, requirements, and immutable content versions through Prisma migrations.
- **Validation engine:** pure rule functions receive a requirement, same-project related requirements, and explicit rule configuration. A fixed registry runs nine rules in stable order and the Zod contract validates the final report.
- **Validation service:** loads and locks the current requirement version, runs the engine, and stores the validated report in the same transaction. HTTP controllers never supply trusted findings.
- **Validation reports:** JSONB rows are associated with requirement ID, exact content version, rule-set version, and creation timestamp. The application exposes no update or delete endpoint for reports.
- **AI service:** optional structured semantic analysis through a typed Ollama HTTP boundary. Prompt construction, Zod schema, output guard, context builder, orchestration, and application persistence have separate responsibilities. Ollama is never required for API startup or deterministic validation.
- **Human review:** potential conflict findings are presented for human review. No AI analysis or approval workflow exists yet.

Requirement versions snapshot title, description, and priority. Key and status are mutable metadata and do not create versions. Versioned updates lock the requirement row, check `expectedVersion`, then update the current record and insert the next snapshot in one transaction. Validation acquires a shared row lock while it reads the current content and inserts its report, preventing a concurrent edit from changing the content during analysis. A report remains tied to its saved version after later edits.

The rule registry contains checks for required fields/project association, configured vague phrases, measurable conditions, actor and action language, outcome conditions, contextual failure/boundary conditions, exact normalized duplicates, and explicit authentication/session-duration conflicts. Findings carry category, severity, evidence, recommendation, and related requirement references. The engine has no numeric quality score. Failed rules are logged and marked `SKIPPED` with a safe explanation rather than appearing to pass. Exact duplicates normalize Unicode, case, whitespace, and punctuation; near-duplicate similarity is not implemented. Conflict checks do not claim general semantic contradiction detection.

## Optional AI semantic analysis

`backend/src/modules/ai` implements a direct `/api/chat` Ollama client with bounded timeout/retry behavior, model health checks, versioned system prompt, strict Zod output contract, bounded relational context builder, output guard, and orchestration. Ollama is disabled unless explicitly configured; no model download is part of startup. `OLLAMA_MODEL` has no assumed default because local hardware and Ollama availability must be verified by each developer.

The context builder loads the target's exact current `RequirementVersion` and a configurable maximum of non-archived requirements from the same project, ordered deterministically and clipped to a total character budget. The prompt keeps system instruction separate from JSON-delimited untrusted requirement content, requests no secrets, and warns that requirement text is data. This is defense in depth, not a claim of prompt-injection immunity. Model output is byte-limited, parsed as JSON, checked against strict Zod enums/shape/length bounds, checked for duplicate findings and supplied IDs, and checked for clearly fabricated quoted evidence. Each finding labels its basis as explicit, missing, inference, or uncertainty. Validated output alone is stored as JSONB. Failure rows contain only status and a bounded safe code. Each row stores target and context versions, configured model, prompt/schema/rule versions, status, duration, and timestamps. A composite foreign key binds analysis to its exact target version.

Deterministic and AI results use separate endpoints, storage, and UI sections. AI cannot alter requirements, validation results, or status. Health at `/api/ai/health` reports the optional dependency without affecting `/api/health`. Failed/unavailable analyses are not presented as results; existing successful history remains readable. Analysis is synchronous and bounded by the configured Ollama timeout; queue-based execution is deferred unless observed model latency exceeds the HTTP lifecycle.

The project validation summary uses only saved reports whose `requirementVersion` equals the current requirement version. Older reports remain available in requirement history but do not count as analysis of changed content. The modular monolith keeps deployment simple; queues, Redis, vector stores, microservices, and AI orchestration remain outside this phase.
