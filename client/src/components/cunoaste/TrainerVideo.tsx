/**
 * TrainerVideo — portrait-aspect video for a trainer card. Plays once,
 * freezes on the pre-rendered "best frame" 1 s before the natural end,
 * and reveals a replay button on the still. Sound toggle while playing.
 *
 * Mirrors the video logic in SlideOwner so the language is consistent
 * across the deck.
 */
import { useEffect, useRef, useState } from "react";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";

type Props = {
  src: string;
  poster: string;
  /** Optional age tag rendered as a top-left chip. */
  ageRange?: string;
};

export default function TrainerVideo({ src, poster, ageRange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [ended, setEnded] = useState(false);

  // Kick autoplay (muted) on mount.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => undefined);
  }, []);

  const toggleMute = (e: React.MouseEvent): void => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play().catch(() => undefined);
  };

  const replay = (e: React.MouseEvent): void => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    setEnded(false);
    v.currentTime = 0;
    v.play().catch(() => undefined);
  };

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden">
      {/* Preloaded poster sits behind the video so the swap is seamless. */}
      <img
        src={poster}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={() => setEnded(true)}
        onTimeUpdate={e => {
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
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          ended ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Soft bottom anchor for any caption sitting on top */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[oklch(0.10_0.025_250)]/55 via-transparent to-transparent" />

      {/* Sound toggle while the clip is playing */}
      {!ended && (
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Activează sunetul" : "Oprește sunetul"}
          className="absolute left-3 top-3 z-10 grid size-8 place-items-center rounded-full border border-white/15 bg-black/40 text-white/85 backdrop-blur-md transition-colors hover:border-brand-cyan/50 hover:text-white"
        >
          {muted ? (
            <VolumeX className="size-3.5" />
          ) : (
            <Volume2 className="size-3.5" />
          )}
        </button>
      )}

      {/* Replay button on the freeze frame */}
      {ended && (
        <button
          type="button"
          onClick={replay}
          aria-label="Reia clipul"
          className="absolute left-3 top-3 z-10 grid size-8 place-items-center rounded-full border border-brand-cyan/40 bg-brand-cyan/15 text-brand-cyan backdrop-blur-md transition-colors hover:border-brand-cyan/70 hover:bg-brand-cyan/25"
        >
          <RotateCcw className="size-3.5" />
        </button>
      )}

      {/* Age range chip (top-right) */}
      {ageRange && (
        <span className="absolute right-3 top-3 z-10 rounded-full border border-brand-gold/40 bg-[oklch(0.10_0.02_250)]/80 px-2.5 py-1 font-heading text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold backdrop-blur-md">
          {ageRange}
        </span>
      )}
    </div>
  );
}
