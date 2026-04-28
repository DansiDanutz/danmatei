/**
 * Programs — Staggered cards with gradient borders on hover,
 * animated feature list, and arrow underline.
 */
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Users, Clock, Target, ArrowRight } from "lucide-react";
import { expoOut, staggerContainer, staggerItem, hoverLift, tapScale, dur } from "@/lib/motion";

const programs = [
  {
    category: "Copii Mici",
    ageRange: "2006-2011",
    description: "Inițiere și dezvoltare fundamentală a tehnicii de fotbal",
    features: ["Antrenamente 2x/săptămână", "Jocuri amicale", "Dezvoltare caracter"],
    icon: Users,
    color: "cyan",
  },
  {
    category: "Copii",
    ageRange: "2012-2014",
    description: "Consolidare abilități și introducere în competiții oficiale",
    features: ["Antrenamente 3x/săptămână", "Campionate regionale", "Nutriție sportivă"],
    icon: Target,
    color: "gold",
  },
  {
    category: "Juniori",
    ageRange: "2015-2017",
    description: "Pregătire avansată și competiții de nivel înalt",
    features: ["Antrenamente 4x/săptămână", "Campionate naționale", "Analiză video"],
    icon: Clock,
    color: "cyan",
  },
];

export default function Programs() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="programe" className="relative section-padding overflow-hidden bg-[oklch(0.10_0.02_250)]" ref={ref}>
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="container relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: expoOut }}
          className="max-w-2xl mb-10 sm:mb-16"
        >
          <span className="font-heading text-xs sm:text-sm uppercase tracking-[0.25em] text-gold mb-3 sm:mb-4 block">
            Programe de Antrenament
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold uppercase leading-[0.95] text-white mb-4 sm:mb-6">
            Categorii<br />
            <span className="text-gradient-cyan">de Vârstă</span>
          </h2>
          <p className="font-body text-base sm:text-lg text-white/70 leading-relaxed">
            Programe structurate pentru fiecare categorie, cu metodologie modernă și antrenori cu licență UEFA.
          </p>
        </motion.div>

        {/* Programs Grid */}
        <motion.div
          className="grid md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8"
          variants={staggerContainer(0.12)}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {programs.map((program) => (
            <motion.div
              key={program.category}
              variants={staggerItem(dur.slow)}
              whileHover={hoverLift}
              className="group relative"
            >
              <div className={`relative bg-[oklch(0.12_0.02_250)] backdrop-blur-xl border rounded-2xl p-5 sm:p-8 h-full transition-all duration-500 overflow-hidden ${
                program.color === "gold"
                  ? "border-white/10 hover:border-brand-gold/40"
                  : "border-white/10 hover:border-brand-cyan/40"
              }`}>
                {/* Gradient border glow on hover */}
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                  program.color === "gold"
                    ? "bg-gradient-to-br from-brand-gold/5 to-transparent"
                    : "bg-gradient-to-br from-brand-cyan/5 to-transparent"
                }`} />

                {/* Decorative circle */}
                <div className={`absolute -top-6 -right-6 w-28 h-28 sm:w-32 sm:h-32 rounded-full transition-all duration-500 ${
                  program.color === "gold"
                    ? "bg-gradient-to-br from-brand-gold/10 to-transparent group-hover:from-brand-gold/20"
                    : "bg-gradient-to-br from-brand-cyan/10 to-transparent group-hover:from-brand-cyan/20"
                }`} />

                {/* Icon */}
                <div className="relative mb-5 sm:mb-6">
                  <motion.div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-colors ${
                      program.color === "gold"
                        ? "bg-brand-gold/10 group-hover:bg-brand-gold/20"
                        : "bg-brand-cyan/10 group-hover:bg-brand-cyan/20"
                    }`}
                    whileHover={{ scale: 1.1, rotate: 3 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    <program.icon className={`w-6 h-6 sm:w-7 sm:h-7 ${
                      program.color === "gold" ? "text-brand-gold" : "text-brand-cyan"
                    }`} />
                  </motion.div>
                </div>

                {/* Content */}
                <div className="relative">
                  <span className={`font-heading text-[10px] sm:text-xs uppercase tracking-[0.25em] mb-1.5 sm:mb-2 block ${
                    program.color === "gold" ? "text-brand-gold" : "text-brand-cyan"
                  }`}>
                    {program.ageRange}
                  </span>
                  <h3 className="font-heading text-xl sm:text-2xl uppercase tracking-wider text-white mb-2 sm:mb-3">
                    {program.category}
                  </h3>
                  <p className="font-body text-sm text-white/60 mb-5 sm:mb-6 leading-relaxed">
                    {program.description}
                  </p>

                  {/* Features with stagger */}
                  <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
                    {program.features.map((feature, i) => (
                      <motion.li
                        key={feature}
                        initial={{ opacity: 0, x: -10 }}
                        animate={isInView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.4, delay: 0.4 + i * 0.08, ease: expoOut }}
                        className="flex items-start gap-2.5 sm:gap-3"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                          program.color === "gold" ? "bg-brand-gold" : "bg-brand-cyan"
                        }`} />
                        <span className="font-body text-sm text-white/70">{feature}</span>
                      </motion.li>
                    ))}
                  </ul>

                  {/* CTA with animated underline */}
                  <a
                    href="#contact"
                    className={`inline-flex items-center gap-2 font-heading text-sm uppercase tracking-wider relative group/cta ${
                      program.color === "gold" ? "text-brand-gold" : "text-brand-cyan"
                    } transition-colors duration-300 touch-target`}
                  >
                    Află mai mult
                    <ArrowRight className="w-4 h-4 transition-transform group-hover/cta:translate-x-1" />
                    <span className="absolute bottom-0 left-0 w-0 h-px group-hover/cta:w-full transition-all duration-300 current-color-bg" style={{
                      backgroundColor: program.color === "gold"
                        ? "oklch(0.75 0.14 85)"
                        : "oklch(0.75 0.12 230)",
                    }} />
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5, ease: expoOut }}
          className="mt-10 sm:mt-16 pt-8 sm:pt-12 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-6"
        >
          <div className="text-center sm:text-left">
            <h3 className="font-heading text-xl sm:text-2xl uppercase tracking-wider text-white mb-1.5 sm:mb-2">
              Gata să te alături?
            </h3>
            <p className="font-body text-sm sm:text-base text-white/60">
              Contactează-ne pentru mai multe detalii și înscrieri.
            </p>
          </div>
          <motion.a
            href="#contact"
            className="flex-shrink-0 bg-gold text-[oklch(0.08_0.02_250)] font-heading text-sm uppercase tracking-[0.12em] px-6 sm:px-8 py-4 rounded-xl hover:bg-[oklch(0.82_0.16_80)] transition-all duration-300 glow-gold touch-target w-full sm:w-auto text-center"
            whileHover={{ scale: 1.03 }}
            whileTap={tapScale}
          >
            Contactează-ne
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
