/**
 * POST /api/training/recap-publish
 *
 * Saves a finalized training recap on the event and fans it out to every
 * parent whose child has the event's trainer assigned. Three writes:
 *   1. UPDATE schedule_events SET recap_md, recap_published_at, recap_published_by
 *   2. INSERT one row in fotbal.notifications per recipient parent
 *   3. Best-effort Web Push fan-out (no-op when VAPID env not set)
 *
 * Idempotent on save: re-publishing overwrites the recap text and bumps the
 * timestamp, but DOES NOT re-notify (we don't want a single edit to spam every
 * parent twice). The trainer can opt-in to renotify by passing renotify=true.
 *
 * Auth: bearer JWT. Caller must be the event's trainer or owner/super_admin.
 *
 * Body: { eventId: uuid, recap: string, renotify?: boolean }
 */
import { z } from "zod";
import { serviceClient, getJwtFromHeader } from "../_lib/supabase.js";
import { sendPushToUsers } from "../_lib/push.js";

const Body = z.object({
  eventId: z.string().uuid(),
  recap: z.string().trim().min(20).max(4000),
  renotify: z.boolean().optional().default(false),
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
  const { eventId, recap, renotify } = parsed.data;

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  // Authenticate caller
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: "invalid_jwt" });
  }
  const userId = userData.user.id;

  const { data: prof } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (!prof) return res.status(401).json({ error: "no_profile" });
  const isAdmin = prof.role === "owner" || prof.role === "super_admin";

  // Load event + its trainer for authorization, plus the trainer-id we need
  // to find the parents whose kids are in this trainer's group.
  const { data: event, error: evErr } = await supabase
    .from("schedule_events")
    .select(
      "id, title, starts_at, trainer_id, recap_published_at, trainers:trainer_id (profile_id)"
    )
    .eq("id", eventId)
    .maybeSingle();
  if (evErr || !event) {
    return res.status(404).json({ error: "event_not_found" });
  }
  const eventTrainer = event.trainers as { profile_id?: string } | null;
  const isAssigned =
    !!eventTrainer?.profile_id && eventTrainer.profile_id === userId;
  if (!isAdmin && !isAssigned) {
    return res.status(403).json({ error: "forbidden" });
  }

  const isFirstPublish = !event.recap_published_at;
  const shouldNotify = isFirstPublish || renotify;

  // 1) Persist the recap on the event
  const nowIso = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("schedule_events")
    .update({
      recap_md: recap,
      recap_published_at: nowIso,
      recap_published_by: userId,
      updated_at: nowIso,
    })
    .eq("id", eventId);
  if (upErr) {
    return res
      .status(500)
      .json({ error: "save_failed", detail: upErr.message });
  }

  // 2) When notifying, find every parent whose ACTIVE child has this trainer
  let recipientCount = 0;
  let pushSummary: { sent: number; skipped: number; removed: number } | null =
    null;
  if (shouldNotify && event.trainer_id) {
    const { data: kids } = await supabase
      .from("children")
      .select("parent_id")
      .eq("trainer_id", event.trainer_id as string)
      .eq("status", "active")
      .not("parent_id", "is", null);

    const recipientSet = new Set<string>();
    (kids ?? []).forEach((row: { parent_id: string }) => {
      if (row.parent_id) recipientSet.add(row.parent_id);
    });
    const recipientIds = Array.from(recipientSet);
    recipientCount = recipientIds.length;

    if (recipientIds.length > 0) {
      const dateRO = new Date(event.starts_at as string).toLocaleDateString(
        "ro-RO",
        { weekday: "long", day: "2-digit", month: "long" }
      );
      const title = `Recap: ${event.title}`;
      const bodyShort =
        recap.length > 140 ? `${recap.slice(0, 137).trim()}…` : recap;
      const link = "/dashboard"; // role router → parent's child page

      // 2a) Insert one in-app notification per parent
      const rows = recipientIds.map(rid => ({
        recipient_id: rid,
        kind: "training_recap",
        title,
        body: `${dateRO} — ${bodyShort}`,
        link,
      }));
      const { error: notifErr } = await supabase
        .from("notifications")
        .insert(rows);
      // Don't fail the whole publish on notification insert error; the recap
      // is already saved and the trainer can manually retry the notify.
      if (notifErr) {
        console.warn(
          "recap-publish: notification insert failed",
          notifErr.message
        );
      }

      // 2b) Best-effort Web Push fan-out (no-op when VAPID not configured)
      pushSummary = await sendPushToUsers(recipientIds, {
        title,
        body: `${dateRO} — ${bodyShort}`,
        tag: `training-recap-${eventId}`,
        url: link,
      });
    }
  }

  return res.status(200).json({
    ok: true,
    eventId,
    publishedAt: nowIso,
    notified: shouldNotify ? recipientCount : 0,
    push: pushSummary,
    isFirstPublish,
  });
}
