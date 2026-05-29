/**
 * Server-side duplicate of `client/src/lib/payment-status.ts` used by the
 * weekly auto-close cron. Vercel serverless functions don't include the
 * `client/` tree at build time, so we can't import from there; the algorithm
 * is small (~50 lines) and changes infrequently, so keeping a server twin
 * is cheaper than carving out a shared package + tsconfig path.
 *
 * If the client copy is updated, mirror the change here. The unit tests on
 * the client copy guard correctness — this file is a verbatim port.
 */

export type PaymentStatus = "green" | "yellow" | "orange" | "red" | "closed";

export interface ChargeSummary {
  amount_ron: number;
  due_date: string;
  kind: "monthly_fee" | "custom";
  period_year: number | null;
  period_month: number | null;
}

export interface PaymentSummary {
  amount_ron: number;
  paid_at: string;
}

export interface StatusResult {
  status: PaymentStatus;
  monthsOverdue: number;
  outstandingRon: number;
  firstUnpaidDueDate: string | null;
}

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
