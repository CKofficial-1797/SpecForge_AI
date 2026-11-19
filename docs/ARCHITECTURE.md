# Architecture

## Phase 3 structure

SpecForge is a modular monolith. The browser application and API are separate packages with independent build/runtime boundaries, not separate business services. PostgreSQL is the planned persistent store, accessed through Prisma.

```text
Browser → React frontend → Express API → Prisma → PostgreSQL
```

## Responsibilities and planned boundaries

- **Frontend:** React Router screens for project lists/details, requirement editing, and read-only version history. TanStack Query manages API state.
- **Backend:** HTTP boundary and modular project/requirement services with Zod validation, pagination, filtering, error mapping, and transactional writes.
- **Database:** PostgreSQL stores projects, requirements, and immutable content versions through Prisma migrations.
- **Validation engine:** pure rule functions receive a requirement, same-project related requirements, and explicit rule configuration. A fixed registry runs nine rules in stable order and the Zod contract validates the final report.
- **Validation service:** loads and locks the current requirement version, runs the engine, and stores the validated report in the same transaction. HTTP controllers never supply trusted findings.
- **Validation reports:** JSONB rows are associated with requirement ID, exact content version, rule-set version, and creation timestamp. The application exposes no update or delete endpoint for reports.
- **AI service:** future structured analysis and recommendations; it will not own deterministic validation.
- **Human review:** potential conflict findings are presented for human review. No AI analysis or approval workflow exists yet.

Requirement versions snapshot title, description, and priority. Key and status are mutable metadata and do not create versions. Versioned updates lock the requirement row, check `expectedVersion`, then update the current record and insert the next snapshot in one transaction. Validation acquires a shared row lock while it reads the current content and inserts its report, preventing a concurrent edit from changing the content during analysis. A report remains tied to its saved version after later edits.

The rule registry contains checks for required fields/project association, configured vague phrases, measurable conditions, actor and action language, outcome conditions, contextual failure/boundary conditions, exact normalized duplicates, and explicit authentication/session-duration conflicts. Findings carry category, severity, evidence, recommendation, and related requirement references. The engine has no numeric quality score. Failed rules are logged and marked `SKIPPED` with a safe explanation rather than appearing to pass. Exact duplicates normalize Unicode, case, whitespace, and punctuation; near-duplicate similarity is not implemented. Conflict checks do not claim general semantic contradiction detection.

The project validation summary uses only saved reports whose `requirementVersion` equals the current requirement version. Older reports remain available in requirement history but do not count as analysis of changed content. The modular monolith keeps deployment simple; queues, Redis, vector stores, microservices, and AI orchestration remain outside this phase.
