/**
 * GET /api/academy/players?q=ion
 *
 * Staff-only search across the WHOLE academy roster, used by the trainer's
 * match squad builder to call up guest players from other groups. A trainer's
 * RLS only sees their own group, so academy-wide search must run service-role
 * behind this auth gate.
 *
 * Returns FULL names (the caller is authenticated staff, not the public) plus a
 * group/age label to disambiguate two kids with the same first name.
 *
 * Auth: bearer JWT — caller must be owner / super_admin / active trainer.
 */
import { serviceClient, getJwtFromHeader } from "../_lib/supabase.js";
import { escapeLike } from "../_lib/like.js";

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
    if (qi >= 0)
      return new URLSearchParams(req.url.slice(qi)).get(key) ?? undefined;
  }
  return undefined;
}

type ChildRow = {
  id: string;
  full_name: string;
  dob: string;
  age_group_label: string | null;
  groups: { label: string } | null;
};

export default async function handler(req: Req, res: Res) {
  if (req.method && req.method !== "GET")
    return res.status(405).json({ error: "method_not_allowed" });

  const jwt = getJwtFromHeader(readHeader(req, "authorization") ?? "");
  if (!jwt) return res.status(401).json({ error: "missing_bearer" });

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
  let isTrainer = false;
  if (!isAdmin) {
    const { data: tr } = await svc
      .from("trainers")
      .select("id")
      .eq("profile_id", userId)
      .eq("active", true)
      .maybeSingle();
    isTrainer = !!tr;
  }
  if (!isAdmin && !isTrainer)
    return res.status(403).json({ error: "forbidden" });

  const q = (readQuery(req, "q") ?? "").trim();
  // Escape LIKE metacharacters so a `%`/`_`/`\` in the search box is treated as
  // a literal, not a wildcard (otherwise `%` matches every minor in the academy).
  const qEscaped = escapeLike(q);
  let query = svc
    .from("children")
    .select("id, full_name, dob, age_group_label, groups:group_id(label)")
    .eq("status", "active")
    .order("full_name", { ascending: true })
    .limit(30);
  if (q) query = query.ilike("full_name", `%${qEscaped}%`);

  const { data, error: qErr } = await query;
  if (qErr) return res.status(500).json({ error: qErr.message });

  const players = ((data ?? []) as unknown as ChildRow[]).map(c => ({
    id: c.id,
    name: c.full_name,
    yearOfBirth: c.dob ? new Date(c.dob).getFullYear() : null,
    groupLabel: c.groups?.label ?? c.age_group_label ?? null,
  }));

  return res.status(200).json({ players });
}
