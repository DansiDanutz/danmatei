/**
 * Tests for the shared webhook HMAC helper used by /api/voice/webhook.
 *
 * Why this matters: this is the gate that decides whether to insert a
 * `lead_calls` row + fan out trainer notifications. A broken accept means
 * a malicious actor can stuff arbitrary "transcripts" into a parent's lead
 * and trigger trainer outreach. A broken reject means the agent's real
 * payloads silently bounce.
 *
 * We test the pure helper directly — no Supabase mock needed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";

import { verifyHmac } from "../../api/_lib/webhook-hmac";

const SECRET = "test-pipecat-webhook-secret";

function hmacWithTimestamp(body: Buffer, ts: string): string {
  return createHmac("sha256", SECRET)
    .update(ts + ".")
    .update(body)
    .digest("hex");
}

describe("verifyHmac (Pipecat / voice webhook)", () => {
  const body = Buffer.from(
    JSON.stringify({ leadId: "abc-123", status: "completed" }),
    "utf8",
  );

  beforeEach(() => {
    vi.stubEnv("PIPECAT_WEBHOOK_SECRET", SECRET);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a body with a valid signature + fresh timestamp", () => {
    const ts = String(Date.now());
    const sig = hmacWithTimestamp(body, ts);
    const result = verifyHmac(
      body,
      {
        "x-pipecat-timestamp": ts,
        "x-pipecat-signature": sig,
      },
      "PIPECAT_WEBHOOK_SECRET",
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a body whose signature was computed with the wrong secret", () => {
    const ts = String(Date.now());
    const wrongSig = createHmac("sha256", "not-the-secret")
      .update(ts + ".")
      .update(body)
      .digest("hex");
    const result = verifyHmac(
      body,
      {
        "x-pipecat-timestamp": ts,
        "x-pipecat-signature": wrongSig,
      },
      "PIPECAT_WEBHOOK_SECRET",
    );
    expect(result).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("rejects a body whose bytes were modified post-sign", () => {
    const ts = String(Date.now());
    const sig = hmacWithTimestamp(body, ts);
    const tampered = Buffer.from(
      JSON.stringify({ leadId: "abc-123", status: "completed", extra: 1 }),
      "utf8",
    );
    const result = verifyHmac(
      tampered,
      {
        "x-pipecat-timestamp": ts,
        "x-pipecat-signature": sig,
      },
      "PIPECAT_WEBHOOK_SECRET",
    );
    expect(result).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("rejects a timestamp skewed more than 5 minutes from now", () => {
    const ts = String(Date.now() - 6 * 60 * 1000); // 6 min in the past
    const sig = hmacWithTimestamp(body, ts);
    const result = verifyHmac(
      body,
      {
        "x-pipecat-timestamp": ts,
        "x-pipecat-signature": sig,
      },
      "PIPECAT_WEBHOOK_SECRET",
    );
    expect(result).toEqual({ ok: false, reason: "timestamp_skew" });
  });

  it("rejects when the timestamp header is missing", () => {
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    const result = verifyHmac(
      body,
      { "x-pipecat-signature": sig },
      "PIPECAT_WEBHOOK_SECRET",
    );
    expect(result).toEqual({ ok: false, reason: "missing_timestamp" });
  });

  it("rejects when the timestamp header is non-numeric garbage", () => {
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    const result = verifyHmac(
      body,
      {
        "x-pipecat-timestamp": "not-a-number",
        "x-pipecat-signature": sig,
      },
      "PIPECAT_WEBHOOK_SECRET",
    );
    expect(result).toEqual({ ok: false, reason: "missing_timestamp" });
  });

  it("rejects when the signature header is missing entirely", () => {
    const ts = String(Date.now());
    const result = verifyHmac(
      body,
      { "x-pipecat-timestamp": ts },
      "PIPECAT_WEBHOOK_SECRET",
    );
    // Helper folds missing-sig into invalid_signature (same 401 from the handler).
    expect(result).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("treats lower- and upper-cased header names identically", () => {
    const ts = String(Date.now());
    const sig = hmacWithTimestamp(body, ts);
    const result = verifyHmac(
      body,
      {
        "X-Pipecat-Timestamp": ts,
        "X-Pipecat-Signature": sig,
      },
      "PIPECAT_WEBHOOK_SECRET",
    );
    expect(result).toEqual({ ok: true });
  });

  it("bypasses verification in dev when the secret env is unset (clearly marked)", () => {
    // Local dev path — devs can iterate against the webhook without a shared
    // secret. Preview + prod must still fail closed (covered below).
    vi.stubEnv("PIPECAT_WEBHOOK_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");
    const result = verifyHmac(
      body,
      {},
      "PIPECAT_WEBHOOK_SECRET",
    );
    expect(result).toEqual({ ok: true });
  });

  it("fails closed in preview when the secret env is unset", () => {
    vi.stubEnv("PIPECAT_WEBHOOK_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    const result = verifyHmac(
      body,
      {},
      "PIPECAT_WEBHOOK_SECRET",
    );
    expect(result).toEqual({ ok: false, reason: "secret_unset" });
  });

  it("fails closed in production when the secret env is unset", () => {
    vi.stubEnv("PIPECAT_WEBHOOK_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    const result = verifyHmac(
      body,
      {},
      "PIPECAT_WEBHOOK_SECRET",
    );
    expect(result).toEqual({ ok: false, reason: "secret_unset" });
  });
});
