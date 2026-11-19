import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { errorHandler } from "../src/middleware/error-handler.js";

describe("API foundation", () => {
  it("returns a structured health response", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "specforge-api" });
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
  });

  it("returns a consistent 404 response for unknown routes", async () => {
    const response = await request(app).get("/api/missing");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("does not grant CORS access to unknown origins", async () => {
    const response = await request(app)
      .options("/api/health")
      .set("Origin", "https://untrusted.example")
      .set("Access-Control-Request-Method", "POST");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("returns 413 rather than an internal error for oversized JSON", async () => {
    const response = await request(app)
      .post("/api/projects")
      .set("Content-Type", "application/json")
      .send(`{"name":"${"x".repeat(1_100_100)}"}`);
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("REQUEST_TOO_LARGE");
  });

  it("formats unexpected errors through the centralized handler", () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    errorHandler(new Error("failure"), {} as never, response as never, vi.fn());
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error",
        requestId: null,
      },
    });
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('"event":"unhandled_api_error"'),
    );
    errorLog.mockRestore();
  });
});
