import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serviceClient: vi.fn(),
  sendWhatsappText: vi.fn(),
  fetchTranscript: vi.fn(),
}));

vi.mock("../../api/_lib/supabase.js", () => ({
  serviceClient: mocks.serviceClient,
}));

vi.mock("../../api/_lib/whatsapp.js", () => ({
  sendWhatsappText: mocks.sendWhatsappText,
}));

vi.mock("../../api/_lib/elevenlabs.js", () => ({
  fetchTranscript: mocks.fetchTranscript,
  transcriptToMarkdown: vi.fn(() => "transcript"),
  transcriptSummary: vi.fn(() => "summary"),
}));

const VOICE_SECRET = "voice-secret";
const ELEVENLABS_SECRET = "elevenlabs-secret";

function signedVoiceReq(body: unknown) {
  const raw = Buffer.from(JSON.stringify(body), "utf8");
  const ts = String(Date.now());
  const sig = createHmac("sha256", VOICE_SECRET)
    .update(`${ts}.`)
    .update(raw)
    .digest("hex");
  return {
    method: "POST",
    headers: {
      "x-pipecat-timestamp": ts,
      "x-pipecat-signature": sig,
    },
    async *[Symbol.asyncIterator]() {
      yield raw;
    },
  };
}

function signedElevenLabsReq(body: unknown) {
  const raw = Buffer.from(JSON.stringify(body), "utf8");
  const ts = String(Date.now());
  const sig = createHmac("sha256", ELEVENLABS_SECRET).update(raw).digest("hex");
  return {
    method: "POST",
    headers: {
      "x-elevenlabs-timestamp": ts,
      "x-elevenlabs-signature": sig,
    },
    async *[Symbol.asyncIterator]() {
      yield raw;
    },
  };
}

function resRecorder() {
  const calls: { status: number; body: unknown }[] = [];
  const res = {
    status(n: number) {
      return {
        json(body: unknown) {
          calls.push({ status: n, body });
          return res;
        },
      };
    },
  };
  return { res, calls };
}

function chain(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };
  return builder;
}

describe("webhook idempotency", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.serviceClient.mockReset();
    mocks.sendWhatsappText.mockReset();
    mocks.fetchTranscript.mockReset();
    vi.stubEnv("PIPECAT_WEBHOOK_SECRET", VOICE_SECRET);
    vi.stubEnv("ELEVENLABS_WEBHOOK_SECRET", ELEVENLABS_SECRET);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "development");
  });

  it("treats a repeated Pipecat call id as already processed", async () => {
    const leadId = "11111111-1111-4111-8111-111111111111";
    const lead = {
      id: leadId,
      parent_name: "Maria",
      parent_phone_e164: "+40700000000",
      child_name: "Alex",
      child_age: 8,
      assigned_trainer_id: "t-sopi",
      cc_trainer_ids: ["t-dan"],
    };
    const leadCalls = chain({ data: { id: "call-existing" }, error: null });
    const leadNotifications = { insert: vi.fn() };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "leads") return chain({ data: lead, error: null });
        if (table === "lead_calls") return leadCalls;
        if (table === "lead_notifications") return leadNotifications;
        throw new Error(`unexpected table ${table}`);
      }),
    };
    mocks.serviceClient.mockReturnValue(supabase);

    const { default: handler } = await import("../../api/voice/webhook");
    const { res, calls } = resRecorder();
    await handler(
      signedVoiceReq({
        leadId,
        vendor_call_id: "lk-room-1",
        status: "completed",
        transcript: [],
      }),
      res
    );

    expect(calls[0]).toEqual({
      status: 200,
      body: {
        ok: true,
        duplicate: true,
        leadId,
        callId: "call-existing",
        recipients: ["t-sopi", "t-dan"],
      },
    });
    expect(leadNotifications.insert).not.toHaveBeenCalled();
    expect(mocks.sendWhatsappText).not.toHaveBeenCalled();
  });

  it("does not refetch or renotify an already completed ElevenLabs conversation", async () => {
    const existing = {
      id: "conversation-row",
      parent_id: "parent",
      trainer_id: "trainer-row",
      child_id: "child",
      status: "completed",
      ended_at: "2026-05-30T10:00:00.000Z",
      transcript_md: "already saved",
    };
    const updates = { update: vi.fn() };
    const notifications = { insert: vi.fn() };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "ai_conversations")
          return chain({ data: existing, error: null });
        if (table === "notifications") return notifications;
        return updates;
      }),
    };
    mocks.serviceClient.mockReturnValue(supabase);

    const { default: handler } = await import("../../api/ai/webhook");
    const { res, calls } = resRecorder();
    await handler(
      signedElevenLabsReq({
        type: "completed",
        data: { conversation_id: "conv-1", status: "completed" },
      }),
      res
    );

    expect(calls[0]).toEqual({
      status: 200,
      body: { ok: true, matched: true, duplicate: true },
    });
    expect(mocks.fetchTranscript).not.toHaveBeenCalled();
    expect(updates.update).not.toHaveBeenCalled();
    expect(notifications.insert).not.toHaveBeenCalled();
  });
});
