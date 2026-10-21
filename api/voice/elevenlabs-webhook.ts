/**
 * POST /api/voice/elevenlabs-webhook
 *
 * ElevenLabs Conversational AI posts here when an AI interview ends (the
 * workspace "post-call webhook", type `post_call_transcription`). We:
 *   1. Verify the `ElevenLabs-Signature` header.
 *   2. Resolve the lead from the `call_token` dynamic variable that
 *      /api/voice/start signed for this call — never from an unsigned id.
 *   3. Map the transcript + post-call analysis to a `lead_calls` row and
 *      notify the lead's trainers (api/_lib/lead-call-result.ts).
 *
 * Other event types (audio, initiation failures) are acknowledged and
 * ignored so ElevenLabs doesn't retry them.
 *
 * See docs/AI_CALL_FLOW.md.
 */
import { z } from "zod";
import { serviceClient } from "../_lib/supabase.js";
import { verifyToken } from "../_lib/sign-token.js";
import { verifyElevenLabsSignature } from "../_lib/elevenlabs-signature.js";
import {
  LEAD_CALL_INTENTS,
  recordLeadCall,
  type LeadCallIntent,
  type LeadCallResult,
  type LeadCallTurn,
} from "../_lib/lead-call-result.js";

// Raw bytes are needed verbatim for the HMAC.
export const config = { api: { bodyParser: false } };

const MAX_BODY_BYTES = 2 * 1024 * 1024; // transcripts + analysis, no audio

const DataCollectionValue = z
  .object({ value: z.unknown().optional() })
  .passthrough();

const Payload = z.object({
  type: z.string(),
  data: z
    .object({
      conversation_id: z.string().min(1),
      status: z.string().optional(),
      transcript: z
        .array(
          z
            .object({
              role: z.string(),
              message: z.string().nullish(),
              time_in_call_secs: z.number().nullish(),
            })
            .passthrough()
        )
        .default([]),
      metadata: z
        .object({
          start_time_unix_secs: z.number().nullish(),
          call_duration_secs: z.number().nullish(),
        })
        .passthrough()
        .optional(),
      analysis: z
        .object({
          transcript_summary: z.string().nullish(),
          data_collection_results: z
            .record(z.string(), DataCollectionValue)
            .nullish(),
        })
        .passthrough()
        .nullish(),
      conversation_initiation_client_data: z
        .object({
          dynamic_variables: z.record(z.string(), z.unknown()).nullish(),
        })
        .passthrough()
        .nullish(),
    })
    .passthrough(),
});
export type ElevenLabsPostCall = z.infer<typeof Payload>;

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

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

function header(req: Req, name: string): string | undefined {
  const v = req.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}

function collected(
  analysis: ElevenLabsPostCall["data"]["analysis"],
  key: string
): string | null {
  const v = analysis?.data_collection_results?.[key]?.value;
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed && trimmed.toLowerCase() !== "none" ? trimmed : null;
}

/**
 * ElevenLabs' summary (Romanian: the agent sets summary_language = "ro") plus
 * the collected details trainers act on.
 */
function trainerSummary(
  analysis: ElevenLabsPostCall["data"]["analysis"]
): string | null {
  const lines = [
    analysis?.transcript_summary?.trim(),
    collected(analysis, "child_experience") &&
      `Experiență: ${collected(analysis, "child_experience")}`,
    collected(analysis, "availability") &&
      `Disponibilitate: ${collected(analysis, "availability")}`,
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}

/**
 * Map an ElevenLabs post-call payload to the shared call record. Returns null
 * when the payload carries no valid `call_token` (not one of our calls).
 */
export function toLeadCallResult(
  payload: ElevenLabsPostCall
): LeadCallResult | null {
  const { data } = payload;
  const token = data.conversation_initiation_client_data?.dynamic_variables
    ?.call_token;
  const verified = typeof token === "string" ? verifyToken(token) : null;
  if (!verified) return null;

  const transcript: LeadCallTurn[] = [];
  for (const turn of data.transcript) {
    const text = turn.message?.trim();
    if (!text) continue; // tool calls / silent turns
    transcript.push({
      role: turn.role === "agent" ? "agent" : "parent",
      text,
      ...(turn.time_in_call_secs != null
        ? { started_at_ms: Math.round(turn.time_in_call_secs * 1000) }
        : {}),
    });
  }

  const start = data.metadata?.start_time_unix_secs ?? null;
  const duration = data.metadata?.call_duration_secs ?? null;
  const intentRaw = collected(data.analysis, "intent")?.toLowerCase() ?? null;
  const intent = (LEAD_CALL_INTENTS as readonly string[]).includes(
    intentRaw ?? ""
  )
    ? (intentRaw as LeadCallIntent)
    : null;
  const nextSteps = (collected(data.analysis, "next_steps") ?? "")
    .split(/\n|;/)
    .map(s => s.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean);
  const parentSpoke = transcript.some(t => t.role === "parent");

  return {
    leadId: verified.leadId,
    vendor: "elevenlabs",
    vendorCallId: data.conversation_id,
    startedAt: start != null ? new Date(start * 1000).toISOString() : null,
    endedAt:
      start != null && duration != null
        ? new Date((start + duration) * 1000).toISOString()
        : null,
    durationSeconds: duration != null ? Math.round(duration) : null,
    status:
      data.status && data.status !== "done"
        ? "failed"
        : parentSpoke
          ? "completed"
          : "abandoned",
    recordingUrl: null,
    transcript,
    summary: trainerSummary(data.analysis),
    intent,
    nextSteps,
    rawPayload: payload,
  };
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
    return res.status(400).json({ error: "body_read_failed" });
  }

  const verify = verifyElevenLabsSignature(
    rawBody,
    header(req, "elevenlabs-signature")
  );
  if (!verify.ok) return res.status(401).json({ error: verify.reason });

  let json: unknown;
  try {
    json = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "invalid_json" });
  }

  const type = (json as { type?: unknown })?.type;
  if (type !== "post_call_transcription") {
    return res.status(200).json({ ok: true, ignored: type ?? "unknown" });
  }

  const parsed = Payload.safeParse(json);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_body", issues: parsed.error.issues });
  }

  const result = toLeadCallResult(parsed.data);
  if (!result) {
    // Not started through /apel (e.g. a dashboard test call) — nothing to
    // attach it to. Acknowledge so ElevenLabs doesn't retry.
    return res.status(200).json({ ok: true, ignored: "no_call_token" });
  }

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  const outcome = await recordLeadCall(supabase, result);
  return res.status(outcome.status).json(outcome.body);
}
