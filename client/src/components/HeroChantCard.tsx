/**
 * HeroChantCard — landing-card video player for /hero-chant.mp4.
 *
 * Plays the video with its ORIGINAL soundtrack. We attempt
 * autoplay-with-sound first; if the browser blocks it (most do on a fresh
 * tab), we fall back to muted autoplay so there is at least motion, and
 * surface a clear sound toggle so the visitor can enable audio with one
 * tap. The first user gesture anywhere on the page also unmutes.
 *
 * UI controls overlaid on the card:
 *   - Sound toggle (top-left, speaker icon)
 *   - Replay (top-right, rewinds + plays)
 *   - Skip (top-right, navigates to /cunoaste)
 */
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { RotateCcw, SkipForward, Volume2, VolumeX } from "lucide-react";

const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

export interface HeroChantCardProps {
  /** Video source — defaults to /hero-chant.mp4 in client/public. */
  src?: string;
  /** Override autoplay behaviour. */
  autoPlay?: boolean;
  /** Loop the clip. */
  loop?: boolean;
  /** Where the skip button navigates to. */
  skipTo?: string;
}

export default function HeroChantCard({
  src = "/hero-chant.mp4",
  autoPlay = true,
  loop = false,
  skipTo = "/cunoaste",
}: HeroChantCardProps) {
  const reduce = useReducedMotion();
  const [, navigate] = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  // Optimistically start unmuted. If the browser blocks autoplay-with-sound
  // on a fresh tab the play() promise rejects, and we fall back to muted —
  // the page-level gesture listener below restores sound on first click.
  const [muted, setMuted] = useState(false);
  // True once the clip reaches the end. Drives the green "continue" cue
  // on the skip button so the visitor knows the intro is complete.
  const [ended, setEnded] = useState(false);

  // Kick playback as soon as metadata is ready.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onReady = (): void => setLoaded(true);
    const onEnded = (): void => setEnded(true);
    const onPlay = (): void => setEnded(false);
    if (v.readyState >= 3) setLoaded(true);
    else v.addEventListener("canplay", onReady);
    v.addEventListener("ended", onEnded);
    v.addEventListener("play", onPlay);
    if (autoPlay) {
      // Prefer unmuted. If the navigation came from a user gesture
      // (link click, tap), navigator.userActivation.hasBeenActive lets
      // us autoplay with sound. On a cold tab, browsers will block this
      // and we fall back to muted — the page-level listener below
      // restores sound on the next interaction of any kind.
      v.muted = false;
      v.volume = 1.0;
      v.play().catch(() => {
        v.muted = true;
        setMuted(true);
        v.play().catch(() => undefined);
      });
    }
    return () => {
      v.removeEventListener("canplay", onReady);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("play", onPlay);
    };
  }, [autoPlay]);

  // First click anywhere on the page → replay the video from the start
  // WITH sound. The only exception is the skip button, which must keep
  // its "navigate to next screen" behaviour. We use the capture phase so
  // we run before React's onClick handlers and can stop propagation,
  // which prevents the in-card buttons (sound toggle, replay) from
  // double-acting on the very first interaction.
  useEffect(() => {
    const onFirstClick = (e: MouseEvent): void => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-role="skip"]')) return;
      e.stopPropagation();
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = 0;
      v.muted = false;
      v.volume = 1.0;
      setMuted(false);
      setEnded(false);
      v.play().catch(() => undefined);
      window.removeEventListener("click", onFirstClick, true);
    };
    window.addEventListener("click", onFirstClick, true);
    return () => window.removeEventListener("click", onFirstClick, true);
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
    v.currentTime = 0;
    v.muted = muted; // keep current mute state
    v.play().catch(() => undefined);
  };

  const skip = (e: React.MouseEvent): void => {
    e.stopPropagation();
    navigate(skipTo);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[oklch(0.10_0.025_250)]">
      <motion.video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline
        preload="auto"
        initial={{ opacity: 0, scale: 1.06 }}
        animate={
          loaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.06 }
        }
        transition={{ duration: 1.0, ease: expoOut }}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Cinematic gradients */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[oklch(0.12_0.025_250)] via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[oklch(0.08_0.02_250)]/40 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[oklch(0.08_0.02_250)]/30 via-transparent to-[oklch(0.08_0.02_250)]/30" />

      {/* Floating particles */}
      {!reduce &&
        [0, 1, 2, 3, 4].map(i => (
          <motion.span
            key={i}
            aria-hidden="true"
            className={`absolute rounded-full ${
              i % 2 === 0 ? "bg-brand-cyan/30" : "bg-brand-gold/22"
            }`}
            style={{
              width: 2 + (i % 2),
              height: 2 + (i % 2),
              left: `${15 + i * 16}%`,
              bottom: `${30 + (i % 3) * 18}%`,
            }}
            animate={{ y: [0, -22, 0], opacity: [0.1, 0.5, 0.1] }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5 + i * 0.3,
            }}
          />
        ))}

      {/* Corner brackets */}
      {[
        "top-3 left-3 border-l-2 border-t-2",
        "top-3 right-3 border-r-2 border-t-2",
        "bottom-3 left-3 border-l-2 border-b-2",
        "bottom-3 right-3 border-r-2 border-b-2",
      ].map((cls, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className={`absolute size-5 rounded-sm border-brand-cyan/30 ${cls}`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6 + i * 0.07, ease: expoOut }}
        />
      ))}

      {/* Sound toggle (top-left) */}
      <div className="absolute left-3 top-3 z-30">
        <ControlButton
          onClick={toggleMute}
          ariaLabel={muted ? "Activează sunetul" : "Oprește sunetul"}
        >
          {muted ? (
            <VolumeX className="size-4" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </ControlButton>
      </div>

      {/* Replay + Skip (top-right cluster) */}
      <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
        <ControlButton onClick={replay} ariaLabel="Reia clipul">
          <RotateCcw className="size-4" />
        </ControlButton>
        <ControlButton
          onClick={skip}
          ariaLabel={ended ? "Continuă" : "Sări peste introducere"}
          tone={ended ? "green" : "cyan"}
          pulse={ended}
          dataRole="skip"
        >
          <SkipForward className="size-4" />
        </ControlButton>
      </div>

      {/* Loading state */}
      {!loaded && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[oklch(0.08_0.02_250)]/80">
          <div className="grid size-12 place-items-center rounded-full border-2 border-brand-cyan/50">
            <span className="ml-1 size-0 border-y-[8px] border-l-[14px] border-y-transparent border-l-brand-cyan/70" />
          </div>
        </div>
      )}
    </div>
  );
}

interface ControlButtonProps {
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
  children: React.ReactNode;
  tone?: "default" | "cyan" | "green";
  pulse?: boolean;
  dataRole?: string;
}

function ControlButton({
  onClick,
  ariaLabel,
  children,
  tone = "default",
  pulse = false,
  dataRole,
}: ControlButtonProps) {
  const styles =
    tone === "green"
      ? "border-emerald-400/70 bg-emerald-500/25 text-emerald-300 hover:border-emerald-300 hover:bg-emerald-500/40 hover:text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.55)]"
      : tone === "cyan"
        ? "border-brand-cyan/40 bg-brand-cyan/15 text-brand-cyan hover:border-brand-cyan/70 hover:bg-brand-cyan/25"
        : "border-white/15 bg-black/40 text-white/85 hover:border-brand-cyan/50 hover:text-white";
  const pulseClass = pulse ? " animate-pulse" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      data-role={dataRole}
      className={`grid size-9 place-items-center rounded-full border backdrop-blur-md transition-colors ${styles}${pulseClass}`}
    >
      {children}
    </button>
  );
}
