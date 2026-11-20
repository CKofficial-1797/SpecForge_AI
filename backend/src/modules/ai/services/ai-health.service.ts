import type { OllamaClient } from "../client/ollama.types.js";
import { env, isAiConfigured } from "../../../config/env.js";
export async function getAiHealth(client: OllamaClient) {
  const result = await client.health();
  return {
    enabled: isAiConfigured,
    available: result.available && result.modelAvailable !== false,
    modelAvailable: result.modelAvailable,
    model: result.model,
    provider: env.AI_PROVIDER,
    modelAvailabilityKnown: result.modelAvailable !== null,
  };
}
