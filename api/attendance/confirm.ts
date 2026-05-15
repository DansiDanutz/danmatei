/**
 * POST /api/attendance/confirm — parent-side RSVP for an upcoming training.
 *
 * Parent taps "Da, vine" or "Nu, lipsește" on the schedule row in
 * /copil/:id, OR taps the daily push notification ("Antrenament joi 18:00
 * — vine X?"). We upsert an attendance row with status='present' or
 * 'absent' so the trainer's AttendanceTab pre-loads the parent's intent
 * and v_child_stats reflects it.
 *
 * The trainer remains the source of truth on the day — they can override
 * any time via the existing tap-grid UX (#7).
 *
 * Auth: bearer JWT. Caller must be the child's parent.
 *
 * Body: { childId: uuid, eventId: uuid, coming: boolean }
 */
import { z } from "zod";
import { serviceClient, getJwtFromHeader } from "../_lib/supabase.js";

const Body = z.object({
  childId: z.string().uuid(),
  eventId: z.string().uuid(),
  coming: z.boolean(),
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
  const { childId, eventId, coming } = parsed.data;

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  // Authenticate caller and verify they're the child's parent.
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: "invalid_jwt" });
  }
  const userId = userData.user.id;

  const { data: child, error: childErr } = await supabase
    .from("children")
    .select("id, parent_id, trainer_id")
    .eq("id", childId)
    .maybeSingle();
  if (childErr || !child) {
    return res.status(404).json({ error: "child_not_found" });
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const isAdmin = prof?.role === "owner" || prof?.role === "super_admin";
  if (!isAdmin && child.parent_id !== userId) {
    return res.status(403).json({ error: "forbidden" });
  }

  // Verify the event belongs to the child's trainer (defense in depth).
  const { data: event, error: evErr } = await supabase
    .from("schedule_events")
    .select("id, trainer_id, kind")
    .eq("id", eventId)
    .maybeSingle();
  if (evErr || !event) {
    return res.status(404).json({ error: "event_not_found" });
  }
  if (event.kind !== "training") {
    return res.status(400).json({ error: "event_not_training" });
  }
  if (
    child.trainer_id &&
    event.trainer_id &&
    child.trainer_id !== event.trainer_id
  ) {
    return res.status(403).json({ error: "wrong_trainer_event" });
  }

  const { error: upErr } = await supabase.from("attendance").upsert(
    {
      event_id: eventId,
      child_id: childId,
      status: coming ? "present" : "absent",
    },
    { onConflict: "event_id, child_id" }
  );
  if (upErr) {
    return res
      .status(500)
      .json({ error: "save_failed", detail: upErr.message });
  }

  return res.status(200).json({
    ok: true,
    childId,
    eventId,
    status: coming ? "present" : "absent",
  });
}
