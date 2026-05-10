/**
 * GET /api/lead/list?trainerSlug=t-sopi
 *
 * Returns the inbox of leads + their latest completed AI call.
 * Filters by `assigned_trainer_id` OR being in `cc_trainer_ids`.
 *
 * NOTE: this endpoint currently uses the service role client. The RLS
 * policies in `0006_ai_call_leads.sql` key off `auth.jwt() ->> 'trainer_id'`,
 * which is not yet wired into the auth flow (no JWT custom claim setter).
 * Until that lands, callers pass the trainer slug explicitly. A follow-up
 * migration will add a `slug` column on `fotbal.trainers` and switch this
 * endpoint to use the user JWT directly.
 */
import { z } from "zod";
import { serviceClient } from "../_lib/supabase.js";

const Query = z.object({
  trainerSlug: z.string().min(2).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

type Req = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
};

type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
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

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const parsed = Query.safeParse(readQuery(req));
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", issues: parsed.error.issues });
  }
  const { trainerSlug, limit } = parsed.data;

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  // Pull leads. If a trainerSlug is provided, scope to that assignment or CC.
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

  if (trainerSlug) {
    q = q.or(
      `assigned_trainer_id.eq.${trainerSlug},cc_trainer_ids.cs.{${trainerSlug}}`,
    );
  }

  const { data, error } = await q;
  if (error) {
    return res.status(500).json({ error: "query_failed", detail: error.message });
  }

  // Reduce each lead to its latest completed call, if any.
  const items = (data ?? []).map((lead) => {
    const calls = (lead.lead_calls as Array<{
      status: string;
      created_at: string;
    }> | null) ?? [];
    const latest =
      calls
        .filter((c) => c.status === "completed")
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
    const { lead_calls: _omit, ...rest } = lead as Record<string, unknown>;
    return { ...rest, latestCall: latest };
  });

  return res.status(200).json({ ok: true, items, count: items.length });
}
