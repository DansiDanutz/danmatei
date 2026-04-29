/**
 * CunoasteDeck — Embla-powered horizontal swipe deck of three slides:
 * Owner → Trainers → Players. Includes:
 *   - Touch swipe on mobile
 *   - Keyboard ←/→ navigation
 *   - Dot pager + slide counter + arrow buttons in a sticky bottom bar
 *   - Top bar with brand mark and an "Acasă" link back to /
 */
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Home as HomeIcon } from "lucide-react";
import { Link } from "wouter";
import SlideOwner from "./SlideOwner";
import SlideTrainers from "./SlideTrainers";
import SlidePlayers from "./SlidePlayers";

const SLIDE_LABELS = ["Fondator", "Antrenori", "Jucători"] as const;

export default function CunoasteDeck() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    skipSnaps: false,
    dragFree: false,
  });
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Keyboard navigation
  useEffect(() => {
    if (!emblaApi) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        emblaApi.scrollPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        emblaApi.scrollNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [emblaApi]);

  const scrollTo = (i: number) => emblaApi?.scrollTo(i);
  const scrollPrev = () => emblaApi?.scrollPrev();
  const scrollNext = () => emblaApi?.scrollNext();
  const canPrev = selected > 0;
  const canNext = selected < SLIDE_LABELS.length - 1;

  return (
    <div className="relative flex h-[100dvh] flex-col bg-[oklch(0.08_0.02_250)] text-white">
      {/* Background atmosphere — academy blue dominates, with three tiny
          painterly accent orbs (cyan, magenta, orange) borrowed from the
          trainer portraits. All low opacity, all heavily blurred — they
          read as "atmospheric energy", not as competing colors. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Primary blue wash — the academy's heart */}
        <div className="absolute -left-40 top-1/4 size-[40rem] rounded-full bg-brand-cyan/[0.07] blur-3xl" />
        <div className="absolute -right-40 bottom-1/4 size-[36rem] rounded-full bg-[oklch(0.45_0.16_240)]/[0.08] blur-3xl" />

        {/* Painterly accent orbs — tiny, visible only on tablet+ so mobile
            stays clean. Echoes the paint splashes in Kely's portrait. */}
        <div className="absolute right-[18%] top-[8%] hidden size-[14rem] rounded-full bg-[oklch(0.65_0.22_50)]/[0.07] blur-3xl md:block" />
        <div className="absolute left-[12%] bottom-[14%] hidden size-[16rem] rounded-full bg-[oklch(0.65_0.25_340)]/[0.05] blur-3xl md:block" />
        <div className="absolute right-[32%] bottom-[36%] hidden size-[10rem] rounded-full bg-brand-gold/[0.05] blur-3xl md:block" />

        {/* Top divider line — same as Home, ties the two pages together */}
        <div className="absolute left-1/2 top-0 h-px w-[60%] -translate-x-1/2 bg-gradient-to-r from-transparent via-brand-cyan/30 to-transparent" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-4 sm:px-10 lg:px-20">
        <Link
          href="/"
          className="group inline-flex items-center gap-3"
          aria-label="Înapoi la pagina principală"
        >
          <span className="relative grid size-10 place-items-center rounded-full ring-1 ring-brand-cyan/30 shadow-[0_0_24px_-6px_oklch(0.75_0.12_230/0.45)] transition-transform group-hover:scale-105">
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

      {/* Embla viewport */}
      <div className="relative z-10 flex-1 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          <div className="min-w-0 flex-[0_0_100%]">
            <SlideOwner />
          </div>
          <div className="min-w-0 flex-[0_0_100%]">
            <SlideTrainers />
          </div>
          <div className="min-w-0 flex-[0_0_100%]">
            <SlidePlayers />
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 hidden px-5 pb-5 sm:block sm:px-10 sm:pb-6 lg:px-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-full border border-white/10 bg-[oklch(0.10_0.02_250)]/80 px-4 py-2.5 backdrop-blur-xl sm:px-5 sm:py-3"
        >
          <button
            type="button"
            onClick={scrollPrev}
            disabled={!canPrev}
            aria-label="Slide-ul anterior"
            className="touch-target grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition-all hover:border-brand-cyan/40 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:bg-white/[0.04]"
          >
            <ArrowLeft className="size-4" />
          </button>

          {/* Dot pager + label */}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              {SLIDE_LABELS.map((_label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollTo(i)}
                  aria-label={`Mergi la slide-ul ${i + 1}`}
                  aria-current={selected === i}
                  className="touch-target group flex h-8 items-center px-1"
                >
                  <span
                    className={`block h-1.5 rounded-full transition-all ${
                      selected === i
                        ? "w-9 bg-brand-cyan"
                        : "w-1.5 bg-white/25 group-hover:bg-white/45"
                    }`}
                  />
                </button>
              ))}
            </div>

            <span className="hidden font-heading text-[10px] uppercase tracking-[0.18em] text-white/50 sm:inline">
              {SLIDE_LABELS[selected]} ·{" "}
              <span className="tabular-nums text-white/70">
                {String(selected + 1).padStart(2, "0")}
                <span className="mx-1 text-white/30">/</span>
                {String(SLIDE_LABELS.length).padStart(2, "0")}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={scrollNext}
            disabled={!canNext}
            aria-label="Slide-ul următor"
            className="touch-target grid size-10 place-items-center rounded-full border border-brand-cyan/40 bg-brand-cyan/15 text-brand-cyan transition-all hover:border-brand-cyan/70 hover:bg-brand-cyan/25 disabled:opacity-30 disabled:hover:border-brand-cyan/40 disabled:hover:bg-brand-cyan/15"
          >
            <ArrowRight className="size-4" />
          </button>
        </motion.div>
      </footer>
    </div>
  );
}
