/**
 * GET /api/cron/close-overdue-accounts — fires Monday 02:00 UTC
 * (configured in vercel.json: "0 2 * * 1"). For every active child, computes
 * their payment status from charges + payments; if it comes out as "closed"
 * (>3 months overdue), flips children.status to 'closed_unpaid'.
 *
 * The admin can still manually transition the child back to 'active' or
 * forward to 'transferred' from the Membri tab.
 *
 * Auth: Vercel Cron sets Authorization: Bearer ${CRON_SECRET}. Requests
 * without the right secret get 401; in prod/preview with CRON_SECRET unset
 * we fail closed with 503.
 *
 * Output: { ok, ranAt, flipped: N } — N children moved to closed_unpaid.
 */
import { serviceClient } from "../_lib/supabase.js";
import { computePaymentStatus } from "../_lib/payment-status.js";

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

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL_ENV === "production" ||
      process.env.VERCEL_ENV === "preview"
    ) {
      return res.status(503).json({ error: "cron_secret_unset" });
    }
    console.warn(
      "[cron/close-overdue-accounts] CRON_SECRET unset — allowing in dev only"
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

  const { data: children, error } = await supabase
    .from("children")
    .select("id")
    .eq("status", "active");
  if (error) {
    return res
      .status(500)
      .json({ error: "fetch_children_failed", detail: error.message });
  }

  type ChargeRow = {
    amount_ron: number | string;
    due_date: string;
    kind: "monthly_fee" | "custom";
    period_year: number | null;
    period_month: number | null;
  };
  type PaymentRow = { amount_ron: number | string; paid_at: string };

  const now = new Date();
  let flipped = 0;

  // Sequential per-child loop. Fan-out is small (<a few hundred active kids),
  // and we'd rather see a clear log row per child than burn quota on parallel
  // reads. The cron only runs once a week so latency doesn't matter.
  for (const child of (children ?? []) as { id: string }[]) {
    const [chargesRes, paymentsRes] = await Promise.all([
      supabase
        .from("child_charges")
        .select("amount_ron, due_date, kind, period_year, period_month")
        .eq("child_id", child.id),
      supabase
        .from("child_payments")
        .select("amount_ron, paid_at")
        .eq("child_id", child.id),
    ]);
    if (chargesRes.error || paymentsRes.error) {
      console.warn(
        `[cron/close-overdue-accounts] fetch failed for child ${child.id}: ${chargesRes.error?.message ?? paymentsRes.error?.message}`
      );
      continue;
    }
    const charges = ((chargesRes.data ?? []) as ChargeRow[]).map(c => ({
      amount_ron: Number(c.amount_ron),
      due_date: c.due_date,
      kind: c.kind,
      period_year: c.period_year,
      period_month: c.period_month,
    }));
    const payments = ((paymentsRes.data ?? []) as PaymentRow[]).map(p => ({
      amount_ron: Number(p.amount_ron),
      paid_at: p.paid_at,
    }));
    const result = computePaymentStatus(charges, payments, now);
    if (result.status !== "closed") continue;

    const { error: upErr } = await supabase
      .from("children")
      .update({ status: "closed_unpaid" })
      .eq("id", child.id);
    if (upErr) {
      console.warn(
        `[cron/close-overdue-accounts] update failed for child ${child.id}: ${upErr.message}`
      );
      continue;
    }
    flipped += 1;
  }

  return res.status(200).json({ ok: true, ranAt, flipped });
}
