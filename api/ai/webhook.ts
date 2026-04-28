/**
 * POST /api/ai/webhook
 *
 * Webhook endpoint for ElevenLabs ConvAI. Called when a conversation
 * completes. Pulls the full transcript via the ElevenLabs API and updates
 * the matching ai_conversations row. Notifies the trainer in-app.
 *
 * Security: validate against the ELEVENLABS_WEBHOOK_SECRET header so we
 * don't accept spoofed payloads. The secret is set in the ElevenLabs
 * dashboard when configuring the webhook.
 */
import { z } from "zod";
import { serviceClient } from "../_lib/supabase";
import {
  fetchTranscript,
  transcriptToMarkdown,
  transcriptSummary,
} from "../_lib/elevenlabs";

const Payload = z.object({
  type: z.string().optional(),
  data: z
    .object({
      conversation_id: z.string().optional(),
      agent_id: z.string().optional(),
      status: z.string().optional(),
      conversation_token: z.string().optional(),
    })
    .partial(),
  // Top-level fallbacks (different webhook versions place fields differently)
  conversation_id: z.string().optional(),
  agent_id: z.string().optional(),
});

interface MinimalReq {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface MinimalRes {
  status: (n: number) => MinimalRes;
  json: (b: unknown) => MinimalRes;
}

function readHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const v = headers?.[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

export default async function handler(req: MinimalReq, res: MinimalRes) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expected = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (expected) {
    const got =
      readHeader(req.headers, "x-elevenlabs-signature") ??
      readHeader(req.headers, "elevenlabs-signature");
    if (got !== expected) {
      return res.status(401).json({ error: "Invalid signature" });
    }
  }

  const parsed = Payload.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const conversationId =
    parsed.data.conversation_id ?? parsed.data.data?.conversation_id;
  const status = parsed.data.data?.status ?? parsed.data.type ?? "completed";
  if (!conversationId) {
    return res.status(400).json({ error: "Missing conversation_id" });
  }

  const transcript = await fetchTranscript(conversationId);

  const svc = serviceClient();

  // Match by conversation id first, then by share token if present.
  const { data: existing, error: findErr } = await svc
    .from("ai_conversations")
    .select("id, parent_id, trainer_id, child_id")
    .eq("elevenlabs_conversation_id", conversationId)
    .maybeSingle();
  if (findErr) {
    return res.status(500).json({ error: findErr.message });
  }

  let rowId = existing?.id ?? null;

  // If we couldn't match on conversation id, optionally accept a token
  // delivered through a custom field. This keeps the integration robust.
  if (!rowId) {
    const token = parsed.data.data?.conversation_token;
    if (token) {
      const { data: byToken } = await svc
        .from("ai_conversations")
        .select("id, parent_id, trainer_id, child_id")
        .eq("share_token", token)
        .maybeSingle();
      rowId = byToken?.id ?? null;
    }
  }

  if (!rowId) {
    return res.status(202).json({ ok: true, matched: false });
  }

  const update: Record<string, unknown> = {
    elevenlabs_conversation_id: conversationId,
    status: status === "completed" ? "completed" : status === "failed" ? "failed" : "in_progress",
    ended_at: new Date().toISOString(),
  };
  if (transcript) {
    update.transcript_md = transcriptToMarkdown(transcript);
    update.transcript_summary = transcriptSummary(transcript);
    update.duration_seconds = transcript.durationSeconds ?? null;
    update.recording_url = transcript.audioUrl ?? null;
  }

  const upd = await svc.from("ai_conversations").update(update).eq("id", rowId);
  if (upd.error) {
    return res.status(500).json({ error: upd.error.message });
  }

  // Notify trainer
  const { data: row } = await svc
    .from("ai_conversations")
    .select("trainer_id, parent_id")
    .eq("id", rowId)
    .single();
  if (row?.trainer_id) {
    const { data: trainer } = await svc
      .from("trainers")
      .select("profile_id")
      .eq("id", row.trainer_id)
      .single();
    if (trainer?.profile_id) {
      await svc.from("notifications").insert({
        recipient_id: trainer.profile_id,
        kind: "ai_transcript_ready",
        title: "Transcript nou disponibil",
        body: "Un părinte tocmai a încheiat conversația cu asistentul AI. Vezi transcriptul în panou.",
        link: "/antrenor#transcripte",
      });
    }
  }

  return res.status(200).json({ ok: true, matched: true });
}
