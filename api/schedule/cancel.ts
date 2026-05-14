/**
 * POST /api/schedule/cancel
 *
 * Trainer cancels (or un-cancels) a scheduled training/match. Soft cancel:
 * sets cancelled_at + cancelled_reason on the row instead of deleting it,
 * so match history and attendance records survive.
 *
 * On a fresh cancellation we fan out an in-app notification + Web Push to
 * every parent of an active child in the trainer's group ("Antrenament
 * anulat: ..."). Un-cancelling does not re-notify (avoid noise).
 *
 * Auth: bearer JWT. Caller must be the event's trainer or owner/super_admin.
 *
 * Body: { eventId, reason? }   // reason omitted = un-cancel
 */
import { z } from "zod";
import {
  serviceClient,
  getJwtFromHeader,
} from "../_lib/supabase.js";
import { sendPushToUsers } from "../_lib/push.js";

const Body = z.object({
  eventId: z.string().uuid(),
  // Empty / null reason = un-cancel; non-empty string = cancel with this
  // explanation surfaced in the notification body.
  reason: z.string().trim().max(500).optional().nullable(),
  uncancel: z.boolean().optional(),
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
  const { eventId, reason, uncancel } = parsed.data;

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
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!prof) return res.status(401).json({ error: "no_profile" });
  const isAdmin = prof.role === "owner" || prof.role === "super_admin";

  const { data: event, error: evErr } = await supabase
    .from("schedule_events")
    .select(
      "id, title, kind, starts_at, location, trainer_id, cancelled_at, trainers:trainer_id (profile_id)"
    )
    .eq("id", eventId)
    .maybeSingle();
  if (evErr || !event) {
    return res.status(404).json({ error: "event_not_found" });
  }
  const evTrainer = event.trainers as { profile_id?: string } | null;
  const isAssigned =
    !!evTrainer?.profile_id && evTrainer.profile_id === userId;
  if (!isAdmin && !isAssigned) {
    return res.status(403).json({ error: "forbidden" });
  }

  const wantUncancel = uncancel === true;
  const wasCancelled = !!event.cancelled_at;

  if (wantUncancel) {
    const { error: upErr } = await supabase
      .from("schedule_events")
      .update({
        cancelled_at: null,
        cancelled_reason: null,
        cancelled_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);
    if (upErr) {
      return res
        .status(500)
        .json({ error: "save_failed", detail: upErr.message });
    }
    return res.status(200).json({ ok: true, cancelled: false, notified: 0 });
  }

  // Cancellation
  const nowIso = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("schedule_events")
    .update({
      cancelled_at: nowIso,
      cancelled_reason: reason && reason.length > 0 ? reason : null,
      cancelled_by: userId,
      updated_at: nowIso,
    })
    .eq("id", eventId);
  if (upErr) {
    return res
      .status(500)
      .json({ error: "save_failed", detail: upErr.message });
  }

  // Don't re-notify on edits to an already-cancelled row.
  if (wasCancelled) {
    return res.status(200).json({ ok: true, cancelled: true, notified: 0 });
  }

  // Fan out — only when this trainer has a group of kids.
  let notified = 0;
  let push: { sent: number; skipped: number; removed: number } | null = null;
  if (event.trainer_id) {
    const { data: kids } = await supabase
      .from("children")
      .select("parent_id")
      .eq("trainer_id", event.trainer_id as string)
      .eq("status", "active")
      .not("parent_id", "is", null);
    const recipients = Array.from(
      new Set(
        ((kids ?? []) as { parent_id: string }[]).map(k => k.parent_id)
      )
    );

    if (recipients.length > 0) {
      const dateRO = new Date(event.starts_at as string).toLocaleString(
        "ro-RO",
        {
          weekday: "long",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Bucharest",
        }
      );
      const kindLabel =
        event.kind === "match"
          ? "Meci anulat"
          : event.kind === "tournament"
            ? "Turneu anulat"
            : "Antrenament anulat";
      const title = `${kindLabel}: ${event.title}`;
      const body = `${dateRO}${event.location ? ` · ${event.location}` : ""}${reason ? ` — ${reason}` : ""}`;
      const link = "/dashboard";

      const rows = recipients.map(rid => ({
        recipient_id: rid,
        kind: "event_cancelled",
        title,
        body,
        link,
      }));
      const { error: insErr } = await supabase
        .from("notifications")
        .insert(rows);
      if (!insErr) notified = rows.length;

      push = await sendPushToUsers(recipients, {
        title,
        body,
        tag: `cancelled-${eventId}`,
        url: link,
      });
    }
  }

  return res.status(200).json({
    ok: true,
    cancelled: true,
    notified,
    push,
  });
}
