/**
 * Responsive Hero - Mobile-first design
 * Full-viewport with parallax background, count-up stats,
 * breathing badge glow, and staggered reveals.
 */
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { CountUpSpan } from "@/hooks/useCountUp";
import { expoOut, dur } from "@/lib/motion";

const HERO_BG = "https://images.unsplash.com/photo-1522778119026-d647f0565c6a?w=1920&q=80";

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  return (
    <section
      ref={sectionRef}
      id="acasa"
      className="relative min-h-[100dvh] flex items-center overflow-hidden"
    >
      {/* Background Image with Parallax */}
      <motion.div className="absolute inset-0" style={{ y: bgY }}>
        <img
          src={HERO_BG}
          alt="Stadion de fotbal"
          className="w-full h-full object-cover scale-110"
          loading="eager"
        />
        {/* Dark overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.06_0.02_250/0.95)] via-[oklch(0.06_0.02_250/0.80)] to-[oklch(0.08_0.02_250/0.95)]" />
        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[oklch(0.08_0.02_250)] to-transparent" />
      </motion.div>

      {/* Top animated gradient line */}
      <motion.div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/50 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Content */}
      <div className="container relative z-10 pt-20 pb-16 sm:pt-24 sm:pb-20">
        <div className="max-w-3xl">
          {/* Badge with breathing glow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: expoOut }}
            className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-brand-cyan/20 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 mb-5 sm:mb-6 shadow-[0_0_20px_-4px_oklch(0.75_0.12_230/0.25)]"
          >
            <motion.span
              className="w-2 h-2 rounded-full bg-cyan flex-shrink-0"
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="font-body text-xs sm:text-sm text-white/80 tracking-wide flex items-center gap-1.5">
              <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Cluj-Napoca, România
            </span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: expoOut }}
            className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold uppercase leading-[0.92] sm:leading-[0.9] mb-5 sm:mb-6"
          >
            <motion.span
              className="text-white block"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: dur.slow, delay: 0.5, ease: expoOut }}
            >
              Școala de
            </motion.span>
            <motion.span
              className="text-white block"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: dur.slow, delay: 0.6, ease: expoOut }}
            >
              Fotbal
            </motion.span>
            <motion.span
              className="text-gradient-cyan block mt-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: dur.slow, delay: 0.7, ease: expoOut }}
            >
              Dan Matei
            </motion.span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.9, ease: expoOut }}
            className="font-body text-base sm:text-lg md:text-xl text-white/70 max-w-lg sm:max-w-xl mb-7 sm:mb-8 leading-relaxed"
          >
            Formăm viitorul fotbalului românesc prin pasiune, educație și fair-play.
            Antrenamente profesionale pentru copii și tineri.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.1, ease: expoOut }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4"
          >
            <motion.a
              href="#programe"
              className="inline-flex items-center justify-center gap-2 bg-cyan text-[oklch(0.08_0.02_250)] font-heading text-sm uppercase tracking-[0.12em] px-6 sm:px-8 py-4 rounded-xl hover:bg-[oklch(0.82_0.15_200)] transition-all duration-300 glow-cyan touch-target"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Programele Noastre
            </motion.a>
            <motion.a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/20 text-white font-heading text-sm uppercase tracking-[0.12em] px-6 sm:px-8 py-4 rounded-xl hover:bg-white/5 hover:border-white/40 transition-all duration-300 touch-target"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Înscrie-ți Copilul
            </motion.a>
          </motion.div>

          {/* Stats with Count-Up */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.3, ease: expoOut }}
            className="mt-10 sm:mt-12 pt-6 sm:pt-8 border-t border-white/10"
          >
            <div className="flex gap-6 sm:gap-8 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
              {[
                { number: 2018, label: "Înființare", isYear: true },
                { number: 8, label: "Ani Exp.", suffix: "+" },
                { number: 100, label: "Sportivi", suffix: "+" },
                { number: 0, label: "Licență", text: "UEFA" },
              ].map((stat) => (
                <div key={stat.label} className="flex-shrink-0 snap-start min-w-[80px] sm:min-w-0">
                  <span className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient-gold block">
                    {stat.text ? (
                      stat.text
                    ) : stat.isYear ? (
                      <CountUpSpan target={stat.number} delay={1600} />
                    ) : (
                      <>
                        <CountUpSpan target={stat.number} delay={1600} />
                        {stat.suffix}
                      </>
                    )}
                  </span>
                  <span className="font-body text-[10px] sm:text-xs uppercase tracking-[0.12em] text-white/50 mt-1 block">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.a
        href="#despre"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-white/40 hover:text-cyan transition-colors hidden sm:flex"
      >
        <span className="font-body text-xs uppercase tracking-[0.2em]">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </motion.a>
    </section>
  );
}
