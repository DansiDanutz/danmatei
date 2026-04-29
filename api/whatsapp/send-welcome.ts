/**
 * POST /api/whatsapp/send-welcome
 *
 * Called once after a parent completes child onboarding. Generates an
 * ElevenLabs ConvAI link, stores the conversation row, and sends a
 * welcome message to the parent's WhatsApp number with the link.
 *
 * Body: { childId: string }
 */
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { serviceClient, userClient, getJwtFromHeader } from "../_lib/supabase.js";
import { sendWhatsappText } from "../_lib/whatsapp.js";
import { createConvAILink } from "../_lib/elevenlabs.js";

const Body = z.object({
  childId: z.string().uuid(),
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
  full_name: string;
  trainer_id: string | null;
  parent: { id: string; full_name: string; phone: string | null } | null;
  trainer: {
    id: string;
    elevenlabs_agent_id: string | null;
    whatsapp_number: string | null;
    profile: { full_name: string } | null;
  } | null;
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

  // Resolve child + parent + trainer through the user JWT (so RLS confirms
  // the caller actually owns this child).
  const u = userClient(jwt);
  const childQ = await u
    .from("children")
    .select(
      "id, full_name, trainer_id, " +
        "parent:profiles!children_parent_id_fkey(id, full_name, phone), " +
        "trainer:trainers!children_trainer_id_fkey(id, elevenlabs_agent_id, whatsapp_number, profile:profiles!trainers_profile_id_fkey(full_name))",
    )
    .eq("id", childId)
    .maybeSingle();
  const child = childQ.data as ChildLookup | null;
  if (!child || !child.parent) {
    return res.status(404).json({ error: "Child not found or not owned by caller" });
  }

  const parentPhone = child.parent.phone;
  const trainerName = child.trainer?.profile?.full_name ?? "antrenorul tău";
  const agentId = child.trainer?.elevenlabs_agent_id ?? null;

  // Build the ConvAI link + persist row via service client.
  const shareToken = randomBytes(12).toString("base64url");
  const linkResult = await createConvAILink(agentId, shareToken);

  const svc = serviceClient();
  const insertConvo = await svc
    .from("ai_conversations")
    .insert({
      parent_id: child.parent.id,
      trainer_id: child.trainer_id,
      child_id: childId,
      elevenlabs_agent_id: linkResult.agentId,
      share_link: linkResult.link,
      share_token: shareToken,
      status: "pending",
    })
    .select("id, share_link")
    .single();
  if (insertConvo.error || !insertConvo.data) {
    return res
      .status(500)
      .json({ error: insertConvo.error?.message ?? "Could not store conversation" });
  }

  // Notification (in-app)
  await svc.from("notifications").insert({
    recipient_id: child.parent.id,
    kind: "ai_link_ready",
    title: "Bun venit în academie!",
    body: `Apasă pentru o scurtă conversație cu asistentul nostru — ${trainerName} va primi rezumatul.`,
    link: insertConvo.data.share_link,
  });

  // WhatsApp (skipped silently when not configured)
  let whatsappResult: { sent: boolean; reason?: string } = { sent: false, reason: "no_phone" };
  if (parentPhone) {
    const body = [
      `Bun venit la Școala de Fotbal Dan Matei, ${child.parent.full_name?.split(" ")[0] ?? ""}!`,
      "",
      `Copilul tău, ${child.full_name}, a fost repartizat la grupa antrenorului ${trainerName}.`,
      "",
      "Înainte să ne auzim, asistentul nostru îți va pune câteva întrebări scurte (vârstă, experiență, așteptări). Conversația durează ~5 minute. Apasă linkul de mai jos pentru a începe:",
      "",
      insertConvo.data.share_link,
      "",
      "După conversație, antrenorul tău primește un rezumat și te contactează aici pe WhatsApp. Mulțumim!",
    ].join("\n");
    whatsappResult = await sendWhatsappText(parentPhone, body);
  }

  return res.status(200).json({
    conversationId: insertConvo.data.id,
    link: insertConvo.data.share_link,
    whatsapp: whatsappResult,
  });
}
