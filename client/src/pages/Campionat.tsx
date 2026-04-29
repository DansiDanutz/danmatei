/**
 * /campionat — Championship view. Lists each active group (trainer)
 * with their match history and an aggregate W-D-L. Per-group results
 * unfold inline via a compact accordion.
 *
 * Reads:
 *   - fotbal.trainers (with profile name) for each group
 *   - fotbal.schedule_events (kind='match') joined with match_results
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Trophy, ListOrdered, MapPin } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import DemoBanner from "@/components/DemoBanner";
import { supabase } from "@/lib/supabase";
import { TRAINERS } from "@/data/landing";
import { expoOut } from "@/lib/motion";

interface MatchRow {
  event_id: string;
  title: string;
  starts_at: string;
  location: string | null;
  opponent: string | null;
  our_score: number | null;
  opponent_score: number | null;
  recap_md: string | null;
}

interface GroupBlock {
  trainerId: string;
  trainerName: string;
  ageMin: number;
  ageMax: number;
  matches: MatchRow[];
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Bucharest",
});

export default function Campionat() {
  const [groups, setGroups] = useState<GroupBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [trainersRes, eventsRes] = await Promise.all([
        supabase
          .from("trainers")
          .select(
            "id, age_min, age_max, profile:profiles!trainers_profile_id_fkey(full_name)",
          )
          .eq("active", true)
          .order("display_order", { ascending: true }),
        supabase
          .from("schedule_events")
          .select(
            "id, trainer_id, title, starts_at, location, opponent, kind, results:match_results!match_results_event_id_fkey(our_score, opponent_score, recap_md)",
          )
          .eq("kind", "match")
          .order("starts_at", { ascending: false }),
      ]);
      const trainers = trainersRes.data;
      const events = eventsRes.data;

      if (cancelled) return;

      type DbTrainer = { id: string; age_min: number; age_max: number; profile: { full_name: string } | null };
      type DbEvent = {
        id: string;
        trainer_id: string;
        title: string;
        starts_at: string;
        location: string | null;
        opponent: string | null;
        results: { our_score: number; opponent_score: number; recap_md: string | null }[] | null;
      };

      const trainerList = ((trainers as DbTrainer[] | null) ?? []).map((t) => ({
        trainerId: t.id,
        trainerName: t.profile?.full_name ?? "Antrenor",
        ageMin: t.age_min,
        ageMax: t.age_max,
      }));

      // Fallback to static TRAINERS when DB is empty so the page is never blank.
      const fallback = trainerList.length === 0;
      setUsingFallback(fallback);
      const seeds = fallback
        ? TRAINERS.map((t) => ({
            trainerId: t.id,
            trainerName: t.name,
            ageMin: t.ageMin,
            ageMax: t.ageMax,
          }))
        : trainerList;

      const blocks: GroupBlock[] = seeds.map((s) => {
        const ms: MatchRow[] = ((events as DbEvent[] | null) ?? [])
          .filter((e) => e.trainer_id === s.trainerId)
          .map((e) => {
            const r = e.results?.[0];
            return {
              event_id: e.id,
              title: e.title,
              starts_at: e.starts_at,
              location: e.location,
              opponent: e.opponent,
              our_score: r?.our_score ?? null,
              opponent_score: r?.opponent_score ?? null,
              recap_md: r?.recap_md ?? null,
            };
          });
        let w = 0;
        let d = 0;
        let l = 0;
        let gf = 0;
        let ga = 0;
        for (const m of ms) {
          if (m.our_score == null || m.opponent_score == null) continue;
          gf += m.our_score;
          ga += m.opponent_score;
          if (m.our_score > m.opponent_score) w++;
          else if (m.our_score === m.opponent_score) d++;
          else l++;
        }
        return { ...s, matches: ms, w, d, l, gf, ga };
      });

      setGroups(blocks);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PublicShell
      pageKicker="Campionat"
      pageTitle="Rezultate pe grupe"
      pageDescription="Câștigate, egaluri, pierdute. Toate meciurile oficiale ale grupelor academiei."
    >
      {usingFallback && <DemoBanner />}

      {loading && (
        <div className="grid place-items-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
        </div>
      )}

      <div className="space-y-3">
        {groups.map((g, i) => {
          const open = openId === g.trainerId;
          return (
            <motion.article
              key={g.trainerId}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.04, ease: expoOut }}
              className="overflow-hidden rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/50"
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : g.trainerId)}
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-white/[0.02] sm:px-7"
                aria-expanded={open}
              >
                <div className="flex items-center gap-4">
                  <span className="grid size-12 place-items-center rounded-2xl border border-brand-cyan/30 bg-brand-cyan/10 font-heading text-sm font-bold tracking-wider text-brand-cyan">
                    U{g.ageMin}–U{g.ageMax}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-heading text-lg font-bold uppercase tracking-[0.04em] text-white sm:text-xl">
                      {g.trainerName}
                    </h2>
                    <p className="mt-0.5 font-body text-xs text-white/55">
                      {g.matches.length} meciuri · GF {g.gf} · GA {g.ga}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-5">
                  <ResultPip label="V" value={g.w} tone="cyan" />
                  <ResultPip label="E" value={g.d} tone="muted" />
                  <ResultPip label="Î" value={g.l} tone="rose" />
                  <ChevronDown
                    className={`size-5 shrink-0 text-white/45 transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: expoOut }}
                    className="border-t border-white/5"
                  >
                    <div className="px-5 py-5 sm:px-7">
                      {g.matches.length === 0 ? (
                        <p className="font-body text-sm italic text-white/45">
                          Nu există meciuri înregistrate încă.
                        </p>
                      ) : (
                        <ul className="space-y-3">
                          {g.matches.map((m) => (
                            <MatchListItem key={m.event_id} m={m} />
                          ))}
                        </ul>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </div>

      {groups.length === 0 && !loading && (
        <div className="grid place-items-center rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/40 py-16 text-center">
          <Trophy className="size-9 text-brand-gold" />
          <p className="mt-3 font-heading text-lg uppercase tracking-wider text-white">
            Nu sunt grupe active
          </p>
          <p className="mt-1 font-body text-sm text-white/55">
            Antrenorii vor fi listați aici imediat ce sunt creați în panou.
          </p>
        </div>
      )}
    </PublicShell>
  );
}

interface ResultPipProps {
  label: string;
  value: number;
  tone: "cyan" | "muted" | "rose";
}

function ResultPip({ label, value, tone }: ResultPipProps) {
  const styles =
    tone === "cyan"
      ? "border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan"
      : tone === "rose"
        ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
        : "border-white/10 bg-white/5 text-white/60";
  return (
    <div className={`hidden rounded-xl border px-2.5 py-1.5 sm:block ${styles}`}>
      <span className="font-heading text-[10px] uppercase tracking-[0.18em] opacity-70">
        {label}
      </span>
      <span className="ml-2 font-heading text-sm font-bold tabular-nums">{value}</span>
    </div>
  );
}

interface MatchListItemProps {
  m: MatchRow;
}

function MatchListItem({ m }: MatchListItemProps) {
  const date = dateFormatter.format(new Date(m.starts_at));
  const hasResult = m.our_score != null && m.opponent_score != null;
  const win = hasResult && m.our_score! > m.opponent_score!;
  const draw = hasResult && m.our_score === m.opponent_score;
  return (
    <li className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-[10px] uppercase tracking-[0.18em] text-white/45">
            {date}
            {m.opponent ? ` · vs ${m.opponent}` : ""}
          </p>
          <p className="mt-1 font-heading text-sm font-semibold text-white">
            {m.title}
          </p>
          {m.location && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/45">
              <MapPin className="size-3" />
              {m.location}
            </p>
          )}
        </div>
        {hasResult ? (
          <span
            className={`shrink-0 rounded-xl px-3 py-1.5 font-heading text-base font-bold tabular-nums ${
              win
                ? "bg-brand-cyan/15 text-brand-cyan"
                : draw
                  ? "bg-white/10 text-white/80"
                  : "bg-rose-400/10 text-rose-300"
            }`}
          >
            {m.our_score}–{m.opponent_score}
          </span>
        ) : (
          <span className="shrink-0 rounded-xl border border-white/10 px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.18em] text-white/45">
            <ListOrdered className="mr-1 inline size-3" />
            Programat
          </span>
        )}
      </div>
      {m.recap_md && (
        <p className="mt-3 font-body text-xs leading-relaxed text-white/55">
          {m.recap_md}
        </p>
      )}
    </li>
  );
}
