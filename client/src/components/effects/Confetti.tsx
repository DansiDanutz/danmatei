/**
 * Confetti — zero-dep CSS confetti burst.
 *
 * Renders ~60 absolutely positioned particles that fall from the top of the
 * parent container with randomized horizontal drift, spin, and delay. Pure
 * CSS animation — no js loop, no canvas, no library.
 *
 * Auto-removes itself after `durationMs` so it doesn't sit in the DOM.
 * Respects prefers-reduced-motion: returns null for users who opted out.
 */
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  /** When this becomes true, a fresh burst fires. Re-toggle to fire again. */
  fire: boolean;
  /** ms — total time before the component unmounts itself. */
  durationMs?: number;
  /** Particle count. Higher = denser burst. */
  count?: number;
};

const COLORS = [
  "#00d4ff", // brand cyan
  "#ffb800", // brand gold
  "#ffffff",
  "#22c55e",
  "#f43f5e",
  "#a855f7",
];

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export default function Confetti({
  fire,
  durationMs = 3500,
  count = 60,
}: Props) {
  const [visible, setVisible] = useState(false);
  const tokenRef = useRef(0);

  // Respect reduced-motion. Recompute once on mount; users rarely change it
  // mid-session.
  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    );
  }, []);

  useEffect(() => {
    if (!fire || reducedMotion) return;
    setVisible(true);
    tokenRef.current += 1;
    const myToken = tokenRef.current;
    const t = setTimeout(() => {
      // Only hide if no later fire has come along.
      if (tokenRef.current === myToken) setVisible(false);
    }, durationMs);
    return () => clearTimeout(t);
  }, [fire, durationMs, reducedMotion]);

  // Particle styles are stable for the lifetime of one burst.
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const left = randomBetween(0, 100); // %
      const drift = randomBetween(-25, 25); // %
      const delay = randomBetween(0, 700); // ms
      const duration = randomBetween(1800, 3200); // ms
      const size = randomBetween(6, 11); // px
      const rotateStart = randomBetween(0, 360);
      const rotateEnd = rotateStart + randomBetween(360, 1080);
      const color = COLORS[i % COLORS.length];
      const isCircle = i % 3 === 0;
      return {
        i,
        left,
        drift,
        delay,
        duration,
        size,
        rotateStart,
        rotateEnd,
        color,
        isCircle,
      };
    });
  }, [count, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || reducedMotion) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      <style>{`
        @keyframes danmateiConfettiFall {
          0% {
            transform: translate3d(0, -10vh, 0) rotate(var(--r0));
            opacity: 0;
          }
          10% { opacity: 1; }
          100% {
            transform: translate3d(var(--dx), 110vh, 0) rotate(var(--r1));
            opacity: 0.85;
          }
        }
      `}</style>
      {particles.map(p => (
        <span
          key={p.i}
          style={
            {
              position: "absolute",
              top: "0",
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              borderRadius: p.isCircle ? "50%" : "2px",
              animation: `danmateiConfettiFall ${p.duration}ms cubic-bezier(0.16,0.84,0.44,1) ${p.delay}ms forwards`,
              "--dx": `${p.drift}vw`,
              "--r0": `${p.rotateStart}deg`,
              "--r1": `${p.rotateEnd}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
