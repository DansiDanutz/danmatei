/**
 * Signed, expiring token for the lead → /apel/:token deep link.
 *
 * Used by:
 *   - api/lead/create.ts → mints the token, embeds it in the WhatsApp link.
 *   - api/voice/start.ts → verifies the token, resolves the lead id.
 *
 * Format:
 *   `${base64url(`${leadId}.${expiresAtMs}`)}.${base64url(HMAC-SHA256(payload))}`
 *
 * Default TTL is 24h. The signing secret comes from LEAD_LINK_SIGNING_SECRET
 * — REQUIRED in production. In dev we fall back to a clearly-marked literal
 * (with a warn) so contributors don't need to set anything to run locally.
 *
 * `signToken` / `verifyToken` are pure functions of the resolved secret +
 * inputs — they read the env at *call* time so tests can stub it via
 * `vi.stubEnv`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24h

function isProd(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

export function isLeadLinkSigningConfigured(): boolean {
  return Boolean(process.env.LEAD_LINK_SIGNING_SECRET) || !isProd();
}

function resolveSecret(): string {
  const fromEnv = process.env.LEAD_LINK_SIGNING_SECRET;
  if (fromEnv) return fromEnv;
  if (isProd()) {
    throw new Error("LEAD_LINK_SIGNING_SECRET required in production");
  }
  console.warn(
    "[sign-token] LEAD_LINK_SIGNING_SECRET not set — using dev-only fallback"
  );
  return "danmatei-dev-only";
}

export interface SignTokenOptions {
  /** Override expiry — useful for tests asserting rejection of expired tokens. */
  expiresAt?: number;
  /** Override TTL in ms (default 24h). Ignored if `expiresAt` is set. */
  ttlMs?: number;
}

export function signToken(leadId: string, opts: SignTokenOptions = {}): string {
  const secret = resolveSecret();
  const expiresAt =
    opts.expiresAt ?? Date.now() + (opts.ttlMs ?? DEFAULT_TTL_MS);
  const payload = `${leadId}.${expiresAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyToken(token: string): { leadId: string } | null {
  const secret = resolveSecret();
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  // Use timingSafeEqual so the comparison takes constant time regardless of
  // how many leading bytes match, preventing a timing-oracle attack on the sig.
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  const sigOk =
    expected.length === sig.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  if (!sigOk) return null;
  const [leadId, expiresAtStr] = payload.split(".");
  const expiresAt = Number(expiresAtStr);
  if (!leadId || !expiresAt || Date.now() > expiresAt) return null;
  return { leadId };
}
