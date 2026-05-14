/**
 * GET /api/leads/analytics
 *
 * Owner-only analytics over fotbal.leads. The owner doesn't have a direct
 * SELECT policy on leads (only the assigned trainer does — see migration
 * 0006), so this endpoint uses the service role and returns ONLY
 * aggregated counts + a 30-day daily series. No PII leaves the server.
 *
 * Query: ?days=30 (default) — window for aggregates and the time series.
 *
 * Response:
 *   {
 *     ok, days,
 *     totals: { total, contacted, closed, conversionRate },
 *     funnel: [{ status, count, drop }],
 *     bySource: [{ key, count }],
 *     byIntent: [{ key, count }],
 *     byTrainer: [{ trainerSlug, count }],
 *     timeSeries: [{ date, total, contacted }]
 *   }
 */
import { z } from "zod";
import {
  serviceClient,
  getJwtFromHeader,
} from "../_lib/supabase.js";

const Query = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
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

function readHeader(req: Req, key: string): string | undefined {
  const v = req.headers?.[key.toLowerCase()] ?? req.headers?.[key];
  return Array.isArray(v) ? v[0] : v;
}

function readQuery(req: Req): Record<string, string> {
  if (req.query) {
    return Object.fromEntries(
      Object.entries(req.query).map(([k, v]) => [
        k,
        Array.isArray(v) ? (v[0] ?? "") : (v ?? ""),
      ])
    );
  }
  if (req.url) {
    const u = new URL(req.url, "http://x");
    return Object.fromEntries(u.searchParams.entries());
  }
  return {};
}

// Funnel order — leads progress (in principle) through these statuses.
const FUNNEL_ORDER: string[] = [
  "new",
  "wa_sent",
  "calling",
  "transcribed",
  "routed",
  "contacted",
  "closed",
];

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const auth = readHeader(req, "authorization") ?? "";
  const jwt = getJwtFromHeader(auth);
  if (!jwt) return res.status(401).json({ error: "missing_bearer" });

  const parsed = Query.safeParse(readQuery(req));
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", issues: parsed.error.issues });
  }
  const { days } = parsed.data;

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
  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!prof) return res.status(401).json({ error: "no_profile" });
  if (prof.role !== "owner" && prof.role !== "super_admin") {
    return res.status(403).json({ error: "owner_role_required" });
  }

  const sinceIso = new Date(Date.now() - days * 86400_000).toISOString();

  type LeadRow = {
    status: string;
    source: string | null;
    assigned_trainer_id: string;
    created_at: string;
    lead_calls?: { intent?: string | null }[] | null;
  };

  const { data: rows, error } = await supabase
    .from("leads")
    .select(
      "status, source, assigned_trainer_id, created_at, lead_calls (intent)"
    )
    .gte("created_at", sinceIso);
  if (error) {
    return res
      .status(500)
      .json({ error: "fetch_failed", detail: error.message });
  }

  const leads = ((rows ?? []) as LeadRow[]) ?? [];

  const total = leads.length;
  const contacted = leads.filter(
    l => l.status === "contacted" || l.status === "closed"
  ).length;
  const closed = leads.filter(l => l.status === "closed").length;
  const conversionRate = total > 0 ? Math.round((closed * 100) / total) : 0;

  // Funnel — count leads at or beyond each status. The cumulative count
  // makes drop-off intuitive (every lead "passed through" 'new' even if
  // they're now "closed").
  const STATUS_RANK = new Map(FUNNEL_ORDER.map((s, i) => [s, i]));
  const funnel = FUNNEL_ORDER.map((status, idx) => {
    const count = leads.filter(l => {
      const rank = STATUS_RANK.get(l.status);
      return rank !== undefined && rank >= idx;
    }).length;
    return { status, count };
  }).map((row, i, all) => ({
    ...row,
    drop:
      i > 0 && all[i - 1].count > 0
        ? Math.round(((all[i - 1].count - row.count) * 100) / all[i - 1].count)
        : 0,
  }));

  // By source
  const sourceCounts = new Map<string, number>();
  for (const l of leads) {
    const key = l.source ?? "unknown";
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  const bySource = Array.from(sourceCounts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

  // By intent (only counts leads with a completed call that has an intent)
  const intentCounts = new Map<string, number>();
  for (const l of leads) {
    const calls = l.lead_calls ?? [];
    for (const c of calls) {
      const key = c.intent ?? null;
      if (!key) continue;
      intentCounts.set(key, (intentCounts.get(key) ?? 0) + 1);
    }
  }
  const byIntent = Array.from(intentCounts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

  // By assigned trainer slug
  const trainerCounts = new Map<string, number>();
  for (const l of leads) {
    trainerCounts.set(
      l.assigned_trainer_id,
      (trainerCounts.get(l.assigned_trainer_id) ?? 0) + 1
    );
  }
  const byTrainer = Array.from(trainerCounts.entries())
    .map(([trainerSlug, count]) => ({ trainerSlug, count }))
    .sort((a, b) => b.count - a.count);

  // Daily time series (last `days` days). Pre-fill zeros so the chart
  // doesn't have gaps on quiet days.
  type DayBucket = { date: string; total: number; contacted: number };
  const bucketMap = new Map<string, DayBucket>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400_000);
    const iso = d.toISOString().slice(0, 10);
    bucketMap.set(iso, { date: iso, total: 0, contacted: 0 });
  }
  for (const l of leads) {
    const day = l.created_at.slice(0, 10);
    const bucket = bucketMap.get(day);
    if (!bucket) continue;
    bucket.total += 1;
    if (l.status === "contacted" || l.status === "closed") {
      bucket.contacted += 1;
    }
  }
  const timeSeries = Array.from(bucketMap.values());

  return res.status(200).json({
    ok: true,
    days,
    totals: { total, contacted, closed, conversionRate },
    funnel,
    bySource,
    byIntent,
    byTrainer,
    timeSeries,
  });
}
