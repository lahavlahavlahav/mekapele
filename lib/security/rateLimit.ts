// =============================================================================
// RATE LIMITING  (server)
// -----------------------------------------------------------------------------
// Fixed-window limiter keyed by identity (uid when authed, else client IP).
// Protects expensive routes (image processing) from abuse / DDoS.
//
// NOTE ON SCALE: this in-memory map works for a single serverless instance but
// resets on cold starts and is NOT shared across instances. For real
// production load, swap `hit()` for a shared store (Upstash Redis / Vercel KV)
// using the same interface — the call sites do not change.
// =============================================================================

import "server-only";

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Record a hit for `key`. Allows up to `limit` requests per `windowMs`.
 */
export function hit(
  key: string,
  limit = 20,
  windowMs = 60_000
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
