/**
 * CunoasteDeck — Embla-powered horizontal swipe deck of three slides:
 * Owner → Trainers → Players. Includes:
 *   - Touch swipe on mobile
 *   - Keyboard ←/→ navigation
 *   - Dot pager + slide counter + arrow buttons in a sticky bottom bar
 *
 * The top brand bar + main nav now come from <PublicShell> in the parent
 * page (Cunoaste.tsx) — same nav as the rest of the public marketing
 * pages.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { EmblaCarouselType } from "embla-carousel";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import SlideOwner from "./SlideOwner";
import SlideTrainers from "./SlideTrainers";
import SlidePlayers from "./SlidePlayers";

const SLIDE_LABELS = ["Fondator", "Antrenori", "Jucători"] as const;

export default function CunoasteDeck() {
  const touchStart = useRef<{ x: number; y: number; nested: boolean } | null>(
    null,
  );
  const [direction, setDirection] = useState(1);

  // Never let the deck drag when the gesture begins inside a nested carousel
  // (e.g. the trainer cards) — that inner swiper owns the horizontal motion.
  const watchDeckDrag = useCallback(
    (_api: EmblaCarouselType, evt: MouseEvent | TouchEvent | PointerEvent) => {
      const target = evt.target as HTMLElement | null;
      return !target?.closest?.("[data-deck-nested]");
    },
    [],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    skipSnaps: false,
    dragFree: false,
    watchDrag: watchDeckDrag,
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

  // Mobile single-slide navigation. `direction` drives the slide-in so a
  // swipe reads as horizontal motion rather than a hard cut.
  const goToMobile = (index: number) => {
    const clamped = Math.max(0, Math.min(SLIDE_LABELS.length - 1, index));
    setDirection(clamped >= selected ? 1 : -1);
    setSelected(clamped);
  };
  const selectPrev = () => goToMobile(selected - 1);
  const selectNext = () => goToMobile(selected + 1);

  const mobileSlides = [<SlideOwner />, <SlideTrainers />, <SlidePlayers />];

  const handleSwipeEnd = (endX: number, endY: number) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || start.nested) return; // nested carousel owns this gesture
    const dx = start.x - endX;
    const dy = start.y - endY;
    if (Math.abs(dx) < 50) return; // too small to be a deck swipe
    if (Math.abs(dx) <= Math.abs(dy) * 1.2) return; // vertical → it's a scroll
    if (dx > 0) selectNext();
    else selectPrev();
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col text-white">
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
      </div>

      {/* Mobile single-slide swiper. Only the active slide is mounted so the
          page height comes from visible content, not offscreen slides. */}
      <div
        className="relative z-10 overflow-x-hidden lg:hidden"
        onTouchStart={(event) => {
          const t = event.touches[0];
          const target = event.target as HTMLElement | null;
          touchStart.current = t
            ? {
                x: t.clientX,
                y: t.clientY,
                nested: !!target?.closest?.("[data-deck-nested]"),
              }
            : null;
        }}
        onTouchEnd={(event) => {
          const t = event.changedTouches[0];
          if (t) handleSwipeEnd(t.clientX, t.clientY);
        }}
      >
        <motion.div
          key={selected}
          initial={{ opacity: 0, x: direction * 48 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          {mobileSlides[selected]}
        </motion.div>
        <div className="mx-auto mt-2 flex w-full max-w-xs items-center justify-center gap-2 px-5 pb-6">
          {SLIDE_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => goToMobile(index)}
              aria-label={`Mergi la ${label}`}
              aria-current={selected === index}
              className="touch-target group flex h-8 items-center px-1"
            >
              <span
                className={`block h-1.5 rounded-full transition-all ${
                  selected === index
                    ? "w-9 bg-brand-cyan"
                    : "w-2 bg-white/25 group-hover:bg-white/45"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Embla viewport */}
      <div className="relative z-10 hidden overflow-hidden lg:block lg:flex-1" ref={emblaRef}>
        <div className="flex lg:h-full">
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
      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 hidden px-5 pb-5 lg:block lg:px-10 lg:pb-6 xl:px-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-full border border-white/12 bg-[oklch(0.14_0.02_250)]/35 px-4 py-2.5 shadow-[0_8px_40px_-12px_oklch(0.05_0.02_250/0.6)] backdrop-blur-2xl sm:px-5 sm:py-3"
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
