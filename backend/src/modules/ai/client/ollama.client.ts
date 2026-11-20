import { env } from "../../../config/env.js";
import type { OllamaClient, OllamaGenerateInput } from "./ollama.types.js";

export class OllamaError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 503,
  ) {
    super(message);
  }
}

export class HttpOllamaClient implements OllamaClient {
  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly config = {
      enabled: env.OLLAMA_ENABLED,
      model: env.OLLAMA_MODEL,
      baseUrl: env.OLLAMA_BASE_URL,
      timeoutMs: env.OLLAMA_TIMEOUT_MS,
      maxRetries: env.OLLAMA_MAX_RETRIES,
    },
  ) {}

  async generate(input: OllamaGenerateInput): Promise<string> {
    const startedAt = Date.now();
    try {
      const content = await this.generateWithRetries(input);
      console.info(
        JSON.stringify({
          event: "ollama_inference",
          model: input.model,
          success: true,
          durationMs: Date.now() - startedAt,
        }),
      );
      return content;
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "ollama_inference",
          model: input.model,
          success: false,
          durationMs: Date.now() - startedAt,
          errorCode:
            error instanceof OllamaError ? error.code : "AI_UNAVAILABLE",
        }),
      );
      throw error;
    }
  }

  private async generateWithRetries(input: OllamaGenerateInput) {
    if (!this.config.enabled || !this.config.model)
      throw new OllamaError("AI_UNAVAILABLE", "AI analysis is not configured");
    let attempt = 0;
    while (true) {
      try {
        const response = await this.fetcher(
          `${this.config.baseUrl.replace(/\/+$/, "")}/api/chat`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              model: input.model,
              messages: input.messages,
              stream: false,
              format: input.format ?? "json",
              options: { temperature: 0 },
            }),
            signal: AbortSignal.timeout(this.config.timeoutMs),
          },
        );
        if (response.status === 404)
          throw new OllamaError(
            "AI_MODEL_UNAVAILABLE",
            "Configured Ollama model is unavailable",
            503,
          );
        if (!response.ok)
          throw new OllamaError(
            "AI_HTTP_FAILURE",
            "Ollama request failed",
            response.status,
          );
        const payload: unknown = await readBoundedJson(response, 512_000);
        if (
          !isRecord(payload) ||
          !isRecord(payload.message) ||
          typeof payload.message.content !== "string"
        )
          throw new OllamaError(
            "AI_INVALID_RESPONSE",
            "Ollama returned an invalid response",
            502,
          );
        return payload.message.content;
      } catch (error) {
        if (
          error instanceof OllamaError &&
          error.code === "AI_MODEL_UNAVAILABLE"
        )
          throw error;
        const transient =
          error instanceof TypeError ||
          (error instanceof Error && error.name === "TimeoutError") ||
          (error instanceof OllamaError &&
            error.code === "AI_HTTP_FAILURE" &&
            (error.status === 429 || error.status >= 500));
        if (transient && attempt < this.config.maxRetries) {
          const backoff =
            Math.min(2000, 200 * 2 ** attempt) +
            Math.floor(Math.random() * 150);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          attempt++;
          continue;
        }
        if (error instanceof Error && error.name === "TimeoutError")
          throw new OllamaError("AI_TIMEOUT", "Ollama request timed out", 504);
        if (error instanceof SyntaxError)
          throw new OllamaError(
            "AI_INVALID_RESPONSE",
            "Ollama returned an invalid response",
            502,
          );
        if (error instanceof OllamaError) throw error;
        throw new OllamaError("AI_UNAVAILABLE", "Ollama is unavailable", 503);
      }
    }
  }

  async health() {
    const model = this.config.model ?? null;
    if (!this.config.enabled || !model)
      return { available: false, modelAvailable: false, model };
    try {
      const response = await this.fetcher(
        `${this.config.baseUrl.replace(/\/+$/, "")}/api/tags`,
        {
          signal: AbortSignal.timeout(Math.min(this.config.timeoutMs, 5000)),
        },
      );
      if (!response.ok)
        return { available: false, modelAvailable: false, model };
      const payload: unknown = await readBoundedJson(response, 128_000);
      const models =
        isRecord(payload) && Array.isArray(payload.models)
          ? payload.models
          : [];
      const modelAvailable = models.some(
        (entry) =>
          isRecord(entry) &&
          typeof entry.name === "string" &&
          (entry.name === model || entry.name.startsWith(`${model}:`)),
      );
      return { available: true, modelAvailable, model };
    } catch {
      return { available: false, modelAvailable: false, model };
    }
  }
}

async function readBoundedJson(response: Response, maxBytes: number) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes)
    throw new OllamaError(
      "AI_RESPONSE_TOO_LARGE",
      "Ollama response exceeds the configured response limit",
      502,
    );
  if (!response.body) throw new SyntaxError("Missing response body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new OllamaError(
          "AI_RESPONSE_TOO_LARGE",
          "Ollama response exceeds the configured response limit",
          502,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
