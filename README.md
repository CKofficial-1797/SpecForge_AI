# SpecForge_AI

**From Requirements to Reliable Software.**

SpecForge is an engineering quality and requirement intelligence platform. It supports project and requirement management, immutable requirement versions, deterministic validation, optional local AI-assisted semantic analysis, clarification and refinement review, and version-bound acceptance criteria. AI output remains a draft until a person explicitly approves it.

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

The schema is `prisma/schema.prisma`. Create development migrations with `npm run db:migrate -- --name descriptive_name`; generate the Prisma 7 client with `npm run db:generate`. Projects support create, list/filter/page, edit, and archive. Requirements support create, list/filter/page, edit, archive, and read-only version history. Changes to title, description, or priority create an immutable version; requirement key and status edits do not. Updates require `expectedVersion` and return HTTP 409 on stale edits. Phase 3 adds validation reports persisted for one exact requirement version and rule-set version. Checks cover required fields, vague terms, measurable conditions, actors, actions, outcomes, selected failure conditions, exact normalized duplicates, and narrowly patterned potential conflicts.

Run `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, and `npm run build`. Integration tests require a dedicated `specforge_test` PostgreSQL database; set `TEST_DATABASE_URL` to that database and run `npm run test:integration --workspace backend`. CI applies migrations and runs both test suites on pushes and pull requests targeting `main`. Remote GitHub Actions results require a successful push and workflow run.

The requirement detail page can run validation, show saved report findings and suggested next actions, and inspect report history. Project details show analyzed, error, warning, clean, and unanalyzed requirement counts for current requirement versions. Heuristics are warnings and may need human review; exact duplicates compare normalized title and description, and conflict checks support only stated authentication and session-duration patterns.

## Optional local AI analysis

SpecForge can use a local Ollama model for semantic findings and product-owner clarification questions. Ollama is optional; CRUD, version history, and deterministic validation work without it. AI content is treated as untrusted, validated before persistence, and never changes requirement content or deterministic results. Confidence is a model estimate, not a probability. Semantic analysis may miss issues or raise incorrect suggestions.

The AI integration is disabled by default. After installing Ollama and verifying a suitable Qwen2.5 Instruct model on your machine, set `OLLAMA_ENABLED=true` and `OLLAMA_MODEL` to the exact installed model tag. Configure `OLLAMA_BASE_URL`, `OLLAMA_TIMEOUT_MS`, and `OLLAMA_MAX_RETRIES` as needed. The application does not download models or send requirement data to cloud providers. Health is available at `/api/ai/health`. See [local AI setup](docs/DEVELOPMENT.md#optional-ollama-ai-analysis).

## Clarification, refinement, and acceptance criteria

Import clarification questions from a successful saved AI analysis. Questions can be answered, revised with full answer history, or dismissed; dismissal never counts as an answer. A refinement proposal uses the original version and latest submitted answers, and remains separate from the canonical requirement until explicit approval. Approval checks the base version and creates the next immutable requirement version in the same transaction. Stale drafts cannot be approved.

After answers have been incorporated into an approved requirement version, generate Given/When/Then acceptance criteria. Each criterion remains a draft until individually approved. Unresolved details block approval, and historical criteria retain their source version. The app has no authentication model yet, so review timestamps are recorded with `reviewedBy` unset. See the [workflow development guide](docs/DEVELOPMENT.md#phase-5-clarification-and-refinement-workflow).

## Troubleshooting

- Docker connection failure: start Docker Desktop and wait for the engine.
- Port conflict: change the host port mapping in Compose.
- API environment error: check `.env` and `DATABASE_URL`.
- Database persistence: keep the `postgres_data` volume when stopping services.

See [development guide](docs/DEVELOPMENT.md) for more detail.
