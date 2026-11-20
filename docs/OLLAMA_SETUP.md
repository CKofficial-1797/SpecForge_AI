# Local Ollama setup and verification

## Host and installation (2026-11-20)

- Windows 10 Home Single Language 26H2, build 26300; 15.3 GiB RAM, about 2.26 GiB available during inspection; RTX 3050 Laptop GPU with 6 GiB VRAM; about 116.4 GiB free on C:.
- Ollama was installed by the user from the official Windows installer. `ollama --version` returned `0.40.16`.
- User approved Qwen2.5 3B Instruct. `ollama pull qwen2.5:3b-instruct` completed; `ollama list` showed digest `357c53fb659c` and size about 1.9 GB.
- The model is a suitable initial candidate for the 6 GiB GPU. Available system RAM was low during inspection; close memory-heavy applications before inference. Do not assume the 7B model is suitable without rechecking memory.

## Direct local inference

The Ollama API at `http://localhost:11434` returned an actual `/api/chat` response in JSON mode. The response parsed successfully as `{"status":"ok","count":2}`. A cold-start call took about 94,772 ms; the model occupied about 2,159 MiB VRAM afterward. No Ollama port is published by Compose.

For a repeat check:

```powershell
ollama --version
ollama list
$body = @{
  model = "qwen2.5:3b-instruct"
  stream = $false
  format = "json"
  messages = @(
    @{ role = "system"; content = 'Return one JSON object with keys "status" and "count".' },
    @{ role = "user"; content = 'Set status to "ok" and count to 2.' }
  )
} | ConvertTo-Json -Depth 6
$result = Invoke-RestMethod -Uri "http://localhost:11434/api/chat" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 180
$result.message.content | ConvertFrom-Json
```

## SpecForge configuration and verification

Local mode now uses `AI_PROVIDER=ollama`; cloud mode is documented in [AI_PROVIDER_CONFIGURATION.md](AI_PROVIDER_CONFIGURATION.md). Provider selection is backend-only.

For local backend inference, set in the untracked repository-root `.env` and restart the backend:

```dotenv
OLLAMA_ENABLED=true
AI_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:3b-instruct
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TIMEOUT_MS=180000
OLLAMA_MAX_RETRIES=0
```

`GET /api/ai/health` returned enabled/available/modelAvailable true for `qwen2.5:3b-instruct`. A real `POST /api/requirements/:id/analyze` succeeded and persisted a version-1 analysis; history returned it. The latest 14-case real evaluator run had 11 valid outputs and 3 rejected outputs. Two downstream generation workflows also rejected model output; see [AI_EVALUATION.md](AI_EVALUATION.md). `OLLAMA_TIMEOUT_MS` defaults to 180,000 because measured cold-start JSON inference exceeded the prior 90,000 ms default.

Ollama remains optional for application startup and Compose. AI-disabled behavior was verified in a prior local health check; the main CRUD, deterministic validation, and saved-history services do not depend on Ollama. The live disabled-after-install fallback path was not retested as part of this remediation.

## Docker networking

Compose does not start Ollama. In Docker Desktop, a backend container would use `http://host.docker.internal:11434`; container-to-host inference is **not verified**. Keep the Ollama API private to the host and do not publish port 11434. The Docker images built successfully, but Docker-to-host model connectivity remains unverified.
