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
import { serviceClient } from "../_lib/supabase.js";
import {
  fetchTranscript,
  transcriptToMarkdown,
  transcriptSummary,
} from "../_lib/elevenlabs.js";
import { verifyHmac } from "../_lib/webhook-hmac.js";

// Disable Vercel's default JSON body parser — we need the raw request bytes
// verbatim to HMAC them. Matches the pattern in api/voice/webhook.ts.
export const config = { api: { bodyParser: false } };

const MAX_BODY_BYTES = 256 * 1024; // 256 KiB

function requiresWebhookSecret(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview"
  );
}

function isWebhookConfigured(): boolean {
  return (
    Boolean(process.env.ELEVENLABS_WEBHOOK_SECRET) || !requiresWebhookSecret()
  );
}

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
  // With bodyParser disabled, the request is an AsyncIterable of Buffer chunks.
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
}

interface MinimalRes {
  status: (n: number) => MinimalRes;
  json: (b: unknown) => MinimalRes;
}

class PayloadTooLargeError extends Error {
  constructor() {
    super("payload too large");
    this.name = "PayloadTooLargeError";
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

async function readRawBody(req: MinimalReq): Promise<Buffer> {
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

export default async function handler(req: MinimalReq, res: MinimalRes) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isWebhookConfigured()) {
    return res.status(503).json({
      error: "elevenlabs_webhook_secret_unset",
      message: "ELEVENLABS_WEBHOOK_SECRET is required in production.",
    });
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
  // ElevenLabs hashes the body only (no timestamp binding) — the timestamp
  // header is still required for replay protection but not part of the
  // HMAC payload.
  const verifyResult = verifyHmac(
    rawBody,
    req.headers ?? {},
    "ELEVENLABS_WEBHOOK_SECRET",
    {
      signatureHeaders: ["x-elevenlabs-signature", "elevenlabs-signature"],
      timestampHeaders: ["x-elevenlabs-timestamp", "elevenlabs-timestamp"],
      bindTimestamp: false,
    }
  );
  if (!verifyResult.ok) {
    // The original returned a capitalised "Invalid signature" for bad
    // signatures specifically — keep that for back-compat. Map the other
    // reasons to the same shape used by voice/webhook.
    const error =
      verifyResult.reason === "invalid_signature"
        ? "Invalid signature"
        : verifyResult.reason;
    return res.status(401).json({ error });
  }

  let bodyJson: unknown;
  try {
    bodyJson = rawBody.length ? JSON.parse(rawBody.toString("utf-8")) : {};
  } catch {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const parsed = Payload.safeParse(bodyJson);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const conversationId =
    parsed.data.conversation_id ?? parsed.data.data?.conversation_id;
  const status = parsed.data.data?.status ?? parsed.data.type ?? "completed";
  if (!conversationId) {
    return res.status(400).json({ error: "Missing conversation_id" });
  }

  let svc;
  try {
    svc = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  // Match by conversation id first, then by share token if present.
  const { data: existing, error: findErr } = await svc
    .from("ai_conversations")
    .select(
      "id, parent_id, trainer_id, child_id, status, ended_at, transcript_md"
    )
    .eq("elevenlabs_conversation_id", conversationId)
    .maybeSingle();
  if (findErr) {
    return res.status(500).json({ error: findErr.message });
  }

  let row =
    (existing as {
      id: string;
      parent_id: string | null;
      trainer_id: string | null;
      child_id: string | null;
      status: string | null;
      ended_at: string | null;
      transcript_md: string | null;
    } | null) ?? null;
  let rowId = row?.id ?? null;

  // If we couldn't match on conversation id, optionally accept a token
  // delivered through a custom field. This keeps the integration robust.
  if (!rowId) {
    const token = parsed.data.data?.conversation_token;
    if (token) {
      const { data: byToken } = await svc
        .from("ai_conversations")
        .select(
          "id, parent_id, trainer_id, child_id, status, ended_at, transcript_md"
        )
        .eq("share_token", token)
        .maybeSingle();
      row =
        (byToken as {
          id: string;
          parent_id: string | null;
          trainer_id: string | null;
          child_id: string | null;
          status: string | null;
          ended_at: string | null;
          transcript_md: string | null;
        } | null) ?? null;
      rowId = row?.id ?? null;
    }
  }

  if (!rowId) {
    return res.status(202).json({ ok: true, matched: false });
  }

  if (row?.status === "completed" && row.ended_at && row.transcript_md) {
    return res.status(200).json({
      ok: true,
      matched: true,
      duplicate: true,
    });
  }

  const transcript = await fetchTranscript(conversationId);

  const update: Record<string, unknown> = {
    elevenlabs_conversation_id: conversationId,
    status:
      status === "completed"
        ? "completed"
        : status === "failed"
          ? "failed"
          : "in_progress",
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

  // Notify trainer only on the first meaningful completion. Webhook providers
  // retry aggressively; repeated completed payloads must not spam the inbox.
  const shouldNotify = row?.status !== "completed" || !row?.ended_at;
  if (shouldNotify && row?.trainer_id) {
    const { data: trainer } = await svc
      .from("trainers")
      .select("profile_id")
      .eq("id", row.trainer_id)
      .single();
    if (trainer?.profile_id) {
      const { error: notifyErr } = await svc.from("notifications").insert({
        recipient_id: trainer.profile_id,
        kind: "ai_transcript_ready",
        title: "Transcript nou disponibil",
        body: "Un părinte tocmai a încheiat conversația cu asistentul AI. Vezi transcriptul în panou.",
        link: "/antrenor#transcripte",
        dedupe_key: `ai_conversation:${rowId}:trainer:${trainer.profile_id}`,
      });
      if (notifyErr && !isUniqueViolation(notifyErr)) {
        return res.status(500).json({ error: notifyErr.message });
      }
    }
  }

  return res.status(200).json({ ok: true, matched: true });
}
