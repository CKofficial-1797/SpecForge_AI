import { describe, expect, it, vi } from "vitest";
import { HttpOllamaClient } from "./ollama.client.js";

const config = {
  provider: "ollama" as const,
  apiKey: undefined,
  enabled: true,
  model: "qwen2.5:3b-instruct",
  baseUrl: "http://localhost:11434",
  timeoutMs: 1000,
  maxRetries: 1,
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
describe("HttpOllamaClient", () => {
  it("returns generated content from the chat response", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ message: { content: "{}" } }));
    await expect(
      new HttpOllamaClient(fetcher, config).generate({
        model: config.model,
        messages: [],
      }),
    ).resolves.toBe("{}");
    expect(fetcher.mock.calls[0]![0]).toBe("http://localhost:11434/api/chat");
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string).format).toBe(
      "json",
    );
  });
  it("passes a caller-provided JSON schema to Ollama", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ message: { content: "{}" } }));
    const format = {
      type: "object",
      properties: { result: { type: "string" } },
      required: ["result"],
    };
    await new HttpOllamaClient(fetcher, config).generate({
      model: config.model,
      messages: [],
      format,
    });
    expect(
      JSON.parse(fetcher.mock.calls[0]![1]!.body as string).format,
    ).toEqual(format);
  });
  it("maps missing model and retries transient failure only within bound", async () => {
    const missing = new HttpOllamaClient(
      vi.fn().mockResolvedValue(response({}, 404)),
      config,
    );
    await expect(
      missing.generate({ model: config.model, messages: [] }),
    ).rejects.toMatchObject({ code: "AI_MODEL_UNAVAILABLE" });
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("connection refused"))
      .mockResolvedValue(response({ message: { content: "{}" } }));
    await new HttpOllamaClient(fetcher, config).generate({
      model: config.model,
      messages: [],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not retry invalid response structures", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ response: "wrong shape" }));
    await expect(
      new HttpOllamaClient(fetcher, config).generate({
        model: config.model,
        messages: [],
      }),
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects oversized streamed responses before parsing them", async () => {
    const oversized = new Response("x".repeat(512_001));
    const fetcher = vi.fn().mockResolvedValue(oversized);
    await expect(
      new HttpOllamaClient(fetcher, config).generate({
        model: config.model,
        messages: [],
      }),
    ).rejects.toMatchObject({ code: "AI_RESPONSE_TOO_LARGE" });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("maps request timeout and malformed transport JSON", async () => {
    const timeout = new Error("aborted");
    timeout.name = "TimeoutError";
    const timed = new HttpOllamaClient(vi.fn().mockRejectedValue(timeout), {
      ...config,
      maxRetries: 0,
    });
    await expect(
      timed.generate({ model: config.model, messages: [] }),
    ).rejects.toMatchObject({ code: "AI_TIMEOUT" });
    const malformed = new HttpOllamaClient(
      vi.fn().mockResolvedValue(new Response("not-json")),
      config,
    );
    await expect(
      malformed.generate({ model: config.model, messages: [] }),
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
  });
  it("bounds retries for transient HTTP failures", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({}, 503));
    const client = new HttpOllamaClient(fetcher, config);
    await expect(
      client.generate({ model: config.model, messages: [] }),
    ).rejects.toMatchObject({ code: "AI_HTTP_FAILURE" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not retry non-transient client errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({}, 400));
    await expect(
      new HttpOllamaClient(fetcher, config).generate({
        model: config.model,
        messages: [],
      }),
    ).rejects.toMatchObject({ code: "AI_HTTP_FAILURE", status: 400 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("reports model availability from /api/tags", async () => {
    const client = new HttpOllamaClient(
      vi
        .fn()
        .mockResolvedValue(
          response({ models: [{ name: "qwen2.5:3b-instruct" }] }),
        ),
      config,
    );
    await expect(client.health()).resolves.toMatchObject({
      available: true,
      modelAvailable: true,
    });
  });
  it("uses the direct cloud API with bearer authentication and no unsupported format option", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ message: { content: "{}" } }));
    const cloud = new HttpOllamaClient(fetcher, {
      ...config,
      provider: "ollama-cloud",
      apiKey: "secret-test-key",
      model: "gemma4:31b",
    });
    await cloud.generate({
      model: "gemma4:31b",
      messages: [],
      format: { type: "object" },
    });
    expect(fetcher.mock.calls[0]![0]).toBe("https://ollama.com/api/chat");
    const init = fetcher.mock.calls[0]![1]!;
    expect(init.headers).toMatchObject({
      authorization: "Bearer secret-test-key",
    });
    expect(JSON.parse(init.body as string)).not.toHaveProperty("format");
  });
  it.each([
    [401, "AI_AUTHENTICATION_FAILED"],
    [403, "AI_AUTHENTICATION_FAILED"],
    [402, "AI_QUOTA_EXCEEDED"],
    [429, "AI_RATE_LIMITED"],
    [404, "AI_MODEL_UNAVAILABLE"],
  ])("maps cloud HTTP %s safely", async (status, code) => {
    const cloud = new HttpOllamaClient(
      vi.fn().mockResolvedValue(response({}, status)),
      {
        ...config,
        provider: "ollama-cloud",
        apiKey: "secret-test-key",
        model: "gemma4:31b",
        maxRetries: 0,
      },
    );
    await expect(
      cloud.generate({ model: "gemma4:31b", messages: [] }),
    ).rejects.toMatchObject({ code });
  });
  it("reports cloud configuration without claiming remote model verification", async () => {
    const cloud = new HttpOllamaClient(vi.fn(), {
      ...config,
      provider: "ollama-cloud",
      apiKey: "secret-test-key",
      model: "gemma4:31b",
    });
    await expect(cloud.health()).resolves.toEqual({
      available: true,
      modelAvailable: null,
      model: "gemma4:31b",
    });
  });
  it("rejects cloud inference without a key before making a network request", async () => {
    const fetcher = vi.fn();
    const cloud = new HttpOllamaClient(fetcher, {
      ...config,
      provider: "ollama-cloud",
      apiKey: undefined,
      enabled: false,
      model: "gemma4:31b",
    });
    await expect(
      cloud.generate({ model: "gemma4:31b", messages: [] }),
    ).rejects.toMatchObject({ code: "AI_CREDENTIALS_MISSING", status: 503 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not log cloud credentials", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cloud = new HttpOllamaClient(
      vi.fn().mockResolvedValue(response({ message: { content: "{}" } })),
      {
        ...config,
        provider: "ollama-cloud",
        apiKey: "secret-test-key",
        model: "gemma4:31b",
      },
    );
    await cloud.generate({ model: "gemma4:31b", messages: [] });
    expect(JSON.stringify([info.mock.calls, warn.mock.calls])).not.toContain(
      "secret-test-key",
    );
    info.mockRestore();
    warn.mockRestore();
  });
});
