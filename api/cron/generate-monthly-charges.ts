/**
 * GET /api/cron/generate-monthly-charges — fires on the 1st of each month at
 * 00:30 UTC (configured in vercel.json: "30 0 1 * *"). For every active child
 * whose group has at least one `group_fees` row, inserts a `child_charges`
 * row of kind 'monthly_fee' for the current (period_year, period_month) with
 * due_date set to the 15th of the same month.
 *
 * Idempotent: the (child_id, kind, period_year, period_month) unique
 * constraint on child_charges drops duplicates silently — re-running the
 * cron in the same month does nothing.
 *
 * Auth: Vercel Cron sets Authorization: Bearer ${CRON_SECRET}. Requests
 * without the right secret get 401; in prod/preview with CRON_SECRET unset
 * we fail closed with 503.
 *
 * Output: { ok, ranAt, generated: N } — N is the number of rows successfully
 * inserted in this run.
 */
import { serviceClient } from "../_lib/supabase.js";

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};
type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
};

function readHeader(req: Req, key: string): string | undefined {
  const v = req.headers?.[key.toLowerCase()] ?? req.headers?.[key];
  return Array.isArray(v) ? v[0] : v;
}

const RO_MONTHS = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];

/** Current month/year in Europe/Bucharest. */
function todayMonthYear(): { month: number; year: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map(p => [p.type, p.value])
  ) as { year: string; month: string; day: string };
  return {
    month: Number(parts.month),
    year: Number(parts.year),
  };
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  // Cron auth — fail-closed. Vercel sets the Authorization header
  // automatically; we refuse to run in prod/preview when CRON_SECRET is
  // unset so an unconfigured deploy can't be triggered by anyone.
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL_ENV === "production" ||
      process.env.VERCEL_ENV === "preview"
    ) {
      return res.status(503).json({ error: "cron_secret_unset" });
    }
    // dev-only: log a warn and continue
    console.warn(
      "[cron/generate-monthly-charges] CRON_SECRET unset — allowing in dev only"
    );
  } else {
    const auth = readHeader(req, "authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const ranAt = new Date().toISOString();

  let supabase;
  try {
    supabase = serviceClient();
  } catch (err) {
    return res.status(503).json({
      error: "supabase_unavailable",
      message: err instanceof Error ? err.message : "service unavailable",
    });
  }

  const { month, year } = todayMonthYear();
  const dueDate = `${year}-${String(month).padStart(2, "0")}-15`;
  const todayIso = `${year}-${String(month).padStart(2, "0")}-${String(
    new Date().getUTCDate()
  ).padStart(2, "0")}`;
  const label = `Taxă lunară ${RO_MONTHS[month - 1]} ${year}`;

  // Pull every active child that has a group_id set. Children without a
  // group are skipped — they don't have a fee to apply yet.
  const { data: kids, error: kidsErr } = await supabase
    .from("children")
    .select("id, group_id")
    .eq("status", "active")
    .not("group_id", "is", null);
  if (kidsErr) {
    return res
      .status(500)
      .json({ error: "fetch_children_failed", detail: kidsErr.message });
  }

  type KidRow = { id: string; group_id: string };
  const allKids = (kids ?? []) as KidRow[];
  if (allKids.length === 0) {
    return res.status(200).json({ ok: true, ranAt, generated: 0 });
  }

  // Pull the latest fee per group (effective_from <= today) in one query,
  // then resolve in memory. We pull all fee rows whose effective_from is on
  // or before today, then keep the most recent per group_id.
  const groupIds = Array.from(new Set(allKids.map(k => k.group_id)));
  const { data: fees, error: feesErr } = await supabase
    .from("group_fees")
    .select("group_id, monthly_fee_ron, effective_from")
    .in("group_id", groupIds)
    .lte("effective_from", todayIso)
    .order("effective_from", { ascending: false });
  if (feesErr) {
    return res
      .status(500)
      .json({ error: "fetch_fees_failed", detail: feesErr.message });
  }

  type FeeRow = {
    group_id: string;
    monthly_fee_ron: number | string;
    effective_from: string;
  };
  const feeRows = (fees ?? []) as FeeRow[];
  const latestFeeByGroup = new Map<string, number>();
  for (const f of feeRows) {
    // First occurrence wins because we sorted desc by effective_from.
    if (!latestFeeByGroup.has(f.group_id)) {
      latestFeeByGroup.set(f.group_id, Number(f.monthly_fee_ron));
    }
  }

  // Build rows for kids whose group has a fee. Insert one at a time so a
  // duplicate (already-generated this month) doesn't poison the whole batch.
  let generated = 0;
  const failures: { childId: string; error: string }[] = [];
  for (const k of allKids) {
    const amount = latestFeeByGroup.get(k.group_id);
    if (amount === undefined) continue; // group has no fee yet

    const { error: insErr } = await supabase.from("child_charges").insert({
      child_id: k.id,
      kind: "monthly_fee",
      label,
      amount_ron: amount,
      period_year: year,
      period_month: month,
      due_date: dueDate,
    });
    if (!insErr) {
      generated += 1;
    } else {
      // 23505 = unique_violation — expected on re-runs, ignore. Anything else is
      // a real under-charge: surface it (count + 207 + non-ok) so a monitored run
      // doesn't look healthy while a child silently goes unbilled for the month.
      const msg = insErr.message ?? "";
      const code = (insErr as { code?: string }).code;
      if (code !== "23505" && !msg.includes("duplicate")) {
        console.error(
          `[cron/generate-monthly-charges] insert failed for child ${k.id}: ${msg}`
        );
        failures.push({ childId: k.id, error: msg });
      }
    }
  }

  if (failures.length > 0) {
    return res
      .status(207)
      .json({ ok: false, ranAt, generated, failed: failures.length, failures });
  }
  return res.status(200).json({ ok: true, ranAt, generated });
}
