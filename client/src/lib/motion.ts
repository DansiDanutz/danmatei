/**
 * Motion — Shared animation presets for Framer Motion
 * Centralises timing, easing, and variant definitions used across the app.
 * All animations use compositor-friendly properties only (transform, opacity).
 */

// ── Easing curves ──────────────────────────────────────────────────────────
export const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const easeOut: [number, number, number, number] = [0.0, 0.0, 0.2, 1];

// ── Spring configs ─────────────────────────────────────────────────────────
export const springBounce = { type: "spring" as const, stiffness: 300, damping: 20 };
export const springSmooth = { type: "spring" as const, stiffness: 200, damping: 30 };
export const springSnappy  = { type: "spring" as const, stiffness: 400, damping: 25 };

// ── Duration presets ───────────────────────────────────────────────────────
export const dur = {
  fast: 0.15,
  normal: 0.3,
  medium: 0.5,
  slow: 0.7,
  reveal: 0.9,
} as const;

// ── Variant factories ──────────────────────────────────────────────────────

/** Fade up — default section entrance */
export const fadeUp = (delay = 0, duration = dur.slow) => ({
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration, delay, ease: expoOut } },
});

/** Fade in — no translation */
export const fadeIn = (delay = 0, duration = dur.slow) => ({
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration, delay, ease: expoOut } },
});

/** Scale in — subtle grow */
export const scaleIn = (delay = 0, duration = dur.medium) => ({
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: { duration, delay, ease: expoOut } },
});

/** Slide from left */
export const slideInLeft = (delay = 0, duration = dur.slow) => ({
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0, transition: { duration, delay, ease: expoOut } },
});

/** Slide from right */
export const slideInRight = (delay = 0, duration = dur.slow) => ({
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0, transition: { duration, delay, ease: expoOut } },
});

// ── Stagger container ──────────────────────────────────────────────────────

/**
 * Wraps children so each receives an incremental delay.
 * Children should use `staggerItem()` or their own `transition.delay`.
 */
export const staggerContainer = (staggerDelay = 0.08) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: staggerDelay, delayChildren: 0.1 },
  },
});

/** Item inside a staggerContainer — fadeUp style */
export const staggerItem = (duration: number = dur.medium) => ({
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration, ease: expoOut },
  },
});

// ── Hover interactions ─────────────────────────────────────────────────────
export const hoverLift = {
  y: -4,
  transition: { duration: dur.normal, ease: easeOut },
};

export const hoverGlow = {
  filter: "brightness(1.15)",
  transition: { duration: dur.normal },
};

// ── Tap interactions ───────────────────────────────────────────────────────
export const tapScale = {
  scale: 0.97,
  transition: { duration: dur.fast },
};
