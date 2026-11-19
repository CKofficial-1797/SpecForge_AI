import type { RequestHandler } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  scope: string;
}

export function createRateLimit(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  let requestsSincePrune = 0;

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (++requestsSincePrune % 128 === 0 || buckets.size >= 10_000) {
        for (const [address, value] of buckets) {
          if (value.resetAt <= now) buckets.delete(address);
        }
      }
      if (!bucket && buckets.size >= 10_000) {
        res.setHeader("Retry-After", "60");
        res.status(429).json({
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Try again later.",
          },
        });
        return;
      }
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    res.setHeader("RateLimit-Limit", options.max);
    res.setHeader(
      "RateLimit-Remaining",
      Math.max(0, options.max - bucket.count),
    );
    res.setHeader("RateLimit-Reset", Math.ceil((bucket.resetAt - now) / 1000));
    if (bucket.count > options.max) {
      res.setHeader(
        "Retry-After",
        Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      );
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: `Too many ${options.scope} requests. Try again later.`,
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
