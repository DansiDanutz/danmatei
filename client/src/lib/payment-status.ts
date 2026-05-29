/**
 * Pure helper module — derives a child's payment status from their charges
 * and payments. No React imports, no I/O — safe to unit-test and to call from
 * both the UI layer (dashboards, badges, lists) and any server-side code.
 *
 * The academy's policy (Romanian text in the UI):
 *   - Pay by the 15th of the current month        → green ("La zi")
 *   - 15th passes still unpaid                    → yellow (1 month overdue)
 *   - Next month's 15th passes still unpaid       → orange (2 months overdue)
 *   - Third 15th passes                           → red (3 months overdue)
 *   - Fourth 15th — child must be closed/transferred → closed
 *
 * The algorithm:
 *   1. Sum payments and charges; outstanding = max(0, charges - payments).
 *   2. If nothing is owed, the child is green — return immediately.
 *   3. Otherwise FIFO-match payments against charges sorted by due_date asc:
 *      walk charges in due-date order, draining the paid pool. The first
 *      charge that can't be fully covered is the "first unpaid". That charge's
 *      due_date drives monthsOverdue (calendar months between then and now).
 *   4. Map monthsOverdue → 0 green, 1 yellow, 2 orange, 3 red, >=4 closed.
 */

/** All possible payment states a child can be in. */
export type PaymentStatus = "green" | "yellow" | "orange" | "red" | "closed";

/**
 * Minimal shape of a charge row needed for status computation. Matches
 * what `select` on `fotbal.child_charges` typically returns.
 */
export interface ChargeSummary {
  amount_ron: number;
  /** ISO YYYY-MM-DD. Drives FIFO order + "first unpaid" anchor date. */
  due_date: string;
  kind: "monthly_fee" | "custom";
  period_year: number | null;
  period_month: number | null;
}

/** Minimal shape of a payment row needed for status computation. */
export interface PaymentSummary {
  amount_ron: number;
  /** ISO YYYY-MM-DD. Currently unused by the FIFO match but kept for parity. */
  paid_at: string;
}

/** Result of `computePaymentStatus`. */
export interface StatusResult {
  /** Final tier — drives the badge color and copy. */
  status: PaymentStatus;
  /** 0 when on-time or fully paid; otherwise whole calendar months overdue. */
  monthsOverdue: number;
  /** Charges - payments, floored at 0. Useful for "datorează X RON" labels. */
  outstandingRon: number;
  /** ISO YYYY-MM-DD of the oldest unpaid charge, or null when all caught up. */
  firstUnpaidDueDate: string | null;
}

/**
 * Compute a child's payment status from raw charges + payments. Pure and
 * deterministic — pass `now` to make snapshot-style tests trivial.
 *
 * @param charges All charges issued to this child (any order).
 * @param payments All payments recorded against this child (any order).
 * @param now Reference "today" — defaults to `new Date()`. Pass a fixed Date
 *   in tests for deterministic results.
 * @returns Status, months overdue, outstanding amount, and the first unpaid
 *   charge's due date (or null when nothing is owed).
 */
export function computePaymentStatus(
  charges: ChargeSummary[],
  payments: PaymentSummary[],
  now: Date = new Date(),
): StatusResult {
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount_ron), 0);
  const totalCharged = charges.reduce(
    (s, c) => s + Number(c.amount_ron),
    0,
  );
  const outstandingRon = Math.max(0, totalCharged - totalPaid);

  if (outstandingRon === 0) {
    return {
      status: "green",
      monthsOverdue: 0,
      outstandingRon: 0,
      firstUnpaidDueDate: null,
    };
  }

  // FIFO match: oldest charges get paid first. Walk in due-date order,
  // decrementing the paid pool. The first charge that's not fully covered
  // is the "first unpaid" — its due_date anchors monthsOverdue.
  const sorted = [...charges].sort((a, b) =>
    a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0,
  );
  let remainingPaid = totalPaid;
  let firstUnpaidDueDate: string | null = null;
  for (const c of sorted) {
    const amount = Number(c.amount_ron);
    if (remainingPaid >= amount) {
      remainingPaid -= amount;
      continue;
    }
    firstUnpaidDueDate = c.due_date;
    break;
  }

  // outstandingRon > 0 guarantees at least one charge is partial/unpaid, but
  // guard anyway — if for some reason we couldn't find one, treat as green.
  if (firstUnpaidDueDate === null) {
    return {
      status: "green",
      monthsOverdue: 0,
      outstandingRon,
      firstUnpaidDueDate: null,
    };
  }

  const firstUnpaid = new Date(firstUnpaidDueDate);
  const monthsBetween = (a: Date, b: Date) =>
    (b.getFullYear() - a.getFullYear()) * 12 +
    (b.getMonth() - a.getMonth());
  const monthsOverdue = Math.max(0, monthsBetween(firstUnpaid, now));

  let status: PaymentStatus;
  if (monthsOverdue === 0) status = "green";
  else if (monthsOverdue === 1) status = "yellow";
  else if (monthsOverdue === 2) status = "orange";
  else if (monthsOverdue === 3) status = "red";
  else status = "closed";

  return {
    status,
    monthsOverdue,
    outstandingRon,
    firstUnpaidDueDate,
  };
}

/** Romanian short label for a status — used by badges and lists. */
export function statusLabel(status: PaymentStatus): string {
  return {
    green: "La zi",
    yellow: "Restanță 1 lună",
    orange: "Restanță 2 luni",
    red: "Restanță 3 luni",
    closed: "Cont închis",
  }[status];
}

/**
 * Tailwind classes for the status badge — border + bg + text. Matches the
 * tinted-pill look used elsewhere in the admin UI.
 */
export function statusColorClass(status: PaymentStatus): string {
  return {
    green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    yellow: "border-amber-300/30 bg-amber-300/10 text-amber-200",
    orange: "border-orange-400/30 bg-orange-400/10 text-orange-300",
    red: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    closed: "border-white/15 bg-white/[0.06] text-white/65",
  }[status];
}
