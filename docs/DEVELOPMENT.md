# Development guide

## Prerequisites

Install Node.js 22+, npm, Git, and Docker Desktop with Compose. Start the Docker engine before database or image checks.

## Install and run locally

```sh
npm ci
cp .env.example .env
docker compose up -d db
npm run dev
```

On PowerShell replace `cp` with `Copy-Item`. Vite runs at port 5173 and Express at port 3000. The API validates `DATABASE_URL` at startup; the Phase 1 health route does not query PostgreSQL.

## Docker stack

```sh
docker compose up --build
```

Compose waits for PostgreSQL's `pg_isready` health check before starting the API. The frontend is published at port 8080, API at 3000. The named `postgres_data` volume preserves database files across container restarts.

## Migrations and validation

The Prisma 7 schema is `prisma/schema.prisma`; its migrations create project, requirement, immutable requirement-version, and JSONB validation-report tables. Each report has a composite foreign key to the exact requirement version it analyzes. The generated client is written to `backend/src/generated/prisma` and ignored by Git. PostgreSQL access uses Prisma's `pg` driver adapter. Use `npm run db:migrate -- --name descriptive_name` for development and `npx prisma migrate deploy` to apply committed migrations. Generate the client with `npm run db:generate`.

## Requirement validation

Run the backend service tests through `npm run test --workspace backend`. To add a rule, implement the `ValidationRule` interface in `backend/src/modules/requirement-validation/rules`, return findings with evidence and an actionable recommendation, then register it in `engine/rule-registry.ts` in the intended execution order. Add positive, negative, boundary, normalization, and false-positive tests in `rules/validation-rules.test.ts`. Bump `RULE_SET_VERSION` when rule behavior or default configuration changes so saved reports identify the rule behavior used.

The API runs validation server-side with `POST /api/requirements/:requirementId/validate`; request bodies are ignored and client findings are never trusted. Reports are saved for the current requirement version. Use `GET /api/requirements/:requirementId/validation-reports?page=1&pageSize=20` for history and `GET /api/requirements/:requirementId/validation-reports/:reportId` to read one saved report. `GET /api/projects/:projectId/validation-summary` aggregates saved reports that match each requirement's current version.

Run `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, and `npm run build`. Integration tests are isolated from the development database: create a `specforge_test` database and set `TEST_DATABASE_URL`, for example `postgresql://specforge:specforge_local@localhost:5432/specforge_test?schema=public`, then run `npm run test:integration --workspace backend`. The suite refuses any database whose name is not exactly `specforge_test`. For Docker, run `docker compose config`, build images, start services, and check `http://localhost:3000/api/health`.

## Common issues

- Docker cannot connect: launch Docker Desktop and wait for its engine.
- Port occupied: change the host mapping in Compose.
- API environment error: verify `.env` and `DATABASE_URL`.
- Keep `.env` local; only `.env.example` belongs in Git.
