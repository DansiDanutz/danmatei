/**
 * Results — Match scores with count-up animation,
 * pulse badges for wins, and staggered card reveals.
 */
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Calendar, TrendingUp, Minus } from "lucide-react";
import { expoOut, staggerContainer, staggerItem, dur } from "@/lib/motion";
import { CountUpSpan } from "@/hooks/useCountUp";

const matches = [
  { id: 1, home: "Dan Matei", away: "Chinteni", homeScore: 2, awayScore: 3, status: "completed", date: "21 Feb 2026" },
  { id: 2, home: "Dan Matei", away: "Luceafărul", homeScore: 4, awayScore: 4, status: "completed", date: "21 Feb 2026" },
  { id: 3, home: "Dan Matei", away: "Câmpia Turzii", homeScore: 1, awayScore: 6, status: "completed", date: "21 Feb 2026" },
  { id: 4, home: "Dan Matei", away: "Gilău", homeScore: 4, awayScore: 1, status: "completed", date: "21 Feb 2026" },
  { id: 5, home: "Dan Matei", away: "U Evolution", homeScore: 7, awayScore: 2, status: "completed", date: "21 Feb 2026" },
];

function getResult(homeScore: number | null, awayScore: number | null) {
  if (homeScore === null || awayScore === null) return null;
  if (homeScore > awayScore) return "win";
  if (homeScore < awayScore) return "loss";
  return "draw";
}

export default function Results() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  const completed = matches.filter((m) => m.status === "completed");
  const wins = completed.filter((m) => getResult(m.homeScore, m.awayScore) === "win").length;
  const draws = completed.filter((m) => getResult(m.homeScore, m.awayScore) === "draw").length;
  const losses = completed.filter((m) => getResult(m.homeScore, m.awayScore) === "loss").length;
  const goalsFor = completed.reduce((acc, m) => acc + (m.homeScore ?? 0), 0);
  const goalsAgainst = completed.reduce((acc, m) => acc + (m.awayScore ?? 0), 0);

  const resultConfig = {
    win: { border: "border-l-emerald-400", bg: "from-emerald-500/5", text: "text-emerald-400", label: "Victorie", badge: "bg-emerald-400/10 text-emerald-400" },
    loss: { border: "border-l-red-400", bg: "from-red-500/5", text: "text-red-400", label: "Înfrângere", badge: "bg-red-400/10 text-red-400" },
    draw: { border: "border-l-gold", bg: "from-amber-500/5", text: "text-gold", label: "Egal", badge: "bg-amber-400/10 text-gold" },
  };

  return (
    <section id="rezultate" className="relative section-padding overflow-hidden bg-[oklch(0.10_0.02_250)]" ref={ref}>
      {/* Pitch texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 40px, oklch(0.80 0.15 200 / 0.3) 40px, oklch(0.80 0.15 200 / 0.3) 41px)",
        }}
      />

      <div className="container relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: expoOut }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 sm:gap-6 mb-10 sm:mb-16"
        >
          <div>
            <span className="font-heading text-xs sm:text-sm uppercase tracking-[0.25em] text-gold mb-3 sm:mb-4 block">
              Turneu · 21 Februarie 2026
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold uppercase leading-[0.95] text-white">
              Rezultate<br />
              <span className="text-gradient-cyan">Meciuri</span>
            </h2>
          </div>

          {/* Summary Stats with count-up */}
          <div className="flex items-center gap-4 sm:gap-6 pb-1 overflow-x-auto scrollbar-hide">
            {[
              { label: "Victorii", value: wins, color: "text-emerald-400" },
              { label: "Egaluri", value: draws, color: "text-gold" },
              { label: "Înfrângeri", value: losses, color: "text-red-400" },
            ].map((stat) => (
              <div key={stat.label} className="text-center min-w-[60px]">
                <span className={`font-heading text-2xl sm:text-3xl font-bold block ${stat.color}`}>
                  <CountUpSpan target={stat.value} delay={300} />
                </span>
                <span className="font-body text-[10px] sm:text-xs uppercase tracking-[0.12em] text-white/40">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Matches List with stagger */}
        <motion.div
          className="space-y-3 sm:space-y-4"
          variants={staggerContainer(0.08)}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {matches.map((match, index) => {
            const result = getResult(match.homeScore, match.awayScore);
            const config = result ? resultConfig[result] : resultConfig.draw;

            return (
              <motion.div
                key={match.id}
                variants={staggerItem(0.5)}
                className={`relative bg-gradient-to-r ${config.bg} to-transparent bg-[oklch(0.12_0.02_250)] border border-white/5 border-l-4 ${config.border} rounded-xl sm:rounded-2xl overflow-hidden`}
              >
                <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 sm:py-5">
                  {/* Match Number */}
                  <span className="font-heading text-xl sm:text-2xl font-bold text-white/10 w-6 sm:w-8 flex-shrink-0 hidden sm:block">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  {/* Teams & Score */}
                  <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 min-w-0">
                    {/* Home */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-cyan/20 border border-cyan/30 flex items-center justify-center flex-shrink-0">
                        <span className="font-heading text-[9px] sm:text-[10px] font-bold text-cyan">DM</span>
                      </div>
                      <span className="font-heading text-sm sm:text-base uppercase tracking-wide text-white font-semibold truncate">
                        {match.home}
                      </span>
                    </div>

                    {/* Score */}
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                      <div className="flex items-center gap-1.5 sm:gap-3">
                        <span className={`font-heading text-2xl sm:text-3xl md:text-4xl font-bold tabular-nums ${
                          result === "win" ? "text-emerald-400" : result === "loss" ? "text-white/80" : "text-gold"
                        }`}>
                          {match.homeScore}
                        </span>
                        <Minus className="w-3 h-3 sm:w-4 sm:h-4 text-white/30" />
                        <span className={`font-heading text-2xl sm:text-3xl md:text-4xl font-bold tabular-nums ${
                          result === "loss" ? "text-red-400" : result === "win" ? "text-white/80" : "text-gold"
                        }`}>
                          {match.awayScore}
                        </span>
                      </div>
                      {/* Result badge — pulse for wins */}
                      <motion.span
                        className={`font-heading text-[9px] sm:text-[10px] uppercase tracking-[0.15em] px-1.5 sm:px-2 py-0.5 rounded ${config.badge}`}
                        {...(result === "win" ? {
                          animate: { scale: [1, 1.05, 1] },
                          transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                        } : {})}
                      >
                        {config.label}
                      </motion.span>
                    </div>

                    {/* Away */}
                    <div className="flex items-center justify-end gap-2 sm:gap-3 min-w-0">
                      <span className="font-heading text-sm sm:text-base uppercase tracking-wide text-white/80 text-right truncate">
                        {match.away}
                      </span>
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <span className="font-heading text-[9px] sm:text-[10px] font-bold text-white/40">
                          {match.away.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="hidden md:flex items-center gap-1.5 text-white/30 flex-shrink-0 pl-4 border-l border-white/5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="font-body text-xs">{match.date}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Goal Tally Footer */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: dur.medium, delay: 0.5, ease: expoOut }}
          className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-white/5"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 sm:gap-6">
            <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto scrollbar-hide w-full sm:w-auto pb-1">
              <div>
                <span className="font-heading text-2xl sm:text-3xl font-bold text-cyan">
                  <CountUpSpan target={goalsFor} delay={600} />
                </span>
                <span className="block font-body text-[10px] sm:text-xs uppercase tracking-[0.12em] text-white/40 mt-1">
                  Goluri Marcate
                </span>
              </div>
              <div>
                <span className="font-heading text-2xl sm:text-3xl font-bold text-white/50">
                  <CountUpSpan target={goalsAgainst} delay={700} />
                </span>
                <span className="block font-body text-[10px] sm:text-xs uppercase tracking-[0.12em] text-white/40 mt-1">
                  Goluri Primite
                </span>
              </div>
              <div>
                <span className={`font-heading text-2xl sm:text-3xl font-bold ${goalsFor - goalsAgainst >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {goalsFor - goalsAgainst > 0 ? "+" : ""}
                  <CountUpSpan target={Math.abs(goalsFor - goalsAgainst)} delay={800} />
                </span>
                <span className="block font-body text-[10px] sm:text-xs uppercase tracking-[0.12em] text-white/40 mt-1">
                  Diferență
                </span>
              </div>
            </div>
            <span className="font-body text-[10px] sm:text-xs text-white/30 italic flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Actualizat după fiecare meci
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
