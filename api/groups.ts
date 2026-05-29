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

// How many children to surface per card (the rest show as "+ N alți copii").
const SAMPLE_SIZE = 4;

function birthYear(dob: string): number {
  return new Date(dob).getFullYear();
}

/**
 * "Andrei Mureșan" → "Andrei M." — this is a public page showing minors, so we
 * surface the first name + last initial only; the full surname never leaves
 * the server.
 */
function maskName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
}

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

    // Pull the active roster once and match children to groups in JS. A child
    // belongs to a group's card if it is explicitly assigned (group_id) or —
    // the common case, since group_id is often left unset — if its birth year
    // falls inside the group's range (the same rule Admin → Grupe uses).
    const { data: kidsRaw } = await svc
      .from("children")
      .select("id, full_name, dob, group_id")
      .eq("status", "active");
    const kids = (kidsRaw ?? []) as Array<{
      id: string;
      full_name: string;
      dob: string;
      group_id: string | null;
    }>;

    const payload = groups.map((g) => {
      const matched = kids
        .filter(
          (c) =>
            c.group_id === g.id ||
            (c.group_id == null &&
              birthYear(c.dob) >= g.birth_year_min &&
              birthYear(c.dob) <= g.birth_year_max)
        )
        .sort((a, b) => birthYear(b.dob) - birthYear(a.dob)); // youngest first

      return {
        id: g.id,
        label: g.label,
        birthYearMin: g.birth_year_min,
        birthYearMax: g.birth_year_max,
        trainerName: g.trainer?.profile?.full_name ?? null,
        childCount: matched.length,
        players: matched.slice(0, SAMPLE_SIZE).map((c) => ({
          id: c.id,
          name: maskName(c.full_name),
          yearOfBirth: birthYear(c.dob),
        })),
      };
    });

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
