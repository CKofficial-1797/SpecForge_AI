# SpecForge_AI

**From Requirements to Reliable Software.**

SpecForge is an engineering quality and requirement intelligence platform. Phase 2 adds project management, structured requirements, and immutable requirement version history. AI analysis, acceptance-criteria generation, and traceable test workflows are not implemented.

## Stack and architecture

React, TypeScript, Vite, Tailwind CSS, React Router, and TanStack Query power the frontend. The backend uses Node.js, Express, TypeScript, and Zod 4. PostgreSQL runs locally through Docker Compose; Prisma ORM 7 with its PostgreSQL driver adapter manages schema and migrations. The project is a modular monolith with separate frontend and backend packages. See [architecture](docs/ARCHITECTURE.md) and [decisions](docs/DECISIONS.md).

## Prerequisites

Node.js 22+, npm, Git, and Docker Desktop with its Compose engine running.

## Docker quick start

```sh
docker compose up --build
```

Frontend: `http://localhost:8080`. API health: `http://localhost:3000/api/health`. PostgreSQL persists in the named `postgres_data` volume. The backend applies committed Prisma migrations on startup.

Copy `.env.example` to `.env` to customize local values. Its credentials are for local development only; never use them for a public deployment.

## Local development

```sh
npm ci
cp .env.example .env
docker compose up -d db
npm run dev
```

Use `Copy-Item .env.example .env` instead of `cp` in PowerShell. Frontend runs at port 5173, API at 3000.

## Database and checks

The schema is `prisma/schema.prisma`. Create development migrations with `npm run db:migrate -- --name descriptive_name`; generate the Prisma 7 client with `npm run db:generate`. Projects support create, list/filter/page, edit, and archive. Requirements support create, list/filter/page, edit, archive, and read-only version history. Changes to title, description, or priority create an immutable version; requirement key and status edits do not. Updates require `expectedVersion` and return HTTP 409 on stale edits.

Run `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, and `npm run build`. Integration tests require a dedicated `specforge_test` PostgreSQL database; set `TEST_DATABASE_URL` to that database and run `npm run test:integration --workspace backend`. CI applies migrations and runs both test suites on pushes and pull requests targeting `main`. Remote GitHub Actions results require a successful push and workflow run.

## Troubleshooting

- Docker connection failure: start Docker Desktop and wait for the engine.
- Port conflict: change the host port mapping in Compose.
- API environment error: check `.env` and `DATABASE_URL`.
- Database persistence: keep the `postgres_data` volume when stopping services.

See [development guide](docs/DEVELOPMENT.md) for more detail.
