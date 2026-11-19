# Engineering decisions

Labels distinguish approved requirements, implementation defaults, and open questions.

## Approved

- React, TypeScript, Vite, Tailwind CSS, React Router, and TanStack Query for the frontend.
- Node.js, Express, TypeScript, and Zod for the backend.
- PostgreSQL through local Docker Compose with Prisma; no managed database in current scope.
- Prisma ORM 7 with its PostgreSQL driver adapter and Zod 4 for validation; these versions address advisories in older releases and fit the Node.js 22+ target.
- Modular monolith with separate frontend and backend packages.
- AI remains excluded from Phase 2. Future integration is planned around Ollama and structured output, subject to hardware/model decisions.
- Deterministic validation, AI analysis, and human approval have separate responsibilities.

## Engineering defaults

- PostgreSQL 17 Alpine for local Compose, Node 22 Alpine for runtime images.
- Local non-secret convenience values in `.env.example`; deployment credentials supplied separately.
- Health response: `{ "status": "ok", "service": "specforge-api" }`.
- Compose host ports: 5432 PostgreSQL, 3000 API, and 8080 frontend.
- Prisma CLI config falls back to the non-secret local sample URL when `DATABASE_URL` is absent so client generation and schema validation work from a fresh checkout. The API itself still requires an explicit valid `DATABASE_URL` at startup.

## Open questions

- What production deployment target and secret-management approach should be supported?
- Should health represent process readiness only or database reachability?
- What authentication and authorization model is desired for future workflows?

## Deferred

Authentication, API contract generation, deterministic analysis engine, AI/Ollama, CI deployment, and production hosting remain deferred after Phase 2.
