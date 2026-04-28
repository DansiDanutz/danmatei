/**
 * ScrollProgress — Thin top-of-page scroll indicator
 * Shows brand-cyan progress bar using spring-smoothed scroll value.
 */
import { motion, type MotionValue } from "framer-motion";

interface ScrollProgressProps {
  progress: MotionValue<number>;
}

export default function ScrollProgress({ progress }: ScrollProgressProps) {
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] bg-brand-cyan/80 z-[60] origin-left"
      style={{ scaleX: progress }}
    />
  );
}
