/**
 * POST /api/messages/send
 *
 * Trainer composes a message in /antrenor → Mesaje. Existing flow inserted
 * the row directly via Supabase JS — the in-app notification went out via
 * the tg_notify_message DB trigger (#0005), but Web Push didn't fire because
 * triggers can't easily call out to the network.
 *
 * This endpoint replaces the direct insert. Same INSERT (so the trigger
 * still creates in-app notifications), then fans Web Push to the right
 * recipients:
 *   - audience='group'  → every active parent of a child whose trainer
 *                         matches this trainer
 *   - audience='child'  → just that child's parent
 *   - audience='parent' → the named parent_id (the form doesn't expose
 *                         this option today, but we honour it for future)
 *
 * Auth: bearer JWT, must be the trainer (whose trainers.id matches
 * trainerId) OR owner/super_admin.
 */
import { z } from "zod";
import {
  serviceClient,
  getJwtFromHeader,
} from "../_lib/supabase.js";
import { sendPushToUsers } from "../_lib/push.js";

// Schema reflects what the messages table actually supports today:
// audience=group (everyone in trainer's group) or audience=child (one kid's
// parent). The DB also has 'parent' in the enum but no parent_id column to
// scope it to, so we don't expose that path here.
const Body = z.object({
  trainerId: z.string().uuid(),
  audience: z.enum(["group", "child"]),
  childId: z.string().uuid().optional().nullable(),
  body: z.string().trim().min(1).max(4000),
});

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};
type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

function readHeader(req: Req, key: string): string | undefined {
  const v = req.headers?.[key.toLowerCase()] ?? req.headers?.[key];
  return Array.isArray(v) ? v[0] : v;
}

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

  const auth = readHeader(req, "authorization") ?? "";
  const jwt = getJwtFromHeader(auth);
  if (!jwt) return res.status(401).json({ error: "missing_bearer" });

  const parsed = Body.safeParse(readBody(req));
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_body",
      issues: parsed.error.issues,
    });
  }
  const { trainerId, audience, childId, body } = parsed.data;

  if (audience === "child" && !childId) {
    return res
      .status(400)
      .json({ error: "child_id_required", message: "audience=child requires childId" });
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

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: "invalid_jwt" });
  }
  const userId = userData.user.id;

  const { data: prof } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (!prof) return res.status(401).json({ error: "no_profile" });
  const isAdmin = prof.role === "owner" || prof.role === "super_admin";

  const { data: trainerRow } = await supabase
    .from("trainers")
    .select("id, profile_id")
    .eq("id", trainerId)
    .maybeSingle();
  if (!trainerRow) return res.status(404).json({ error: "trainer_not_found" });
  const isAssigned = trainerRow.profile_id === userId;
  if (!isAdmin && !isAssigned) {
    return res.status(403).json({ error: "forbidden" });
  }

  // 1) Insert the message — DB trigger creates in-app notifications.
  const { data: inserted, error: insErr } = await supabase
    .from("messages")
    .insert({
      trainer_id: trainerId,
      audience,
      child_id: audience === "child" ? childId : null,
      body_md: body,
    })
    .select("id, created_at")
    .single();
  if (insErr || !inserted) {
    return res
      .status(500)
      .json({ error: "save_failed", detail: insErr?.message ?? "unknown" });
  }

  // 2) Resolve push recipients per audience.
  const trainerName = (prof.full_name as string | null) ?? "Antrenor";
  const recipientIds = new Set<string>();
  if (audience === "group") {
    const { data: kids } = await supabase
      .from("children")
      .select("parent_id")
      .eq("trainer_id", trainerId)
      .eq("status", "active")
      .not("parent_id", "is", null);
    ((kids ?? []) as { parent_id: string }[]).forEach(k => {
      if (k.parent_id) recipientIds.add(k.parent_id);
    });
  } else if (audience === "child" && childId) {
    const { data: child } = await supabase
      .from("children")
      .select("parent_id")
      .eq("id", childId)
      .maybeSingle();
    if (child?.parent_id) recipientIds.add(child.parent_id);
  }

  // 3) Best-effort Web Push (no-op when VAPID not set).
  const bodyShort = body.length > 140 ? `${body.slice(0, 137).trim()}…` : body;
  const push =
    recipientIds.size > 0
      ? await sendPushToUsers(Array.from(recipientIds), {
          title: `Mesaj nou de la ${trainerName}`,
          body: bodyShort,
          tag: `message-${inserted.id}`,
          url: "/notificari",
        })
      : { sent: 0, skipped: 0, removed: 0 };

  return res.status(200).json({
    ok: true,
    messageId: inserted.id,
    recipients: recipientIds.size,
    push,
  });
}
