# Reliability and operational behavior

## Health

- `GET /api/health` is the lightweight application liveness check and retains the existing response contract.
- `GET /api/health/ready` checks PostgreSQL with a small query. It returns HTTP 503 when the database is unavailable and does not depend on Ollama.
- `GET /api/ai/health` reports whether optional Ollama is enabled/reachable and whether the configured model tag is available. AI unavailability does not make application health fail.

## Request handling and observability

Requests receive a server-generated `X-Request-Id`. Structured request logs contain the ID, method, path without query string, response status, and duration; bodies and prompt text are not logged. Unhandled errors return a generic safe message with the request ID and log only safe error type/code metadata. Request JSON is limited to 1 MB; oversized requests return 413.

The in-process API rate limit allows 600 requests per client IP per 15 minutes; AI generation endpoints share a limit of 10 requests per IP per 15 minutes. Limits are per process and reset on restart. Behind a proxy, Express currently does not trust forwarded headers, so clients may share the proxy IP; configure trusted proxy hops deliberately before deployment. These limits do not substitute for authentication or a distributed abuse-control layer.

## AI and database failure behavior

Ollama calls use configured timeouts, bounded retries for transient failures, safe status mapping, response-size caps, and versioned structured output validators. Invalid output is rejected and is not stored as successful. Existing modules keep AI optional; CRUD, versioning, deterministic validation, and saved history remain independent of Ollama.

Database writes use Prisma transactions and relational constraints where multiple records or workflow state changes must remain consistent. Health readiness distinguishes database failure from application liveness. Query timeouts and pool sizing should be tuned for the target PostgreSQL deployment; this phase adds no cache, queue, or external telemetry system.

## Pre-Phase 9 verification (2026-11-20)

- The Compose PostgreSQL service is loopback-bound. Integration tests use `TEST_DATABASE_URL=postgresql://specforge:specforge_local@localhost:5432/specforge_test?schema=public`; `backend/tests/integration/setup.ts` refuses a database name other than `specforge_test` and replaces `DATABASE_URL` before importing test modules.
- All seven Prisma migrations were already applied to `specforge_test`; `npx prisma migrate status --schema prisma/schema.prisma` reported the database up to date. `npx prisma validate --schema prisma/schema.prisma` passed.
- `npm run test:integration --workspace backend`: 8 files / 22 tests passed. Each resource-creating suite deletes its generated records in `afterAll`; post-run counts were zero for projects, requirements, requirement versions, validation reports, AI analyses, and test cases. The tests target only `specforge_test`; no migration/reset was run against development data.
- Live backend check against `specforge_test`: `/api/health/ready` returned 200 with database `ok`; `/api/ai/health` returned 200 with AI disabled and no model. Both responses carried `X-Request-Id`.
- Frontend/backend Docker image builds and `docker compose config --quiet` pass. Docker-to-host Ollama networking is not verified because Ollama is not installed; Compose does not start or require Ollama.
- The real AI evaluator remains blocked, and no model-backed workflow is verified. See [AI_EVALUATION.md](AI_EVALUATION.md) and [OLLAMA_SETUP.md](OLLAMA_SETUP.md).

## Recovery and known limits

Restarting the backend clears in-memory rate-limit buckets. PostgreSQL remains the source of truth for requirements, versions, reports, analyses, and generated workflow history. Current implementation has no authenticated user/session model, no distributed rate limiter, and no external metrics backend. Do not expose an unauthenticated instance to an untrusted network.

### Real local model verification update (2026-11-20)

Ollama 0.40.16 and `qwen2.5:3b-instruct` (digest `357c53fb659c`) are installed. A cold-start request took about 94.8 seconds, so the default `OLLAMA_TIMEOUT_MS` is now 180,000 ms. Health and a live requirement-analysis persistence/history round trip succeeded. The 14-case evaluator accepted 11 outputs and rejected 3; refinement, acceptance criteria, and test-case generation also rejected invalid outputs. Docker-to-host Ollama connectivity and API timeout enforcement under an actual timeout condition remain unverified. See [AI_EVALUATION.md](AI_EVALUATION.md).
