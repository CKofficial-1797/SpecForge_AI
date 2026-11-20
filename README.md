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

## Optional AI analysis (local Ollama or Ollama Cloud)

SpecForge can use local Ollama or Ollama Cloud for semantic findings and product-owner clarification questions. AI is optional; CRUD, version history, and deterministic validation work without it. AI content is treated as untrusted, validated before persistence, and never changes requirement content or deterministic results. Confidence is a model estimate, not a probability. Semantic analysis may miss issues or raise incorrect suggestions.

The AI integration is optional and provider selection is backend-only through `AI_PROVIDER`. For local mode, install Ollama and Qwen2.5, then configure `AI_PROVIDER=ollama`, `OLLAMA_ENABLED=true`, `OLLAMA_BASE_URL`, and `OLLAMA_MODEL`. For cloud mode, configure `AI_PROVIDER=ollama-cloud`, `OLLAMA_API_KEY`, and a currently supported `OLLAMA_MODEL`; no local Ollama install or model download is needed. Cloud inference sends the supplied requirement context to Ollama Cloud. Cloud models currently do not support Ollama structured output mode, so SpecForge still validates the returned JSON with its unchanged schemas and guards. Use `/api/ai/health` for configuration status; remote cloud model/key availability is confirmed when an inference request runs. See [AI provider configuration](docs/AI_PROVIDER_CONFIGURATION.md), [local Ollama setup](docs/OLLAMA_SETUP.md), and the [development guide](docs/DEVELOPMENT.md#optional-ollama-ai-analysis).

For Docker Desktop, `localhost` inside the backend container is the container itself. Set `OLLAMA_DOCKER_BASE_URL=http://host.docker.internal:11434` for a host-installed Ollama instance; Compose keeps the Ollama service optional and does not publish port 11434. The backend uses `OLLAMA_BASE_URL` for host-process development and `OLLAMA_DOCKER_BASE_URL` in Compose. Never expose the Ollama endpoint to an untrusted network.

## Clarification, refinement, and acceptance criteria

Import clarification questions from a successful saved AI analysis. Questions can be answered, revised with full answer history, or dismissed; dismissal never counts as an answer. A refinement proposal uses the original version and latest submitted answers, and remains separate from the canonical requirement until explicit approval. Approval checks the base version and creates the next immutable requirement version in the same transaction. Stale drafts cannot be approved.

After answers have been incorporated into an approved requirement version, generate Given/When/Then acceptance criteria. Each criterion remains a draft until individually approved. Unresolved details block approval, and historical criteria retain their source version. The app has no authentication model yet, so review timestamps are recorded with `reviewedBy` unset. See the [workflow development guide](docs/DEVELOPMENT.md#phase-5-clarification-and-refinement-workflow).

## AI test case generation

Generate draft test cases only from resolved acceptance criteria explicitly approved for the current requirement version. Each case keeps source criterion and version links, shows deterministic findings, and needs a separate human approval; draft edits have snapshots. The workflow reuses the configured optional AI provider. If inference is unavailable, no cases are fabricated and the rest of the application remains usable. See [test case generation](docs/TEST_CASE_GENERATION.md).

## Traceability and coverage

Project details include a version-aware traceability matrix linking requirements to acceptance criteria and generated test cases, current and historical coverage, approval counts, and coverage gaps. Coverage counts approved criteria for current non-archived versions and approved cases with valid exact-version links. Historical evidence is shown separately. See [traceability and coverage](docs/TRACEABILITY.md).

## Security and readiness

SpecForge currently has no authentication or project-level user authorization. Do not expose it to untrusted networks or use it as a multi-user service until access control is implemented. Docker Compose development ports bind to localhost. See [security findings and deployment precautions](SECURITY.md), [AI evaluation](docs/AI_EVALUATION.md), [Ollama setup and current verification](docs/OLLAMA_SETUP.md), and [reliability behavior](docs/RELIABILITY.md).

## Demo preparation status

The Phase 9 demo uses a real local Qwen2.5 3B analysis and a refinement draft whose review transition was invoked during preparation; no identified stakeholder is recorded as reviewer. Acceptance criteria were rejected by source grounding, so no successful criterion or downstream test case is available to show. No application screenshots or video have been produced. See the [10-minute demo plan](docs/DEMO_SCRIPT.md), [manual screenshot guide](docs/SCREENSHOT_GUIDE.md), and [five-slide outline](docs/PRESENTATION_OUTLINE.md) for an accurate presentation plan and capture instructions.

## Troubleshooting

- Docker connection failure: start Docker Desktop and wait for the engine.
- Port conflict: change the host port mapping in Compose.
- API environment error: check `.env` and `DATABASE_URL`.
- Database persistence: keep the `postgres_data` volume when stopping services.

See [development guide](docs/DEVELOPMENT.md) for more detail.
