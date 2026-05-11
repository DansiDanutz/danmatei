/**
 * POST /api/voice/start
 *
 * Called by the /apel/:token page when the parent clicks "Începe apelul".
 *
 * Flow:
 *   1. Verify the signed token from /api/lead/create (HMAC + expiry).
 *   2. Resolve the lead row.
 *   3. Generate a deterministic LiveKit room name from the lead id.
 *   4. Issue two short-lived LiveKit JWTs:
 *        - one for the parent's browser (read+write audio)
 *        - one for the Pipecat agent (read+write audio + agent metadata)
 *   5. POST to the Pipecat agent's /spawn endpoint so the agent joins
 *      the same room with the parent's lead context (name, child, age).
 *   6. Return the parent's join token + LiveKit URL to the browser.
 *
 * The token-signing scheme matches `api/lead/create.ts`.
 *
 * Env required (production):
 *   - LIVEKIT_URL                 (wss://...)
 *   - LIVEKIT_API_KEY
 *   - LIVEKIT_API_SECRET
 *   - VOICE_AGENT_SPAWN_URL       (http://voice-agent:8080/spawn)
 *   - VOICE_AGENT_AUTH_TOKEN      (shared secret)
 *   - LEAD_LINK_SIGNING_SECRET    (matches api/lead/create.ts)
 *
 * In dev/preview without these vars, returns 503 and the page falls back
 * to a "voice agent not configured" message.
 */
import { createHmac } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import { serviceClient } from "../_lib/supabase.js";

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

const SIGNING_SECRET =
  process.env.LEAD_LINK_SIGNING_SECRET ??
  process.env.SUPABASE_SERVICE_ROLE ??
  "danmatei-dev";

function verifyToken(token: string): { leadId: string } | null {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", SIGNING_SECRET)
    .update(payload)
    .digest("base64url");
  if (expected !== sig) return null;
  const [leadId, expiresAtStr] = payload.split(".");
  const expiresAt = Number(expiresAtStr);
  if (!leadId || !expiresAt || Date.now() > expiresAt) return null;
  return { leadId };
}

function readBody(req: Req): Record<string, unknown> {
  if (typeof req.body === "object" && req.body) return req.body as Record<string, unknown>;
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
  const verified = verifyToken(token);
  if (!verified) return res.status(401).json({ error: "invalid_token" });

  const livekitUrl = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  // Auto-dispatch agent name — must match the registered LIVEKIT_AGENT_NAME
  // on the Fly-hosted worker (services/voice-agent/agent.py).
  const agentName = process.env.LIVEKIT_AGENT_NAME || "danmatei-voice-agent";
  if (!livekitUrl || !apiKey || !apiSecret) {
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
      "id, parent_name, parent_phone_e164, child_name, child_age, assigned_trainer_id",
    )
    .eq("id", verified.leadId)
    .single();
  if (error || !lead) {
    return res.status(404).json({ error: "lead_not_found" });
  }

  const room = `lead-${verified.leadId.slice(0, 8)}-${Date.now().toString(36)}`;

  // Lead context that the agent reads from room.metadata on connect.
  const roomMetadata = JSON.stringify({
    leadId: lead.id,
    parentName: lead.parent_name,
    childName: lead.child_name,
    childAge: lead.child_age,
  });

  // Mint the parent's token with LiveKit auto-dispatch wired up: when the
  // parent joins this room, LiveKit Cloud spawns the agent worker named
  // `agentName` against the same room. No /spawn HTTP call needed.
  const parentToken = await mintToken({
    apiKey,
    apiSecret,
    room,
    identity: `parent-${verified.leadId.slice(0, 8)}`,
    name: lead.parent_name,
    ttlSeconds: 60 * 30, // 30 min
    metadata: JSON.stringify({ role: "parent", leadId: lead.id }),
    agentName,
    roomMetadata,
  });

  // Move the lead to 'calling' status (best effort)
  await supabase
    .from("leads")
    .update({ status: "calling" })
    .eq("id", verified.leadId);

  return res.status(200).json({
    ok: true,
    leadId: lead.id,
    livekitUrl,
    room,
    token: parentToken,
    agentDispatch: { mode: "livekit-auto-dispatch", agentName },
  });
}

async function mintToken(opts: {
  apiKey: string;
  apiSecret: string;
  room: string;
  identity: string;
  name: string;
  ttlSeconds: number;
  metadata?: string;
  // When set, LiveKit Cloud auto-dispatches the named agent into the room
  // as soon as the participant joins. `roomMetadata` is attached to the
  // room (separate from the participant's `metadata`) and is what the
  // agent reads to learn about the lead.
  agentName?: string;
  roomMetadata?: string;
}): Promise<string> {
  const at = new AccessToken(opts.apiKey, opts.apiSecret, {
    identity: opts.identity,
    name: opts.name,
    ttl: opts.ttlSeconds,
    metadata: opts.metadata,
  });
  at.addGrant({
    roomJoin: true,
    room: opts.room,
    canPublish: true,
    canSubscribe: true,
  });
  if (opts.agentName) {
    // Cast through `never` — `roomConfig` is part of the JWT claims spec
    // but isn't typed on the older AccessToken class. The LiveKit server
    // reads it and creates the room with these settings.
    (at as unknown as { roomConfig: unknown }).roomConfig = {
      agents: [{ agentName: opts.agentName }],
      metadata: opts.roomMetadata,
    };
  }
  return at.toJwt();
}
