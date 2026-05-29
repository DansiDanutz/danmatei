/**
 * /api/groups — PUBLIC, read-only.
 *
 * The marketing deck (/cunoaste → SlidePlayers) must show the REAL age groups
 * the owner configured in Admin → Grupe. Those live in `fotbal.groups`, whose
 * RLS only lets the owner + the assigned trainer read them — so the anonymous
 * browser client gets zero rows. This endpoint returns the *active* groups
 * (non-sensitive: label, birth-year range, trainer name, head-count) via the
 * service-role client, so the public site stays in sync with what admin set.
 *
 * GET only. Cached at the edge for a minute.
 */
import { serviceClient } from "./_lib/supabase.js";

type Req = { method?: string };
type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
  setHeader?: (k: string, v: string) => void;
};

type GroupRow = {
  id: string;
  label: string;
  birth_year_min: number;
  birth_year_max: number;
  trainer: { profile: { full_name: string } | null } | null;
};

export default async function handler(req: Req, res: Res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const svc = serviceClient();

    const { data, error } = await svc
      .from("groups")
      .select(
        "id, label, birth_year_min, birth_year_max, active, trainer:trainers(profile:profiles(full_name))"
      )
      .eq("active", true)
      // Youngest first (highest birth year) → U7, U9, U11 … reads naturally.
      .order("birth_year_min", { ascending: false });
    if (error) throw error;

    const groups = (data ?? []) as unknown as GroupRow[];

    // Active head-count per group. `children.group_id` is populated when a
    // child is assigned to a year-matched group (see Admin → Grupe).
    const counts = new Map<string, number>();
    if (groups.length > 0) {
      const { data: kids } = await svc
        .from("children")
        .select("group_id")
        .eq("status", "active")
        .in(
          "group_id",
          groups.map((g) => g.id)
        );
      for (const c of (kids ?? []) as Array<{ group_id: string | null }>) {
        if (c.group_id)
          counts.set(c.group_id, (counts.get(c.group_id) ?? 0) + 1);
      }
    }

    const payload = groups.map((g) => ({
      id: g.id,
      label: g.label,
      birthYearMin: g.birth_year_min,
      birthYearMax: g.birth_year_max,
      trainerName: g.trainer?.profile?.full_name ?? null,
      childCount: counts.get(g.id) ?? 0,
    }));

    if (res.setHeader) {
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=60, stale-while-revalidate=300"
      );
    }
    return res.status(200).json({ groups: payload });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
