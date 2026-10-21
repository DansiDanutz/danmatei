/**
 * POST /api/voice/webhook
 *
 * The legacy LiveKit voice agent posts end-of-call payloads here. We:
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
import { verifyHmac } from "../_lib/webhook-hmac.js";
import { LEAD_CALL_INTENTS, recordLeadCall } from "../_lib/lead-call-result.js";

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
  intent: z.enum(LEAD_CALL_INTENTS).nullish(),
  next_steps: z.array(z.string()).default([]),
});

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

  const outcome = await recordLeadCall(supabase, {
    leadId: data.leadId,
    vendor: "pipecat",
    vendorCallId,
    startedAt: toTimestamp(data.started_at ?? undefined),
    endedAt: toTimestamp(data.ended_at ?? undefined),
    durationSeconds: data.duration_seconds ?? null,
    status: data.status,
    recordingUrl: data.recording_url ?? null,
    transcript: data.transcript,
    summary: data.summary ?? null,
    intent: data.intent ?? null,
    nextSteps: data.next_steps,
    rawPayload: data,
  });
  return res.status(outcome.status).json(outcome.body);
}
