import type { OllamaClient } from "../client/ollama.types.js";
import { env } from "../../../config/env.js";
export async function getAiHealth(client: OllamaClient) {
  const result = await client.health();
  return {
    enabled: env.OLLAMA_ENABLED,
    available: result.available && result.modelAvailable,
    modelAvailable: result.modelAvailable,
    model: result.model,
  };
}
