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

## Optional Ollama AI analysis

AI is disabled by default. Continue to run the app normally without Ollama; CRUD, version history, and deterministic validation remain available. To enable local semantic analysis:

1. Install Ollama locally and verify it responds at `http://localhost:11434`.
2. Choose a Qwen2.5 Instruct tag appropriate for your hardware, install it with Ollama, and check it appears in `ollama list`. SpecForge does not pick or download a model automatically.
3. Set `OLLAMA_ENABLED=true`, `OLLAMA_MODEL=<installed-tag>`, and optionally `OLLAMA_BASE_URL`, `OLLAMA_TIMEOUT_MS`, and `OLLAMA_MAX_RETRIES` in the backend environment. Keep Ollama bound to localhost; do not expose its port publicly.
4. Check `GET /api/ai/health`; it reports endpoint and configured-model availability. A successful health response does not guarantee semantically correct model output.
5. Run `POST /api/requirements/:requirementId/analyze`. Read history at `GET /api/requirements/:requirementId/ai-analyses` and a record at `GET /api/requirements/:requirementId/ai-analyses/:analysisId`.

For CI and unit tests, inject a mocked `OllamaClient`; ordinary tests require no Ollama server or model. Tests for actual local connectivity are separate and should only run when a developer has installed a compatible model. `AI_CONTEXT_MAX_RELATED` and `AI_CONTEXT_MAX_CHARS` bound the same-project non-archived context. Troubleshooting: verify the configured URL, model tag from `ollama list`, available memory, and timeout. If Ollama is stopped or the model is absent, analysis requests return a safe unavailable response and deterministic validation continues. Never paste secrets in requirement text; prompts intentionally do not include application secrets.

## Phase 5 clarification and refinement workflow

From a requirement detail page, import questions from a successful AI analysis. Submit an answer to an open question; use “Edit latest answer” to create a new revision without erasing prior answers. Dismissal is terminal and remains unresolved. The API also exposes `GET /api/requirements/:requirementId/clarifications`, `GET /api/clarifications/:questionId`, `POST /api/clarifications/:questionId/answers`, `PATCH /api/clarifications/:questionId/answers/:answerId`, and `PATCH /api/clarifications/:questionId/dismiss`.

Generate a refinement draft from the selected successful current-version analysis after at least one answer exists. The model receives only answered question/answer pairs; the server appends unanswered/dismissed questions as unresolved on the saved draft. Review the original version, proposed wording, applied answer mappings, ambiguities, assumptions, unresolved questions, and warnings. Approve to create a new requirement version or reject to preserve the canonical content. Stale drafts return HTTP 409. No reviewer identity is stored because the application does not implement authentication.

Generate Given/When/Then criteria from the canonical current requirement after unanswered/dismissed questions are handled and answer revisions have been incorporated by an approved refinement. Criteria with unresolved details remain drafts and cannot be approved. Review each criterion individually; old criteria remain attached to their source versions. API generation uses mocked Ollama clients in tests. Use `npm run test --workspace backend` for unit contracts and `TEST_DATABASE_URL=postgresql://specforge:specforge_local@localhost:5432/specforge_test?schema=public npm run test:integration --workspace backend` (PowerShell: set `$env:TEST_DATABASE_URL` first) for the isolated workflow regression.

## Phase 6 test case workflow

On a requirement detail page, inspect its approved criteria, generate test case drafts when local AI health reports an available model, review deterministic findings, edit drafts, and explicitly approve or reject each case. Draft edits create a revision snapshot. Generation uses approved, resolved criteria from the exact current requirement version; historical cases remain readable and cannot be approved. See [test case generation API, lifecycle, prompt and limits](TEST_CASE_GENERATION.md). CI uses mock fixtures only; installing Ollama is not required, and no real model inference has been verified.

Run `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, and `npm run build`. Integration tests are isolated from the development database: create a `specforge_test` database and set `TEST_DATABASE_URL`, for example `postgresql://specforge:specforge_local@localhost:5432/specforge_test?schema=public`, then run `npm run test:integration --workspace backend`. The suite refuses any database whose name is not exactly `specforge_test`. For Docker, run `docker compose config`, build images, start services, and check `http://localhost:3000/api/health`.

## Common issues

- Docker cannot connect: launch Docker Desktop and wait for its engine.
- Port occupied: change the host mapping in Compose.
- API environment error: verify `.env` and `DATABASE_URL`.
- Keep `.env` local; only `.env.example` belongs in Git.
