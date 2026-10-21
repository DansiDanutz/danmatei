/**
 * Verify an ElevenLabs Conversational AI webhook signature.
 *
 * ElevenLabs sends one header, `ElevenLabs-Signature: t=<unix seconds>,v0=<hex>`,
 * where `<hex>` is HMAC-SHA256(secret, `${t}.${rawBody}`). The secret is the
 * one shown when the post-call webhook is created in the ElevenLabs dashboard
 * (stored here as ELEVENLABS_WEBHOOK_SECRET).
 *
 * Same bypass rule as webhook-hmac.ts: unsigned requests are accepted only
 * outside production/preview AND when no secret is configured.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const ELEVENLABS_MAX_SKEW_MS = 30 * 60 * 1000; // ElevenLabs' own SDK default

export type ElevenLabsVerifyResult = { ok: true } | { ok: false; reason: string };

function bypassAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.VERCEL_ENV !== "preview"
  );
}

export function parseSignatureHeader(
  header: string | undefined
): { t: string; v0: string } | null {
  if (!header) return null;
  let t: string | undefined;
  let v0: string | undefined;
  for (const part of header.split(",")) {
    const [k, ...rest] = part.trim().split("=");
    const v = rest.join("=");
    if (k === "t") t = v;
    else if (k === "v0") v0 = v;
  }
  return t && v0 ? { t, v0 } : null;
}

export function verifyElevenLabsSignature(
  rawBody: Buffer,
  header: string | undefined,
  opts: { secret?: string; now?: () => number } = {}
): ElevenLabsVerifyResult {
  const secret = opts.secret ?? process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    return bypassAllowed() ? { ok: true } : { ok: false, reason: "secret_unset" };
  }

  const parsed = parseSignatureHeader(header);
  if (!parsed) return { ok: false, reason: "missing_signature" };

  const tsSeconds = Number(parsed.t);
  if (!Number.isFinite(tsSeconds)) {
    return { ok: false, reason: "missing_timestamp" };
  }
  const now = (opts.now ?? Date.now)();
  if (Math.abs(now - tsSeconds * 1000) > ELEVENLABS_MAX_SKEW_MS) {
    return { ok: false, reason: "timestamp_skew" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${parsed.t}.`)
    .update(rawBody)
    .digest("hex");
  if (parsed.v0.length !== expected.length) {
    return { ok: false, reason: "invalid_signature" };
  }
  return timingSafeEqual(Buffer.from(parsed.v0), Buffer.from(expected))
    ? { ok: true }
    : { ok: false, reason: "invalid_signature" };
}
