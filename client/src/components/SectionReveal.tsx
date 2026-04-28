/**
 * SectionReveal — Scroll-triggered section wrapper
 * Supports direction variants (up, left, right) and stagger children.
 * Uses compositor-friendly properties only (transform, opacity).
 */
import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { expoOut, staggerContainer, staggerItem, dur } from "@/lib/motion";

type Direction = "up" | "left" | "right";

interface SectionRevealProps {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  className?: string;
  /** If true, wrap children in a stagger container */
  stagger?: boolean;
  staggerDelay?: number;
}

const hiddenMap: Record<Direction, { opacity: number; x: number; y: number }> = {
  up: { opacity: 0, x: 0, y: 40 },
  left: { opacity: 0, x: -40, y: 0 },
  right: { opacity: 0, x: 40, y: 0 },
};

export default function SectionReveal({
  children,
  direction = "up",
  delay = 0,
  className,
  stagger = false,
  staggerDelay = 0.08,
}: SectionRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const hidden = hiddenMap[direction];

  if (stagger) {
    return (
      <motion.div
        ref={ref}
        variants={staggerContainer(staggerDelay)}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: hidden.opacity, x: hidden.x, y: hidden.y }}
      animate={
        isInView
          ? { opacity: 1, x: 0, y: 0 }
          : { opacity: hidden.opacity, x: hidden.x, y: hidden.y }
      }
      transition={{ duration: dur.slow, delay, ease: expoOut }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Stagger item — use inside a <SectionReveal stagger> */
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem()} className={className}>
      {children}
    </motion.div>
  );
}
