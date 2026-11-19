import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { errorHandler } from "../src/middleware/error-handler.js";

describe("API foundation", () => {
  it("returns a structured health response", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "specforge-api" });
  });

  it("returns a consistent 404 response for unknown routes", async () => {
    const response = await request(app).get("/api/missing");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
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
      },
    });
    expect(errorLog).toHaveBeenCalledWith(
      "Unhandled API error",
      expect.any(Error),
    );
    errorLog.mockRestore();
  });
});
