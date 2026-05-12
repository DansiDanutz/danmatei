/**
 * CTA — Floating gold particles, word-by-word title reveal,
 * and magnetic hover effect on buttons.
 */
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useCallback } from "react";
import { Phone, Mail, MapPin, Clock, Users } from "lucide-react";
import { expoOut, staggerContainer, staggerItem, tapScale } from "@/lib/motion";

const CTA_BG = "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1920&q=80";

const infoItems = [
  { icon: Users, title: "Categorii", description: "2006-2017" },
  { icon: MapPin, title: "Locație", description: "Baza Unirea + Baza Cotton" },
  { icon: Clock, title: "Program", description: "Luni-Vineri 16-19" },
];

/** Gold floating particles */
function GoldParticles() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: 2 + Math.random() * 3,
    delay: Math.random() * 4,
    duration: 6 + Math.random() * 4,
  }));

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-brand-gold/30"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            bottom: "-5%",
          }}
          animate={{
            y: [0, -(typeof window !== "undefined" ? window.innerHeight : 800)],
            opacity: [0, 0.6, 0.3, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

/** Magnetic hover button wrapper */
function MagneticButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 20 });
  const springY = useSpring(y, { stiffness: 200, damping: 20 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * 0.15);
    y.set((e.clientY - centerY) * 0.15);
  }, [x, y]);

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.div
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function CTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="enrollment" className="relative py-20 sm:py-28 lg:py-32 overflow-hidden" ref={ref}>
      {/* Background */}
      <div className="absolute inset-0">
        <img src={CTA_BG} alt="Teren de fotbal" className="w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.06_0.02_250/0.95)] via-[oklch(0.06_0.02_250/0.88)] to-[oklch(0.08_0.02_250/0.95)]" />
      </div>

      {/* Gold particles */}
      <GoldParticles />

      <div className="container relative z-10 flex flex-col items-center justify-center text-center px-4">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, ease: expoOut }}
          className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 mb-5 sm:mb-6"
        >
          <motion.span
            className="w-2 h-2 rounded-full bg-gold flex-shrink-0"
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="font-body text-xs sm:text-sm text-white/80 tracking-wide">
            Înscrieri deschise pentru toate categoriile
          </span>
        </motion.div>

        {/* Main CTA with word-by-word reveal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1, ease: expoOut }}
        >
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold uppercase leading-[0.95] text-white mb-4 sm:mb-6">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2, ease: expoOut }}
              className="block"
            >
              Gata să devii
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.35, ease: expoOut }}
              className="text-gradient-cyan block"
            >
              Campion?
            </motion.span>
          </h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="font-body text-base sm:text-lg md:text-xl text-white/70 max-w-xl sm:max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2"
          >
            Alătură-te Școlii de Fotbal Dan Matei și descoperă pasiunea pentru fotbal.
            Antrenamente profesionale și o comunitate dedicată succesului tău.
          </motion.p>
        </motion.div>

        {/* CTA Buttons with magnetic hover */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2, ease: expoOut }}
          className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto px-4 sm:px-0"
        >
          <MagneticButton className="flex-shrink-0">
            <a
              href="tel:0744311147"
              className="inline-flex items-center justify-center gap-2 bg-gold text-[oklch(0.08_0.02_250)] font-heading text-sm uppercase tracking-[0.12em] px-6 sm:px-10 py-4 rounded-xl hover:bg-[oklch(0.82_0.16_80)] transition-all duration-300 glow-gold touch-target"
            >
              <Phone className="w-4 h-4" />
              Sună Acum: 0744 311 147
            </a>
          </MagneticButton>
          <MagneticButton className="flex-shrink-0">
            <a
              href="mailto:zzizzou5@yahoo.com"
              className="inline-flex items-center justify-center gap-2 border-2 border-cyan text-cyan font-heading text-sm uppercase tracking-[0.12em] px-6 sm:px-10 py-4 rounded-xl hover:bg-cyan/10 transition-all duration-300 touch-target"
            >
              <Mail className="w-4 h-4" />
              Trimite Email
            </a>
          </MagneticButton>
        </motion.div>

        {/* Info Grid */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mt-12 sm:mt-16 pt-8 sm:pt-12 border-t border-white/10 w-full max-w-2xl lg:max-w-3xl"
          variants={staggerContainer(0.1)}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {infoItems.map((info) => (
            <motion.div
              key={info.title}
              variants={staggerItem()}
              className="flex flex-col items-center gap-2"
            >
              <motion.div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-1"
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                <info.icon className="w-5 h-5 sm:w-6 sm:h-6 text-gold" />
              </motion.div>
              <span className="font-heading text-xs sm:text-sm uppercase tracking-[0.15em] text-gold block">
                {info.title}
              </span>
              <span className="font-body text-sm sm:text-base text-white/70">{info.description}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
