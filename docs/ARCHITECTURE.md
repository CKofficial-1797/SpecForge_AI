# Architecture

## Phase 2 structure

SpecForge is a modular monolith. The browser application and API are separate packages with independent build/runtime boundaries, not separate business services. PostgreSQL is the planned persistent store, accessed through Prisma.

```text
Browser → React frontend → Express API → Prisma → PostgreSQL
```

## Responsibilities and planned boundaries

- **Frontend:** React Router screens for project lists/details, requirement editing, and read-only version history. TanStack Query manages API state.
- **Backend:** HTTP boundary and modular project/requirement services with Zod validation, pagination, filtering, error mapping, and transactional writes.
- **Database:** PostgreSQL stores projects, requirements, and immutable content versions through Prisma migrations.
- **Deterministic rules:** future requirement validation will operate independently of AI availability.
- **AI service:** future structured analysis and recommendations; it will not own deterministic validation.
- **Human review:** remains part of future approval workflows. No AI or approval flow exists in Phase 1.

Requirement versions snapshot title, description, and priority. Key and status are mutable metadata and do not create versions. Versioned updates lock the requirement row, check `expectedVersion`, then update the current record and insert the next snapshot in one transaction. A unique `(requirementId, versionNumber)` constraint provides a final concurrency guard. Projects are locked while requirements are created or the project is archived, preventing a new requirement from racing with project archival. The modular monolith keeps deployment simple; queues, Redis, vector stores, microservices, and AI orchestration remain outside this phase.
