/**
 * Admin → Plăți tab.
 *
 * Loads every child currently in scope of the academy's financial layer
 * (active + closed_unpaid) plus all their charges and payments in three
 * batched queries. Computes payment status per child via the shared
 * `computePaymentStatus` helper from `client/src/lib/payment-status.ts`.
 *
 * UI surfaces three things:
 *   1. A status summary at the top — count of green/yellow/orange/red/closed
 *      with the rose bucket pulsing when there's at least one 3-month
 *      account, drawing the owner's eye to urgent collections.
 *   2. A filter chip row + a search box (child or parent name). Filtering is
 *      pure-client so the page stays snappy.
 *   3. Per-child cards that expand inline to show the full charge ledger,
 *      payment history, and two inline forms — "Înregistrează plată" and
 *      "Adaugă cheltuială custom" — that insert directly through the RLS-
 *      gated client and refetch only the affected child's data.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { BrandedField } from "@/components/ui/branded-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentStatusInfo } from "@/components/payment-status-info";
import {
  computePaymentStatus,
  statusColorClass,
  statusLabel,
  type PaymentStatus,
} from "@/lib/payment-status";

type ChildRow = {
  id: string;
  full_name: string;
  status: "active" | "paused" | "left" | "closed_unpaid" | "transferred";
  group_id: string | null;
  parent: { full_name: string | null } | null;
  group: { label: string | null } | null;
};

type ChargeRow = {
  id: string;
  child_id: string;
  kind: "monthly_fee" | "custom";
  label: string | null;
  amount_ron: number | string;
  period_year: number | null;
  period_month: number | null;
  due_date: string;
  created_at: string;
};

type PaymentRow = {
  id: string;
  child_id: string;
  amount_ron: number | string;
  paid_at: string;
  method: "cash" | "bank_transfer" | "card" | "other" | null;
  note: string | null;
  created_at: string;
};

type FilterValue = "all" | PaymentStatus;

const LOCAL_INPUT_CLS =
  "touch-target w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-4 py-3 font-body text-base text-white placeholder:text-white/25 focus:border-brand-cyan/60 focus:ring-2 focus:ring-brand-cyan/20";

const RO_MONTHS = [
  "Ianuarie",
  "Februarie",
  "Martie",
  "Aprilie",
  "Mai",
  "Iunie",
  "Iulie",
  "August",
  "Septembrie",
  "Octombrie",
  "Noiembrie",
  "Decembrie",
];

const METHOD_LABEL: Record<NonNullable<PaymentRow["method"]>, string> = {
  cash: "Cash",
  bank_transfer: "Transfer bancar",
  card: "Card",
  other: "Altă metodă",
};

function formatRon(n: number): string {
  return `${n.toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} RON`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Tally each charge as Plătit / Restant via the same FIFO match the
 * status helper uses, so the inline ledger and the badge agree.
 */
function annotateChargesFifo(charges: ChargeRow[], payments: PaymentRow[]) {
  const sorted = [...charges].sort((a, b) =>
    a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0,
  );
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount_ron), 0);
  let pool = totalPaid;
  const annotated = sorted.map(c => {
    const amount = Number(c.amount_ron);
    if (pool >= amount) {
      pool -= amount;
      return { ...c, paid: true as const, partial: 0 };
    }
    const partial = pool;
    pool = 0;
    return { ...c, paid: false as const, partial };
  });
  return annotated;
}

export default function PaymentsTab() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadAll = useMemo(
    () => async () => {
      setError(null);
      const childrenRes = await supabase
        .from("children")
        .select(
          "id, full_name, status, group_id, parent:profiles!children_parent_id_fkey(full_name), group:groups(label)"
        )
        .in("status", ["active", "closed_unpaid"])
        .order("full_name", { ascending: true });
      if (childrenRes.error) {
        setError(childrenRes.error.message);
        setLoading(false);
        return;
      }
      const kids = (childrenRes.data ?? []) as unknown as ChildRow[];
      setChildren(kids);

      if (kids.length === 0) {
        setCharges([]);
        setPayments([]);
        setLoading(false);
        return;
      }

      const childIds = kids.map(k => k.id);
      const [chargesRes, paymentsRes] = await Promise.all([
        supabase
          .from("child_charges")
          .select(
            "id, child_id, kind, label, amount_ron, period_year, period_month, due_date, created_at"
          )
          .in("child_id", childIds)
          .order("due_date", { ascending: false }),
        supabase
          .from("child_payments")
          .select("id, child_id, amount_ron, paid_at, method, note, created_at")
          .in("child_id", childIds)
          .order("paid_at", { ascending: false }),
      ]);
      if (chargesRes.error || paymentsRes.error) {
        setError(chargesRes.error?.message ?? paymentsRes.error?.message ?? "Eroare la încărcarea datelor.");
        setLoading(false);
        return;
      }
      setCharges((chargesRes.data ?? []) as ChargeRow[]);
      setPayments((paymentsRes.data ?? []) as PaymentRow[]);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    setLoading(true);
    loadAll();
  }, [loadAll]);

  /**
   * Refetch just one child's charges + payments after an inline insert. We
   * keep the rest of the dataset cached to avoid flicker on the other rows.
   */
  const refetchChild = async (childId: string) => {
    const [chargesRes, paymentsRes] = await Promise.all([
      supabase
        .from("child_charges")
        .select(
          "id, child_id, kind, label, amount_ron, period_year, period_month, due_date, created_at"
        )
        .eq("child_id", childId)
        .order("due_date", { ascending: false }),
      supabase
        .from("child_payments")
        .select("id, child_id, amount_ron, paid_at, method, note, created_at")
        .eq("child_id", childId)
        .order("paid_at", { ascending: false }),
    ]);
    if (chargesRes.error || paymentsRes.error) {
      toast.error("Nu am putut reîncărca datele copilului.");
      return;
    }
    setCharges(prev => [
      ...prev.filter(c => c.child_id !== childId),
      ...((chargesRes.data ?? []) as ChargeRow[]),
    ]);
    setPayments(prev => [
      ...prev.filter(p => p.child_id !== childId),
      ...((paymentsRes.data ?? []) as PaymentRow[]),
    ]);
  };

  // Precompute every child's status + outstanding once per data change so the
  // summary, filtering, and per-row badges all read from the same map.
  const statusByChild = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof computePaymentStatus>
    >();
    const now = new Date();
    for (const child of children) {
      const cs = charges
        .filter(c => c.child_id === child.id)
        .map(c => ({
          amount_ron: Number(c.amount_ron),
          due_date: c.due_date,
          kind: c.kind,
          period_year: c.period_year,
          period_month: c.period_month,
        }));
      const ps = payments
        .filter(p => p.child_id === child.id)
        .map(p => ({
          amount_ron: Number(p.amount_ron),
          paid_at: p.paid_at,
        }));
      map.set(child.id, computePaymentStatus(cs, ps, now));
    }
    return map;
  }, [children, charges, payments]);

  const summary = useMemo(() => {
    const counts: Record<PaymentStatus, number> = {
      green: 0,
      yellow: 0,
      orange: 0,
      red: 0,
      closed: 0,
    };
    Array.from(statusByChild.values()).forEach(r => {
      counts[r.status] += 1;
    });
    return counts;
  }, [statusByChild]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return children.filter(c => {
      const s = statusByChild.get(c.id)?.status;
      if (filter !== "all" && s !== filter) return false;
      if (!q) return true;
      return (
        c.full_name.toLowerCase().includes(q) ||
        (c.parent?.full_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [children, statusByChild, filter, search]);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center gap-3 rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5">
        <div className="flex items-center gap-2">
          <Receipt className="size-4 text-brand-cyan" />
          <h2 className="font-heading text-[12px] uppercase tracking-[0.2em] text-white/85">
            Status plăți · {children.length} {children.length === 1 ? "copil" : "copii"}
          </h2>
          <PaymentStatusInfo />
        </div>
        <button
          type="button"
          onClick={() => loadAll()}
          className="ml-auto touch-target inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 font-heading text-[10px] uppercase tracking-[0.18em] text-white/75 hover:border-brand-cyan/40 hover:text-white"
        >
          <RefreshCcw className="size-3.5" />
          Reîncarcă
        </button>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard label="La zi" status="green" count={summary.green} />
        <SummaryCard label="1 lună" status="yellow" count={summary.yellow} />
        <SummaryCard label="2 luni" status="orange" count={summary.orange} />
        <SummaryCard label="3 luni" status="red" count={summary.red} pulse />
        <SummaryCard label="Închise" status="closed" count={summary.closed} />
      </div>

      {/* Filter + search */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-3">
        <FilterChip value="all" current={filter} onClick={setFilter} count={children.length}>
          Toți
        </FilterChip>
        <FilterChip value="green" current={filter} onClick={setFilter} count={summary.green}>
          La zi
        </FilterChip>
        <FilterChip value="yellow" current={filter} onClick={setFilter} count={summary.yellow}>
          1 lună
        </FilterChip>
        <FilterChip value="orange" current={filter} onClick={setFilter} count={summary.orange}>
          2 luni
        </FilterChip>
        <FilterChip
          value="red"
          current={filter}
          onClick={setFilter}
          count={summary.red}
          pulse={summary.red > 0}
        >
          3 luni
        </FilterChip>
        <FilterChip value="closed" current={filter} onClick={setFilter} count={summary.closed}>
          Închise
        </FilterChip>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/45" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Caută copil sau părinte"
            className="touch-target w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] py-2 pl-9 pr-3 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 font-body text-sm text-rose-200">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Niciun copil"
          description={
            search || filter !== "all"
              ? "Schimbă filtrul sau căutarea pentru alte rezultate."
              : "Adaugă copii și grupe ca să apară aici."
          }
        />
      ) : (
        <ul className="grid gap-3">
          {filtered.map(child => {
            const result = statusByChild.get(child.id);
            const isOpen = expanded === child.id;
            return (
              <li key={child.id}>
                <ChildPaymentCard
                  child={child}
                  result={result}
                  charges={charges.filter(c => c.child_id === child.id)}
                  payments={payments.filter(p => p.child_id === child.id)}
                  open={isOpen}
                  onToggle={() =>
                    setExpanded(prev => (prev === child.id ? null : child.id))
                  }
                  recorderId={profile?.id ?? null}
                  onMutated={() => refetchChild(child.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  status,
  count,
  pulse = false,
}: {
  label: string;
  status: PaymentStatus;
  count: number;
  pulse?: boolean;
}) {
  const ring = {
    green: "border-emerald-400/30 bg-emerald-400/[0.06]",
    yellow: "border-amber-300/30 bg-amber-300/[0.06]",
    orange: "border-orange-400/30 bg-orange-400/[0.06]",
    red: "border-rose-400/30 bg-rose-400/[0.06]",
    closed: "border-white/15 bg-white/[0.04]",
  }[status];
  const number = {
    green: "text-emerald-300",
    yellow: "text-amber-200",
    orange: "text-orange-300",
    red: "text-rose-300",
    closed: "text-white/70",
  }[status];
  const shouldPulse = pulse && count > 0;
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${ring} ${shouldPulse ? "animate-pulse" : ""}`}
    >
      <p className="font-heading text-[10px] uppercase tracking-[0.18em] text-white/55">
        {label}
      </p>
      <p className={`mt-1 font-heading text-3xl font-bold tabular-nums ${number}`}>
        {count}
      </p>
    </div>
  );
}

function FilterChip({
  value,
  current,
  onClick,
  count,
  children,
  pulse = false,
}: {
  value: FilterValue;
  current: FilterValue;
  onClick: (v: FilterValue) => void;
  count: number;
  children: ReactNode;
  pulse?: boolean;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.16em] transition-colors ${
        active
          ? "border-brand-cyan/45 bg-brand-cyan/15 text-brand-cyan"
          : "border-white/12 bg-white/[0.04] text-white/65 hover:border-brand-cyan/40 hover:text-white"
      } ${pulse ? "animate-pulse" : ""}`}
    >
      {children}
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-white/75">
        {count}
      </span>
    </button>
  );
}

function ChildPaymentCard({
  child,
  result,
  charges,
  payments,
  open,
  onToggle,
  recorderId,
  onMutated,
}: {
  child: ChildRow;
  result: ReturnType<typeof computePaymentStatus> | undefined;
  charges: ChargeRow[];
  payments: PaymentRow[];
  open: boolean;
  onToggle: () => void;
  recorderId: string | null;
  onMutated: () => void;
}) {
  const status = result?.status ?? "green";
  const outstanding = result?.outstandingRon ?? 0;
  const monthsOverdue = result?.monthsOverdue ?? 0;

  const annotated = useMemo(
    () => annotateChargesFifo(charges, payments),
    [charges, payments]
  );

  return (
    <article className="rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-4 transition-colors">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-base font-semibold uppercase tracking-[0.04em] text-white">
            {child.full_name}
          </h3>
          <p className="mt-0.5 font-body text-xs text-white/55">
            {child.parent?.full_name ?? "Părinte nealocat"}
            {child.group?.label && ` · ${child.group.label}`}
            {child.status === "closed_unpaid" && " · CONT ÎNCHIS"}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] ${statusColorClass(status)}`}>
          {statusLabel(status)}
          {monthsOverdue > 0 && monthsOverdue <= 3 && ` · ${monthsOverdue}L`}
        </span>
        <span className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 font-heading text-[10px] uppercase tracking-[0.18em] text-white/75 tabular-nums">
          {formatRon(outstanding)}
        </span>
        {open ? (
          <ChevronUp className="size-4 text-white/55" />
        ) : (
          <ChevronDown className="size-4 text-white/55" />
        )}
      </button>

      {open && (
        <div className="mt-4 grid gap-4 border-t border-white/8 pt-4 lg:grid-cols-2">
          <section>
            <h4 className="font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
              Taxe ({annotated.length})
            </h4>
            <ul className="mt-2 grid gap-1.5">
              {annotated.length === 0 && (
                <li className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 font-body text-xs text-white/45">
                  Nu există taxe înregistrate.
                </li>
              )}
              {annotated.map(c => {
                const label =
                  c.label ??
                  (c.kind === "monthly_fee" && c.period_month && c.period_year
                    ? `Taxă lunară ${RO_MONTHS[c.period_month - 1]} ${c.period_year}`
                    : "Cheltuială");
                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-white/85">{label}</p>
                      <p className="text-white/45">
                        Scadent {formatDate(c.due_date)}
                      </p>
                    </div>
                    <span className="tabular-nums text-white/75">
                      {formatRon(Number(c.amount_ron))}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.12em] ${
                        c.paid
                          ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                          : c.partial > 0
                            ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
                            : "border-rose-300/30 bg-rose-300/10 text-rose-200"
                      }`}
                    >
                      {c.paid
                        ? "Plătit"
                        : c.partial > 0
                          ? "Parțial"
                          : "Restant"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h4 className="font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
              Plăți ({payments.length})
            </h4>
            <ul className="mt-2 grid gap-1.5">
              {payments.length === 0 && (
                <li className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 font-body text-xs text-white/45">
                  Nu există plăți înregistrate.
                </li>
              )}
              {payments.map(p => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-white/85 tabular-nums">
                      {formatRon(Number(p.amount_ron))}
                    </p>
                    <p className="text-white/45">
                      {formatDate(p.paid_at)}
                      {p.method && ` · ${METHOD_LABEL[p.method]}`}
                    </p>
                    {p.note && (
                      <p className="mt-0.5 text-white/55 italic">{p.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="lg:col-span-2">
            <ChildActions
              childId={child.id}
              recorderId={recorderId}
              defaultPaymentRon={Math.max(1, Math.round(outstanding))}
              onDone={onMutated}
            />
          </div>
        </div>
      )}
    </article>
  );
}

// ─── Inline forms ─────────────────────────────────────────────────────────────

const paymentSchema = z.object({
  amount_ron: z.number().min(1, "Minim 1 RON").max(100000),
  paid_at: z.string().min(1),
  method: z.enum(["cash", "bank_transfer", "card", "other"]),
  note: z.string().max(500).optional().or(z.literal("")),
});
type PaymentValues = z.infer<typeof paymentSchema>;

const customChargeSchema = z.object({
  label: z.string().min(1, "Eticheta este obligatorie").max(160),
  amount_ron: z.number().min(0, "Minim 0 RON").max(100000),
  due_date: z.string().min(1),
});
type CustomChargeValues = z.infer<typeof customChargeSchema>;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ChildActions({
  childId,
  recorderId,
  defaultPaymentRon,
  onDone,
}: {
  childId: string;
  recorderId: string | null;
  defaultPaymentRon: number;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"none" | "payment" | "charge">("none");
  return (
    <div className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode(mode === "payment" ? "none" : "payment")}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.16em] text-brand-cyan transition-colors hover:bg-brand-cyan/20"
        >
          <Plus className="size-3" />
          Înregistrează plată
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "charge" ? "none" : "charge")}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-brand-cyan/40 hover:text-white"
        >
          <Plus className="size-3" />
          Adaugă cheltuială custom
        </button>
      </div>

      {mode === "payment" && (
        <PaymentForm
          childId={childId}
          recorderId={recorderId}
          defaultAmount={defaultPaymentRon}
          onCancel={() => setMode("none")}
          onSaved={() => {
            setMode("none");
            onDone();
          }}
        />
      )}
      {mode === "charge" && (
        <CustomChargeForm
          childId={childId}
          recorderId={recorderId}
          onCancel={() => setMode("none")}
          onSaved={() => {
            setMode("none");
            onDone();
          }}
        />
      )}
    </div>
  );
}

function PaymentForm({
  childId,
  recorderId,
  defaultAmount,
  onCancel,
  onSaved,
}: {
  childId: string;
  recorderId: string | null;
  defaultAmount: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount_ron: defaultAmount,
      paid_at: todayIso(),
      method: "cash",
      note: "",
    },
  });

  const onSubmit = handleSubmit(async v => {
    if (!recorderId) {
      toast.error("Profilul tău nu este încărcat — reîncarcă pagina.");
      return;
    }
    const { error: insErr } = await supabase.from("child_payments").insert({
      child_id: childId,
      amount_ron: v.amount_ron,
      paid_at: v.paid_at,
      method: v.method,
      note: v.note?.trim() ? v.note.trim() : null,
      recorded_by: recorderId,
    });
    if (insErr) {
      toast.error("Nu am putut salva plata", { description: insErr.message });
      return;
    }
    toast.success("Plată înregistrată.");
    onSaved();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <BrandedField htmlFor={`pay-amount-${childId}`} label="Sumă (RON)" error={errors.amount_ron?.message} required>
          <input
            id={`pay-amount-${childId}`}
            type="number"
            min={1}
            step="0.01"
            {...register("amount_ron", { valueAsNumber: true })}
            className={LOCAL_INPUT_CLS}
          />
        </BrandedField>
        <BrandedField htmlFor={`pay-date-${childId}`} label="Data plății" error={errors.paid_at?.message} required>
          <input
            id={`pay-date-${childId}`}
            type="date"
            {...register("paid_at")}
            className={LOCAL_INPUT_CLS}
          />
        </BrandedField>
      </div>
      <div>
        <label
          htmlFor={`pay-method-${childId}`}
          className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
        >
          Metodă
        </label>
        <select
          id={`pay-method-${childId}`}
          {...register("method")}
          className={LOCAL_INPUT_CLS}
        >
          <option value="cash">Cash</option>
          <option value="bank_transfer">Transfer bancar</option>
          <option value="card">Card</option>
          <option value="other">Altă metodă</option>
        </select>
      </div>
      <BrandedField htmlFor={`pay-note-${childId}`} label="Notă (opțional)" error={errors.note?.message}>
        <input
          id={`pay-note-${childId}`}
          type="text"
          {...register("note")}
          placeholder="Ex: chitanța 1234"
          className={LOCAL_INPUT_CLS}
        />
      </BrandedField>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-cyan px-4 py-2 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : "Salvează plata"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 font-heading text-[10px] uppercase tracking-[0.18em] text-white/75 hover:text-white disabled:opacity-60"
        >
          <X className="size-3" />
          Anulează
        </button>
      </div>
    </form>
  );
}

function CustomChargeForm({
  childId,
  recorderId,
  onCancel,
  onSaved,
}: {
  childId: string;
  recorderId: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomChargeValues>({
    resolver: zodResolver(customChargeSchema),
    defaultValues: {
      label: "",
      amount_ron: 0,
      due_date: todayIso(),
    },
  });

  const onSubmit = handleSubmit(async v => {
    const { error: insErr } = await supabase.from("child_charges").insert({
      child_id: childId,
      kind: "custom",
      label: v.label.trim(),
      amount_ron: v.amount_ron,
      period_year: null,
      period_month: null,
      due_date: v.due_date,
      created_by: recorderId,
    });
    if (insErr) {
      toast.error("Nu am putut adăuga cheltuiala", { description: insErr.message });
      return;
    }
    toast.success("Cheltuială adăugată.");
    onSaved();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <BrandedField htmlFor={`ch-label-${childId}`} label="Etichetă" error={errors.label?.message} required>
        <input
          id={`ch-label-${childId}`}
          type="text"
          {...register("label")}
          placeholder="Ex: Echipament, Taxă turneu"
          className={LOCAL_INPUT_CLS}
        />
      </BrandedField>
      <div className="grid gap-3 sm:grid-cols-2">
        <BrandedField htmlFor={`ch-amount-${childId}`} label="Sumă (RON)" error={errors.amount_ron?.message} required>
          <input
            id={`ch-amount-${childId}`}
            type="number"
            min={0}
            step="0.01"
            {...register("amount_ron", { valueAsNumber: true })}
            className={LOCAL_INPUT_CLS}
          />
        </BrandedField>
        <BrandedField htmlFor={`ch-due-${childId}`} label="Scadență" error={errors.due_date?.message} required>
          <input
            id={`ch-due-${childId}`}
            type="date"
            {...register("due_date")}
            className={LOCAL_INPUT_CLS}
          />
        </BrandedField>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-cyan px-4 py-2 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : "Salvează cheltuiala"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 font-heading text-[10px] uppercase tracking-[0.18em] text-white/75 hover:text-white disabled:opacity-60"
        >
          <X className="size-3" />
          Anulează
        </button>
      </div>
    </form>
  );
}
