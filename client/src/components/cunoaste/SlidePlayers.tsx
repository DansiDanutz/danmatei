/**
 * SlidePlayers — third slide. Bento grid of age groups with rich detail:
 * code, schedule, focus highlights, child count, assigned trainer(s),
 * and a "Vezi echipa" CTA that opens the public groups page anchored
 * to the matching group code.
 */
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Users } from "lucide-react";
import { Link } from "wouter";
import { AGE_GROUPS, TRAINERS } from "@/data/landing";
import SlideShell from "./SlideShell";

const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

const trainersById = Object.fromEntries(TRAINERS.map(t => [t.id, t]));

// Per-group accent — every group stays in the academy's blue family
// (the navy base + brand-cyan swirl visible across all three trainer
// portraits). Variation is created by hue shift WITHIN the blue/cyan
// spectrum, not by jumping into magenta or red. A single warm "spark"
// (gold for U7, oklch hue 95) is reserved for the youngest group as a
// nod to the painted-portrait warmth — the rest stay solidly cool.
const GROUP_THEMES: Record<
  string,
  { glow: string; accent: string; chip: string; spark?: string }
> = {
  U7: {
    // Bright cyan (matches Sopi's cyan flame swirl)
    glow: "radial-gradient(120% 100% at 0% 0%, oklch(0.40 0.16 210 / 0.55), transparent 60%)",
    accent: "oklch(0.82 0.16 210)",
    chip: "from-[oklch(0.34_0.14_210)]/45 to-[oklch(0.18_0.06_240)]/45",
    spark: "oklch(0.85 0.16 90)", // gold pop — reserved for the youngest
  },
  U9: {
    // Aqua-teal — pool of water shade
    glow: "radial-gradient(120% 100% at 100% 0%, oklch(0.40 0.14 220 / 0.55), transparent 60%)",
    accent: "oklch(0.80 0.16 220)",
    chip: "from-[oklch(0.32_0.13_220)]/45 to-[oklch(0.18_0.06_240)]/45",
  },
  U11: {
    // Brand royal blue — the academy's heart color
    glow: "radial-gradient(120% 100% at 0% 100%, oklch(0.42 0.16 235 / 0.55), transparent 60%)",
    accent: "oklch(0.78 0.16 235)",
    chip: "from-[oklch(0.32_0.14_235)]/45 to-[oklch(0.18_0.07_245)]/45",
  },
  U13: {
    // Indigo — deeper, more serious
    glow: "radial-gradient(120% 100% at 100% 100%, oklch(0.40 0.14 250 / 0.55), transparent 60%)",
    accent: "oklch(0.74 0.15 250)",
    chip: "from-[oklch(0.30_0.13_250)]/45 to-[oklch(0.18_0.07_255)]/45",
  },
  U15: {
    // Navy — the deep night base across all three trainer portraits
    glow: "radial-gradient(120% 100% at 50% 0%, oklch(0.36 0.13 260 / 0.55), transparent 60%)",
    accent: "oklch(0.70 0.15 260)",
    chip: "from-[oklch(0.28_0.12_260)]/45 to-[oklch(0.16_0.07_265)]/45",
  },
};

export default function SlidePlayers() {
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
      {/* Uniform grid: every card has the same width and stretches to the
          tallest content via auto-rows-fr. Mobile = 1 col, tablet = 2 col
          (last row holds one card alone), desktop = 5 col (single row). */}
      <div className="grid h-full auto-rows-fr gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-5">
        {AGE_GROUPS.map((g, i) => {
          const groupTrainers = g.trainerIds
            .map(id => trainersById[id])
            .filter(Boolean);
          const theme = GROUP_THEMES[g.code] ?? GROUP_THEMES.U7;

          return (
            <motion.article
              key={g.code}
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: 0.3 + i * 0.07,
                ease: expoOut,
              }}
              className="relative"
            >
              {/* Animated cyan rim — same language as Owner + Trainer cards */}
              <span
                aria-hidden="true"
                className="card-rim-glow pointer-events-none absolute -inset-[3px] rounded-[calc(1.5rem+3px)] opacity-75"
                style={{ animationDelay: `${i * -1.2}s` }}
              />

              <div className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/85 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-cyan/40 hover:shadow-[0_24px_60px_-22px_oklch(0.75_0.12_230/0.4)] sm:p-6">
                {/* Themed glow background — varies by group code */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{ backgroundImage: theme.glow }}
                />

                {/* Faint pitch lines pattern (decorative) */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                  }}
                />

                {/* Painterly spark — only on groups that define one (U7).
                    Echoes the warm glints in the trainer portraits without
                    overriding the academy blue. */}
                {theme.spark && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-6 -top-6 size-32 rounded-full opacity-30 blur-2xl"
                    style={{ backgroundColor: theme.spark }}
                  />
                )}

                <div className="relative flex flex-col gap-4">
                  {/* Code + label header */}
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className="font-heading text-5xl font-bold leading-none tabular-nums tracking-tight sm:text-6xl"
                      style={{ color: theme.accent }}
                    >
                      {g.code}
                    </span>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="font-heading text-[11px] uppercase tracking-[0.22em] text-white/55">
                        {g.label}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-heading text-[10px] uppercase tracking-[0.16em] text-white/70">
                        <Users className="size-3 text-brand-gold" />
                        {g.childCount} copii
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="relative font-body text-[15px] leading-relaxed text-white/80 sm:text-base">
                    {g.description}
                  </p>

                  {/* Schedule */}
                  {g.schedule && (
                    <div className="inline-flex items-center gap-2 self-start rounded-full border border-brand-cyan/25 bg-brand-cyan/5 px-3 py-1.5 font-heading text-xs font-medium uppercase tracking-[0.14em] text-brand-cyan/90">
                      <Calendar className="size-3.5" />
                      {g.schedule}
                    </div>
                  )}

                  {/* Highlights */}
                  {g.highlights && g.highlights.length > 0 && (
                    <ul className="grid gap-2 border-t border-white/8 pt-3">
                      {g.highlights.map(h => (
                        <li
                          key={h}
                          className="flex gap-2.5 font-body text-[13px] leading-snug text-white/70 sm:text-sm"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-1.5 inline-block size-1 shrink-0 rounded-full"
                            style={{ backgroundColor: theme.accent }}
                          />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Sample roster — mini cards for individual children */}
                  {g.players && g.players.length > 0 && (
                    <div className="border-t border-white/8 pt-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
                          Jucători
                        </span>
                        {g.childCount > g.players.length && (
                          <span className="font-heading text-[10px] uppercase tracking-[0.16em] text-white/45">
                            +{g.childCount - g.players.length} alții
                          </span>
                        )}
                      </div>
                      <ul className="grid gap-1.5">
                        {g.players.map(p => {
                          const initials = p.name
                            .split(" ")
                            .map(part => part[0])
                            .slice(0, 2)
                            .join("");
                          return (
                            <li
                              key={p.id}
                              className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.025] p-1.5"
                            >
                              <span
                                aria-hidden="true"
                                className="grid size-7 shrink-0 place-items-center rounded-md font-heading text-[10px] font-bold tabular-nums text-white/90"
                                style={{
                                  backgroundColor: `${theme.accent}30`,
                                  color: theme.accent,
                                }}
                              >
                                {initials}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-heading text-[12px] font-semibold uppercase tracking-[0.04em] text-white/90">
                                  {p.name}
                                </div>
                                <div className="truncate font-heading text-[10px] uppercase tracking-[0.14em] text-white/50">
                                  {p.position}
                                  <span className="mx-1.5 text-white/25">
                                    ·
                                  </span>
                                  <span className="tabular-nums text-white/70">
                                    {p.yearOfBirth}
                                  </span>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Footer: trainers + CTA */}
                <div className="relative mt-auto flex items-center justify-between gap-3 pt-3">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {groupTrainers.map(t => (
                        <span
                          key={t.id}
                          title={t.name}
                          className={`grid size-9 place-items-center rounded-full border-2 border-[oklch(0.13_0.03_250)] bg-gradient-to-br ${theme.chip} font-heading text-[11px] font-bold text-white/90`}
                        >
                          {t.initials}
                        </span>
                      ))}
                    </div>
                    {groupTrainers.length > 0 && (
                      <span className="font-heading text-[11px] uppercase tracking-[0.16em] text-white/55">
                        {groupTrainers.length === 1
                          ? groupTrainers[0]!.name.split(" ")[0]
                          : "Echipă"}
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/grupe#${g.code}`}
                    aria-label={`Vezi echipa ${g.code}`}
                    className="touch-target group/cta inline-flex items-center gap-2 rounded-full border border-brand-cyan/40 bg-brand-cyan/15 px-4 py-2 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-cyan transition-all hover:border-brand-cyan/70 hover:bg-brand-cyan/25 hover:text-white"
                  >
                    Vezi echipa
                    <ArrowRight className="size-3.5 transition-transform group-hover/cta:translate-x-0.5" />
                  </Link>
                </div>

                {/* Hover sweep */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
            </motion.article>
          );
        })}
      </div>
    </SlideShell>
  );
}
