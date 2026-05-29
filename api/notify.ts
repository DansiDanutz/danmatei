/**
 * POST /api/notify — owner-only broadcast notifications.
 *
 * Targets:
 *   - "all_parents"  → every parent who has at least one active child
 *   - "group"        → parents of children assigned to a specific trainer
 *   - "trainer"      → a single trainer (by profile_id)
 *
 * Auth: caller must be authenticated and have role = 'owner' or 'super_admin'.
 */
import { z } from "zod";
import {
  serviceClient,
  userClient,
  getJwtFromHeader,
  getUserIdFromJwt,
} from "./_lib/supabase.js";
import { sendPushToUsers } from "./_lib/push.js";

const Body = z.object({
  target: z.enum(["all_parents", "group", "trainer"]),
  trainerId: z.string().uuid().optional().nullable(),
  trainerProfileId: z.string().uuid().optional().nullable(),
  title: z.string().min(2).max(200),
  body: z.string().min(2).max(2000),
  link: z.string().max(500).optional().nullable(),
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

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader =
    (typeof req.headers?.authorization === "string"
      ? req.headers.authorization
      : Array.isArray(req.headers?.authorization)
        ? req.headers.authorization[0]
        : undefined) ?? "";
  const jwt = getJwtFromHeader(authHeader);
  if (!jwt) return res.status(401).json({ error: "Missing bearer token" });

  // Verify caller is owner or super_admin.
  let callerRole: string | null = null;
  try {
    const userId = await getUserIdFromJwt(jwt);
    const u = userClient(jwt);
    const { data, error } = await u
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (error) throw error;
    callerRole = data?.role ?? null;
  } catch (e) {
    return res.status(401).json({ error: (e as Error).message });
  }
  if (callerRole !== "owner" && callerRole !== "super_admin") {
    return res.status(403).json({ error: "Owner or super_admin role required" });
  }

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid body", issues: parsed.error.issues });
  }
  const v = parsed.data;

  const svc = serviceClient();

  // Resolve recipient profile IDs based on target.
  let recipientIds: string[] = [];

  try {
    if (v.target === "all_parents") {
      const { data, error } = await svc
        .from("children")
        .select("parent_id")
        .eq("status", "active")
        .not("parent_id", "is", null);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: { parent_id: string }) => set.add(r.parent_id));
      recipientIds = Array.from(set);
    } else if (v.target === "group") {
      if (!v.trainerId) {
        return res.status(400).json({ error: "trainerId required for group target" });
      }
      const { data, error } = await svc
        .from("children")
        .select("parent_id")
        .eq("trainer_id", v.trainerId)
        .eq("status", "active")
        .not("parent_id", "is", null);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: { parent_id: string }) => set.add(r.parent_id));
      recipientIds = Array.from(set);
    } else if (v.target === "trainer") {
      if (!v.trainerProfileId) {
        return res.status(400).json({ error: "trainerProfileId required for trainer target" });
      }
      recipientIds = [v.trainerProfileId];
    }
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }

  if (recipientIds.length === 0) {
    return res.status(200).json({ sent: 0, recipients: [] });
  }

  // Insert one notification row per recipient.
  const rows = recipientIds.map((rid) => ({
    recipient_id: rid,
    kind: v.target,
    title: v.title,
    body: v.body,
    link: v.link ?? null,
  }));

  const { error: insErr } = await svc.from("notifications").insert(rows);
  if (insErr) {
    return res.status(500).json({ error: insErr.message });
  }

  // Best-effort Web Push fan-out. Always runs after the in-app insert
  // succeeds; never throws (no-ops cleanly when VAPID isn't configured).
  const push = await sendPushToUsers(recipientIds, {
    title: v.title,
    body: v.body,
    tag: `notify-${v.target}`,
    url: v.link ?? "/dashboard",
  });

  return res.status(200).json({
    sent: rows.length,
    recipients: recipientIds,
    push,
  });
}
