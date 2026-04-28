/**
 * SlideShell — shared frame for the three swipe-deck slides.
 *
 * Provides the top eyebrow (index + label), the title block, and the
 * sticky bottom-right CTA that appears on every slide. Each slide passes
 * its own body content as children. Visual identity (colors, decoration)
 * is the slide's job, not the shell's.
 */
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Props = {
  index: number;
  total: number;
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  accent: "cyan" | "gold" | "navy";
  children: ReactNode;
};

const accentToken = {
  cyan: "text-brand-cyan",
  gold: "text-brand-gold",
  navy: "text-brand-cyan-dark",
};

export default function SlideShell({
  index,
  total,
  eyebrow,
  title,
  subtitle,
  ctaLabel = "Înscrie copilul",
  ctaHref = "/inregistrare",
  accent,
  children,
}: Props) {
  return (
    <section
      aria-roledescription="slide"
      aria-label={`${eyebrow} (${index} din ${total})`}
      className="relative flex h-full w-full flex-col px-5 pb-28 pt-6 sm:px-10 sm:pt-10 lg:px-20 lg:pb-32 lg:pt-14"
    >
      {/* Eyebrow */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: expoOut }}
        className="flex items-center gap-3"
      >
        <span
          className={`font-heading text-xs font-semibold tabular-nums ${accentToken[accent]}`}
        >
          {String(index).padStart(2, "0")}
          <span className="mx-1.5 text-white/30">/</span>
          <span className="text-white/40">
            {String(total).padStart(2, "0")}
          </span>
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-white/20 via-white/10 to-transparent" />
        <span className="font-heading text-[10px] font-medium uppercase tracking-[0.3em] text-white/50">
          {eyebrow}
        </span>
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.08, ease: expoOut }}
        className="mt-6 font-heading text-4xl font-bold uppercase leading-[1.02] tracking-[0.02em] text-white sm:text-6xl lg:text-7xl"
      >
        {title}
      </motion.h2>

      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: expoOut }}
          className="mt-4 max-w-2xl font-body text-base text-white/65 sm:text-lg"
        >
          {subtitle}
        </motion.p>
      )}

      {/* Body */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.28, ease: expoOut }}
        className="mt-8 flex-1"
      >
        {children}
      </motion.div>

      {/* Sticky CTA */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: expoOut }}
        className="pointer-events-none absolute bottom-20 right-5 z-20 sm:bottom-24 sm:right-10 lg:right-20"
      >
        <Link
          href={ctaHref}
          className="touch-target pointer-events-auto group inline-flex items-center gap-3 rounded-full bg-brand-cyan px-6 py-3.5 font-heading text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] shadow-[0_10px_40px_-8px_oklch(0.75_0.12_230/0.6)] transition-all hover:-translate-y-0.5 hover:bg-[oklch(0.82_0.13_220)] hover:shadow-[0_16px_60px_-8px_oklch(0.82_0.13_220/0.7)]"
        >
          {ctaLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
    </section>
  );
}
