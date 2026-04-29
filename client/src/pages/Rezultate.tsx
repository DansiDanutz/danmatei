/**
 * /rezultate — Public match results board. Joins `fotbal.match_results`
 * with `fotbal.schedule_events` (title, date, location, opponent) and
 * shows the most recent 40 results. Falls back to placeholder cards
 * when the DB is empty so the page still looks alive.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Trophy } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import DemoBanner from "@/components/DemoBanner";
import { supabase } from "@/lib/supabase";
import { expoOut } from "@/lib/motion";

interface ResultRow {
  id: string;
  our_score: number;
  opponent_score: number;
  recap_md: string | null;
  event: {
    title: string;
    starts_at: string;
    location: string | null;
    opponent: string | null;
  } | null;
}

const FALLBACK: ResultRow[] = [
  {
    id: "demo-1",
    our_score: 4,
    opponent_score: 1,
    recap_md: "U13 împotriva ACS Sănătatea — control total în repriza a doua.",
    event: {
      title: "U13 vs ACS Sănătatea",
      starts_at: new Date(Date.now() - 86400000 * 6).toISOString(),
      location: "Stadion Cetatea",
      opponent: "ACS Sănătatea",
    },
  },
  {
    id: "demo-2",
    our_score: 2,
    opponent_score: 2,
    recap_md: "U11 — meci echilibrat, două goluri în ultimele 10 minute.",
    event: {
      title: "U11 vs LPS Cluj",
      starts_at: new Date(Date.now() - 86400000 * 13).toISOString(),
      location: "Baza Sportivă Mănăștur",
      opponent: "LPS Cluj",
    },
  },
  {
    id: "demo-3",
    our_score: 5,
    opponent_score: 0,
    recap_md: "U9 — cinci goluri, primul curat din partea grupei mici.",
    event: {
      title: "U9 vs CSȘ Cluj",
      starts_at: new Date(Date.now() - 86400000 * 20).toISOString(),
      location: "Baza Sportivă Mănăștur",
      opponent: "CSȘ Cluj",
    },
  },
];

const dateFormatter = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Bucharest",
});

function outcome(our: number, opp: number): "W" | "D" | "L" {
  if (our > opp) return "W";
  if (our < opp) return "L";
  return "D";
}

export default function Rezultate() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("match_results")
        .select(
          "id, our_score, opponent_score, recap_md, event:schedule_events!event_id(title, starts_at, location, opponent)"
        )
        .order("created_at", { ascending: false })
        .limit(40);
      if (cancelled) return;
      const rows = (data as ResultRow[] | null) ?? [];
      const fallback = rows.length === 0;
      setUsingFallback(fallback);
      setResults(fallback ? FALLBACK : rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const wins = results.filter(r => r.our_score > r.opponent_score).length;
  const draws = results.filter(r => r.our_score === r.opponent_score).length;
  const losses = results.filter(r => r.our_score < r.opponent_score).length;

  return (
    <PublicShell
      pageKicker="Rezultate"
      pageTitle="Meciuri & scoruri"
      pageDescription="Cele mai recente rezultate ale grupelor școlii — campionat, turnee, amicale."
    >
      {usingFallback && <DemoBanner />}

      {/* Win/draw/loss strip */}
      <div className="mb-8 grid grid-cols-3 gap-3 sm:gap-5">
        {[
          { label: "Victorii", value: wins, accent: "text-brand-cyan" },
          { label: "Egaluri", value: draws, accent: "text-white/85" },
          { label: "Înfrângeri", value: losses, accent: "text-rose-300/85" },
        ].map(s => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/55 p-4 text-center sm:p-5"
          >
            <div
              className={`font-heading text-3xl font-bold tabular-nums sm:text-4xl ${s.accent}`}
            >
              {s.value}
            </div>
            <div className="mt-1 font-heading text-[10px] uppercase tracking-[0.18em] text-white/45">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="grid place-items-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
        </div>
      )}

      <div className="grid gap-3 sm:gap-4">
        {results.map((r, i) => {
          const date = r.event?.starts_at
            ? dateFormatter.format(new Date(r.event.starts_at))
            : "—";
          const result = outcome(r.our_score, r.opponent_score);
          const resultColor =
            result === "W"
              ? "text-brand-cyan"
              : result === "D"
                ? "text-white/70"
                : "text-rose-300/85";
          return (
            <motion.article
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.04, ease: expoOut }}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/55 p-4 transition-colors hover:border-brand-cyan/40 sm:p-5"
            >
              <span
                className={`grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] font-heading text-sm font-bold tabular-nums ${resultColor}`}
                aria-label={
                  result === "W"
                    ? "Victorie"
                    : result === "D"
                      ? "Egal"
                      : "Înfrângere"
                }
              >
                {result}
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-heading text-base font-semibold uppercase tracking-[0.04em] text-white sm:text-lg">
                  {r.event?.title ?? "Meci"}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[12px] text-white/55">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-brand-cyan/70" />
                    {date}
                  </span>
                  {r.event?.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-brand-cyan/70" />
                      {r.event.location}
                    </span>
                  )}
                </div>
                {r.recap_md && (
                  <p className="mt-2 line-clamp-1 font-body text-sm text-white/65">
                    {r.recap_md}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 font-heading tabular-nums">
                <span className="text-2xl font-bold text-white sm:text-3xl">
                  {r.our_score}
                </span>
                <span className="text-white/20">·</span>
                <span className="text-2xl font-bold text-white/55 sm:text-3xl">
                  {r.opponent_score}
                </span>
                <Trophy
                  className={`ml-1 size-4 ${result === "W" ? "text-brand-gold" : "text-white/15"}`}
                />
              </div>
            </motion.article>
          );
        })}
      </div>
    </PublicShell>
  );
}
