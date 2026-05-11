/**
 * SlideOwner — first slide. Big portrait of Dan Matei + four reasons
 * stacked on the right + a quote ribbon. Cyan is the dominant brand
 * color (jersey identity); gold appears only on the achievement stat
 * (Trofee) per the original brand spec.
 */
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { Quote, RotateCcw, Trophy, Volume2, VolumeX } from "lucide-react";
import { OWNER } from "@/data/landing";
import SlideShell from "./SlideShell";

const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

const POSTER_SRC = "/TheBoss-poster.jpg";

export default function SlideOwner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  // After the video plays one full cycle we freeze on the best frame
  // (a pre-rendered still). The video element stays mounted so the
  // user can replay it via the dedicated button.
  const [ended, setEnded] = useState(false);

  const toggleMute = (): void => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play().catch(() => undefined);
  };

  const replay = (): void => {
    const v = videoRef.current;
    if (!v) return;
    setEnded(false);
    v.currentTime = 0;
    v.play().catch(() => undefined);
  };

  return (
    <SlideShell
      index={1}
      total={3}
      eyebrow="Fondatorul"
      accent="cyan"
      title={
        <>
          <span className="block text-white/55">De ce</span>
          <span className="text-gradient-cyan">{OWNER.name}</span>
        </>
      }
      subtitle={OWNER.role}
    >
      <div className="grid content-start gap-4 sm:gap-5 lg:h-full lg:grid-cols-12 lg:gap-10">
        {/* Portrait video + quote */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          <div className="relative">
            <span
              aria-hidden="true"
              className="card-rim-glow pointer-events-none absolute -inset-[3px] rounded-[calc(1rem+3px)] opacity-90"
            />
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-brand-cyan/30 bg-[oklch(0.10_0.025_250)] shadow-[0_28px_70px_-22px_oklch(0.75_0.12_230/0.55)] xs:aspect-[4/5]">
              {/* Preloaded poster — best frame from the clip. Sits behind the
                video at low opacity so the swap when the clip ends is
                imperceptible (no flash, no missing-asset gap). */}
              <img
                src={POSTER_SRC}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
              <video
                ref={videoRef}
                src="/TheBoss.mp4"
                poster={POSTER_SRC}
                muted
                playsInline
                preload="none"
                onEnded={() => setEnded(true)}
                onTimeUpdate={e => {
                  // Freeze on the chosen still 1 s before the natural end so we
                  // never see the awkward last-second moment of the clip.
                  const v = e.currentTarget;
                  if (
                    !ended &&
                    Number.isFinite(v.duration) &&
                    v.currentTime >= v.duration - 1
                  ) {
                    v.pause();
                    setEnded(true);
                  }
                }}
                className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300 ${
                  ended ? "opacity-0" : "opacity-100"
                }`}
              />
              {/* Soft gradient anchor at the bottom for legibility against any caption */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[oklch(0.10_0.025_250)]/55 via-transparent to-transparent" />
              {/* Cyan inner rim — matches the brand language */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-brand-cyan/25"
              />
              {/* Sound toggle — hidden once the clip has ended (no audio
                source while the still is showing). */}
              {!ended && (
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? "Activează sunetul" : "Oprește sunetul"}
                  className="absolute left-3 top-3 z-10 grid size-9 place-items-center rounded-full border border-white/15 bg-black/40 text-white/85 backdrop-blur-md transition-colors hover:border-brand-cyan/50 hover:text-white"
                >
                  {muted ? (
                    <VolumeX className="size-4" />
                  ) : (
                    <Volume2 className="size-4" />
                  )}
                </button>
              )}
              {/* Replay — visible only on the freeze frame, lets the visitor
                rewind and watch the clip again. */}
              {ended && (
                <button
                  type="button"
                  onClick={replay}
                  aria-label="Reia clipul"
                  className="absolute left-3 top-3 z-10 grid size-9 place-items-center rounded-full border border-brand-cyan/40 bg-brand-cyan/15 text-brand-cyan backdrop-blur-md transition-colors hover:border-brand-cyan/70 hover:bg-brand-cyan/25"
                >
                  <RotateCcw className="size-4" />
                </button>
              )}
              {/* Eyebrow tag — top-right, ties the video to the slide */}
              <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/40 bg-brand-cyan/15 px-2.5 py-1 font-heading text-[9px] uppercase tracking-[0.22em] text-brand-cyan backdrop-blur-md">
                <span className="block size-1 rounded-full bg-brand-cyan" />
                Fondator
              </span>
            </div>
          </div>
          <div className="relative">
            <span
              aria-hidden="true"
              className="card-rim-glow pointer-events-none absolute -inset-[3px] rounded-[calc(1rem+3px)] opacity-70"
            />
            <motion.blockquote
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4, ease: expoOut }}
              className="relative rounded-2xl border border-brand-cyan/20 bg-[oklch(0.13_0.03_250)]/70 p-5 pl-12"
            >
              <Quote className="absolute left-4 top-4 size-6 text-brand-cyan/80" />
              <p className="font-body text-sm leading-relaxed text-white/85 sm:text-base">
                {OWNER.quote}
              </p>
            </motion.blockquote>
          </div>

          {/* Stats strip — gold reserved for the trophy stat (achievement) */}
          <div className="grid grid-cols-2 gap-2 xs:grid-cols-4">
            {OWNER.stats.map((s, i) => {
              const isAchievement = s.label.toLowerCase().includes("trofee");
              return (
                <div
                  key={s.label}
                  className={`relative rounded-xl border px-2 py-3 text-center ${
                    isAchievement
                      ? "border-brand-gold/30 bg-brand-gold/5"
                      : "border-white/8 bg-[oklch(0.13_0.03_250)]/60"
                  }`}
                >
                  {isAchievement && (
                    <Trophy className="absolute right-1.5 top-1.5 size-2.5 text-brand-gold/70" />
                  )}
                  <div
                    className={`font-heading text-lg font-bold tabular-nums sm:text-xl ${
                      isAchievement ? "text-brand-gold" : "text-brand-cyan"
                    }`}
                  >
                    {s.value}
                  </div>
                  <div className="mt-0.5 font-heading text-[9px] uppercase tracking-[0.18em] text-white/45">
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reasons — numbered list, cyan numerals */}
        <ol className="grid gap-3 lg:col-span-7 lg:gap-4">
          {OWNER.reasons.map((r, i) => (
            <motion.li
              key={r.title}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.35 + i * 0.08,
                ease: expoOut,
              }}
              className="relative"
            >
              <span
                aria-hidden="true"
                className="card-rim-glow pointer-events-none absolute -inset-[3px] rounded-[calc(1rem+3px)] opacity-70"
                style={{ animationDelay: `${i * -1.5}s` }}
              />
              <div className="group relative flex gap-3 rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-3 transition-all hover:-translate-y-0.5 hover:border-brand-cyan/40 hover:bg-[oklch(0.15_0.03_250)]/85 hover:shadow-[0_18px_50px_-20px_oklch(0.75_0.12_230/0.45)] xs:p-4 sm:p-5">
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-brand-cyan/30 bg-brand-cyan/10 font-heading text-sm font-bold tabular-nums text-brand-cyan"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h3 className="font-heading text-base font-semibold uppercase tracking-[0.06em] text-white sm:text-lg">
                    {r.title}
                  </h3>
                  <p className="mt-1 font-body text-sm leading-relaxed text-white/65 sm:text-[15px]">
                    {r.body}
                  </p>
                  {r.details && r.details.length > 0 && (
                    <ul className="mt-3 grid gap-1.5 border-t border-white/8 pt-3">
                      {r.details.map(detail => (
                        <li
                          key={detail}
                          className="flex gap-2.5 font-body text-[13px] leading-snug text-white/70 sm:text-sm"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-1.5 inline-block size-1 shrink-0 rounded-full bg-brand-cyan/70"
                          />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {/* Left edge accent on hover */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-3 left-0 w-px bg-gradient-to-b from-transparent via-brand-cyan/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </SlideShell>
  );
}
