import { describe, expect, it, vi } from "vitest";
import { createRateLimit } from "./rate-limit.js";

describe("in-memory rate limit", () => {
  it("limits a client and emits a retry hint", () => {
    const middleware = createRateLimit({
      windowMs: 60_000,
      max: 1,
      scope: "test",
    });
    const next = vi.fn();
    const headers = new Map<string, unknown>();
    const res = {
      setHeader: vi.fn((name: string, value: unknown) =>
        headers.set(name, value),
      ),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const req = { ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" } };
    middleware(req as never, res as never, next);
    expect(next).toHaveBeenCalledOnce();
    middleware(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(headers.get("Retry-After")).toBeTruthy();
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "RATE_LIMITED",
        message: "Too many test requests. Try again later.",
      },
    });
  });
});
