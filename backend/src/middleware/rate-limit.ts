
import type { RequestHandler } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  scope: string;
}

interface RateLimitBucket {
  count: number;
  expiresAt: number;
}

export function createRateLimit(options: RateLimitOptions): RequestHandler {
  const requests = new Map<string, RateLimitBucket>();
  let cleanupCounter = 0;

  return (req, res, next) => {
    const currentTime = Date.now();
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";

    let record = requests.get(clientIp);

    if (!record || record.expiresAt <= currentTime) {
      cleanupCounter++;

      if (cleanupCounter % 100 === 0 || requests.size >= 10000) {
        for (const [ip, entry] of requests.entries()) {
          if (entry.expiresAt <= currentTime) {
            requests.delete(ip);
          }
        }
      }

      if (!record && requests.size >= 10000) {
        res.setHeader("Retry-After", "60");
        res.status(429).json({
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
          },
        });
        return;
      }

      record = {
        count: 0,
        expiresAt: currentTime + options.windowMs,
      };

      requests.set(clientIp, record);
    }

    record.count++;

    const remainingRequests = Math.max(
      0,
      options.max - record.count
    );

    const timeRemaining = Math.max(
      1,
      Math.ceil((record.expiresAt - currentTime) / 1000)
    );

    res.setHeader("RateLimit-Limit", options.max);
    res.setHeader("RateLimit-Remaining", remainingRequests);
    res.setHeader("RateLimit-Reset", timeRemaining);

    if (record.count > options.max) {
      res.setHeader("Retry-After", timeRemaining);

      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: `Too many ${options.scope} requests. Please try again later.`,
        },
      });
      return;
    }

    next();
  };
}

export const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  scope: "API",
});

export const aiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  scope: "AI generation",
});
