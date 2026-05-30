/**
 * POST /api/voice/webhook
 *
 * The LiveKit voice agent posts end-of-call payloads here. We:
 *   1. Verify the HMAC signature.
 *   2. Insert a `lead_calls` row (transcript + summary + intent + recording).
 *   3. Update the parent `leads` row → status='transcribed' → 'routed'.
 *   4. Fan out notifications to the assigned trainer + the boss across
 *      push / WhatsApp / email / inapp channels.
 *
 * See docs/AI_CALL_FLOW.md.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { serviceClient } from "../_lib/supabase.js";
import { sendWhatsappText } from "../_lib/whatsapp.js";
import { verifyHmac } from "../_lib/webhook-hmac.js";

const TranscriptTurn = z.object({
  role: z.enum(["agent", "parent", "system"]),
  text: z.string(),
  started_at_ms: z.number().optional(),
  ended_at_ms: z.number().optional(),
});

// Optional fields use `.nullish()` (accepts both null and undefined) because
// the Python agent serialises unset optionals as JSON `null` rather than
// omitting the key — and Zod's plain `.optional()` only accepts `undefined`.
// Without this, every call where intent/summary/recording_url is unset
// failed schema validation with HTTP 400 (observed live on 2026-05-12).
const Body = z.object({
  leadId: z.string().uuid(),
  vendor_call_id: z.string().min(1).max(200).nullish(),
  started_at: z.union([z.number(), z.string()]).nullish(),
  ended_at: z.union([z.number(), z.string()]).nullish(),
  duration_seconds: z.number().int().nonnegative().nullish(),
  status: z
    .enum(["completed", "failed", "no_answer", "abandoned"])
    .default("completed"),
  recording_url: z.string().url().nullish(),
  transcript: z.array(TranscriptTurn).default([]),
  summary: z.string().nullish(),
  intent: z
    .enum(["register", "info", "visit", "price", "schedule", "other"])
    .nullish(),
  next_steps: z.array(z.string()).default([]),
});

const TRAINER_NAMES: Record<string, string> = {
  "t-sopi": "Răzvan Soporan",
  "t-kelemen": "Kelemen Andrei",
  "t-dan": "Dan Matei",
};

// Disable Vercel's default JSON body parser — we need the raw request
// bytes verbatim to HMAC them. If we let Vercel parse + we re-stringify,
// whitespace and unicode escaping diverge from Python's `json.dumps` (the
// agent's encoder), making every signature fail.
export const config = { api: { bodyParser: false } };

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  // When bodyParser is disabled, the request is the raw Node IncomingMessage
  // (AsyncIterable of Buffer chunks). We don't get req.body for free anymore.
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

const MAX_BODY_BYTES = 256 * 1024; // 256 KiB

class PayloadTooLargeError extends Error {
  constructor() {
    super("payload too large");
    this.name = "PayloadTooLargeError";
  }
}

async function readRawBody(req: Req): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req as unknown as AsyncIterable<Buffer | string>) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
    total += buf.length;
    if (total > MAX_BODY_BYTES) throw new PayloadTooLargeError();
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function toTimestamp(value: number | string | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return new Date(value * 1000).toISOString();
}

function fallbackVendorCallId(rawBody: Buffer): string {
  return `payload-sha256:${createHash("sha256").update(rawBody).digest("hex")}`;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  let rawBody: Buffer;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    if (err instanceof PayloadTooLargeError) {
      return res.status(413).json({ error: "payload too large" });
    }
    return res.status(400).json({
      error: "body_read_failed",
      detail: err instanceof Error ? err.message : "read failed",
    });
  }

  // Replay protection + signature verification. See _lib/webhook-hmac.ts.
  // services/voice-agent/agent.py sends X-Pipecat-Timestamp and signs
  // `${ts}.${body}` to match this verifier.
  const verifyResult = verifyHmac(
    rawBody,
    req.headers ?? {},
    "PIPECAT_WEBHOOK_SECRET",
    {
      signatureHeaders: ["x-pipecat-signature"],
      timestampHeaders: ["x-pipecat-timestamp"],
    }
  );
  if (!verifyResult.ok) {
    // Preserve the original 401 error codes (missing_timestamp / timestamp_skew /
    // invalid_signature / secret_unset / missing_signature) so existing
    // observability and the agent's retry logic don't change.
    return res.status(401).json({ error: verifyResult.reason });
  }

  let bodyJson: unknown;
  try {
    bodyJson = rawBody.length ? JSON.parse(rawBody.toString("utf8")) : {};
  } catch (err) {
    return res.status(400).json({
      error: "invalid_json",
      detail: err instanceof Error ? err.message : "parse failed",
    });
  }

  const parsed = Body.safeParse(bodyJson);
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_body",
      issues: parsed.error.issues,
    });
  }
  const data = parsed.data;
  const vendorCallId =
    data.vendor_call_id?.trim() || fallbackVendorCallId(rawBody);

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  // Pull the lead so we know who to notify.
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select(
      "id, parent_name, parent_phone_e164, child_name, child_age, assigned_trainer_id, cc_trainer_ids"
    )
    .eq("id", data.leadId)
    .single();
  if (leadErr || !lead) {
    return res
      .status(404)
      .json({ error: "lead_not_found", detail: leadErr?.message });
  }

  const recipients = Array.from(
    new Set([lead.assigned_trainer_id, ...(lead.cc_trainer_ids ?? [])]).values()
  );

  const { data: existingCall, error: existingCallErr } = await supabase
    .from("lead_calls")
    .select("id")
    .eq("vendor", "pipecat")
    .eq("vendor_call_id", vendorCallId)
    .maybeSingle();
  if (existingCallErr) {
    return res.status(500).json({
      error: "call_lookup_failed",
      detail: existingCallErr.message,
    });
  }
  if (existingCall) {
    return res.status(200).json({
      ok: true,
      duplicate: true,
      leadId: data.leadId,
      callId: existingCall.id,
      recipients,
    });
  }

  // Insert the call record.
  const { data: callRow, error: callErr } = await supabase
    .from("lead_calls")
    .insert({
      lead_id: data.leadId,
      vendor: "pipecat",
      vendor_call_id: vendorCallId,
      started_at: toTimestamp(data.started_at ?? undefined),
      ended_at: toTimestamp(data.ended_at ?? undefined),
      duration_seconds: data.duration_seconds ?? null,
      status: data.status,
      recording_url: data.recording_url ?? null,
      transcript: data.transcript,
      summary: data.summary ?? null,
      intent: data.intent ?? null,
      next_steps: data.next_steps,
      raw_payload: data,
    })
    .select("id")
    .single();
  if (callErr || !callRow) {
    if (isUniqueViolation(callErr)) {
      const { data: duplicate } = await supabase
        .from("lead_calls")
        .select("id")
        .eq("vendor", "pipecat")
        .eq("vendor_call_id", vendorCallId)
        .maybeSingle();
      if (duplicate) {
        return res.status(200).json({
          ok: true,
          duplicate: true,
          leadId: data.leadId,
          callId: duplicate.id,
          recipients,
        });
      }
    }
    return res
      .status(500)
      .json({ error: "call_insert_failed", detail: callErr?.message });
  }

  // Mark lead routed.
  await supabase
    .from("leads")
    .update({ status: "routed" })
    .eq("id", data.leadId);

  // Notification fanout — push/WhatsApp/email/inapp.
  const summary = data.summary ?? "Apel nou — vezi transcrierea în aplicație.";

  for (const trainerId of recipients) {
    const trainerLabel = TRAINER_NAMES[trainerId] ?? trainerId;
    const payload = {
      leadId: data.leadId,
      callId: callRow.id,
      parentName: lead.parent_name,
      childName: lead.child_name,
      childAge: lead.child_age,
      summary,
      intent: data.intent ?? null,
      nextSteps: data.next_steps,
      recordingUrl: data.recording_url ?? null,
    };

    // In-app + push (rows in lead_notifications drive both).
    await supabase.from("lead_notifications").insert([
      {
        recipient_trainer_id: trainerId,
        channel: "inapp",
        type: "new_lead_transcript",
        payload,
      },
      {
        recipient_trainer_id: trainerId,
        channel: "push",
        type: "new_lead_transcript",
        payload,
      },
      {
        recipient_trainer_id: trainerId,
        channel: "email",
        type: "new_lead_transcript",
        payload,
      },
      {
        recipient_trainer_id: trainerId,
        channel: "whatsapp",
        type: "new_lead_transcript",
        payload,
      },
    ]);

    // Best-effort WhatsApp summary to the trainer (skipped silently if no creds).
    const trainerPhoneEnv =
      process.env[
        `TRAINER_PHONE_${trainerId.replace(/-/g, "_").toUpperCase()}`
      ];
    if (trainerPhoneEnv) {
      const body = [
        `🆕 Lead nou pentru ${trainerLabel}`,
        `${lead.parent_name} (${lead.parent_phone_e164}) — copil: ${lead.child_name}, ${lead.child_age} ani`,
        "",
        summary,
        data.next_steps.length
          ? `\nPași: ${data.next_steps.map(s => `• ${s}`).join("\n")}`
          : "",
      ].join("\n");
      await sendWhatsappText(trainerPhoneEnv, body);
    }
  }

  return res
    .status(200)
    .json({ ok: true, leadId: data.leadId, callId: callRow.id, recipients });
}
