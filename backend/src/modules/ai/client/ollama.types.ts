export interface OllamaGenerateInput {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  format?: "json" | Record<string, unknown>;
}
export interface OllamaClient {
  generate(input: OllamaGenerateInput): Promise<string>;
  health(): Promise<{
    available: boolean;
    modelAvailable: boolean | null;
    model: string | null;
  }>;
}
export type OllamaFailureCode =
  | "AI_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_MODEL_UNAVAILABLE"
  | "AI_HTTP_FAILURE"
  | "AI_INVALID_RESPONSE";
