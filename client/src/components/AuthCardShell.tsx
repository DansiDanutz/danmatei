/**
 * AuthCardShell — shared wrapper for /login + /inregistrare so they share
 * the same cyan-anchored visual identity as / and /cunoaste.
 */
import { motion } from "framer-motion";
import { Link } from "wouter";
import type { ReactNode } from "react";
import { Home as HomeIcon } from "lucide-react";

const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Props = {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthCardShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: Props) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[oklch(0.08_0.02_250)] text-white">
      {/* Atmosphere */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-1/4 size-[36rem] rounded-full bg-brand-cyan/[0.07] blur-3xl" />
        <div className="absolute -right-32 bottom-1/4 size-[32rem] rounded-full bg-brand-cyan/[0.05] blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-4 sm:px-10">
        <Link
          href="/"
          className="group inline-flex items-center gap-3"
          aria-label="Acasă"
        >
          <span className="grid size-10 place-items-center rounded-full ring-1 ring-brand-cyan/30 shadow-[0_0_24px_-6px_oklch(0.75_0.12_230/0.45)] transition-transform group-hover:scale-105">
            <img
              src="/logo-official.jpg"
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-full"
            />
          </span>
          <span className="hidden font-heading text-xs font-semibold uppercase tracking-[0.22em] text-white/85 sm:inline">
            Școala Dan Matei
          </span>
        </Link>

        <Link
          href="/"
          className="touch-target inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 font-heading text-[11px] font-medium uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-brand-cyan/40 hover:text-white"
        >
          <HomeIcon className="size-3.5" />
          Acasă
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-start justify-center px-4 py-8 sm:py-14">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: expoOut }}
            className="flex items-center gap-3"
          >
            <span className="font-heading text-[10px] font-medium uppercase tracking-[0.3em] text-brand-cyan/80">
              {eyebrow}
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-brand-cyan/30 via-white/10 to-transparent" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: expoOut }}
            className="mt-3 font-heading text-3xl font-bold uppercase leading-[1.05] tracking-[0.02em] text-white sm:text-4xl"
          >
            {title}
          </motion.h1>

          {subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: expoOut }}
              className="mt-3 font-body text-sm leading-relaxed text-white/60 sm:text-base"
            >
              {subtitle}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24, ease: expoOut }}
            className="mt-8 rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-6 shadow-[0_30px_80px_-30px_oklch(0.75_0.12_230/0.35)] backdrop-blur-sm sm:p-8"
          >
            {children}
          </motion.div>

          {footer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="mt-6 text-center font-body text-sm text-white/55"
            >
              {footer}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
