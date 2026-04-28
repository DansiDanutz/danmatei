/**
 * /turnee — Public list of tournament events. Pulls from
 * fotbal.schedule_events where kind='tournament', joining trainers
 * to label the group. Future events first, then past.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Trophy, Users } from "lucide-react";
import PublicShell from "@/components/PublicShell";
import { supabase } from "@/lib/supabase";
import { expoOut } from "@/lib/motion";

interface TournamentRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  trainer: { age_min: number; age_max: number; profile: { full_name: string } | null } | null;
}

const FALLBACK: TournamentRow[] = [
  {
    id: "demo-1",
    title: "Cupa Transilvaniei",
    starts_at: "2026-05-15T09:00:00Z",
    ends_at: "2026-05-17T18:00:00Z",
    location: "Cluj-Arena, Cluj-Napoca",
    notes: "Turneu inter-academii, 16 echipe, 3 zile.",
    trainer: {
      age_min: 12,
      age_max: 13,
      profile: { full_name: "Cristian Ilea" },
    },
  },
  {
    id: "demo-2",
    title: "Memorialul „Dan Matei” — U10",
    starts_at: "2026-06-08T10:00:00Z",
    ends_at: "2026-06-08T17:00:00Z",
    location: "Baza Sportivă Mănăștur",
    notes: "Tradiția anului. 8 echipe locale invitate.",
    trainer: {
      age_min: 10,
      age_max: 11,
      profile: { full_name: "Radu Mureșan" },
    },
  },
];

const dateFormatter = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function Turnee() {
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("schedule_events")
        .select(
          "id, title, starts_at, ends_at, location, notes, trainer:trainers!schedule_events_trainer_id_fkey(age_min, age_max, profile:profiles!trainers_profile_id_fkey(full_name))",
        )
        .eq("kind", "tournament")
        .order("starts_at", { ascending: false });
      if (cancelled) return;
      const items = (data as unknown as TournamentRow[] | null) ?? [];
      setRows(items.length === 0 ? FALLBACK : items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
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
      {loading && (
        <div className="grid place-items-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
        </div>
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
