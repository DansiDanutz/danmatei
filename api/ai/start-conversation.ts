/**
 * POST /api/ai/start-conversation
 *
 * Called server-side from the signup completion flow. Creates an ElevenLabs
 * ConvAI shareable link for the parent, persists the conversation row, and
 * returns the link so the calling endpoint can include it in the welcome
 * WhatsApp message.
 *
 * Auth: caller must be authenticated. The conversation is bound to the
 * authenticated parent's profile.
 *
 * Body: { childId?: string }   // optional, narrows trainer/agent lookup
 */
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { serviceClient, userClient, getJwtFromHeader } from "../_lib/supabase";
import { createConvAILink } from "../_lib/elevenlabs";

const Body = z.object({
  childId: z.string().uuid().optional(),
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

interface ChildLookup {
  id: string;
  trainer_id: string | null;
  trainer:
    | { id: string; elevenlabs_agent_id: string | null }
    | null;
}

export default async function handler(req: MinimalReq, res: MinimalRes) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const auth =
    typeof req.headers?.authorization === "string"
      ? req.headers.authorization
      : Array.isArray(req.headers?.authorization)
        ? req.headers.authorization[0]
        : undefined;
  const jwt = getJwtFromHeader(auth);
  if (!jwt) return res.status(401).json({ error: "Missing bearer token" });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  }
  const { childId } = parsed.data;

  // Identify the calling parent.
  const u = userClient(jwt);
  const profileQ = await u.from("profiles").select("id").single();
  if (profileQ.error || !profileQ.data) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const parentId = profileQ.data.id as string;

  // Find the trainer + agent through the (optional) child.
  let trainerId: string | null = null;
  let agentId: string | null = null;
  if (childId) {
    const childQ = await u
      .from("children")
      .select(
        "id, trainer_id, trainer:trainers!children_trainer_id_fkey(id, elevenlabs_agent_id)",
      )
      .eq("id", childId)
      .maybeSingle();
    const child = childQ.data as ChildLookup | null;
    trainerId = child?.trainer_id ?? null;
    agentId = child?.trainer?.elevenlabs_agent_id ?? null;
  }

  const shareToken = randomBytes(12).toString("base64url");
  const linkResult = await createConvAILink(agentId, shareToken);

  // Persist via service client (bypasses RLS — table is service-only writes).
  const svc = serviceClient();
  const insert = await svc
    .from("ai_conversations")
    .insert({
      parent_id: parentId,
      trainer_id: trainerId,
      child_id: childId ?? null,
      elevenlabs_agent_id: linkResult.agentId,
      elevenlabs_conversation_id: linkResult.conversationId ?? null,
      share_link: linkResult.link,
      share_token: shareToken,
      status: "pending",
    })
    .select("id, share_link, share_token")
    .single();

  if (insert.error || !insert.data) {
    return res.status(500).json({ error: insert.error?.message ?? "Insert failed" });
  }

  return res.status(200).json({
    conversationId: insert.data.id,
    link: insert.data.share_link,
    token: insert.data.share_token,
    source: linkResult.source,
  });
}
