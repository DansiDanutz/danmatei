/**
 * /grupe — Public list of groups (one per trainer). Pulls trainers from
 * Supabase with their age range; falls back to TRAINERS static when the
 * table is empty.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Users as UsersIcon } from "lucide-react";
import { Link } from "wouter";
import PublicShell from "@/components/PublicShell";
import DemoBanner from "@/components/DemoBanner";
import { supabase } from "@/lib/supabase";
import { TRAINERS, type Trainer } from "@/data/landing";
import { expoOut } from "@/lib/motion";

interface DBTrainer {
  id: string;
  position: string | null;
  bio: string | null;
  age_min: number;
  age_max: number;
  certifications: string[] | null;
  active: boolean;
  display_order: number;
  profile: { full_name: string } | null;
}

interface GroupRow {
  id: string;
  name: string;
  position: string;
  ageMin: number;
  ageMax: number;
  bio: string;
  certifications: string[];
  childCount: number;
}

export default function Grupe() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [trainersRes, kidsRes] = await Promise.all([
        supabase
          .from("trainers")
          .select(
            "id, position, bio, age_min, age_max, certifications, active, display_order, profile:profiles!trainers_profile_id_fkey(full_name)",
          )
          .eq("active", true)
          .order("display_order", { ascending: true }),
        supabase.from("children").select("trainer_id").eq("status", "active"),
      ]);
      const trainers = trainersRes.data;
      const kids = kidsRes.data;

      const counts = new Map<string, number>();
      (kids ?? []).forEach((c: { trainer_id: string | null }) => {
        if (c.trainer_id) counts.set(c.trainer_id, (counts.get(c.trainer_id) ?? 0) + 1);
      });

      if (cancelled) return;
      const rows: GroupRow[] = (trainers as DBTrainer[] | null ?? []).map((t) => ({
        id: t.id,
        name: t.profile?.full_name ?? "Antrenor",
        position: t.position ?? `Antrenor U${t.age_min}–U${t.age_max}`,
        ageMin: t.age_min,
        ageMax: t.age_max,
        bio: t.bio ?? "",
        certifications: t.certifications ?? [],
        childCount: counts.get(t.id) ?? 0,
      }));
      const fallback = rows.length === 0;
      setUsingFallback(fallback);
      if (fallback) {
        setGroups(
          TRAINERS.map((t: Trainer) => ({
            id: t.id,
            name: t.name,
            position: t.position,
            ageMin: t.ageMin,
            ageMax: t.ageMax,
            bio: t.bio,
            certifications: t.certifications,
            childCount: 0,
          })),
        );
      } else {
        setGroups(rows);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PublicShell
      pageKicker="Grupe pe vârste"
      pageTitle="Grupe & antrenori"
      pageDescription="Fiecare antrenor coordonează una sau două grupe, pe vârste apropiate. La înscriere, copilul este repartizat automat în funcție de data nașterii."
    >
      {usingFallback && <DemoBanner />}

      {loading && (
        <div className="grid place-items-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {groups.map((g, i) => (
          <motion.article
            key={g.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: expoOut }}
            className="group relative overflow-hidden rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/60 p-6 transition-colors hover:border-brand-cyan/30 sm:p-8"
          >
            <span className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-brand-cyan/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="font-heading text-[10px] uppercase tracking-[0.22em] text-brand-cyan">
                  {g.position}
                </span>
                <h2 className="mt-2 font-heading text-2xl font-bold uppercase tracking-[0.02em] text-white sm:text-3xl">
                  {g.name}
                </h2>
              </div>
              <span className="grid size-14 place-items-center rounded-2xl border border-brand-cyan/30 bg-brand-cyan/10 font-heading text-base font-bold tracking-wider text-brand-cyan">
                U{g.ageMin}–U{g.ageMax}
              </span>
            </header>

            {g.bio && (
              <p className="mt-4 font-body text-sm leading-relaxed text-white/65 line-clamp-3">
                {g.bio}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {g.certifications.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2.5 py-1 font-heading text-[10px] uppercase tracking-[0.16em] text-brand-gold"
                >
                  {c}
                </span>
              ))}
            </div>

            <footer className="mt-5 flex items-center justify-between border-t border-white/5 pt-5">
              <div className="flex items-center gap-4 text-xs text-white/55">
                <span className="inline-flex items-center gap-1.5">
                  <UsersIcon className="size-3.5 text-brand-cyan/70" />
                  {g.childCount} copii
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-brand-cyan/70" />
                  Orar flexibil
                </span>
              </div>
              <Link
                href={`/campionat?grupa=${g.id}`}
                className="inline-flex items-center gap-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-brand-cyan transition-colors hover:text-white"
              >
                Rezultate
                <ArrowRight className="size-3.5" />
              </Link>
            </footer>
          </motion.article>
        ))}
      </div>
    </PublicShell>
  );
}
