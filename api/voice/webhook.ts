/**
 * POST /api/voice/webhook
 *
 * Pipecat agent posts end-of-call payload here. We:
 *   1. Verify the HMAC signature.
 *   2. Insert a `lead_calls` row (transcript + summary + intent + recording).
 *   3. Update the parent `leads` row → status='transcribed' → 'routed'.
 *   4. Fan out notifications to the assigned trainer + the boss across
 *      push / WhatsApp / email / inapp channels.
 *
 * See docs/AI_CALL_FLOW.md.
 */
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serviceClient } from "../_lib/supabase.js";
import { sendWhatsappText } from "../_lib/whatsapp.js";

const TranscriptTurn = z.object({
  role: z.enum(["agent", "parent", "system"]),
  text: z.string(),
  started_at_ms: z.number().optional(),
  ended_at_ms: z.number().optional(),
});

const Body = z.object({
  leadId: z.string().uuid(),
  vendor_call_id: z.string().optional(),
  started_at: z.union([z.number(), z.string()]).optional(),
  ended_at: z.union([z.number(), z.string()]).optional(),
  duration_seconds: z.number().int().nonnegative().optional(),
  status: z
    .enum(["completed", "failed", "no_answer", "abandoned"])
    .default("completed"),
  recording_url: z.string().url().optional(),
  transcript: z.array(TranscriptTurn).default([]),
  summary: z.string().optional(),
  intent: z
    .enum(["register", "info", "visit", "price", "schedule", "other"])
    .optional(),
  next_steps: z.array(z.string()).default([]),
});

const TRAINER_NAMES: Record<string, string> = {
  "t-sopi": "Sopi",
  "t-kelemen": "Kelemen Andrei",
  "t-dan": "Dan Matei",
};

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  rawBody?: string;
};

type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

function readHeader(req: Req, key: string): string | undefined {
  const v = req.headers?.[key.toLowerCase()] ?? req.headers?.[key];
  return Array.isArray(v) ? v[0] : v;
}

function verifySignature(req: Req): boolean {
  const secret = process.env.PIPECAT_WEBHOOK_SECRET;
  if (!secret) return true; // dev mode — skip
  const sig = readHeader(req, "x-pipecat-signature");
  if (!sig) return false;
  const raw = req.rawBody ?? JSON.stringify(req.body ?? {});
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function toTimestamp(value: number | string | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return new Date(value * 1000).toISOString();
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!verifySignature(req)) {
    return res.status(401).json({ error: "invalid_signature" });
  }

  const parsed = Body.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_body",
      issues: parsed.error.issues,
    });
  }
  const data = parsed.data;

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
    .select("id, parent_name, parent_phone_e164, child_name, child_age, assigned_trainer_id, cc_trainer_ids")
    .eq("id", data.leadId)
    .single();
  if (leadErr || !lead) {
    return res
      .status(404)
      .json({ error: "lead_not_found", detail: leadErr?.message });
  }

  // Insert the call record.
  const { data: callRow, error: callErr } = await supabase
    .from("lead_calls")
    .insert({
      lead_id: data.leadId,
      vendor: "pipecat",
      vendor_call_id: data.vendor_call_id ?? null,
      started_at: toTimestamp(data.started_at),
      ended_at: toTimestamp(data.ended_at),
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
  const recipients = Array.from(
    new Set([lead.assigned_trainer_id, ...(lead.cc_trainer_ids ?? [])])
      .values(),
  );
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
      { recipient_trainer_id: trainerId, channel: "inapp", type: "new_lead_transcript", payload },
      { recipient_trainer_id: trainerId, channel: "push",  type: "new_lead_transcript", payload },
      { recipient_trainer_id: trainerId, channel: "email", type: "new_lead_transcript", payload },
      { recipient_trainer_id: trainerId, channel: "whatsapp", type: "new_lead_transcript", payload },
    ]);

    // Best-effort WhatsApp summary to the trainer (skipped silently if no creds).
    const trainerPhoneEnv = process.env[`TRAINER_PHONE_${trainerId.replace(/-/g, "_").toUpperCase()}`];
    if (trainerPhoneEnv) {
      const body = [
        `🆕 Lead nou pentru ${trainerLabel}`,
        `${lead.parent_name} (${lead.parent_phone_e164}) — copil: ${lead.child_name}, ${lead.child_age} ani`,
        "",
        summary,
        data.next_steps.length ? `\nPași: ${data.next_steps.map((s) => `• ${s}`).join("\n")}` : "",
      ].join("\n");
      await sendWhatsappText(trainerPhoneEnv, body);
    }
  }

  return res
    .status(200)
    .json({ ok: true, leadId: data.leadId, callId: callRow.id, recipients });
}
