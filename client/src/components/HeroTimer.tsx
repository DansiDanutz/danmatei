/**
 * HeroTimer — wraps the landing hero card with a 5-second auto-redirect to
 * `/cunoaste`. Renders a circular progress ring + "Sări peste" skip pill in
 * the top-right of the card so the redirect is never a surprise.
 *
 * Constraints:
 *   - Animation budget capped at 5s (HERO_REDIRECT_MS).
 *   - Honors prefers-reduced-motion: no animated ring, but still redirects
 *     on schedule. Users who can't tolerate motion still progress.
 *   - Devx escape: ?stay=1 in the URL pauses the redirect indefinitely so
 *     designers can iterate on the card.
 */
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { HERO_REDIRECT_MS } from "@/data/landing";

const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];
const RING_SIZE = 44;
const RING_RADIUS = 18;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

interface HeroTimerProps {
  children: ReactNode;
  redirectTo?: string;
  /**
   * When true, behaves as if `?stay=1` is set — no auto-redirect, no skip
   * pill, no countdown ring. Use while iterating on the landing card so
   * the page doesn't navigate away mid-edit.
   */
  disabled?: boolean;
}

export default function HeroTimer({
  children,
  redirectTo = "/cunoaste",
  disabled = false,
}: HeroTimerProps) {
  const [, navigate] = useLocation();
  const reduce = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const timeoutId = useRef<number | null>(null);
  const cancelled = useRef(false);

  // Devx escape: ?stay=1 pauses the redirect. The `disabled` prop has the
  // same effect but is set in code (used while we iterate on /).
  const stay =
    disabled ||
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("stay") === "1");

  useEffect(() => {
    if (stay) return;

    const tick = (now: number) => {
      if (cancelled.current) return;
      if (startedAt.current === null) startedAt.current = now;
      const elapsed = now - startedAt.current;
      const pct = Math.min(1, elapsed / HERO_REDIRECT_MS);
      setProgress(pct);
      if (pct < 1) rafId.current = requestAnimationFrame(tick);
    };

    if (!reduce) {
      rafId.current = requestAnimationFrame(tick);
    } else {
      // Reduced motion: skip the ring animation but still redirect at 5s.
      setProgress(1);
    }

    timeoutId.current = window.setTimeout(() => {
      if (cancelled.current) return;
      navigate(redirectTo);
    }, HERO_REDIRECT_MS);

    return () => {
      cancelled.current = true;
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      if (timeoutId.current !== null) window.clearTimeout(timeoutId.current);
    };
  }, [navigate, redirectTo, reduce, stay]);

  const skip = () => {
    cancelled.current = true;
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    if (timeoutId.current !== null) window.clearTimeout(timeoutId.current);
    navigate(redirectTo);
  };

  const dashOffset = RING_CIRC * (1 - progress);

  return (
    <div className="relative">
      {children}

      {/* Skip pill with progress ring — top-right of the wrapped card */}
      {!stay && (
        <motion.button
          type="button"
          onClick={skip}
          aria-label="Sări peste introducere"
          initial={{ opacity: 0, scale: 0.8, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: expoOut }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="touch-target absolute right-3 top-3 z-30 flex items-center gap-2 rounded-full border border-white/15 bg-black/40 pl-2 pr-3.5 backdrop-blur-md transition-colors hover:border-brand-cyan/50 hover:bg-black/60"
        >
          <span className="relative grid place-items-center">
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              className="-rotate-90"
              aria-hidden="true"
            >
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                strokeWidth={2}
                stroke="oklch(1 0 0 / 0.12)"
                fill="none"
              />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                strokeWidth={2}
                stroke="oklch(0.75 0.12 230)"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={dashOffset}
                style={{ transition: reduce ? undefined : "none" }}
              />
            </svg>
            <span className="absolute font-heading text-[10px] font-semibold text-brand-cyan tabular-nums">
              {Math.max(
                1,
                Math.ceil((1 - progress) * (HERO_REDIRECT_MS / 1000))
              )}
            </span>
          </span>
          <span className="font-heading text-[11px] font-medium uppercase tracking-[0.18em] text-white/85">
            Sări peste
          </span>
        </motion.button>
      )}
    </div>
  );
}
