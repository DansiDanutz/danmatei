/**
 * POST /api/schedule/notify
 *
 * The trainer's "approval": fan out an in-app notification + Web Push to every
 * parent of an active child in the trainer's group, announcing a scheduled
 * event (training / match / etc). For matches it includes the location, the
 * "be present at" time (call_time) and the fee when set. Stamps
 * schedule_events.group_notified_at so the UI can show "Notificat".
 *
 * Auth: bearer JWT. Caller must be the event's trainer or owner/super_admin.
 * Body: { eventId }
 */
import { z } from "zod";
import { serviceClient, getJwtFromHeader } from "../_lib/supabase.js";
import { sendPushToUsers } from "../_lib/push.js";

const Body = z.object({ eventId: z.string().uuid() });

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

function timeRO(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });
}
function clockRO(iso: string): string {
  return new Date(iso).toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const jwt = getJwtFromHeader(readHeader(req, "authorization") ?? "");
  if (!jwt) return res.status(401).json({ error: "missing_bearer" });

  const parsed = Body.safeParse(readBody(req));
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });
  const { eventId } = parsed.data;

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
  if (userErr || !userData?.user)
    return res.status(401).json({ error: "invalid_jwt" });
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
      "id, title, kind, starts_at, call_time, fee_ron, location, opponent, notes, trainer_id, cancelled_at, trainers:trainer_id (profile_id)"
    )
    .eq("id", eventId)
    .maybeSingle();
  if (evErr || !event) return res.status(404).json({ error: "event_not_found" });

  const evTrainer = event.trainers as { profile_id?: string } | null;
  const isAssigned = !!evTrainer?.profile_id && evTrainer.profile_id === userId;
  if (!isAdmin && !isAssigned) return res.status(403).json({ error: "forbidden" });
  if (event.cancelled_at)
    return res.status(400).json({ error: "event_cancelled" });
  if (!event.trainer_id)
    return res.status(400).json({ error: "no_group" });

  const { data: kids } = await supabase
    .from("children")
    .select("parent_id")
    .eq("trainer_id", event.trainer_id as string)
    .eq("status", "active")
    .not("parent_id", "is", null);
  const recipients = Array.from(
    new Set(((kids ?? []) as { parent_id: string }[]).map((k) => k.parent_id))
  );

  const kindLabel =
    event.kind === "match"
      ? "Meci"
      : event.kind === "tournament"
        ? "Turneu"
        : event.kind === "training"
          ? "Antrenament"
          : "Eveniment";
  const title = `${kindLabel}: ${event.title}${event.opponent ? ` vs ${event.opponent}` : ""}`;

  const lines: string[] = [timeRO(event.starts_at as string)];
  if (event.location) lines.push(`📍 ${event.location}`);
  if (event.call_time)
    lines.push(`Prezență la ${clockRO(event.call_time as string)}`);
  if (event.fee_ron != null && Number(event.fee_ron) > 0)
    lines.push(`Taxă: ${event.fee_ron} RON`);
  if (event.notes) lines.push(String(event.notes));
  const body = lines.join(" · ");
  const link = "/dashboard";

  let notified = 0;
  let push: { sent: number; skipped: number; removed: number } | null = null;
  if (recipients.length > 0) {
    const rows = recipients.map((rid) => ({
      recipient_id: rid,
      kind: "event_announced",
      title,
      body,
      link,
    }));
    const { error: insErr } = await supabase.from("notifications").insert(rows);
    if (!insErr) notified = rows.length;
    push = await sendPushToUsers(recipients, {
      title,
      body,
      tag: `event-${eventId}`,
      url: link,
    });
  }

  await supabase
    .from("schedule_events")
    .update({ group_notified_at: new Date().toISOString() })
    .eq("id", eventId);

  return res.status(200).json({ ok: true, notified, push });
}
