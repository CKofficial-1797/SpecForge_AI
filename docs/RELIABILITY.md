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

## Recovery and known limits

Restarting the backend clears in-memory rate-limit buckets. PostgreSQL remains the source of truth for requirements, versions, reports, analyses, and generated workflow history. Current implementation has no authenticated user/session model, no distributed rate limiter, and no external metrics backend. Do not expose an unauthenticated instance to an untrusted network.
