/**
 * SlideTrainers — second slide. Roster of UEFA-licensed trainers
 * shown as a horizontal swipe carousel: one card at a time on mobile,
 * with peek on tablet+. Each card shows portrait, name, position, age
 * range, bio, and certification badges. Embla powers the swipe; arrow
 * buttons + dot pager give keyboard / pointer alternatives.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import type { EmblaCarouselType } from "embla-carousel";
import { ArrowLeft, ArrowRight, Award, Target } from "lucide-react";
import { TRAINERS } from "@/data/landing";
import {
  buildWhatsAppLink,
  defaultParentToTrainerGreeting,
} from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import SlideShell from "./SlideShell";
import PortraitFrame from "./PortraitFrame";
import TrainerVideo from "./TrainerVideo";

const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function SlideTrainers() {
  // One-card-at-a-time guard. Embla's default momentum lets fast flicks carry
  // past 2-3 cards; this intercepts pointer/touch end and snaps exactly one card.
  const dragOriginX = useRef(0);
  const dragOriginTime = useRef(0);

  const watchDrag = useCallback(
    (api: EmblaCarouselType, evt: MouseEvent | TouchEvent | PointerEvent) => {
      const isTouch = evt.type.startsWith("touch");

      if (evt.type === "pointerdown" || evt.type === "touchstart") {
        dragOriginX.current = isTouch
          ? (evt as TouchEvent).touches[0].clientX
          : (evt as PointerEvent).clientX;
        dragOriginTime.current = performance.now();
        return true;
      }

      if (evt.type === "pointerup" || evt.type === "touchend") {
        const endX = isTouch
          ? (evt as TouchEvent).changedTouches[0]?.clientX ??
            dragOriginX.current
          : (evt as PointerEvent).clientX;
        const deltaX = dragOriginX.current - endX;
        const deltaT = performance.now() - dragOriginTime.current;
        const speed = Math.abs(deltaX) / Math.max(deltaT, 1);

        if (Math.abs(deltaX) > 40 || speed > 0.15) {
          if (deltaX > 0) api.scrollNext();
          else api.scrollPrev();
          return false;
        }
      }

      return true;
    },
    [],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    containScroll: "trimSnaps",
    skipSnaps: false,
    dragFree: false,
    duration: 18,
    dragThreshold: 10,
    watchDrag,
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

  const scrollPrev = (): void => emblaApi?.scrollPrev();
  const scrollNext = (): void => emblaApi?.scrollNext();
  const scrollTo = (i: number): void => emblaApi?.scrollTo(i);
  const canPrev = selected > 0;
  const canNext = selected < TRAINERS.length - 1;

  return (
    <SlideShell
      index={2}
      total={3}
      eyebrow="Echipa Tehnică"
      accent="cyan"
      title={
        <>
          <span className="block text-white/55">Antrenorii</span>
          <span className="text-gradient-cyan">care formează viitorul</span>
        </>
      }
      subtitle="Trei antrenori cu licență UEFA, fiecare specializat pe o grupă de vârstă. Fără înlocuitori, fără pauze: aceeași echipă pe tot parcursul anului."
    >
      <div className="flex h-full flex-col gap-5">
        {/* Embla viewport */}
        <div className="relative -mx-5 flex-1 overflow-hidden sm:-mx-10 lg:-mx-20">
          <div
            className="overflow-hidden px-5 sm:px-10 lg:px-20"
            ref={emblaRef}
          >
            <div className="flex gap-4 sm:gap-5">
              {TRAINERS.map((t, i) => (
                <motion.article
                  key={t.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.6,
                    delay: 0.3 + i * 0.1,
                    ease: expoOut,
                  }}
                  className="relative min-w-0 flex-[0_0_88%] xs:flex-[0_0_82%] sm:flex-[0_0_60%] lg:flex-[0_0_calc((100%-2.5rem)/3)]"
                >
                  {/* Animated cyan rim */}
                  <span
                    aria-hidden="true"
                    className="card-rim-glow pointer-events-none absolute -inset-[3px] rounded-[calc(1.5rem+3px)] opacity-80"
                    style={{ animationDelay: `${i * -2}s` }}
                  />
                  <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/85 transition-all hover:-translate-y-1 hover:border-brand-cyan/40 hover:shadow-[0_24px_60px_-20px_oklch(0.75_0.12_230/0.4)]">
                    {t.videoSrc && t.posterSrc ? (
                      <TrainerVideo
                        src={t.videoSrc}
                        poster={t.posterSrc}
                        ageRange={`U${t.ageMin}–U${t.ageMax}`}
                      />
                    ) : (
                      <>
                        <PortraitFrame
                          initials={t.initials}
                          accent={t.accent}
                          className="aspect-[4/5] w-full"
                        />
                        {/* Age range tag floats over portrait */}
                        <span className="absolute left-4 top-4 z-10 rounded-full border border-brand-gold/40 bg-[oklch(0.10_0.02_250)]/80 px-3 py-1 font-heading text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold backdrop-blur-md">
                          U{t.ageMin}–U{t.ageMax}
                        </span>
                      </>
                    )}

                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <div>
                        <h3 className="font-heading text-xl font-bold uppercase tracking-[0.04em] text-white">
                          {t.name}
                        </h3>
                        <p className="mt-0.5 font-heading text-[11px] uppercase tracking-[0.18em] text-brand-cyan/85">
                          {t.position}
                        </p>
                      </div>

                      <p className="font-body text-sm leading-relaxed text-white/65">
                        {t.bio}
                      </p>

                      {/* Specializări — sub-card with focus areas. Fills the
                          dead space when bio is short, gives every trainer
                          a concrete "what they're known for" panel. */}
                      {t.focus && t.focus.length > 0 && (
                        <div className="rounded-xl border border-brand-cyan/20 bg-brand-cyan/[0.04] p-3">
                          <div className="mb-2 flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-[0.2em] text-brand-cyan/85">
                            <Target className="size-3" />
                            Specializări
                          </div>
                          <ul className="grid gap-1.5">
                            {t.focus.map(f => (
                              <li
                                key={f}
                                className="flex gap-2 font-body text-[13px] leading-snug text-white/80"
                              >
                                <span
                                  aria-hidden="true"
                                  className="mt-1.5 inline-block size-1 shrink-0 rounded-full bg-brand-cyan/70"
                                />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                        {t.certifications.map(c => (
                          <span
                            key={c}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-heading text-[10px] uppercase tracking-[0.14em] text-white/70"
                          >
                            <Award className="size-3 text-brand-gold" />
                            {c}
                          </span>
                        ))}
                      </div>

                      {/* Per-trainer WhatsApp pill — disabled placeholder
                          when the number isn't configured yet (e.g.
                          Răzvan Soporan until admin sets it). */}
                      {(() => {
                        const href = buildWhatsAppLink(
                          t.whatsapp,
                          defaultParentToTrainerGreeting(t.name),
                        );
                        return href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Scrie pe WhatsApp lui ${t.name}`}
                            className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[oklch(0.7_0.18_150)] text-[oklch(0.12_0.02_150)] px-4 py-2.5 font-heading text-[11px] uppercase tracking-[0.16em] hover:opacity-90 transition shadow-[0_12px_30px_-12px_oklch(0.7_0.18_150/0.5)]"
                          >
                            <WhatsAppIcon className="size-4" />
                            WhatsApp direct
                          </a>
                        ) : (
                          <span
                            className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-2.5 font-heading text-[10px] uppercase tracking-[0.16em] text-white/40"
                            title="Numărul de WhatsApp va fi adăugat în curând"
                          >
                            <WhatsAppIcon className="size-4 opacity-50" />
                            WhatsApp · în curând
                          </span>
                        );
                      })()}
                    </div>

                    {/* Hover accent line */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </div>

        {/* Pager + arrows */}
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={scrollPrev}
            disabled={!canPrev}
            aria-label="Antrenorul anterior"
            className="touch-target grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition-all hover:border-brand-cyan/40 hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
          >
            <ArrowLeft className="size-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {TRAINERS.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => scrollTo(i)}
                  aria-label={`Mergi la ${t.name}`}
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
            <span className="hidden font-heading text-[10px] uppercase tracking-[0.18em] text-white/55 sm:inline">
              {TRAINERS[selected]?.name} ·{" "}
              <span className="tabular-nums text-white/70">
                {String(selected + 1).padStart(2, "0")}
                <span className="mx-1 text-white/30">/</span>
                {String(TRAINERS.length).padStart(2, "0")}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={scrollNext}
            disabled={!canNext}
            aria-label="Antrenorul următor"
            className="touch-target grid size-10 place-items-center rounded-full border border-brand-cyan/40 bg-brand-cyan/15 text-brand-cyan transition-all hover:border-brand-cyan/70 hover:bg-brand-cyan/25 disabled:opacity-30"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </SlideShell>
  );
}
