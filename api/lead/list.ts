/**
 * GET /api/lead/list
 *
 * Returns the inbox of leads + their latest completed AI call.
 * Returns the authenticated trainer's inbox of leads + their latest completed
 * AI call. The caller's JWT is verified server-side; the trainer routing slug
 * is derived from that trainer's own profile, not from caller-controlled query
 * params.
 */
import { z } from "zod";
import {
  getJwtFromHeader,
  getUserIdFromJwt,
  serviceClient,
  userClient,
} from "../_lib/supabase.js";

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

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

type LeadCallRow = {
  status: string;
  created_at: string;
};

type LeadRow = Record<string, unknown> & {
  lead_calls?: LeadCallRow[] | null;
};

function readQuery(req: Req): Record<string, string> {
  if (req.query) {
    return Object.fromEntries(
      Object.entries(req.query).map(([k, v]) => [
        k,
        Array.isArray(v) ? v[0] ?? "" : v ?? "",
      ]),
    );
  }
  if (req.url) {
    const u = new URL(req.url, "http://x");
    return Object.fromEntries(u.searchParams.entries());
  }
  return {};
}

function readAuthHeader(req: Req): string {
  return (
    (typeof req.headers?.authorization === "string"
      ? req.headers.authorization
      : Array.isArray(req.headers?.authorization)
        ? req.headers.authorization[0]
        : undefined) ?? ""
  );
}

function trainerSlugForAgeRange(ageMin: number, ageMax: number): string {
  const mid = (ageMin + ageMax) / 2;
  if (mid <= 9) return "t-sopi";
  if (mid <= 13) return "t-kelemen";
  return "t-dan";
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const jwt = getJwtFromHeader(readAuthHeader(req));
  if (!jwt) return res.status(401).json({ error: "missing_bearer_token" });

  const parsed = Query.safeParse(readQuery(req));
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", issues: parsed.error.issues });
  }
  const { limit } = parsed.data;

  let userId: string;
  try {
    userId = await getUserIdFromJwt(jwt);
  } catch {
    return res.status(401).json({ error: "not_authenticated" });
  }

  const u = userClient(jwt);
  const { data: profile, error: profileErr } = await u
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (profileErr || profile?.role !== "trainer") {
    return res.status(403).json({ error: "trainer_role_required" });
  }

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  const { data: trainer, error: trainerErr } = await supabase
    .from("trainers")
    .select("age_min, age_max")
    .eq("profile_id", userId)
    .eq("active", true)
    .single();
  if (trainerErr || !trainer) {
    return res.status(403).json({ error: "trainer_profile_required" });
  }

  const trainerSlug = trainerSlugForAgeRange(
    Number(trainer.age_min),
    Number(trainer.age_max),
  );

  // Pull leads scoped to the authenticated trainer's derived routing slug.
  let q = supabase
    .from("leads")
    .select(
      `
      id,
      parent_name,
      parent_phone_e164,
      child_name,
      child_age,
      child_position,
      status,
      assigned_trainer_id,
      cc_trainer_ids,
      snoozed_until,
      created_at,
      lead_calls (
        id,
        duration_seconds,
        summary,
        intent,
        next_steps,
        recording_url,
        status,
        created_at
      )
      `,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  q = q.or(
    `assigned_trainer_id.eq.${trainerSlug},cc_trainer_ids.cs.{${trainerSlug}}`,
  );

  const { data, error } = await q;
  if (error) {
    return res.status(500).json({ error: "query_failed", detail: error.message });
  }

  // Reduce each lead to its latest completed call, if any.
  const items = ((data ?? []) as LeadRow[]).map((lead: LeadRow) => {
    const calls = lead.lead_calls ?? [];
    const latest =
      calls
        .filter((c) => c.status === "completed")
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
    const { lead_calls: _omit, ...rest } = lead as Record<string, unknown>;
    return { ...rest, latestCall: latest };
  });

  return res.status(200).json({
    ok: true,
    trainerSlug,
    items,
    count: items.length,
  });
}
