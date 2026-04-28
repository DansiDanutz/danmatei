/**
 * useCountUp — Animated number counting on scroll reveal
 * Starts from 0, animates to `target` over `duration` ms when in view.
 */
import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";

interface UseCountUpOptions {
  target: number;
  duration?: number;
  delay?: number;
  enabled?: boolean;
}

export function useCountUp({
  target,
  duration = 1200,
  delay = 0,
  enabled = true,
}: UseCountUpOptions) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled || !isInView) return;

    const timeout = setTimeout(() => {
      const start = performance.now();

      function tick(now: number) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
    }, delay);

    return () => clearTimeout(timeout);
  }, [isInView, target, duration, delay, enabled]);

  return { ref, value };
}

/**
 * CountUpSpan — convenience component
 * Renders an animated <span> counting from 0 to target.
 */
interface CountUpSpanProps {
  target: number;
  duration?: number;
  delay?: number;
  className?: string;
  suffix?: string;
}

export function CountUpSpan({
  target,
  duration,
  delay,
  className,
  suffix = "",
}: CountUpSpanProps) {
  const { ref, value } = useCountUp({ target, duration, delay });
  return (
    <span ref={ref} className={className}>
      {value}
      {suffix}
    </span>
  );
}
