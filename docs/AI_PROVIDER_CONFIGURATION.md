# AI provider configuration

SpecForge selects its inference provider from the backend environment. There is no provider selector in the frontend, and the provider cannot be changed through API requests. Keep `.env` out of source control; `.env.example` contains no credentials.

Both providers use the same prompts, prompt versions, context builders, output schemas, grounding checks, persistence, and human-review lifecycle. AI output remains untrusted. Generated refinements, acceptance criteria, and test cases stay drafts until a person reviews and approves them.

## Local Ollama

Install [Ollama](https://ollama.com/download), pull a compatible local model, and verify it with `ollama list` and a local inference. This machine's currently verified setup is Ollama `0.40.16` with `qwen2.5:3b-instruct`.

Set these values in the backend environment (the repository root `.env` is loaded for local development). A process-level environment variable takes precedence over `.env`; set or clear any existing `AI_PROVIDER` variable before starting the API if it differs from the value in `.env`:

```dotenv
AI_PROVIDER=ollama
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b-instruct
OLLAMA_TIMEOUT_MS=180000
OLLAMA_MAX_RETRIES=1
```

For Docker Compose, the backend container defaults to `http://host.docker.internal:11434` so it can reach Ollama running on the host. Override `OLLAMA_BASE_URL` if your Docker environment uses another host address. Ollama is not a Compose service and is never required for startup.

## Ollama Cloud

Create an API key from [Ollama account settings](https://ollama.com/settings/keys), then add it to the backend environment. Select a model currently listed in the [Ollama Cloud model library](https://ollama.com/library):

```dotenv
AI_PROVIDER=ollama-cloud
OLLAMA_API_KEY=replace-with-your-own-key
OLLAMA_MODEL=gemma4:31b
OLLAMA_TIMEOUT_MS=180000
OLLAMA_MAX_RETRIES=1
```

Cloud mode calls `https://ollama.com/api/chat` with bearer authentication. It does not need a local Ollama installation, local model download, or `OLLAMA_ENABLED=true`. The example model is illustrative; check the current Ollama model library and account access before using a model. Each repository user or deployment must supply their own key and should store it as a deployment secret. Never put it in a `VITE_` variable, browser code, issue, requirement text, or committed file.

Ollama documents that cloud models currently do not support structured outputs. SpecForge omits the Ollama `format` request option in cloud mode, while keeping the same JSON prompts, parsing, Zod validation, source grounding, size limits, and persistence checks. A valid JSON response is not by itself evidence that its semantic content is correct.

## Health and errors

Call `GET /api/ai/health`. Local mode checks the configured endpoint and confirms the model appears in `/api/tags`. Cloud mode reports whether the provider, key, and model are configured; Ollama does not document a non-inference model-list probe for this direct API, so health does not claim that the remote key or model was verified. Actual cloud inference reports safe authentication, quota, rate-limit, timeout, HTTP, model, or malformed-response errors.

Provider configuration is parsed at backend startup; unsupported `AI_PROVIDER` values fail startup. Missing cloud credentials leave AI unavailable without affecting project, requirement, or deterministic validation workflows. Compose passes AI variables only to the backend service; it does not bake secrets into either image or pass them to the frontend container.

## Verification

Automated tests mock the HTTP boundary and require no Ollama server, key, or model download. To verify a real local model, configure local mode and call an existing analysis or generation API against disposable development data. Do not claim cloud connectivity without a successful inference using a valid key. Cloud use is not performed automatically by tests.

See [Ollama's API introduction](https://docs.ollama.com/api/introduction) and [Cloud documentation](https://docs.ollama.com/cloud) for current endpoint, authentication, and capability details.
