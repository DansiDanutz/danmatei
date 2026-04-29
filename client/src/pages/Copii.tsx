/**
 * /copii — Children directory.
 *
 *  - Logged-out visitors see a public preview of the academy's roster,
 *    grouped by U-code, drawn from the static `AGE_GROUPS` data.
 *  - Logged-in parents see THEIR own children (`fotbal.children` filtered
 *    by parent_id via RLS) with a CTA to add another child.
 *  - Trainers and the owner see all active children in their scope.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Cake, ShieldCheck, UserPlus } from "lucide-react";
import { Link } from "wouter";
import PublicShell from "@/components/PublicShell";
import { supabase } from "@/lib/supabase";
import { AGE_GROUPS } from "@/data/landing";
import { useAuth } from "@/lib/auth";
import { expoOut } from "@/lib/motion";

interface ChildRow {
  id: string;
  full_name: string;
  dob: string;
  gender: string | null;
  age_group_label: string | null;
  status: "active" | "paused" | "left";
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Bucharest",
});

function ageInYears(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

export default function Copii() {
  const { user, profile, loading } = useAuth();
  const [rows, setRows] = useState<ChildRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadingRows(true);
    void (async () => {
      const { data } = await supabase
        .from("children")
        .select("id, full_name, dob, gender, age_group_label, status")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setRows((data as ChildRow[] | null) ?? []);
      setLoadingRows(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const totalRoster = useMemo(
    () => AGE_GROUPS.reduce((sum, g) => sum + (g.players?.length ?? 0), 0),
    []
  );

  // ── Public preview (logged-out) ────────────────────────────────────────
  if (!loading && !user) {
    return (
      <PublicShell
        pageKicker="Copii"
        pageTitle="Familia academiei"
        pageDescription={`${totalRoster} copii din ${AGE_GROUPS.length} grupe — viitorul fotbalului clujean începe aici.`}
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-cyan/25 bg-brand-cyan/[0.05] p-4 sm:p-5">
          <p className="font-body text-sm text-white/75">
            Părinte? Conectează-te ca să vezi profilul copilului tău, programul
            și mesajele de la antrenor.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-5 py-2.5 font-heading text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-transform hover:-translate-y-0.5"
          >
            Intră în cont
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid gap-5">
          {AGE_GROUPS.map((g, gi) => (
            <motion.section
              key={g.code}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: gi * 0.05, ease: expoOut }}
              className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/50 p-5 sm:p-6"
            >
              <header className="mb-4 flex items-baseline justify-between gap-3">
                <div>
                  <span className="font-heading text-3xl font-bold tabular-nums tracking-tight text-brand-cyan sm:text-4xl">
                    {g.code}
                  </span>
                  <span className="ml-3 font-heading text-[11px] uppercase tracking-[0.22em] text-white/45">
                    {g.label}
                  </span>
                </div>
                <span className="font-heading text-[10px] uppercase tracking-[0.18em] text-white/45">
                  {g.childCount} copii
                </span>
              </header>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(g.players ?? []).map(p => {
                  const initials = p.name
                    .split(" ")
                    .map(part => part[0])
                    .slice(0, 2)
                    .join("");
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-cyan/15 font-heading text-xs font-bold text-brand-cyan">
                        {initials}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-heading text-sm font-semibold uppercase tracking-[0.04em] text-white/90">
                          {p.name}
                        </div>
                        <div className="truncate font-heading text-[10px] uppercase tracking-[0.14em] text-white/50">
                          {p.position}
                          <span className="mx-1.5 text-white/25">·</span>
                          <span className="tabular-nums text-white/70">
                            {p.yearOfBirth}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          ))}
        </div>
      </PublicShell>
    );
  }

  // ── Authenticated view ─────────────────────────────────────────────────
  const role = profile?.role ?? "parent";
  const heading =
    role === "parent"
      ? "Copiii tăi"
      : role === "trainer"
        ? "Grupa ta"
        : "Toți copiii";
  const description =
    role === "parent"
      ? "Profil, prezență, evoluție — totul într-un singur loc."
      : role === "trainer"
        ? "Roster activ pentru grupa pe care o coordonezi."
        : "Toți copiii activi din academie.";

  return (
    <PublicShell
      pageKicker="Copii"
      pageTitle={heading}
      pageDescription={description}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-white/65">
          <ShieldCheck className="size-3.5 text-brand-cyan/70" />
          {rows.length} {rows.length === 1 ? "copil" : "copii"}
        </span>
        {role === "parent" && (
          <Link
            href="/inregistrare/copil"
            className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-5 py-2.5 font-heading text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-transform hover:-translate-y-0.5"
          >
            <UserPlus className="size-3.5" />
            Adaugă copil
          </Link>
        )}
      </div>

      {loadingRows && (
        <div className="grid place-items-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
        </div>
      )}

      {!loadingRows && rows.length === 0 && (
        <div className="rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/50 p-8 text-center">
          <p className="font-body text-sm text-white/65">
            Nu există copii înregistrați în contul tău încă.
          </p>
          <Link
            href="/inregistrare/copil"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-cyan px-5 py-2.5 font-heading text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)]"
          >
            <UserPlus className="size-3.5" />
            Adaugă primul copil
          </Link>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((c, i) => {
          const initials = c.full_name
            .split(" ")
            .map(p => p[0])
            .slice(0, 2)
            .join("");
          return (
            <motion.article
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.04, ease: expoOut }}
              className="group relative flex flex-col gap-3 rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/55 p-5 transition-colors hover:border-brand-cyan/40"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full border border-brand-cyan/30 bg-brand-cyan/10 font-heading text-base font-bold text-brand-cyan">
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-heading text-base font-semibold uppercase tracking-[0.04em] text-white">
                    {c.full_name}
                  </h3>
                  <p className="font-heading text-[10px] uppercase tracking-[0.18em] text-brand-cyan/85">
                    {c.age_group_label ?? "Fără grupă"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 font-body text-[12px] text-white/60">
                <span className="inline-flex items-center gap-1.5">
                  <Cake className="size-3.5 text-brand-cyan/70" />
                  {dateFormatter.format(new Date(c.dob))}
                  <span className="text-white/30">·</span>
                  {ageInYears(c.dob)} ani
                </span>
              </div>
              <Link
                href={`/copil/${c.id}`}
                className="mt-2 inline-flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 font-heading text-[11px] uppercase tracking-[0.16em] text-white/70 transition-colors hover:border-brand-cyan/40 hover:text-white"
              >
                Profil complet
                <ArrowRight className="size-3.5" />
              </Link>
            </motion.article>
          );
        })}
      </div>
    </PublicShell>
  );
}
