# Architecture

## Phase 1 structure

SpecForge is a modular monolith. The browser application and API are separate packages with independent build/runtime boundaries, not separate business services. PostgreSQL is the planned persistent store, accessed through Prisma.

```text
Browser → React frontend → Express API → Prisma → PostgreSQL
```

## Responsibilities and planned boundaries

- **Frontend:** application shell and future user-facing workflows. TanStack Query is configured for API state; no product workflow exists yet.
- **Backend:** HTTP boundary, environment validation, request logging, CORS, error handling, and future application modules.
- **Database:** local PostgreSQL in Compose, with Prisma schema and migrations. Phase 1 has no product tables.
- **Deterministic rules:** future requirement validation will operate independently of AI availability.
- **AI service:** future structured analysis and recommendations; it will not own deterministic validation.
- **Human review:** remains part of future approval workflows. No AI or approval flow exists in Phase 1.

The modular monolith keeps development and deployment simple while supporting clear internal boundaries. Kafka, queues, Redis, vector stores, microservices, and AI orchestration frameworks are excluded because this phase has no need for them.
