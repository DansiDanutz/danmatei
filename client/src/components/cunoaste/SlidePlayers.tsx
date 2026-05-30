/**
 * SlidePlayers — third slide. Bento grid of the academy's age groups.
 *
 * Strictly DYNAMIC: the cards are the owner's real groups from Admin → Grupe
 * (the `fotbal.groups` table) via the public `/api/groups` endpoint. No
 * hardcoded list — 4 groups → 4 cards, 3 → 3.
 *
 * Visibility by role:
 *   - logged out (public)      → all groups
 *   - owner / super_admin      → all groups
 *   - any other logged-in user → only the group(s) tied to the children in
 *     their scope (a parent's kids / a trainer's trainees, via RLS)
 *
 * Quick-jump chips above the grid scroll to the matching card. Each card is
 * built from data every group has and a fixed-height header zone, so cards
 * stay uniform and rosters line up across the row.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Users } from "lucide-react";
import { Link } from "wouter";
import { AGE_GROUPS, TRAINERS, type AgeGroup } from "@/data/landing";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { birthYearFromDob } from "@shared/date";
import SlideShell from "./SlideShell";

const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];
const ROSTER_PREVIEW = 4;
const MAX_ATTEMPTS = 3;
const HIGHLIGHT_MS = 1600;

// Editorial copy library, keyed by group code (U7, U9, …). Used ONLY to enrich
// a live group's description + age label when its code matches — never to
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
  key: string; // group id
  code: string; // big card number, e.g. "U9"
  subtitle: string; // age range line
  description: string;
  birthYearMin: number;
  birthYearMax: number;
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

function trainerFromEditorial(
  ed?: AgeGroup
): { initials: string; name: string } | null {
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
    birthYearMin: g.birthYearMin,
    birthYearMax: g.birthYearMax,
    players: g.players ?? [],
    childCount: g.childCount ?? 0,
    trainer: g.trainerName
      ? { initials: initialsOf(g.trainerName), name: g.trainerName }
      : trainerFromEditorial(ed),
  };
}

// ── Data loading ───────────────────────────────────────────────────────────
// DisplayGroup[] on success (possibly empty = "no groups defined"), or null
// when the API can't be reached after retries. NEVER a fake list.
async function fetchGroupsOnce(): Promise<DisplayGroup[] | null> {
  try {
    const res = await fetch("/api/groups", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok || !ct.includes("application/json")) return null;
    const data = (await res.json()) as { groups?: ApiGroup[] };
    return (Array.isArray(data.groups) ? data.groups : []).map(fromApi);
  } catch {
    return null;
  }
}

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

const LG_COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

function GroupCard({
  g,
  i,
  highlighted,
  innerRef,
}: {
  g: DisplayGroup;
  i: number;
  highlighted: boolean;
  innerRef: (el: HTMLElement | null) => void;
}) {
  const theme = GROUP_THEMES[g.code] ?? FALLBACK_THEME;
  const preview = g.players.slice(0, ROSTER_PREVIEW);
  const more = Math.max(0, g.childCount - preview.length);

  return (
    <motion.article
      ref={innerRef}
      initial={{ opacity: 0, scale: 0.97, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 + i * 0.07, ease: expoOut }}
      className="relative scroll-mt-24"
    >
      <span
        aria-hidden="true"
        className="card-rim-glow pointer-events-none absolute -inset-[3px] rounded-[calc(1.5rem+3px)] opacity-70"
        style={{ animationDelay: `${i * -1.2}s` }}
      />

      <div
        className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-[oklch(0.13_0.03_250)]/85 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-cyan/40 hover:shadow-[0_24px_60px_-22px_oklch(0.75_0.12_230/0.4)] sm:p-6 ${
          highlighted
            ? "border-brand-cyan/70 ring-2 ring-brand-cyan/40"
            : "border-white/8"
        }`}
      >
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

        {/* Trainer — always rendered (fixed height) so cards align */}
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

        {/* Description — clamped + 2-line min-height for aligned rosters */}
        <p className="relative mt-3 line-clamp-2 min-h-[2.65rem] font-body text-[13px] leading-relaxed text-white/65 sm:min-h-[2.85rem] sm:text-sm">
          {g.description}
        </p>

        {/* Roster — real kids, or a positive empty state */}
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

        {/* CTA — one line, pinned to the bottom */}
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
  const { user, profile, loading: authLoading } = useAuth();
  // undefined = loading · null = API unavailable · [] = none · [...] = groups
  const [allGroups, setAllGroups] = useState<DisplayGroup[] | null | undefined>(
    undefined
  );
  const [visible, setVisible] = useState<DisplayGroup[] | null | undefined>(
    undefined
  );
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const highlightTimer = useRef<number | null>(null);

  // 1) Load all groups once (public data).
  useEffect(() => {
    let active = true;
    loadGroups().then((g) => {
      if (active) setAllGroups(g);
    });
    return () => {
      active = false;
    };
  }, []);

  // 2) Decide what THIS viewer should see.
  useEffect(() => {
    if (allGroups === undefined || authLoading) {
      setVisible(undefined);
      return;
    }
    if (allGroups === null) {
      setVisible(null);
      return;
    }
    const role = profile?.role;
    // Public visitors + the owner/admin see every group.
    if (!user || role === "owner" || role === "super_admin") {
      setVisible(allGroups);
      return;
    }
    // A logged-in parent/trainer sees only the group(s) of the children in
    // their scope. RLS limits this query to their own kids / trainees.
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("children")
          .select("group_id, dob")
          .eq("status", "active");
        const kids = (data ?? []) as { group_id: string | null; dob: string }[];
        const ids = new Set<string>();
        for (const k of kids) {
          const y = birthYearFromDob(k.dob);
          const match = allGroups.find(
            (g) =>
              k.group_id === g.key ||
              (k.group_id == null &&
                y >= g.birthYearMin &&
                y <= g.birthYearMax)
          );
          if (match) ids.add(match.key);
        }
        if (active) setVisible(allGroups.filter((g) => ids.has(g.key)));
      } catch {
        if (active) setVisible(allGroups);
      }
    })();
    return () => {
      active = false;
    };
  }, [allGroups, authLoading, user, profile]);

  const scrollToCard = (code: string) => {
    cardRefs.current
      .get(code)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    setActiveCode(code);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(
      () => setActiveCode(null),
      HIGHLIGHT_MS
    );
  };

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
      {visible === undefined ? (
        <div className="grid min-h-[40vh] place-items-center">
          <div className="size-5 animate-spin rounded-full border-2 border-brand-cyan/30 border-t-brand-cyan" />
        </div>
      ) : visible === null ? (
        <div className="grid min-h-[40vh] place-items-center text-center">
          <p className="font-body text-sm text-white/55">
            Grupele nu pot fi încărcate momentan. Reîncarcă pagina.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="grid min-h-[40vh] place-items-center text-center">
          <p className="max-w-sm font-body text-sm text-white/55">
            {user
              ? "Momentan nu ești alocat unei grupe. Contactează academia pentru înscriere."
              : "Grupele vor apărea aici imediat ce sunt create în panou."}
          </p>
        </div>
      ) : visible.length === 1 ? (
        // A single group (e.g. a logged-in parent's group) — centered, no chips.
        <div className="mx-auto w-full max-w-sm sm:max-w-md">
          <GroupCard
            g={visible[0]!}
            i={0}
            highlighted={false}
            innerRef={() => {}}
          />
        </div>
      ) : (
        <div className="flex h-full flex-col">
          {/* Quick-jump chips — tap a code to scroll to that card */}
          <div className="mb-4 flex flex-wrap gap-2 sm:mb-5">
            {visible.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => scrollToCard(g.code)}
                aria-label={`Mergi la grupa ${g.code}`}
                className={`touch-target rounded-full border px-3.5 py-1.5 font-heading text-[12px] font-bold uppercase tracking-[0.12em] transition-all ${
                  activeCode === g.code
                    ? "border-brand-cyan/70 bg-brand-cyan/20 text-white"
                    : "border-white/12 bg-white/[0.05] text-white/75 hover:border-brand-cyan/40 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {g.code}
              </button>
            ))}
          </div>

          <div
            className={`grid flex-1 gap-4 sm:auto-rows-fr sm:grid-cols-2 sm:gap-5 ${
              LG_COLS[Math.min(visible.length, 5)] ?? "lg:grid-cols-5"
            }`}
          >
            {visible.map((g, i) => (
              <GroupCard
                key={g.key}
                g={g}
                i={i}
                highlighted={activeCode === g.code}
                innerRef={(el) => {
                  if (el) cardRefs.current.set(g.code, el);
                  else cardRefs.current.delete(g.code);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </SlideShell>
  );
}
