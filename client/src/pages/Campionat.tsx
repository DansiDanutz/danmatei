/**
 * /campionat — Championship view. Lists each active group (trainer)
 * with their match history and an aggregate W-D-L. Per-group results
 *
 * Reads:
 *   - fotbal.trainers (with profile name) for each group
 *   - public_championship (migration 0038): every approved match with its
 *     score; visitors can't read schedule_events / match_results (RLS)
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Trophy, ListOrdered, MapPin } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import DemoBanner from "@/components/DemoBanner";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchTrainerNames } from "@/lib/trainer-names";
import { startPublicLoad } from "@/lib/public-load";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import {
  buildChampionshipGroups,
  type ChampionshipRow,
  type GroupBlock,
  type GroupSeed,
  type MatchRow,
} from "@/lib/championship";
import LoadErrorState from "@/components/LoadErrorState";
import { TRAINERS } from "@/data/landing";
import { expoOut } from "@/lib/motion";

type ChampionshipData = { groups: GroupBlock[]; fallback: boolean };

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
  const [loadFailed, setLoadFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadFailed(true);
      setLoading(false);
      return;
    }
    return startPublicLoad<ChampionshipData>(
      async () => {
        const [trainersRes, matchesRes, trainerNames] = await Promise.all([
          supabase
            .from("trainers")
            .select("id, age_min, age_max, profile:profiles!trainers_profile_id_fkey(full_name)")
            .eq("active", true)
            .order("display_order", { ascending: true }),
          // Visitors can't read schedule_events / match_results (RLS);
          // public_championship (migration 0038) returns every approved match
          // with its score. Page through it so totals use the full history.
          fetchAllPages<ChampionshipRow>((from, to) =>
            supabase.rpc("public_championship").range(from, to)
          ),
          fetchTrainerNames(),
        ]);
        const error = trainersRes.error ?? matchesRes.error;
        if (error) return { data: null, error };

        type DbTrainer = { id: string; age_min: number; age_max: number; profile: { full_name: string } | null };
        const trainerList: GroupSeed[] = ((trainersRes.data as DbTrainer[] | null) ?? []).map((t) => ({
          trainerId: t.id,
          trainerName: trainerNames.get(t.id) ?? t.profile?.full_name ?? "Antrenor",
          ageMin: t.age_min,
          ageMax: t.age_max,
        }));
        // No active trainers in the DB yet: list the static roster so the page
        // isn't blank (marked with the demo banner).
        const fallback = trainerList.length === 0;
        const seeds = fallback
          ? TRAINERS.map((t) => ({ trainerId: t.id, trainerName: t.name, ageMin: t.ageMin, ageMax: t.ageMax }))
          : trainerList;
        return {
          data: [{ groups: buildChampionshipGroups(seeds, matchesRes.data), fallback }],
          error: null,
        };
      },
      (state) => {
        if (state.status === "loading") return;
        setLoadFailed(state.status === "failed");
        if (state.status === "ready") {
          setGroups(state.rows[0]?.groups ?? []);
          setUsingFallback(state.rows[0]?.fallback ?? false);
        }
        setLoading(false);
      }
    );
  }, []);

  return (
    <PublicShell
      pageKicker="Campionat"
      pageTitle="Rezultate pe grupe"
      pageDescription="Câștigate, egaluri, pierdute. Toate meciurile oficiale ale grupelor academiei."
    >
      {usingFallback && <DemoBanner />}
      {!loading && loadFailed && <LoadErrorState what="rezultatele grupelor" />}

      {loading && (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
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
                  <ResultPip label="V" title="Victorii" value={g.w} tone="cyan" />
                  <ResultPip label="E" title="Egaluri" value={g.d} tone="muted" />
                  <ResultPip label="Î" title="Înfrângeri" value={g.l} tone="rose" />
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
                        <p className="font-body text-sm italic text-white/65">
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

      {groups.length === 0 && !loading && !loadFailed && (
        <EmptyState
          icon={<ListOrdered className="size-6" />}
          title="Nu sunt grupe active"
          description="Antrenorii vor fi listați aici imediat ce sunt creați în panou."
        />
      )}
    </PublicShell>
  );
}

interface ResultPipProps {
  label: string;
  title: string;
  value: number;
  tone: "cyan" | "muted" | "rose";
}

function ResultPip({ label, title, value, tone }: ResultPipProps) {
  const styles =
    tone === "cyan"
      ? "border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan"
      : tone === "rose"
        ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
        : "border-white/10 bg-white/5 text-white/60";
  return (
    <div title={title} className={`hidden cursor-help rounded-xl border px-2.5 py-1.5 sm:block ${styles}`}>
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
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/65">
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
