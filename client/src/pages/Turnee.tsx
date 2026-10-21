/**
 * /turnee — Public list of tournament events. Pulls from
 * fotbal.schedule_events where kind='tournament', joining trainers
 * to label the group. Future events first, then past.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Trophy, Users } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import LoadErrorState from "@/components/LoadErrorState";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { startPublicLoad } from "@/lib/public-load";
import { expoOut } from "@/lib/motion";

interface PublicTournamentRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  trainer_id: string | null;
  age_min: number | null;
  age_max: number | null;
  trainer_name: string | null;
}

interface TournamentRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  trainer: { id?: string; age_min: number; age_max: number; profile: { full_name: string } | null } | null;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Bucharest",
});

export default function Turnee() {
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadFailed(true);
      setLoading(false);
      return;
    }
    return startPublicLoad<TournamentRow>(
      async () => {
        // Visitors can't read schedule_events directly (RLS);
        // public_tournaments (migration 0035) returns the display fields.
        const { data, error } = await supabase.rpc("public_tournaments");
        const rows = ((data ?? []) as PublicTournamentRow[]).map((r) => ({
          id: r.id,
          title: r.title,
          starts_at: r.starts_at,
          ends_at: r.ends_at,
          location: r.location,
          notes: r.notes,
          trainer: r.trainer_id
            ? {
                id: r.trainer_id,
                age_min: r.age_min ?? 0,
                age_max: r.age_max ?? 0,
                profile: r.trainer_name ? { full_name: r.trainer_name } : null,
              }
            : null,
        }));
        return { data: rows, error };
      },
      (state) => {
        if (state.status === "loading") return;
        setLoadFailed(state.status === "failed");
        if (state.status === "ready") setRows(state.rows);
        setLoading(false);
      }
    );
  }, []);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const upc: TournamentRow[] = [];
    const old: TournamentRow[] = [];
    for (const r of rows) {
      if (new Date(r.starts_at).getTime() >= now) upc.push(r);
      else old.push(r);
    }
    upc.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    return { upcoming: upc, past: old };
  }, [rows]);

  return (
    <PublicShell
      pageKicker="Competiții"
      pageTitle="Turnee & evenimente"
      pageDescription="Turneele la care participă grupele academiei. Calendar complet, locație și grupa implicată."
    >
      {!loading && loadFailed && <LoadErrorState what="turneele" />}

      {loading && (
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && !loadFailed && upcoming.length === 0 && past.length === 0 && (
        <EmptyState
          icon={<Trophy className="size-6" />}
          title="Niciun turneu programat"
          description="Calendarul de turnee va apărea aici imediat ce sunt anunțate competițiile."
          tone="gold"
        />
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.22em] text-brand-cyan">
            Următoarele turnee
          </h2>
          <div className="mt-4 grid gap-3 sm:gap-4 lg:grid-cols-2">
            {upcoming.map((t, i) => (
              <TournamentCard key={t.id} t={t} delay={i * 0.05} highlight />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-12">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.22em] text-white/55">
            Trecute
          </h2>
          <div className="mt-4 grid gap-3 sm:gap-4 lg:grid-cols-2">
            {past.map((t, i) => (
              <TournamentCard key={t.id} t={t} delay={i * 0.04} />
            ))}
          </div>
        </section>
      )}
    </PublicShell>
  );
}

interface TournamentCardProps {
  t: TournamentRow;
  delay: number;
  highlight?: boolean;
}

function TournamentCard({ t, delay, highlight = false }: TournamentCardProps) {
  const start = dateFormatter.format(new Date(t.starts_at));
  const end = t.ends_at ? dateFormatter.format(new Date(t.ends_at)) : null;
  const range = end && end !== start ? `${start} → ${end}` : start;
  const groupLabel = t.trainer
    ? `U${t.trainer.age_min}–U${t.trainer.age_max} · ${t.trainer.profile?.full_name ?? ""}`
    : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: expoOut }}
      className={`relative overflow-hidden rounded-3xl border p-6 sm:p-7 ${
        highlight
          ? "border-brand-cyan/30 bg-brand-cyan/[0.06]"
          : "border-white/8 bg-[oklch(0.13_0.03_250)]/40"
      }`}
    >
      <header className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-2xl border border-brand-gold/30 bg-brand-gold/10 text-brand-gold">
          <Trophy className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-semibold uppercase tracking-[0.04em] text-white sm:text-xl">
            {t.title}
          </h3>
          {groupLabel && (
            <p className="mt-0.5 inline-flex items-center gap-1.5 font-heading text-[11px] uppercase tracking-[0.18em] text-brand-cyan">
              <Users className="size-3" />
              {groupLabel}
            </p>
          )}
        </div>
      </header>

      {t.notes && (
        <p className="mt-3 font-body text-sm leading-relaxed text-white/65">
          {t.notes}
        </p>
      )}

      <dl className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="size-3.5 text-brand-cyan/70" />
          {range}
        </span>
        {t.location && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5 text-brand-cyan/70" />
            {t.location}
          </span>
        )}
      </dl>
    </motion.article>
  );
}
