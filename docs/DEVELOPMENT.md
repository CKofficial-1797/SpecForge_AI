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

The Prisma 7 schema is `prisma/schema.prisma`; it intentionally has no domain models or migration files in this phase. The generated client is written to `backend/src/generated/prisma` and ignored by Git. PostgreSQL access uses Prisma's `pg` driver adapter. After approved schema changes, use `npm run db:migrate -- --name descriptive_name` for development. Apply committed migrations with `npx prisma migrate deploy` and generate the client with `npm run db:generate`.

Run `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, and `npm run build`. Validate schema with `npx prisma validate --schema prisma/schema.prisma`. For Docker, run `docker compose config`, build images, start services, and check `http://localhost:3000/api/health`.

## Common issues

- Docker cannot connect: launch Docker Desktop and wait for its engine.
- Port occupied: change the host mapping in Compose.
- API environment error: verify `.env` and `DATABASE_URL`.
- Keep `.env` local; only `.env.example` belongs in Git.
