/**
 * SpeakerTest — inline speaker / output check for the pre-call screen.
 *
 * Mirrors MicTest in shape: parent clicks "Testează sunetul", we play a
 * short pleasant chime via WebAudio (no audio file dependency), then ask
 * "Ai auzit clopoțelul?" with Da / Nu buttons. State latches to "ok"
 * (green) or "fail" (rose) based on their answer so the surrounding
 * checklist can gate the call-start button.
 *
 * Why a chime synthesised in WebAudio rather than an mp3:
 *   - zero new asset to fetch on a slow connection
 *   - guaranteed to be gesture-triggered (the button click), so iOS
 *     Safari's autoplay policy doesn't block it
 *   - we can detect a degenerate state (no AudioContext at all) and
 *     surface that clearly instead of silently failing
 *
 * The component takes an optional onResult callback so a parent
 * checklist can know when the test passes (and re-enable the call
 * button only then). When omitted, behaves stand-alone.
 */
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Volume2, VolumeX, XCircle } from "lucide-react";

type State = "idle" | "playing" | "asking" | "ok" | "fail";

type Props = {
  /** Fires once when the parent confirms they heard (true) or didn't (false). */
  onResult?: (heard: boolean) => void;
};

const TONE_SECONDS = 1.2;

export default function SpeakerTest({ onResult }: Props) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  // Stop any in-flight chime + close audio context on unmount so we don't
  // leak audio nodes if the parent navigates away mid-test.
  useEffect(
    () => () => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    },
    []
  );

  const playChime = async () => {
    if (state === "playing") return;
    setState("playing");
    setError(null);
    try {
      const AudioCtor =
        window.AudioContext ??
        // Safari pre-14 fallback. Cast to silence the lib types.
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtor) {
        setError("Browserul tău nu suportă redarea audio.");
        setState("fail");
        onResult?.(false);
        return;
      }
      // Reuse one context across plays so iOS doesn't accumulate them.
      const ctx = ctxRef.current ?? new AudioCtor();
      ctxRef.current = ctx;
      // iOS often starts the context in 'suspended' until a gesture-tied
      // resume() is called; this click is the gesture.
      if (ctx.state === "suspended") await ctx.resume();

      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      // Short fade-in so the tone doesn't pop, then a comfortable hold,
      // then a soft fade-out.
      master.gain.exponentialRampToValueAtTime(0.18, now + 0.06);
      master.gain.setTargetAtTime(0.0001, now + TONE_SECONDS - 0.3, 0.12);
      master.connect(ctx.destination);

      // Two-note chime (E5 then G5) — pleasant, distinct, recognisable.
      const note = (frequency: number, start: number, length: number) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = frequency;
        osc.connect(master);
        osc.start(start);
        osc.stop(start + length);
      };
      note(659.25, now, 0.55); // E5
      note(783.99, now + 0.45, 0.7); // G5

      // After the chime finishes, ask the parent to confirm.
      window.setTimeout(() => {
        setState("asking");
      }, Math.round(TONE_SECONDS * 1000));
    } catch (err) {
      console.warn("[speaker-test] play failed", err);
      setError(
        "N-am putut reda sunetul. Verifică că browserul nu e silențios."
      );
      setState("fail");
      onResult?.(false);
    }
  };

  const confirm = (heard: boolean) => {
    setState(heard ? "ok" : "fail");
    onResult?.(heard);
  };

  return (
    <div className="mx-auto mt-2 mb-3 w-full max-w-sm rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.04] p-4 text-left">
      <div className="flex items-start gap-3">
        <div
          className={[
            "grid size-9 shrink-0 place-items-center rounded-full transition-colors",
            state === "fail"
              ? "bg-red-500/15 text-red-300 ring-1 ring-red-400/40"
              : state === "ok"
                ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/50"
                : "bg-white/[0.06] text-white/70 ring-1 ring-white/15",
          ].join(" ")}
          aria-hidden="true"
        >
          {state === "fail" ? (
            <VolumeX className="size-4" />
          ) : state === "ok" ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-heading text-[11px] uppercase tracking-[0.18em] text-cyan-300">
            Testează sunetul
          </p>
          <p className="mt-0.5 text-sm leading-snug text-white/75">
            {state === "idle" &&
              "Apasă butonul și ascultă un clopoțel scurt — verifici că auzi căștile sau difuzorul înainte să suni."}
            {state === "playing" && "Redau clopoțelul…"}
            {state === "asking" && "Ai auzit clopoțelul?"}
            {state === "ok" && "Te aud și mă auzi — totul e în regulă."}
            {state === "fail" &&
              (error ??
                "Nu ai auzit nimic. Verifică volumul, ieșirea audio și dacă alt sunet redă în browser.")}
          </p>
        </div>
      </div>

      {state === "asking" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => confirm(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 font-heading text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition-colors hover:bg-emerald-500/20"
          >
            <CheckCircle2 className="size-3.5" />
            Da, am auzit
          </button>
          <button
            type="button"
            onClick={() => confirm(false)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 font-heading text-[11px] font-semibold uppercase tracking-[0.16em] text-red-200 transition-colors hover:bg-red-500/20"
          >
            <XCircle className="size-3.5" />
            Nu am auzit
          </button>
        </div>
      )}

      {(state === "idle" || state === "fail") && (
        <button
          type="button"
          onClick={playChime}
          className={[
            "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-heading text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
            state === "fail"
              ? "border border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
              : "border border-cyan-400/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20",
          ].join(" ")}
        >
          <Volume2 className="size-3.5" />
          {state === "fail" ? "Încearcă din nou" : "Redă clopoțelul"}
        </button>
      )}
    </div>
  );
}
