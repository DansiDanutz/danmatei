/**
 * SlidePlayers — third slide. Bento grid of the academy's age groups.
 *
 * Strictly DYNAMIC: the cards are the owner's real groups from Admin → Grupe
 * (the `fotbal.groups` table) via the public `/api/groups` endpoint. There is
 * NO hardcoded list — if there are 4 groups you see 4 cards, if 3 you see 3.
 * If the API is briefly unreachable we retry and otherwise show a small
 * "indisponibil" state; we never invent placeholder groups.
 *
 * Each card is built from data every group has (code, age range, head-count,
 * trainer, live roster) and a fixed-height header zone, so the cards stay
 * uniform and the rosters line up across the row on tablet/desktop. A group
 * with no children yet shows a positive "înscrieri deschise" state.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Users } from "lucide-react";
import { Link } from "wouter";
import { AGE_GROUPS, TRAINERS, type AgeGroup } from "@/data/landing";
import SlideShell from "./SlideShell";

const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];
const ROSTER_PREVIEW = 4;
const MAX_ATTEMPTS = 3;

// Editorial copy library, keyed by group code (U7, U9, …). Used ONLY to give a
// live group a nicer description + age label when its code matches — never to
// fabricate a group that doesn't exist in the DB.
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
  subtitle: string; // age range line, e.g. "U8 – U9" or "2018–2019"
  description: string;
  players: { id: string; name: string; yearOfBirth: number }[];
  childCount: number;
  trainer: { initials: string; name: string } | null;
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

function trainerFromEditorial(ed?: AgeGroup): { initials: string; name: string } | null {
  if (!ed) return null;
  const t = ed.trainerIds.map((id) => trainerById[id]).find(Boolean);
  return t ? { initials: t.initials, name: t.name } : null;
}

function fromApi(g: ApiGroup): DisplayGroup {
  const code = normCode(g.label);
  const ed = EDITORIAL[code];
  return {
    key: g.id,
    code,
    subtitle: ed?.label ?? `${g.birthYearMin}–${g.birthYearMax}`,
    description:
      ed?.description ??
      `Antrenamente pe vârstă pentru copii născuți între ${g.birthYearMin} și ${g.birthYearMax}.`,
    players: g.players ?? [],
    childCount: g.childCount ?? 0,
    trainer: g.trainerName
      ? { initials: initialsOf(g.trainerName), name: g.trainerName }
      : trainerFromEditorial(ed),
  };
}

// ── Data loading ───────────────────────────────────────────────────────────
// Returns DisplayGroup[] on success (possibly empty = "no groups defined"),
// or null when the API can't be reached after retries. NEVER a fake list.
async function fetchGroupsOnce(): Promise<DisplayGroup[] | null> {
  try {
    const res = await fetch("/api/groups", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    // Local dev / SPA fallback answers /api/* with index.html — treat as miss.
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok || !ct.includes("application/json")) return null;
    const data = (await res.json()) as { groups?: ApiGroup[] };
    return (Array.isArray(data.groups) ? data.groups : []).map(fromApi);
  } catch {
    return null;
  }
}

// Cache only successful results so transient failures can recover on remount.
let groupsCache: Promise<DisplayGroup[] | null> | null = null;

function loadGroups(): Promise<DisplayGroup[] | null> {
  if (groupsCache) return groupsCache;
  const run = (async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const result = await fetchGroupsOnce();
      if (result !== null) return result;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
    return null;
  })();
  groupsCache = run;
  run.then((r) => {
    if (r === null) groupsCache = null; // allow a later retry
  });
  return run;
}

// Per-group accent — every group stays in the academy's blue family; a single
// warm gold spark is reserved for the youngest group.
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
const FALLBACK_THEME = GROUP_THEMES.U15;

// Tailwind-safe literal column classes so the desktop row width tracks the real
// group count instead of a hardcoded value (dynamic class strings get purged).
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

  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.97, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 + i * 0.07, ease: expoOut }}
      className="relative"
    >
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

        {/* Header: code + age range (fixed height) */}
        <div className="relative flex items-start justify-between gap-3">
          <span
            className="font-heading text-5xl font-bold leading-none tabular-nums tracking-tight sm:text-6xl"
            style={{ color: theme.accent }}
          >
            {g.code}
          </span>
          <div className="flex flex-col items-end gap-1.5 pt-1">
            <span className="whitespace-nowrap font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
              {g.subtitle}
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-heading text-[10px] uppercase tracking-[0.14em] text-white/70">
              <Users className="size-3" style={{ color: theme.accent }} />
              {g.childCount} {g.childCount === 1 ? "copil" : "copii"}
            </span>
          </div>
        </div>

        {/* Trainer — row is ALWAYS rendered (fixed height) so cards align even
            when a group has no trainer assigned yet. */}
        <div className="relative mt-4 flex h-7 items-center gap-2">
          {g.trainer && (
            <>
              <span
                title={g.trainer.name}
                className={`grid size-7 shrink-0 place-items-center rounded-full border border-white/10 bg-gradient-to-br ${theme.chip} font-heading text-[10px] font-bold text-white/90`}
              >
                {g.trainer.initials}
              </span>
              <span className="min-w-0 truncate font-heading text-[11px] uppercase tracking-[0.14em] text-white/55">
                {g.trainer.name}
              </span>
            </>
          )}
        </div>

        {/* Description — clamped AND min-height = 2 lines, so every card's
            roster starts at the same Y. */}
        <p className="relative mt-3 line-clamp-2 min-h-[2.65rem] font-body text-[13px] leading-relaxed text-white/65 sm:min-h-[2.85rem] sm:text-sm">
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

        {/* CTA — one line, pinned to the bottom so every card aligns */}
        <Link
          href={`/grupe#${g.code}`}
          aria-label={`Vezi echipa ${g.code}`}
          className="touch-target group/cta relative mt-5 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-brand-cyan/40 bg-brand-cyan/15 px-4 py-2.5 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-cyan transition-all hover:border-brand-cyan/70 hover:bg-brand-cyan/25 hover:text-white"
        >
          Vezi echipa
          <ArrowRight className="size-3.5 transition-transform group-hover/cta:translate-x-0.5" />
        </Link>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
    </motion.article>
  );
}

export default function SlidePlayers() {
  // undefined = loading · null = API unavailable · [] = no groups defined
  const [groups, setGroups] = useState<DisplayGroup[] | null | undefined>(
    undefined
  );

  useEffect(() => {
    let active = true;
    loadGroups().then((g) => {
      if (active) setGroups(g);
    });
    return () => {
      active = false;
    };
  }, []);

  const lgColsClass = groups?.length
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
      {groups === undefined ? (
        <div className="grid min-h-[40vh] place-items-center">
          <div className="size-5 animate-spin rounded-full border-2 border-brand-cyan/30 border-t-brand-cyan" />
        </div>
      ) : groups === null ? (
        <div className="grid min-h-[40vh] place-items-center text-center">
          <p className="font-body text-sm text-white/55">
            Grupele nu pot fi încărcate momentan. Reîncarcă pagina.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <div className="grid min-h-[40vh] place-items-center text-center">
          <p className="font-body text-sm text-white/55">
            Grupele vor apărea aici imediat ce sunt create în panou.
          </p>
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
