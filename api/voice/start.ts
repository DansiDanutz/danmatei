/**
 * POST /api/voice/start
 *
 * Called by the /apel/:token page when the parent clicks "Începe apelul".
 *
 * Flow:
 *   1. Verify the signed token from /api/lead/create (HMAC + expiry).
 *   2. Resolve the lead row.
 *   3. Ask ElevenLabs for a signed WebSocket URL for the interview agent
 *      (the API key never reaches the browser).
 *   4. Return it with the call's dynamic variables: parent/child context for
 *      the agent's prompt, plus a short-lived `call_token` that
 *      /api/voice/elevenlabs-webhook verifies to attach the finished call to
 *      this lead.
 *
 * Env required (production):
 *   - ELEVENLABS_API_KEY
 *   - ELEVENLABS_INTERVIEW_AGENT_ID   (created by scripts/elevenlabs-agent.mjs)
 *   - LEAD_LINK_SIGNING_SECRET        (matches api/lead/create.ts)
 *
 * Without the ElevenLabs vars it returns 503 `voice_not_configured` and the
 * page tells the parent the trainer will contact them on WhatsApp.
 */
import { serviceClient } from "../_lib/supabase.js";
import { checkRateLimit } from "../_lib/ratelimit.js";
import {
  isLeadLinkSigningConfigured,
  signToken,
  verifyToken,
} from "../_lib/sign-token.js";

const ELEVENLABS_API = "https://api.elevenlabs.io/v1";
// Long enough for the call (capped at a few minutes by the agent) plus
// ElevenLabs' post-call analysis before the webhook arrives.
const CALL_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

function readBody(req: Req): Record<string, unknown> {
  if (typeof req.body === "object" && req.body)
    return req.body as Record<string, unknown>;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const body = readBody(req);
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return res.status(400).json({ error: "missing_token" });
  if (!isLeadLinkSigningConfigured()) {
    return res.status(503).json({
      error: "lead_link_signing_unavailable",
      message: "LEAD_LINK_SIGNING_SECRET is required in production.",
    });
  }
  const verified = verifyToken(token);
  if (!verified) return res.status(401).json({ error: "invalid_token" });
  // Links are valid for 24h and reusable; each start dispatches a paid voice
  // agent, so cap how often one lead can open a call.
  if (!checkRateLimit(`voice:${verified.leadId}`, 3, 60 * 60 * 1000).ok) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_INTERVIEW_AGENT_ID;
  if (!apiKey || !agentId) {
    return res.status(503).json({ error: "voice_not_configured" });
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

  const { data: lead, error } = await supabase
    .from("leads")
    .select(
      "id, parent_name, parent_phone_e164, child_name, child_age, assigned_trainer_id"
    )
    .eq("id", verified.leadId)
    .single();
  if (error || !lead) {
    return res.status(404).json({ error: "lead_not_found" });
  }

  // Look up OTHER leads with the same phone number that have already
  // completed at least one AI call (status routed or transcribed). If
  // there is any, this parent has spoken to Andra before and we want
  // her to skip the "are you new?" branch on the next call. We use the
  // count only — no PII leaks into the agent metadata beyond what's
  // already there. Best-effort: if the query fails, we just treat them
  // as a new parent.
  let previousCallsCount = 0;
  if (lead.parent_phone_e164) {
    const { count } = await supabase
      .from("leads")
      .select("id", { head: true, count: "exact" })
      .eq("parent_phone_e164", lead.parent_phone_e164)
      .neq("id", lead.id)
      .in("status", ["routed", "transcribed"]);
    previousCallsCount = count ?? 0;
  }
  const isExistingParent = previousCallsCount > 0;

  const signed = await fetch(
    `${ELEVENLABS_API}/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": apiKey } }
  ).catch(() => null);
  const signedJson = signed?.ok
    ? ((await signed.json().catch(() => null)) as { signed_url?: string } | null)
    : null;
  if (!signedJson?.signed_url) {
    console.error("[voice/start] ElevenLabs signed URL failed", signed?.status);
    return res.status(502).json({ error: "voice_unavailable" });
  }

  // Move the lead to 'calling' status (best effort)
  await supabase
    .from("leads")
    .update({ status: "calling" })
    .eq("id", verified.leadId);

  return res.status(200).json({
    ok: true,
    leadId: lead.id,
    signedUrl: signedJson.signed_url,
    // Referenced as {{name}} in the agent's prompt / first message.
    dynamicVariables: {
      parent_name: lead.parent_name ?? "",
      child_name: lead.child_name ?? "",
      child_age: lead.child_age ?? "",
      is_existing_parent: isExistingParent,
      previous_calls_count: previousCallsCount,
      call_token: signToken(lead.id, { ttlMs: CALL_TOKEN_TTL_MS }),
    },
  });
}
