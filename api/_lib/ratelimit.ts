/**
 * In-memory token bucket per (key) — first-line defense, not distributed.
 *
 * Used by LLM endpoints to cap per-user/hour requests so a single
 * authenticated (or compromised) account can't drain provider credit. This
 * intentionally lives in process memory: Vercel function-instance reuse
 * (~5-min window in practice) provides enough damping for this threat
 * model. A distributed rate limit (Redis/Upstash) is the right second
 * line of defense if this ever becomes load-bearing.
 *
 * Buckets are simple: each key gets `limit` tokens that reset on a fixed
 * window. First call after the window populates a fresh bucket.
 */
const buckets = new Map<string, { tokens: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; resetIn: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { tokens: limit - 1, resetAt: now + windowMs });
    return { ok: true, resetIn: 0 };
  }
  if (b.tokens <= 0) return { ok: false, resetIn: b.resetAt - now };
  b.tokens -= 1;
  return { ok: true, resetIn: 0 };
}
