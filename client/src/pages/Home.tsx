/**
 * Home — Landing card. After 5 seconds (HERO_REDIRECT_MS) the page
 * auto-advances to `/cunoaste` where the 3-card swipe deck lives.
 *
 * Visual identity is anchored on the brand jersey color (equipment cyan,
 * #5ECBF2). The card is deliberately minimal: brand mark, hero video,
 * value prop, and a stat strip. The 5-second countdown ring and "Sări
 * peste" pill (rendered by HeroTimer) live in the top-right.
 */
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Bell,
  CalendarClock,
  ImageIcon,
  LogIn,
  Newspaper,
  Trophy,
  Users,
} from "lucide-react";
import HeroChantCard from "@/components/HeroChantCard";
import HeroTimer from "@/components/HeroTimer";
import { OWNER } from "@/data/landing";

const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Primary navigation surfaced from the landing page. Order matches the
// information hierarchy: news first, then alerts, then performance, then
// community, then ops, then media. Login sits at the end with primary
// styling so visitors who already have an account can jump in fast.
const MENU_ITEMS: Array<{
  label: string;
  href: string;
  icon: typeof Newspaper;
  primary?: boolean;
}> = [
  { label: "Știri", href: "/stiri", icon: Newspaper },
  { label: "Notificări", href: "/notificari", icon: Bell },
  { label: "Rezultate", href: "/rezultate", icon: Trophy },
  { label: "Copii", href: "/copii", icon: Users },
  { label: "Program", href: "/program", icon: CalendarClock },
  { label: "Galerie", href: "/galerie", icon: ImageIcon },
  { label: "Login", href: "/login", icon: LogIn, primary: true },
];

// Deterministic starfield — 20 dots (reduced from 60 for performance).
// Scattered with seeded jitter so they don't reshuffle on every render.
// Visible only on tablet/desktop.
const STARS = Array.from({ length: 20 }, (_, i) => {
  const s = (i * 9301 + 49297) % 233280;
  return {
    left: (s % 1000) / 10, // 0–100
    top: ((s * 7) % 1000) / 10,
    size: 1 + (s % 3), // 1–3 px
    opacity: 0.3 + ((s * 11) % 70) / 100, // 0.3–1.0
    delay: ((s * 13) % 60) / 10, // 0–6 s
    duration: 2.4 + ((s * 17) % 30) / 10, // 2.4–5.4 s
  };
});

export default function Home() {
  return (
    <div
      id="acasa"
      className="relative min-h-[100dvh] overflow-hidden bg-[oklch(0.08_0.02_250)]"
    >
      {/* Atmosphere — cyan-anchored, gold whisper */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-1/3 size-[36rem] rounded-full bg-brand-cyan/[0.08] blur-3xl" />
        <div className="absolute -right-32 bottom-1/4 size-[32rem] rounded-full bg-brand-cyan/[0.05] blur-3xl" />
        <div className="absolute left-1/2 top-0 h-px w-[60%] -translate-x-1/2 bg-gradient-to-r from-transparent via-brand-cyan/30 to-transparent" />
      </div>

      {/* Stars + stadium silhouette — tablet/desktop only */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden md:block"
      >
        {/* Starfield */}
        {STARS.map((star, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              boxShadow:
                star.size > 2
                  ? "0 0 6px oklch(0.95 0.06 230 / 0.7)"
                  : undefined,
            }}
            animate={{
              opacity: [star.opacity * 0.3, star.opacity, star.opacity * 0.3],
            }}
            transition={{
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Stadium silhouette — sits at the bottom of the viewport */}
        <svg
          viewBox="0 0 1200 400"
          preserveAspectRatio="xMidYMax slice"
          className="absolute bottom-0 left-0 h-[55%] w-full opacity-[0.18]"
        >
          {/* Floodlight tower glows */}
          <radialGradient id="lightGlow" cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              stopColor="oklch(0.95 0.08 230)"
              stopOpacity="0.9"
            />
            <stop
              offset="60%"
              stopColor="oklch(0.85 0.12 230)"
              stopOpacity="0.15"
            />
            <stop
              offset="100%"
              stopColor="oklch(0.85 0.12 230)"
              stopOpacity="0"
            />
          </radialGradient>
          <linearGradient id="standGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.30 0.06 230)" />
            <stop offset="100%" stopColor="oklch(0.10 0.02 250)" />
          </linearGradient>

          {/* Floodlight cones */}
          <ellipse cx="80" cy="220" rx="180" ry="220" fill="url(#lightGlow)" />
          <ellipse
            cx="1120"
            cy="220"
            rx="180"
            ry="220"
            fill="url(#lightGlow)"
          />

          {/* Stand back curve */}
          <path
            d="M -50 340 Q 600 180 1250 340 L 1250 410 L -50 410 Z"
            fill="url(#standGrad)"
          />
          {/* Stand front (lower lip) */}
          <path
            d="M -20 360 Q 600 260 1220 360 L 1220 410 L -20 410 Z"
            fill="oklch(0.12 0.025 250)"
          />

          {/* Field rim — faint ellipse + center circle + halfway line */}
          <ellipse
            cx="600"
            cy="385"
            rx="540"
            ry="22"
            fill="none"
            stroke="oklch(0.75 0.12 230 / 0.35)"
            strokeWidth="1"
          />
          <line
            x1="600"
            y1="365"
            x2="600"
            y2="408"
            stroke="oklch(0.75 0.12 230 / 0.3)"
            strokeWidth="1"
          />
          <ellipse
            cx="600"
            cy="385"
            rx="50"
            ry="6"
            fill="none"
            stroke="oklch(0.75 0.12 230 / 0.3)"
            strokeWidth="1"
          />

          {/* Floodlight towers */}
          {[80, 1120].map(x => (
            <g key={x}>
              <line
                x1={x}
                y1="80"
                x2={x}
                y2="350"
                stroke="oklch(0.55 0.08 230 / 0.7)"
                strokeWidth="2"
              />
              {/* Lamp head */}
              <rect
                x={x - 18}
                y="70"
                width="36"
                height="14"
                rx="2"
                fill="oklch(0.45 0.06 230)"
              />
              {/* Bright lamp */}
              <circle cx={x} cy="77" r="3" fill="oklch(0.98 0.06 230)" />
            </g>
          ))}
        </svg>
      </div>

      {/* Primary navigation — six surfaces of the academy. Sits at the
          very top of the viewport. Mobile shows a horizontal scroll row
          with snap so all six remain reachable; tablet+ centres the row. */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.1, ease: expoOut }}
        aria-label="Meniu principal"
        className="relative z-20 px-4 pt-4 sm:px-8 sm:pt-6"
      >
        <ul className="mx-auto flex max-w-3xl snap-x snap-mandatory gap-2 overflow-x-auto rounded-full border border-white/8 bg-[oklch(0.10_0.02_250)]/70 p-1.5 backdrop-blur-md sm:justify-center sm:gap-1 [&::-webkit-scrollbar]:hidden">
          {MENU_ITEMS.map(item => {
            const Icon = item.icon;
            const baseClass =
              "group/menu inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-heading text-[11px] font-semibold uppercase tracking-[0.16em] transition-all sm:px-4 sm:py-2 sm:text-[12px]";
            const variantClass = item.primary
              ? "border border-brand-cyan/60 bg-brand-cyan/20 text-brand-cyan hover:border-brand-cyan hover:bg-brand-cyan/30 hover:text-white"
              : "border border-transparent text-white/70 hover:border-brand-cyan/40 hover:bg-brand-cyan/10 hover:text-white";
            return (
              <li key={item.href} className="snap-start">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className={`${baseClass} ${variantClass}`}
                >
                  <Icon
                    className={`size-3.5 transition-colors ${
                      item.primary
                        ? "text-brand-cyan"
                        : "text-brand-cyan/80 group-hover/menu:text-brand-cyan"
                    }`}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </motion.nav>

      <section className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 pb-10 pt-4 sm:pb-14 sm:pt-6">
        <div className="w-full max-w-md">
          {/* Top brand mark */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: expoOut }}
            className="mb-5 flex items-center justify-center gap-3"
          >
            <span className="relative grid size-12 place-items-center rounded-full bg-[oklch(0.12_0.025_250)] ring-1 ring-brand-cyan/30 shadow-[0_0_30px_-6px_oklch(0.75_0.12_230/0.45)]">
              <img
                src="/logo-official.jpg"
                alt="Școala Dan Matei"
                width={36}
                height={36}
                className="size-9 rounded-full"
              />
            </span>
            <span className="font-heading text-[10px] uppercase tracking-[0.32em] text-brand-cyan/80">
              Acs · Cluj-Napoca
            </span>
          </motion.div>

          <HeroTimer redirectTo="/cunoaste" disabled>
            <div className="relative">
              {/* Animated rim — a soft cyan light traveling around the card */}
              <span
                aria-hidden="true"
                className="card-rim-glow pointer-events-none absolute -inset-[3px] rounded-[calc(1.5rem+3px)] opacity-90"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.9, ease: expoOut }}
                className="relative overflow-hidden rounded-3xl border border-brand-cyan/15 bg-[oklch(0.12_0.025_250)] shadow-[0_30px_80px_-20px_oklch(0.75_0.12_230/0.35),0_10px_30px_-12px_black/0.6]"
              >
                {/* Cyan rim glow — jersey signature */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-brand-cyan/15"
                />

                {/* Hero video with kids' chant audio (Unu·Doi·Trei·Dan Matei) */}
                <div className="aspect-[4/3]">
                  <HeroChantCard />
                </div>

                {/* Content */}
                <div className="px-6 pb-6 pt-5 text-center">
                  <motion.span
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.25, ease: expoOut }}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-1 font-heading text-[10px] uppercase tracking-[0.22em] text-brand-cyan"
                  >
                    <span
                      aria-hidden="true"
                      className="block size-1 rounded-full bg-brand-cyan animate-pulse"
                    />
                    Licență UEFA · Din 2017
                  </motion.span>

                  <motion.h1
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.32, ease: expoOut }}
                    className="mt-3 font-heading text-2xl font-bold uppercase leading-none tracking-wider text-wave-white"
                  >
                    Școala de Fotbal
                  </motion.h1>

                  <motion.h2
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4, ease: expoOut }}
                    className="mt-1 font-heading text-3xl font-bold uppercase leading-none tracking-wider text-wave-cyan"
                  >
                    {OWNER.name}
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5, ease: expoOut }}
                    className="mt-3 font-body text-sm leading-relaxed text-white/55"
                  >
                    Academia unde copiii devin fotbaliști — și oameni.
                  </motion.p>

                  {/* Stat strip — all cyan, gold reserved for trophy */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.62, ease: expoOut }}
                    className="mt-5 grid grid-cols-3 gap-2"
                  >
                    {OWNER.stats.slice(0, 3).map(s => {
                      const isAchievement = s.label
                        .toLowerCase()
                        .includes("trofee");
                      return (
                        <div
                          key={s.label}
                          className={`rounded-xl border px-2 py-2.5 ${
                            isAchievement
                              ? "border-brand-gold/25 bg-brand-gold/5"
                              : "border-brand-cyan/15 bg-brand-cyan/[0.04]"
                          }`}
                        >
                          <div
                            className={`font-heading text-base font-bold tabular-nums ${
                              isAchievement
                                ? "text-brand-gold"
                                : "text-brand-cyan"
                            }`}
                          >
                            {s.value}
                          </div>
                          <div className="font-heading text-[9px] uppercase tracking-[0.18em] text-white/45">
                            {s.label}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </HeroTimer>

          {/* Caption */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.6 }}
            className="mt-6 text-center font-heading text-[10px] uppercase tracking-[0.3em] text-white/30"
          >
            Cunoști academia în câteva secunde
          </motion.p>
        </div>
      </section>
    </div>
  );
}
