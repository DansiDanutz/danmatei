/**
 * Shared HMAC verification for inbound webhook bodies.
 *
 * Used by:
 *   - api/voice/webhook.ts   (LiveKit voice agent end-of-call payload)
 *   - api/ai/webhook.ts      (ElevenLabs ConvAI completion payload)
 *
 * Pure function — no I/O, easy to unit-test. The handler reads the raw body
 * bytes, calls verifyHmac, and rejects 401 on failure.
 *
 * Header conventions (lowercased internally):
 *   - x-{vendor}-signature   hex HMAC-SHA256
 *   - x-{vendor}-timestamp   unix epoch milliseconds (used both for replay
 *                            protection AND bound into the HMAC payload so a
 *                            captured signature can't be replayed with a
 *                            different timestamp)
 *
 * Bypass: in non-prod ONLY (NODE_ENV !== 'production' AND VERCEL_ENV is
 * neither 'production' nor 'preview') AND the secret env var is unset, we
 * accept unsigned requests so devs can iterate locally without webhooks.
 * Preview deploys fail closed.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // 5 minutes

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export type WebhookVendor = "pipecat" | "elevenlabs";

function readHeader(
  headers: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const lowerKey = key.toLowerCase();
  // Fast path: Node + Vercel deliver headers lowercased.
  let v = headers[lowerKey] ?? headers[key];
  // Fallback: caller passed mixed-case keys (e.g. fetch headers in a test
  // harness). Walk the dict once with case-insensitive comparison.
  if (v === undefined) {
    for (const k of Object.keys(headers)) {
      if (k.toLowerCase() === lowerKey) {
        v = headers[k];
        break;
      }
    }
  }
  return Array.isArray(v) ? v[0] : v;
}

function bypassAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.VERCEL_ENV !== "preview"
  );
}

export interface VerifyHmacOptions {
  /** Override `Date.now()` for deterministic testing. */
  now?: () => number;
  /**
   * Header name for the signature. Defaults to `x-{vendor}-signature`. The
   * ElevenLabs webhook historically accepted an unprefixed variant, so the
   * caller can pass an extra fallback name here.
   */
  signatureHeaders?: string[];
  /**
   * Header name(s) for the timestamp. Same fallback story as signature.
   */
  timestampHeaders?: string[];
  /**
   * When true, the HMAC payload is `${timestamp}.${rawBody}` so a captured
   * signature can't be replayed with a different timestamp. When false, the
   * HMAC is computed over the raw body only (matches the ElevenLabs
   * convention prior to their timestamp rollout).
   *
   * Defaults to true.
   */
  bindTimestamp?: boolean;
  /**
   * When true (default), the timestamp header is required + the value must
   * be within MAX_TIMESTAMP_SKEW_MS of `now()`. When false, timestamp
   * checks are skipped entirely (only honor for the rare case where the
   * vendor doesn't send one yet AND replay-protection isn't worth the
   * deploy gate).
   */
  checkTimestamp?: boolean;
}

/**
 * Verify an inbound webhook's HMAC signature against the named env var.
 *
 * @param rawBody  The raw request body bytes — verbatim, NOT re-stringified.
 * @param headers  Request headers (lowercased keys assumed; we double-check).
 * @param envName  The env var holding the shared secret.
 * @param opts     Optional vendor-specific knobs.
 */
export function verifyHmac(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
  envName: string,
  opts: VerifyHmacOptions = {},
): VerifyResult {
  const secret = process.env[envName];

  // No secret configured → bypass only in safe envs.
  if (!secret) {
    return bypassAllowed()
      ? { ok: true }
      : { ok: false, reason: "secret_unset" };
  }

  const now = opts.now ?? Date.now;
  const bindTimestamp = opts.bindTimestamp ?? true;
  const checkTimestamp = opts.checkTimestamp ?? true;

  // Timestamp check first — original handlers returned `missing_timestamp`
  // before falling through to signature verification, and downstream alerts
  // distinguish the two.
  let tsHeader: string | undefined;
  if (checkTimestamp || bindTimestamp) {
    const tsHeaders = opts.timestampHeaders ?? [
      "x-pipecat-timestamp",
      "x-elevenlabs-timestamp",
    ];
    for (const h of tsHeaders) {
      tsHeader = readHeader(headers, h);
      if (tsHeader) break;
    }
    if (checkTimestamp) {
      if (!tsHeader) return { ok: false, reason: "missing_timestamp" };
      const tsMs = Number(tsHeader);
      if (!Number.isFinite(tsMs)) {
        return { ok: false, reason: "missing_timestamp" };
      }
      if (Math.abs(now() - tsMs) > MAX_TIMESTAMP_SKEW_MS) {
        return { ok: false, reason: "timestamp_skew" };
      }
    }
  }

  // Signature header.
  const sigHeaders = opts.signatureHeaders ?? [
    "x-pipecat-signature",
    "x-elevenlabs-signature",
  ];
  let headerSig: string | undefined;
  for (const h of sigHeaders) {
    headerSig = readHeader(headers, h);
    if (headerSig) break;
  }
  if (!headerSig) return { ok: false, reason: "invalid_signature" };

  // Compute expected signature.
  const mac = createHmac("sha256", secret);
  if (bindTimestamp && tsHeader) {
    mac.update(tsHeader + ".");
  }
  mac.update(rawBody);
  const expected = mac.digest("hex");

  if (headerSig.length !== expected.length) {
    return { ok: false, reason: "invalid_signature" };
  }
  try {
    const ok = timingSafeEqual(
      Buffer.from(headerSig),
      Buffer.from(expected),
    );
    return ok
      ? { ok: true }
      : { ok: false, reason: "invalid_signature" };
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }
}
