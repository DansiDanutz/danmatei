/**
 * Admin → Funnel tab.
 *
 * Owner-side analytics over fotbal.leads. Pulls aggregated counts from
 * /api/leads/analytics — no PII reaches the client. Renders:
 *   - 4 KPI cards (total, contacted, closed, conversion %)
 *   - Funnel bars per status (with drop-off %)
 *   - Daily time series (recharts area chart, total + contacted)
 *   - Source breakdown (small bar list)
 *   - Intent breakdown (small bar list)
 *   - Lead distribution by trainer slug
 *
 * Window selector: 7 / 30 / 60 / 180 days.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Analytics = {
  ok: boolean;
  days: number;
  totals: {
    total: number;
    contacted: number;
    closed: number;
    conversionRate: number;
  };
  funnel: { status: string; count: number; drop: number }[];
  bySource: { key: string; count: number }[];
  byIntent: { key: string; count: number }[];
  byTrainer: { trainerSlug: string; count: number }[];
  timeSeries: { date: string; total: number; contacted: number }[];
};

const STATUS_LABEL: Record<string, string> = {
  new: "Nou",
  wa_sent: "WhatsApp trimis",
  calling: "În apel",
  transcribed: "Transcris",
  routed: "Rutat",
  contacted: "Contactat",
  closed: "Închis",
};

const SOURCE_LABEL: Record<string, string> = {
  web: "Web",
  app: "Aplicație",
  whatsapp_inbound: "WhatsApp",
  unknown: "Necunoscut",
};

const INTENT_LABEL: Record<string, string> = {
  register: "Înscriere",
  visit: "Vizită",
  info: "Informații",
  price: "Preț",
  schedule: "Program",
  other: "Altele",
};

const TRAINER_LABEL: Record<string, string> = {
  "t-sopi": "Sopi (U7-U9)",
  "t-kelemen": "Kelemen (U10-U13)",
  "t-dan": "Dan (U14-U15)",
};

const WINDOW_OPTIONS = [
  { days: 7, label: "7 zile" },
  { days: 30, label: "30 zile" },
  { days: 60, label: "60 zile" },
  { days: 180, label: "180 zile" },
];

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
  });
}

export default function LeadAnalyticsTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) {
          if (!cancelled) {
            setError("Sesiune expirată — autentifică-te din nou.");
            setLoading(false);
          }
          return;
        }
        const r = await fetch(`/api/leads/analytics?days=${days}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const j = (await r.json().catch(() => ({}))) as
          | Analytics
          | { error?: string };
        if (cancelled) return;
        if (!r.ok || !("ok" in j) || !j.ok) {
          setError(("error" in j && j.error) || `HTTP ${r.status}`);
          setLoading(false);
          return;
        }
        setData(j as Analytics);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const maxFunnel = useMemo(
    () => (data ? Math.max(1, ...data.funnel.map(f => f.count)) : 1),
    [data]
  );
  const maxSource = useMemo(
    () => (data ? Math.max(1, ...data.bySource.map(b => b.count)) : 1),
    [data]
  );
  const maxIntent = useMemo(
    () => (data ? Math.max(1, ...data.byIntent.map(b => b.count)) : 1),
    [data]
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl uppercase tracking-tight text-white">
            Pâlnia de lead-uri
          </h2>
          <p className="mt-1 font-body text-sm text-white/60">
            Câți părinți intră, cât de departe ajung, unde renunță. Numai pentru
            owner — datele sunt agregate, niciun nume nu apare aici.
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
          {WINDOW_OPTIONS.map(opt => (
            <button
              key={opt.days}
              type="button"
              onClick={() => setDays(opt.days)}
              aria-pressed={days === opt.days}
              className={`rounded-full px-3 py-1 font-heading text-[10.5px] uppercase tracking-[0.16em] transition ${
                days === opt.days
                  ? "bg-brand-cyan text-[oklch(0.08_0.02_250)]"
                  : "text-white/65 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {loading && (
        <div className="grid place-items-center py-20 text-white/55">
          <Loader2 className="size-5 animate-spin text-brand-cyan" />
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-300/10 p-6 font-body text-sm text-rose-200">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* KPI cards */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Total lead-uri" value={data.totals.total} />
            <Kpi label="Contactate" value={data.totals.contacted} tone="cyan" />
            <Kpi label="Închise" value={data.totals.closed} tone="gold" />
            <Kpi
              label="Conversie"
              value={`${data.totals.conversionRate}%`}
              tone={data.totals.conversionRate >= 30 ? "gold" : "cyan"}
              icon={<TrendingUp className="size-3.5" />}
            />
          </section>

          {/* Time series */}
          {data.timeSeries.length > 0 && (
            <section className="rounded-2xl border border-white/8 bg-[oklch(0.10_0.02_250)] p-4">
              <h3 className="mb-3 font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
                Lead-uri pe zi
              </h3>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.timeSeries}
                    margin={{ top: 6, right: 12, left: -16, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="totalFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="oklch(0.78 0.13 210)"
                          stopOpacity={0.45}
                        />
                        <stop
                          offset="100%"
                          stopColor="oklch(0.78 0.13 210)"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                      <linearGradient
                        id="contactedFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#ffb800"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="100%"
                          stopColor="#ffb800"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={dateLabel}
                      tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.13 0.03 250)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "0.75rem",
                        fontFamily: "inherit",
                        fontSize: "12px",
                      }}
                      labelFormatter={dateLabel}
                      labelStyle={{ color: "rgba(255,255,255,0.85)" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="oklch(0.78 0.13 210)"
                      strokeWidth={2}
                      fill="url(#totalFill)"
                      name="Total"
                    />
                    <Area
                      type="monotone"
                      dataKey="contacted"
                      stroke="#ffb800"
                      strokeWidth={2}
                      fill="url(#contactedFill)"
                      name="Contactate"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Funnel */}
          <section className="rounded-2xl border border-white/8 bg-[oklch(0.10_0.02_250)] p-4">
            <h3 className="mb-3 font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
              Funnel pe statut
            </h3>
            <ul className="space-y-2">
              {data.funnel.map(f => {
                const widthPct = Math.max(2, (f.count * 100) / maxFunnel);
                return (
                  <li
                    key={f.status}
                    className="grid grid-cols-[140px_1fr_88px] items-center gap-3"
                  >
                    <span className="font-heading text-[11px] uppercase tracking-[0.16em] text-white/75">
                      {STATUS_LABEL[f.status] ?? f.status}
                    </span>
                    <div className="relative h-7 overflow-hidden rounded-lg bg-white/[0.04]">
                      <div
                        className="h-full rounded-lg bg-gradient-to-r from-brand-cyan/45 to-brand-cyan/15"
                        style={{ width: `${widthPct}%` }}
                      />
                      <span className="absolute inset-y-0 left-3 flex items-center font-heading text-xs tabular-nums text-white">
                        {f.count}
                      </span>
                    </div>
                    <span className="text-right font-heading text-[10.5px] uppercase tracking-[0.16em] text-white/45 tabular-nums">
                      {f.drop > 0 ? (
                        <span className="inline-flex items-center gap-1 text-rose-300/85">
                          <ArrowDownRight className="size-3" />-{f.drop}%
                        </span>
                      ) : (
                        ""
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Source + Intent side-by-side */}
          <section className="grid gap-4 lg:grid-cols-2">
            <BreakdownCard
              title="Sursă"
              rows={data.bySource}
              max={maxSource}
              labelFor={k => SOURCE_LABEL[k] ?? k}
              accent="cyan"
            />
            <BreakdownCard
              title="Intenție (din apel)"
              rows={data.byIntent}
              max={maxIntent}
              labelFor={k => INTENT_LABEL[k] ?? k}
              accent="gold"
              emptyHint="Niciun apel cu intenție identificată în această fereastră."
            />
          </section>

          {/* Trainer split */}
          {data.byTrainer.length > 0 && (
            <section className="rounded-2xl border border-white/8 bg-[oklch(0.10_0.02_250)] p-4">
              <h3 className="mb-3 font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
                Lead-uri per antrenor (rutate la)
              </h3>
              <ul className="grid gap-2 sm:grid-cols-3">
                {data.byTrainer.map(t => (
                  <li
                    key={t.trainerSlug}
                    className="rounded-xl border border-white/8 bg-white/[0.02] p-3"
                  >
                    <div className="font-heading text-[10.5px] uppercase tracking-[0.18em] text-white/55">
                      {TRAINER_LABEL[t.trainerSlug] ?? t.trainerSlug}
                    </div>
                    <div className="mt-1 font-heading text-2xl tabular-nums text-brand-cyan">
                      {t.count}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: number | string;
  tone?: "default" | "cyan" | "gold";
  icon?: React.ReactNode;
}) {
  const valueClass =
    tone === "gold"
      ? "text-brand-gold"
      : tone === "cyan"
        ? "text-brand-cyan"
        : "text-white";
  return (
    <div className="rounded-2xl border border-white/8 bg-[oklch(0.10_0.02_250)] p-4">
      <div className="inline-flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-[0.22em] text-white/55">
        {icon}
        {label}
      </div>
      <div
        className={`mt-1.5 font-heading text-3xl leading-none tabular-nums ${valueClass}`}
      >
        {value}
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  max,
  labelFor,
  accent,
  emptyHint,
}: {
  title: string;
  rows: { key: string; count: number }[];
  max: number;
  labelFor: (k: string) => string;
  accent: "cyan" | "gold";
  emptyHint?: string;
}) {
  const fillClass =
    accent === "gold"
      ? "from-brand-gold/55 to-brand-gold/15"
      : "from-brand-cyan/55 to-brand-cyan/15";
  return (
    <div className="rounded-2xl border border-white/8 bg-[oklch(0.10_0.02_250)] p-4">
      <h3 className="mb-3 font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="font-body text-sm text-white/45">
          {emptyHint ?? "Nimic înregistrat în această fereastră."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map(r => {
            const widthPct = Math.max(2, (r.count * 100) / max);
            return (
              <li
                key={r.key}
                className="grid grid-cols-[120px_1fr_44px] items-center gap-3"
              >
                <span className="font-heading text-[11px] uppercase tracking-[0.14em] text-white/75">
                  {labelFor(r.key)}
                </span>
                <div className="h-6 overflow-hidden rounded-lg bg-white/[0.04]">
                  <div
                    className={`h-full rounded-lg bg-gradient-to-r ${fillClass}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="text-right font-heading text-xs tabular-nums text-white">
                  {r.count}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
