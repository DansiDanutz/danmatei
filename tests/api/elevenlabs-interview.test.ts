/**
 * ElevenLabs AI interview: webhook signature, payload → lead_calls mapping,
 * and the agent config the setup script sends.
 *
 * Why this matters: the webhook is public. A forged or replayed payload must
 * not create calls or notify trainers, and a call must only ever attach to the
 * lead whose signed call_token started it.
 */
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  parseSignatureHeader,
  verifyElevenLabsSignature,
} from "../../api/_lib/elevenlabs-signature";
import {
  toLeadCallResult,
  type ElevenLabsPostCall,
} from "../../api/voice/elevenlabs-webhook";
import { signToken } from "../../api/_lib/sign-token";
// @ts-expect-error — plain ESM script without type declarations
import { buildAgentBody } from "../../scripts/elevenlabs-agent.mjs";

const SECRET = "wsec_test_secret_value";
const LEAD_ID = "11111111-2222-3333-4444-555555555555";
const NOW = 1_790_000_000_000;

function sign(body: string, t: number, secret = SECRET) {
  const v0 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v0=${v0}`;
}

describe("verifyElevenLabsSignature", () => {
  const body = Buffer.from('{"type":"post_call_transcription"}');
  const t = Math.floor(NOW / 1000);
  const now = () => NOW;

  it("accepts a correctly signed, fresh payload", () => {
    expect(
      verifyElevenLabsSignature(body, sign(body.toString(), t), {
        secret: SECRET,
        now,
      })
    ).toEqual({ ok: true });
  });

  it("rejects a signature made with another secret", () => {
    expect(
      verifyElevenLabsSignature(body, sign(body.toString(), t, "other"), {
        secret: SECRET,
        now,
      })
    ).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("rejects a tampered body", () => {
    const header = sign(body.toString(), t);
    expect(
      verifyElevenLabsSignature(Buffer.from('{"type":"x"}'), header, {
        secret: SECRET,
        now,
      })
    ).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("rejects a replay older than 30 minutes", () => {
    const old = t - 31 * 60;
    expect(
      verifyElevenLabsSignature(body, sign(body.toString(), old), {
        secret: SECRET,
        now,
      })
    ).toEqual({ ok: false, reason: "timestamp_skew" });
  });

  it("rejects a missing or malformed header", () => {
    expect(
      verifyElevenLabsSignature(body, undefined, { secret: SECRET, now })
    ).toEqual({ ok: false, reason: "missing_signature" });
    expect(parseSignatureHeader("v0=abc")).toBeNull();
  });

  describe("without a configured secret", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("fails closed in production", () => {
      vi.stubEnv("ELEVENLABS_WEBHOOK_SECRET", "");
      vi.stubEnv("VERCEL_ENV", "production");
      expect(verifyElevenLabsSignature(body, undefined)).toEqual({
        ok: false,
        reason: "secret_unset",
      });
    });
  });
});

describe("toLeadCallResult", () => {
  beforeEach(() => {
    vi.stubEnv("LEAD_LINK_SIGNING_SECRET", "test-secret-please-rotate");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "development");
  });
  afterEach(() => vi.unstubAllEnvs());

  function payload(
    overrides: Partial<ElevenLabsPostCall["data"]> = {}
  ): ElevenLabsPostCall {
    return {
      type: "post_call_transcription",
      data: {
        conversation_id: "conv_123",
        status: "done",
        transcript: [
          { role: "agent", message: "Bună, Maria!", time_in_call_secs: 0 },
          { role: "user", message: "Bună ziua.", time_in_call_secs: 3.2 },
          { role: "agent", message: null, time_in_call_secs: 9 },
        ],
        metadata: { start_time_unix_secs: 1_790_000_000, call_duration_secs: 95 },
        analysis: {
          transcript_summary: "Mama Mariei vrea să-l înscrie pe Alex la U9.",
          data_collection_results: {
            intent: { value: "register" },
            next_steps: { value: "Trimite programul U9; Programează vizită joi" },
            availability: { value: "luni și miercuri după 17" },
          },
        },
        conversation_initiation_client_data: {
          dynamic_variables: { call_token: signToken(LEAD_ID) },
        },
        ...overrides,
      },
    };
  }

  it("maps transcript, analysis and timing to the lead's call", () => {
    const r = toLeadCallResult(payload());
    expect(r).toMatchObject({
      leadId: LEAD_ID,
      vendor: "elevenlabs",
      vendorCallId: "conv_123",
      status: "completed",
      durationSeconds: 95,
      intent: "register",
      nextSteps: ["Trimite programul U9", "Programează vizită joi"],
      startedAt: new Date(1_790_000_000_000).toISOString(),
      endedAt: new Date(1_790_000_095_000).toISOString(),
    });
    expect(r?.transcript).toEqual([
      { role: "agent", text: "Bună, Maria!", started_at_ms: 0 },
      { role: "parent", text: "Bună ziua.", started_at_ms: 3200 },
    ]);
    expect(r?.summary).toBe(
      "Mama Mariei vrea să-l înscrie pe Alex la U9.\nDisponibilitate: luni și miercuri după 17"
    );
  });

  it("ignores calls without a valid call_token", () => {
    expect(
      toLeadCallResult(
        payload({
          conversation_initiation_client_data: {
            dynamic_variables: { call_token: "forged.token" },
          },
        })
      )
    ).toBeNull();
    expect(
      toLeadCallResult(payload({ conversation_initiation_client_data: null }))
    ).toBeNull();
  });

  it("drops unknown intents and marks silent calls abandoned", () => {
    const r = toLeadCallResult(
      payload({
        transcript: [{ role: "agent", message: "Bună!", time_in_call_secs: 0 }],
        analysis: { data_collection_results: { intent: { value: "chat" } } },
      })
    );
    expect(r?.intent).toBeNull();
    expect(r?.status).toBe("abandoned");
    expect(r?.summary).toBeNull();
  });

  it("marks failed conversations as failed", () => {
    expect(toLeadCallResult(payload({ status: "failed" }))?.status).toBe(
      "failed"
    );
  });
});

describe("interview agent config", () => {
  const body = buildAgentBody();
  const agent = body.conversation_config.agent;

  it("injects the Romanian prompt", () => {
    expect(agent.language).toBe("ro");
    expect(agent.prompt.prompt).toContain("Andra");
    expect(agent.prompt.prompt).not.toContain("@prompt.ro.md");
  });

  it("declares a placeholder for every {{variable}} it uses", () => {
    const used = new Set(
      [...`${agent.prompt.prompt}${agent.first_message}`.matchAll(/\{\{(\w+)\}\}/g)].map(
        m => m[1]
      )
    );
    const declared = Object.keys(
      agent.dynamic_variables.dynamic_variable_placeholders
    );
    for (const name of used) expect(declared).toContain(name);
  });

  it("never exposes the call token to the model", () => {
    expect(agent.prompt.prompt).not.toContain("{{call_token}}");
    expect(agent.first_message).not.toContain("{{call_token}}");
  });

  it("requires signed URLs and keeps intents in sync with lead_calls", () => {
    expect(body.platform_settings.auth.enable_auth).toBe(true);
    expect(body.platform_settings.data_collection.intent.enum).toEqual([
      "register",
      "info",
      "visit",
      "price",
      "schedule",
      "other",
    ]);
  });
});
