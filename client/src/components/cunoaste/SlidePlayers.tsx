/**
 * SlidePlayers — third slide. Bento grid of the academy's age groups.
 *
 * Fully DYNAMIC: groups come from the owner's real configuration in
 * Admin → Grupe (the `fotbal.groups` table) via the public `/api/groups`
 * endpoint, so the public site always shows exactly the groups that exist.
 *
 * Each card is built from data EVERY group has (code, age range, head-count,
 * trainer, live roster) so cards stay uniform whether or not a group has
 * matching editorial copy — a custom code like U17 looks just as intentional
 * as U9. A group with no children yet shows a positive "înscrieri deschise"
 * state instead of an empty hole.
 *
 * When the API is unreachable (local dev server, missing env) we fall back to
 * the static `AGE_GROUPS` set so the page is never empty.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Users } from "lucide-react";
import { Link } from "wouter";
import { AGE_GROUPS, TRAINERS, type AgeGroup } from "@/data/landing";
import SlideShell from "./SlideShell";

const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];
const ROSTER_PREVIEW = 4;

// Editorial copy library, keyed by group code (U7, U9, …). Used only to give a
// live group a nicer one-line description + age label when its code matches.
const EDITORIAL: Record<string, AgeGroup> = Object.fromEntries(
  AGE_GROUPS.map((g) => [g.code, g])
);

const trainerById = Object.fromEntries(TRAINERS.map((t) => [t.id, t]));

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Normalize a DB label ("u 9", "U9 ") to a code ("U9") for editorial lookup. */
function normCode(label: string): string {
  return label.trim().toUpperCase().replace(/\s+/g, "");
}

type DisplayGroup = {
  key: string;
  code: string; // big card number, e.g. "U9"
  subtitle: string; // age range line, e.g. "U8 – U9" or "Născuți 2018–2019"
  description: string;
  players: { id: string; name: string; yearOfBirth: number }[];
  childCount: number;
  trainers: { initials: string; name: string }[];
};

type ApiGroup = {
  id: string;
  label: string;
  birthYearMin: number;
  birthYearMax: number;
  trainerName: string | null;
  childCount: number;
  players: { id: string; name: string; yearOfBirth: number }[];
};

function trainersFromEditorial(ed?: AgeGroup) {
  if (!ed) return [];
  return ed.trainerIds
    .map((id) => trainerById[id])
    .filter(Boolean)
    .map((t) => ({ initials: t.initials, name: t.name }));
}

function fromApi(g: ApiGroup): DisplayGroup {
  const code = normCode(g.label);
  const ed = EDITORIAL[code];
  return {
    key: g.id,
    code,
    subtitle: ed?.label ?? `Născuți ${g.birthYearMin}–${g.birthYearMax}`,
    description:
      ed?.description ??
      `Antrenamente pe vârstă pentru copii născuți între ${g.birthYearMin} și ${g.birthYearMax}.`,
    // Real, live roster from the DB (first name + last initial).
    players: g.players ?? [],
    childCount: g.childCount ?? 0,
    trainers: g.trainerName
      ? [{ initials: initialsOf(g.trainerName), name: g.trainerName }]
      : trainersFromEditorial(ed),
  };
}

function fromStatic(g: AgeGroup): DisplayGroup {
  return {
    key: g.code,
    code: g.code,
    subtitle: g.label,
    description: g.description,
    players: (g.players ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      yearOfBirth: p.yearOfBirth,
    })),
    childCount: g.childCount ?? 0,
    trainers: trainersFromEditorial(g),
  };
}

// Module-level cache so the two SlidePlayers instances (mobile single-slide +
// hidden desktop deck) and repeat visits share a single network call.
let groupsCache: Promise<DisplayGroup[]> | null = null;

function loadGroups(): Promise<DisplayGroup[]> {
  if (groupsCache) return groupsCache;
  groupsCache = (async () => {
    try {
      const res = await fetch("/api/groups", {
        headers: { accept: "application/json" },
      });
      // In local dev there is no serverless runtime — the dev server answers
      // /api/* with the SPA's index.html. Guard against that so we fall back.
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || !ct.includes("application/json")) {
        throw new Error(`groups api ${res.status}`);
      }
      const data = (await res.json()) as { groups?: ApiGroup[] };
      const list = Array.isArray(data.groups) ? data.groups : [];
      if (list.length === 0) throw new Error("no groups");
      return list.map(fromApi);
    } catch {
      // Resilient fallback — keep the marketing page populated.
      return AGE_GROUPS.map(fromStatic);
    }
  })();
  return groupsCache;
}

// Per-group accent — every group stays in the academy's blue family. Variation
// is a hue shift WITHIN the blue/cyan spectrum; a single warm gold spark is
// reserved for the youngest group.
const GROUP_THEMES: Record<
  string,
  { glow: string; accent: string; chip: string; spark?: string }
> = {
  U7: {
    glow: "radial-gradient(120% 100% at 0% 0%, oklch(0.40 0.16 210 / 0.5), transparent 60%)",
    accent: "oklch(0.82 0.16 210)",
    chip: "from-[oklch(0.34_0.14_210)]/45 to-[oklch(0.18_0.06_240)]/45",
    spark: "oklch(0.85 0.16 90)",
  },
  U9: {
    glow: "radial-gradient(120% 100% at 100% 0%, oklch(0.40 0.14 220 / 0.5), transparent 60%)",
    accent: "oklch(0.80 0.16 220)",
    chip: "from-[oklch(0.32_0.13_220)]/45 to-[oklch(0.18_0.06_240)]/45",
  },
  U11: {
    glow: "radial-gradient(120% 100% at 0% 100%, oklch(0.42 0.16 235 / 0.5), transparent 60%)",
    accent: "oklch(0.78 0.16 235)",
    chip: "from-[oklch(0.32_0.14_235)]/45 to-[oklch(0.18_0.07_245)]/45",
  },
  U13: {
    glow: "radial-gradient(120% 100% at 100% 100%, oklch(0.40 0.14 250 / 0.5), transparent 60%)",
    accent: "oklch(0.74 0.15 250)",
    chip: "from-[oklch(0.30_0.13_250)]/45 to-[oklch(0.18_0.07_255)]/45",
  },
  U15: {
    glow: "radial-gradient(120% 100% at 50% 0%, oklch(0.36 0.13 260 / 0.5), transparent 60%)",
    accent: "oklch(0.70 0.15 260)",
    chip: "from-[oklch(0.28_0.12_260)]/45 to-[oklch(0.16_0.07_265)]/45",
  },
};

// Unknown / custom codes (e.g. U17) get the deepest navy theme — fits older,
// more advanced groups better than the youngest group's bright/gold accent.
const FALLBACK_THEME = GROUP_THEMES.U15;

// Tailwind-safe literal column classes so the desktop row width tracks the real
// group count instead of a hardcoded 5 (dynamic class strings would be purged).
const LG_COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

function GroupCard({ g, i }: { g: DisplayGroup; i: number }) {
  const theme = GROUP_THEMES[g.code] ?? FALLBACK_THEME;
  const preview = g.players.slice(0, ROSTER_PREVIEW);
  const more = Math.max(0, g.childCount - preview.length);
  const trainer = g.trainers[0];

  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.97, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 + i * 0.07, ease: expoOut }}
      className="relative"
    >
      {/* Animated cyan rim — same language as Owner + Trainer cards */}
      <span
        aria-hidden="true"
        className="card-rim-glow pointer-events-none absolute -inset-[3px] rounded-[calc(1.5rem+3px)] opacity-70"
        style={{ animationDelay: `${i * -1.2}s` }}
      />

      <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/85 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-cyan/40 hover:shadow-[0_24px_60px_-22px_oklch(0.75_0.12_230/0.4)] sm:p-6">
        {/* Themed glow + faint pitch lines */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: theme.glow }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {theme.spark && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -top-6 size-32 rounded-full opacity-30 blur-2xl"
            style={{ backgroundColor: theme.spark }}
          />
        )}

        {/* Header: code + age range */}
        <div className="relative flex items-start justify-between gap-3">
          <span
            className="font-heading text-5xl font-bold leading-none tabular-nums tracking-tight sm:text-6xl"
            style={{ color: theme.accent }}
          >
            {g.code}
          </span>
          <div className="flex flex-col items-end gap-1.5 pt-1">
            <span className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
              {g.subtitle}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-heading text-[10px] uppercase tracking-[0.14em] text-white/70">
              <Users className="size-3" style={{ color: theme.accent }} />
              {g.childCount} {g.childCount === 1 ? "copil" : "copii"}
            </span>
          </div>
        </div>

        {/* Trainer */}
        {trainer && (
          <div className="relative mt-4 flex items-center gap-2">
            <span
              title={trainer.name}
              className={`grid size-7 place-items-center rounded-full border border-white/10 bg-gradient-to-br ${theme.chip} font-heading text-[10px] font-bold text-white/90`}
            >
              {trainer.initials}
            </span>
            <span className="font-heading text-[11px] uppercase tracking-[0.14em] text-white/55">
              {trainer.name}
            </span>
          </div>
        )}

        {/* Description — clamped to 2 lines so every card stays the same shape */}
        <p className="relative mt-3 line-clamp-2 font-body text-[13px] leading-relaxed text-white/65 sm:text-sm">
          {g.description}
        </p>

        {/* Roster — the flexible hero. Real kids, or a positive empty state. */}
        <div className="relative mt-4 flex-1 border-t border-white/8 pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-white/50">
              Jucători
            </span>
            {more > 0 && (
              <span className="font-heading text-[10px] uppercase tracking-[0.14em] text-white/40">
                +{more} {more === 1 ? "altul" : "alții"}
              </span>
            )}
          </div>

          {preview.length > 0 ? (
            <ul className="grid gap-1.5">
              {preview.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.025] p-1.5"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-7 shrink-0 place-items-center rounded-md font-heading text-[10px] font-bold tabular-nums"
                    style={{
                      backgroundColor: `${theme.accent}26`,
                      color: theme.accent,
                    }}
                  >
                    {initialsOf(p.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-heading text-[12px] font-semibold uppercase tracking-[0.04em] text-white/90">
                    {p.name}
                  </span>
                  <span className="font-heading text-[10px] tabular-nums tracking-[0.1em] text-white/45">
                    {p.yearOfBirth}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-brand-cyan/25 bg-brand-cyan/[0.04] px-3 py-4 text-center">
              <Sparkles className="mx-auto size-4 text-brand-cyan/80" />
              <p className="mt-1.5 font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-cyan/90">
                Înscrieri deschise
              </p>
              <p className="mt-1 font-body text-[12px] leading-snug text-white/55">
                Programează o evaluare gratuită
              </p>
            </div>
          )}
        </div>

        {/* CTA — pinned to the bottom so every card aligns */}
        <Link
          href={`/grupe#${g.code}`}
          aria-label={`Vezi grupa ${g.code}`}
          className="touch-target group/cta relative mt-5 inline-flex items-center justify-center gap-2 rounded-full border border-brand-cyan/40 bg-brand-cyan/15 px-4 py-2.5 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-cyan transition-all hover:border-brand-cyan/70 hover:bg-brand-cyan/25 hover:text-white"
        >
          Vezi grupa
          <ArrowRight className="size-3.5 transition-transform group-hover/cta:translate-x-0.5" />
        </Link>

        {/* Hover sweep */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
    </motion.article>
  );
}

export default function SlidePlayers() {
  const [groups, setGroups] = useState<DisplayGroup[] | null>(null);

  useEffect(() => {
    let active = true;
    loadGroups().then((g) => {
      if (active) setGroups(g);
    });
    return () => {
      active = false;
    };
  }, []);

  const lgColsClass = groups
    ? LG_COLS[Math.min(groups.length, 5)] ?? "lg:grid-cols-5"
    : "lg:grid-cols-3";

  return (
    <SlideShell
      index={3}
      total={3}
      eyebrow="Grupele de Vârstă"
      accent="cyan"
      title={
        <>
          <span className="block text-white/55">Grupa potrivită</span>
          <span className="text-gradient-cyan">pentru copilul tău</span>
        </>
      }
      subtitle="Selectează grupa în funcție de data nașterii. Sistemul îl ghidează automat la antrenorul potrivit la momentul înscrierii."
    >
      {groups === null ? (
        <div className="grid min-h-[40vh] place-items-center">
          <div className="size-5 animate-spin rounded-full border-2 border-brand-cyan/30 border-t-brand-cyan" />
        </div>
      ) : (
        <div
          className={`grid gap-4 sm:h-full sm:auto-rows-fr sm:grid-cols-2 sm:gap-5 ${lgColsClass}`}
        >
          {groups.map((g, i) => (
            <GroupCard key={g.key} g={g} i={i} />
          ))}
        </div>
      )}
    </SlideShell>
  );
}
