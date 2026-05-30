/**
 * GET /api/match/squad?eventId=...
 *
 * The match squad (fotbal.match_participations) joined to child names + group
 * label. Staff-only (owner / super_admin or the event's own trainer).
 *
 * Why service-role: match_participations RLS read is `child_id IN (children I
 * can read)`, and a trainer can only read their own group's children — so a
 * squad that includes guest call-ups from other groups would come back missing
 * those rows on the trainer's client. The server returns the full squad.
 *
 * Auth: bearer JWT.
 */
import { serviceClient, getJwtFromHeader } from "../_lib/supabase.js";

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
};
type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

function readHeader(req: Req, key: string): string | undefined {
  const v = req.headers?.[key.toLowerCase()] ?? req.headers?.[key];
  return Array.isArray(v) ? v[0] : v;
}
function readQuery(req: Req, key: string): string | undefined {
  const direct = req.query?.[key];
  if (direct != null) return Array.isArray(direct) ? direct[0] : direct;
  if (req.url) {
    const qi = req.url.indexOf("?");
    if (qi >= 0) return new URLSearchParams(req.url.slice(qi)).get(key) ?? undefined;
  }
  return undefined;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PartRow = {
  id: string;
  child_id: string;
  role: string;
  goals: number;
  assists: number;
  children: {
    full_name: string;
    dob: string | null;
    group_id: string | null;
    groups: { label: string } | null;
  } | null;
};

export default async function handler(req: Req, res: Res) {
  if (req.method && req.method !== "GET")
    return res.status(405).json({ error: "method_not_allowed" });

  const jwt = getJwtFromHeader(readHeader(req, "authorization") ?? "");
  if (!jwt) return res.status(401).json({ error: "missing_bearer" });

  const eventId = readQuery(req, "eventId") ?? "";
  if (!UUID_RE.test(eventId))
    return res.status(400).json({ error: "invalid_event_id" });

  let svc;
  try {
    svc = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  const { data: userData, error: userErr } = await svc.auth.getUser(jwt);
  if (userErr || !userData?.user)
    return res.status(401).json({ error: "invalid_jwt" });
  const userId = userData.user.id;

  const { data: prof } = await svc
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const isAdmin = prof?.role === "owner" || prof?.role === "super_admin";

  const { data: event } = await svc
    .from("schedule_events")
    .select("id, trainer_id, trainers:trainer_id(profile_id)")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return res.status(404).json({ error: "event_not_found" });

  const evTrainer = event.trainers as { profile_id?: string } | null;
  const isAssigned = !!evTrainer?.profile_id && evTrainer.profile_id === userId;
  if (!isAdmin && !isAssigned) return res.status(403).json({ error: "forbidden" });

  const { data: rows, error: rErr } = await svc
    .from("match_participations")
    .select(
      "id, child_id, role, goals, assists, children:child_id(full_name, dob, group_id, groups:group_id(label))"
    )
    .eq("event_id", eventId);
  if (rErr) return res.status(500).json({ error: rErr.message });

  const squad = ((rows ?? []) as unknown as PartRow[])
    .map((r) => ({
      id: r.id,
      childId: r.child_id,
      role: r.role,
      goals: r.goals ?? 0,
      assists: r.assists ?? 0,
      name: r.children?.full_name ?? "—",
      yearOfBirth: r.children?.dob ? new Date(r.children.dob).getFullYear() : null,
      groupId: r.children?.group_id ?? null,
      groupLabel: r.children?.groups?.label ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ro"));

  return res.status(200).json({ squad });
}
