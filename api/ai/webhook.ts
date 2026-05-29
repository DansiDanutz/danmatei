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
import { createHmac, timingSafeEqual } from "node:crypto";
import { serviceClient } from "../_lib/supabase.js";
import {
  fetchTranscript,
  transcriptToMarkdown,
  transcriptSummary,
} from "../_lib/elevenlabs.js";

// Disable Vercel's default JSON body parser — we need the raw request bytes
// verbatim to HMAC them. Matches the pattern in api/voice/webhook.ts.
export const config = { api: { bodyParser: false } };

const MAX_BODY_BYTES = 256 * 1024; // 256 KiB
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // 5 minutes

// Fail-closed: require the secret at module-load time in production. ElevenLabs
// signs delivery with it, and we will not accept unsigned bodies in prod.
const IS_PROD =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";
if (IS_PROD && !process.env.ELEVENLABS_WEBHOOK_SECRET) {
  throw new Error("ELEVENLABS_WEBHOOK_SECRET required in production");
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

function readHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const v = headers?.[key.toLowerCase()] ?? headers?.[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

class PayloadTooLargeError extends Error {
  constructor() {
    super("payload too large");
    this.name = "PayloadTooLargeError";
  }
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

function verifySignature(rawBody: Buffer, headerSig: string | undefined): boolean {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  // If no secret is configured (only possible in non-prod since prod throws
  // at import time), accept unsigned — the dev needs to be able to iterate
  // locally without a webhook secret.
  if (!secret) return true;
  if (!headerSig) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = Buffer.from(headerSig);
  const exp = Buffer.from(expected);
  if (got.length !== exp.length) return false;
  try {
    return timingSafeEqual(got, exp);
  } catch {
    return false;
  }
}

export default async function handler(req: MinimalReq, res: MinimalRes) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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

  // Replay protection — require X-Elevenlabs-Timestamp within 5min skew.
  // ElevenLabs may not yet send this header; the deployment gate is rotating
  // the webhook secret once it does. When the secret is absent (non-prod only)
  // we skip the timestamp check too.
  if (process.env.ELEVENLABS_WEBHOOK_SECRET) {
    const tsHeader =
      readHeader(req.headers, "x-elevenlabs-timestamp") ??
      readHeader(req.headers, "elevenlabs-timestamp");
    const tsMs = tsHeader ? Number(tsHeader) : NaN;
    if (!Number.isFinite(tsMs)) {
      return res.status(401).json({ error: "missing_timestamp" });
    }
    if (Math.abs(Date.now() - tsMs) > MAX_TIMESTAMP_SKEW_MS) {
      return res.status(401).json({ error: "timestamp_skew" });
    }
  }

  const sig =
    readHeader(req.headers, "x-elevenlabs-signature") ??
    readHeader(req.headers, "elevenlabs-signature");
  if (!verifySignature(rawBody, sig)) {
    return res.status(401).json({ error: "Invalid signature" });
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
