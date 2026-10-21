/**
 * Record a finished AI interview call and notify the lead's trainers.
 *
 * Used by api/voice/elevenlabs-webhook.ts after it verifies and parses the
 * ElevenLabs post-call payload into a `LeadCallResult`: idempotent
 * `lead_calls` insert, lead → routed, trainer notification fan-out. Rows
 * from the retired LiveKit worker keep vendor = 'pipecat'.
 */
import type { serviceClient } from "./supabase.js";
import { sendWhatsappText } from "./whatsapp.js";

export const LEAD_CALL_INTENTS = [
  "register",
  "info",
  "visit",
  "price",
  "schedule",
  "other",
] as const;
export type LeadCallIntent = (typeof LEAD_CALL_INTENTS)[number];

export interface LeadCallTurn {
  role: "agent" | "parent" | "system";
  text: string;
  started_at_ms?: number;
  ended_at_ms?: number;
}

export interface LeadCallResult {
  leadId: string;
  vendor: "elevenlabs";
  vendorCallId: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  status: "completed" | "failed" | "no_answer" | "abandoned";
  recordingUrl: string | null;
  transcript: LeadCallTurn[];
  summary: string | null;
  intent: LeadCallIntent | null;
  nextSteps: string[];
  rawPayload: unknown;
}

const TRAINER_NAMES: Record<string, string> = {
  "t-sopi": "Răzvan Soporan",
  "t-kelemen": "Kelemen Andrei",
  "t-dan": "Dan Matei",
};

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export type RecordLeadCallOutcome = {
  status: number;
  body: Record<string, unknown>;
};

export async function recordLeadCall(
  supabase: ReturnType<typeof serviceClient>,
  data: LeadCallResult
): Promise<RecordLeadCallOutcome> {
  // Pull the lead so we know who to notify.
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select(
      "id, parent_name, parent_phone_e164, child_name, child_age, assigned_trainer_id, cc_trainer_ids"
    )
    .eq("id", data.leadId)
    .single();
  if (leadErr || !lead) {
    return {
      status: 404,
      body: { error: "lead_not_found", detail: leadErr?.message },
    };
  }

  const recipients = Array.from(
    new Set([lead.assigned_trainer_id, ...(lead.cc_trainer_ids ?? [])]).values()
  );

  const { data: existingCall, error: existingCallErr } = await supabase
    .from("lead_calls")
    .select("id")
    .eq("vendor", data.vendor)
    .eq("vendor_call_id", data.vendorCallId)
    .maybeSingle();
  if (existingCallErr) {
    return {
      status: 500,
      body: { error: "call_lookup_failed", detail: existingCallErr.message },
    };
  }
  if (existingCall) {
    return {
      status: 200,
      body: {
        ok: true,
        duplicate: true,
        leadId: data.leadId,
        callId: existingCall.id,
        recipients,
      },
    };
  }

  // Insert the call record.
  const { data: callRow, error: callErr } = await supabase
    .from("lead_calls")
    .insert({
      lead_id: data.leadId,
      vendor: data.vendor,
      vendor_call_id: data.vendorCallId,
      started_at: data.startedAt,
      ended_at: data.endedAt,
      duration_seconds: data.durationSeconds,
      status: data.status,
      recording_url: data.recordingUrl,
      transcript: data.transcript,
      summary: data.summary,
      intent: data.intent,
      next_steps: data.nextSteps,
      raw_payload: data.rawPayload,
    })
    .select("id")
    .single();
  if (callErr || !callRow) {
    if (isUniqueViolation(callErr)) {
      const { data: duplicate } = await supabase
        .from("lead_calls")
        .select("id")
        .eq("vendor", data.vendor)
        .eq("vendor_call_id", data.vendorCallId)
        .maybeSingle();
      if (duplicate) {
        return {
          status: 200,
          body: {
            ok: true,
            duplicate: true,
            leadId: data.leadId,
            callId: duplicate.id,
            recipients,
          },
        };
      }
    }
    return {
      status: 500,
      body: { error: "call_insert_failed", detail: callErr?.message },
    };
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
      intent: data.intent,
      nextSteps: data.nextSteps,
      recordingUrl: data.recordingUrl,
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
        data.nextSteps.length
          ? `\nPași: ${data.nextSteps.map(s => `• ${s}`).join("\n")}`
          : "",
      ].join("\n");
      await sendWhatsappText(trainerPhoneEnv, body);
    }
  }

  return {
    status: 200,
    body: { ok: true, leadId: data.leadId, callId: callRow.id, recipients },
  };
}
