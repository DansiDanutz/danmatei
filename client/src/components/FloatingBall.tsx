/**
 * FloatingBall — Interactive football with physics
 * A small ball that floats around the page, can be dragged
 * and thrown, bounces off viewport edges with realistic physics.
 * Uses framer-motion drag + spring for natural feel.
 */
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion";
import { useState, useCallback, useRef, useEffect } from "react";

export default function FloatingBall() {
  const [visible, setVisible] = useState(true);
  const [trails, setTrails] = useState<{ id: number; x: number; y: number }[]>([]);
  const trailId = useRef(0);
  const lastTrailTime = useRef(0);

  const x = useMotionValue(typeof window !== "undefined" ? window.innerWidth - 80 : 500);
  const y = useMotionValue(typeof window !== "undefined" ? 200 : 200);

  const rotateZ = useSpring(useTransform(x, [0, typeof window !== "undefined" ? window.innerWidth : 1000], [0, 720]), {
    stiffness: 60,
    damping: 20,
  });

  const handleDrag = useCallback(() => {
    const now = Date.now();
    if (now - lastTrailTime.current < 50) return;
    lastTrailTime.current = now;

    const id = trailId.current++;
    setTrails((prev) => [...prev.slice(-8), { id, x: x.get(), y: y.get() }]);
  }, [x, y]);

  // Clean old trails
  useEffect(() => {
    const interval = setInterval(() => {
      setTrails((prev) => {
        if (prev.length === 0) return prev;
        return prev.slice(1);
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* Trail particles */}
      <AnimatePresence>
        {trails.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0.4, scale: 1 }}
            exit={{ opacity: 0, scale: 0.3 }}
            className="fixed z-[45] pointer-events-none"
            style={{
              left: t.x - 6,
              top: t.y - 6,
            }}
          >
            <div className="w-3 h-3 rounded-full bg-brand-gold/20" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Ball */}
      <motion.div
        className="fixed z-[55] cursor-grab active:cursor-grabbing"
        style={{ x, y }}
        drag
        dragMomentum
        dragElastic={0.1}
        dragConstraints={{
          top: 0,
          left: 0,
          right: typeof window !== "undefined" ? window.innerWidth : 1000,
          bottom: typeof window !== "undefined" ? window.innerHeight : 800,
        }}
        dragTransition={{ bounceStiffness: 300, bounceDamping: 20 }}
        onDrag={handleDrag}
        whileTap={{ scale: 1.15 }}
        whileHover={{ scale: 1.05 }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25, delay: 2 }}
      >
        <motion.div
          style={{ rotate: rotateZ }}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full relative shadow-lg shadow-black/30"
        >
          {/* Ball body */}
          <div
            className="w-full h-full rounded-full relative overflow-hidden"
            style={{
              background: "radial-gradient(circle at 35% 30%, oklch(0.96 0.01 80), oklch(0.88 0.03 80))",
              boxShadow:
                "inset -2px -2px 6px oklch(0.6 0.02 80 / 0.3), 0 2px 8px oklch(0.75 0.14 85 / 0.25)",
            }}
          >
            {/* Pentagon patches */}
            <div className="absolute top-[22%] left-[30%] w-[30%] h-[25%] bg-oklch(0.15 0.02 250) rotate-[15deg] rounded-[2px]" />
            <div className="absolute top-[50%] left-[15%] w-[25%] h-[22%] bg-oklch(0.15 0.02 250) rotate-[-10deg] rounded-[2px]" />
            <div className="absolute top-[48%] left-[55%] w-[28%] h-[24%] bg-oklch(0.15 0.02 250) rotate-[8deg] rounded-[2px]" />
            <div className="absolute top-[20%] left-[60%] w-[22%] h-[20%] bg-oklch(0.15 0.02 250) rotate-[-5deg] rounded-[2px]" />

            {/* Highlight */}
            <div className="absolute top-[12%] left-[25%] w-[35%] h-[25%] bg-white/30 rounded-full blur-[2px]" />
          </div>
        </motion.div>

        {/* Dismiss button (tiny X) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setVisible(false);
          }}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-cyan/80 text-[oklch(0.08_0.02_250)] flex items-center justify-center text-[8px] font-bold opacity-0 hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      </motion.div>
    </>
  );
}
