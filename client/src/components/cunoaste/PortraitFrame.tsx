/**
 * PortraitFrame — branded placeholder portrait used until real photos are
 * uploaded via /admin (Phase 5). Renders an OKLCH gradient disc with
 * initials in Oswald, plus broadcast-style corner brackets to match the
 * existing HeroCard visual language.
 *
 * Drop a real image at `imageSrc` once available — the frame falls back
 * to the gradient if the image fails to load.
 */
import { motion } from "framer-motion";
import { useState } from "react";

type Props = {
  initials: string;
  accent?: "cyan" | "gold" | "navy";
  imageSrc?: string | null;
  className?: string;
};

const accentMap = {
  cyan: {
    grad: "from-[oklch(0.55_0.13_230)] via-[oklch(0.32_0.10_230)] to-[oklch(0.18_0.06_240)]",
    bracket: "border-brand-cyan/45",
    initials: "text-brand-cyan",
  },
  gold: {
    grad: "from-[oklch(0.55_0.14_85)] via-[oklch(0.32_0.10_85)] to-[oklch(0.18_0.05_240)]",
    bracket: "border-brand-gold/45",
    initials: "text-brand-gold",
  },
  navy: {
    grad: "from-[oklch(0.42_0.10_220)] via-[oklch(0.25_0.07_220)] to-[oklch(0.14_0.04_240)]",
    bracket: "border-white/30",
    initials: "text-white/85",
  },
} as const;

export default function PortraitFrame({
  initials,
  accent = "cyan",
  imageSrc,
  className = "",
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const tokens = accentMap[accent];
  const showImage = imageSrc && !imgFailed;

  return (
    <div className={`relative overflow-hidden rounded-3xl ${className}`}>
      <div
        className={`absolute inset-0 bg-gradient-to-br ${tokens.grad}`}
        aria-hidden="true"
      />

      {/* Subtle texture grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
            "linear-gradient(0deg, oklch(1 0 0 / 0.08) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Real photo (lazy fallback) */}
      {showImage && (
        <img
          src={imageSrc}
          alt=""
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Initials disc — only shows when no photo */}
      {!showImage && (
        <div className="absolute inset-0 grid place-items-center">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative grid size-32 place-items-center rounded-full border border-white/10 bg-[oklch(0.10_0.02_250)]/60 backdrop-blur-sm sm:size-40"
          >
            <span
              className={`font-heading text-5xl font-bold tracking-tight sm:text-6xl ${tokens.initials}`}
            >
              {initials}
            </span>
          </motion.div>
        </div>
      )}

      {/* Bottom fade for legibility under captions */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[oklch(0.10_0.02_250)]/80 via-[oklch(0.10_0.02_250)]/30 to-transparent" />

      {/* Broadcast brackets */}
      {[
        "top-3 left-3 border-l-2 border-t-2 rounded-tl-lg",
        "top-3 right-3 border-r-2 border-t-2 rounded-tr-lg",
        "bottom-3 left-3 border-l-2 border-b-2 rounded-bl-lg",
        "bottom-3 right-3 border-r-2 border-b-2 rounded-br-lg",
      ].map(cls => (
        <span
          key={cls}
          aria-hidden="true"
          className={`absolute size-6 ${cls} ${tokens.bracket}`}
        />
      ))}
    </div>
  );
}
