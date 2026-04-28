/**
 * HeroCard — Video-based animated card
 * Uses the user's AI-generated football clip as the hero visual,
 * with branded overlay effects: gradient fades, corner brackets,
 * floating particles, and animated motto.
 */
import { motion } from "framer-motion";
import { useRef, useEffect, useState } from "react";

const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function HeroCard() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
    const onReady = () => setLoaded(true);
    if (v.readyState >= 3) setLoaded(true);
    else v.addEventListener("canplay", onReady);
    return () => v.removeEventListener("canplay", onReady);
  }, []);

  return (
    <div className="relative w-full h-full bg-[oklch(0.08_0.02_250)] overflow-hidden">
      {/* ── Video background ── */}
      <motion.video
        ref={videoRef}
        src="/football-hero.mp4"
        autoPlay
        loop
        muted
        playsInline
        initial={{ opacity: 0, scale: 1.1 }}
        animate={loaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.1 }}
        transition={{ duration: 1.2, ease: expoOut }}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* ── Gradient overlays ── */}
      {/* Bottom fade into card content */}
      <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.12_0.025_250)] via-transparent to-transparent" />
      {/* Top vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.08_0.02_250)]/40 via-transparent to-transparent" />
      {/* Side vignettes for cinematic feel */}
      <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.08_0.02_250)]/30 via-transparent to-[oklch(0.08_0.02_250)]/30" />

      {/* ── Floating particles ── */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${i % 2 === 0 ? "bg-brand-cyan/25" : "bg-brand-gold/20"}`}
          style={{
            width: 2 + (i % 2),
            height: 2 + (i % 2),
            left: `${15 + i * 16}%`,
            bottom: `${30 + (i % 3) * 18}%`,
          }}
          animate={{
            y: [0, -22, 0],
            opacity: [0.1, 0.5, 0.1],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5 + i * 0.3,
          }}
        />
      ))}

      {/* ── Corner brackets ── */}
      {[
        "top-3 left-3 border-l-2 border-t-2 rounded-tl-sm",
        "top-3 right-3 border-r-2 border-t-2 rounded-tr-sm",
        "bottom-3 left-3 border-l-2 border-b-2 rounded-bl-sm",
        "bottom-3 right-3 border-r-2 border-b-2 rounded-br-sm",
      ].map((cls, i) => (
        <motion.div
          key={i}
          className={`absolute w-5 h-5 ${cls} border-brand-cyan/25`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.6 + i * 0.07, ease: expoOut }}
        />
      ))}

      {/* ── Motto overlay ── */}
      <motion.div
        className="absolute bottom-[6%] left-0 right-0 text-center z-20"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.6, ease: expoOut }}
      >
        <motion.span
          className="font-heading text-[9px] sm:text-[10px] uppercase tracking-[0.3em] text-white/40"
          animate={{ opacity: [0.3, 0.65, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          Work Hard, Feel Good
        </motion.span>
      </motion.div>

      {/* ── Play icon (hidden once playing) ── */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[oklch(0.08_0.02_250)]/80 z-30">
          <div className="w-12 h-12 rounded-full border-2 border-brand-cyan/50 flex items-center justify-center">
            <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[14px] border-l-brand-cyan/70 ml-1" />
          </div>
        </div>
      )}
    </div>
  );
}
