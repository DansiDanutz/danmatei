/**
 * Player Showcase Card - Animated football silhouette
 * Uses Framer Motion for floating, glow, and scale animations
 * Follows huashu-design motion principles
 */
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";

export default function PlayerShowcase() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="relative section-padding overflow-hidden" ref={ref}>
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left: Animated Image Card */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="relative order-2 lg:order-1"
          >
            {/* Main Card Container */}
            <div className="relative bg-[oklch(0.10_0.02_250)] border border-white/10 rounded-3xl p-6 sm:p-10 overflow-hidden">
              {/* Animated gradient background */}
              <motion.div
                className="absolute inset-0 opacity-20"
                animate={{
                  background: [
                    "radial-gradient(circle at 30% 50%, oklch(0.75 0.15 200 / 0.3) 0%, transparent 60%)",
                    "radial-gradient(circle at 70% 50%, oklch(0.80 0.16 80 / 0.3) 0%, transparent 60%)",
                    "radial-gradient(circle at 30% 50%, oklch(0.75 0.15 200 / 0.3) 0%, transparent 60%)",
                  ],
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Floating silhouette container */}
              <motion.div
                className="relative z-10 flex items-center justify-center py-8 sm:py-12"
                animate={{
                  y: [0, -12, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {/* Glow effect behind image */}
                <motion.div
                  className="absolute w-48 h-48 sm:w-64 sm:h-64 rounded-full blur-3xl"
                  style={{ background: "oklch(0.75 0.15 200 / 0.25)" }}
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.4, 0.7, 0.4],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                {/* Silhouette Image with filter */}
                <motion.img
                  src="/football-silhouette.png"
                  alt="Football player silhouette"
                  className="relative z-10 w-48 sm:w-64 h-auto drop-shadow-2xl"
                  style={{
                    filter: "brightness(0) invert(1) drop-shadow(0 0 20px oklch(0.75 0.15 200 / 0.5))",
                  }}
                  whileHover={{ scale: 1.08, rotate: 2 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
              </motion.div>

              {/* Animated stats bar */}
              <motion.div
                className="relative z-10 flex justify-center gap-6 sm:gap-10 mt-4"
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                {[
                  { value: "100+", label: "Sportivi" },
                  { value: "8+", label: "Ani Exp." },
                  { value: "UEFA", label: "Licență" },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    className="text-center"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
                  >
                    <span className="font-heading text-xl sm:text-2xl font-bold text-gradient-cyan block">
                      {stat.value}
                    </span>
                    <span className="font-body text-[10px] sm:text-xs uppercase tracking-wider text-white/50">
                      {stat.label}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Decorative elements */}
            <motion.div
              className="absolute -bottom-3 -right-3 w-full h-full border-2 border-cyan/20 rounded-3xl -z-10"
              animate={{ opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          </motion.div>

          {/* Right: Text Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="order-1 lg:order-2"
          >
            <span className="font-heading text-xs sm:text-sm uppercase tracking-[0.25em] text-cyan mb-3 sm:mb-4 block">
              Pasiune & Dedicare
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold uppercase leading-[0.95] text-white mb-5 sm:mb-6">
              Fiecare<br />
              <span className="text-gradient-gold">Șut</span> Contează
            </h2>
            <p className="font-body text-base sm:text-lg text-white/70 leading-relaxed mb-6">
              La Școala de Fotbal Dan Matei, fiecare copil învață să dea totul pe teren. 
              De la primii pași cu mingea până la execuții spectaculoase, formăm nu doar 
              sportivi, ci caractere puternice.
            </p>

            {/* Animated feature list */}
            <div className="space-y-4">
              {[
                { title: "Tehnică Avansată", desc: "Control, pase și finalizare la nivel profesional" },
                { title: "Conditie Fizică", desc: "Pregătire athletică specifică fotbalului" },
                { title: "Spirit de Echipă", desc: "Colaborare, comunicare și încredere" },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  className="flex items-start gap-4 p-4 rounded-xl bg-[oklch(0.12_0.02_250)] border border-white/5 hover:border-cyan/30 transition-all duration-300"
                  initial={{ opacity: 0, x: 20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                  whileHover={{ x: 4 }}
                >
                  <div className="w-2 h-2 rounded-full bg-cyan mt-2 flex-shrink-0" />
                  <div>
                    <h4 className="font-heading text-sm uppercase tracking-wider text-white mb-1">
                      {item.title}
                    </h4>
                    <p className="font-body text-sm text-white/50">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
