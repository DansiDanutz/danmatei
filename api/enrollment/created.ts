/**
 * POST /api/enrollment/created — fire a push notification to the people who
 * need to act on a new child signup: the matching trainer(s) and the
 * owner/admin. Called by the parent's client right after the child row is
 * inserted (best-effort; the in-app queues are the source of truth).
 *
 * Auth: the caller must be authenticated AND be the child's parent (so a
 * random visitor can't spam enrollment pushes).
 *
 * Body: { childId: uuid }
 */
import { z } from "zod";
import {
  serviceClient,
  getJwtFromHeader,
  getUserIdFromJwt,
} from "../_lib/supabase.js";
import { sendPushToUsers } from "../_lib/push.js";
import { birthYearFromDob } from "../../shared/date.js";

const Body = z.object({ childId: z.string().uuid() });

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};
type Res = {
  status: (n: number) => Res;
  json: (b: unknown) => Res;
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

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  let callerId: string;
  try {
    callerId = await getUserIdFromJwt(jwt);
  } catch {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const svc = serviceClient();

  // Load the child + verify the caller is its parent.
  const { data: child, error: childErr } = await svc
    .from("children")
    .select("id, full_name, dob, trainer_id, parent_id")
    .eq("id", parsed.data.childId)
    .single();
  if (childErr || !child) {
    return res.status(404).json({ error: "Child not found" });
  }
  if (child.parent_id !== callerId) {
    return res.status(403).json({ error: "Not your child" });
  }

  const birthYear = birthYearFromDob(child.dob as string);

  // Recipients ───────────────────────────────────────────────────────────────
  // Trainers: the one the parent pre-selected (if any) + every trainer whose
  // active group's birth-year range contains the child.
  const trainerProfileIds = new Set<string>();

  if (child.trainer_id) {
    const { data: t } = await svc
      .from("trainers")
      .select("profile_id")
      .eq("id", child.trainer_id)
      .single();
    if (t?.profile_id) trainerProfileIds.add(t.profile_id as string);
  }

  const { data: matchGroups } = await svc
    .from("groups")
    .select("trainer:trainers(profile_id)")
    .eq("active", true)
    .lte("birth_year_min", birthYear)
    .gte("birth_year_max", birthYear);
  for (const g of (matchGroups ?? []) as unknown as Array<{
    trainer: { profile_id: string } | null;
  }>) {
    if (g.trainer?.profile_id) trainerProfileIds.add(g.trainer.profile_id);
  }

  // Owners / admins.
  const { data: owners } = await svc
    .from("profiles")
    .select("id")
    .in("role", ["owner", "super_admin"]);
  const ownerIds = ((owners ?? []) as Array<{ id: string }>).map(o => o.id);

  const name = (child.full_name as string) ?? "Un copil";

  // Send (deep-link each audience to their own screen).
  const [toTrainers, toOwners] = await Promise.all([
    sendPushToUsers([...trainerProfileIds], {
      title: "Înscriere nouă",
      body: `${name} (${birthYear}) așteaptă confirmarea ta.`,
      tag: `enroll-${child.id}`,
      url: "/antrenor",
    }),
    sendPushToUsers(ownerIds, {
      title: "Înscriere nouă",
      body: `${name} (${birthYear}) s-a înscris. Repartizează grupa sau pune pe hold.`,
      tag: `enroll-${child.id}`,
      url: "/admin",
    }),
  ]);

  return res.status(200).json({
    notified: {
      trainers: trainerProfileIds.size,
      owners: ownerIds.length,
      pushSent: toTrainers.sent + toOwners.sent,
    },
  });
}
