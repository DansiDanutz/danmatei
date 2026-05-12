/**
 * MicTest — inline microphone test for the pre-call screen.
 *
 * Lets the parent click "Testează microfonul", grant browser mic
 * permission once, and see a live level meter that pulses with their
 * voice. Confirms three things before they commit to the call:
 *   1. The site can request mic access (no blocker / no security error)
 *   2. They actually grant it
 *   3. The mic is producing sound (live RMS)
 *
 * Granting here doesn't double-prompt later — the same permission
 * propagates to the LiveKit room. We release the stream on unmount so
 * the mic LED turns off if the parent navigates away without starting
 * the call.
 *
 * All graphic + sizing is self-contained Tailwind so the component
 * drops anywhere on the page.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, CheckCircle2 } from "lucide-react";

type State = "idle" | "requesting" | "active" | "denied";

export default function MicTest() {
  const [state, setState] = useState<State>("idle");
  // 0..1 RMS level — drives both the bar width and the heard-you confirmation.
  const [level, setLevel] = useState(0);
  // Latches true once we've seen real voice (> threshold) for one frame —
  // gives the parent a clear "yes, we heard you" signal.
  const [heard, setHeard] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  };

  // Release the mic on unmount — important so the OS mic indicator
  // turns off when the parent navigates away.
  useEffect(() => () => stop(), []);

  const start = async () => {
    if (state === "active" || state === "requesting") return;
    setState("requesting");
    setHeard(false);
    setLevel(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtor =
        window.AudioContext ??
        // Safari pre-14 fallback. Cast to silence the lib types.
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtor();
      ctxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const buf = new Uint8Array(analyser.fftSize);

      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        // RMS around the 128 zero-crossing, normalised to [0,1].
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const n = (buf[i] - 128) / 128;
          sum += n * n;
        }
        const rms = Math.sqrt(sum / buf.length);
        const next = Math.min(1, rms * 3.2);
        setLevel(next);
        if (next > 0.08) setHeard(true);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

      setState("active");
    } catch (err) {
      // Includes both NotAllowedError (user clicked Block) and
      // NotFoundError (no mic). For our purposes the UI message is the
      // same — "your browser said no".
      console.warn("[mic-test] getUserMedia failed", err);
      setState("denied");
    }
  };

  // Tailwind percentages don't accept arbitrary expressions, so we
  // build the width as an inline style.
  const barWidth = `${Math.max(2, Math.round(level * 100))}%`;

  return (
    <div className="mx-auto mt-2 mb-6 w-full max-w-sm rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.04] p-4 text-left">
      <div className="flex items-start gap-3">
        <div
          className={[
            "grid size-9 shrink-0 place-items-center rounded-full transition-colors",
            state === "denied"
              ? "bg-red-500/15 text-red-300 ring-1 ring-red-400/40"
              : state === "active" && heard
                ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/50"
                : state === "active"
                  ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/30"
                  : "bg-white/[0.06] text-white/70 ring-1 ring-white/15",
          ].join(" ")}
          aria-hidden="true"
        >
          {state === "denied" ? (
            <MicOff className="size-4" />
          ) : state === "active" && heard ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Mic className="size-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-heading text-[11px] uppercase tracking-[0.18em] text-emerald-300">
            Testează microfonul
          </p>
          <p className="mt-0.5 text-sm leading-snug text-white/75">
            {state === "idle" &&
              "Apasă butonul și spune câteva cuvinte — verifici că browserul tău te aude înainte să suni."}
            {state === "requesting" && "Acceptă accesul la microfon din browser…"}
            {state === "active" && !heard && "Spune ceva — bara de mai jos ar trebui să se miște."}
            {state === "active" && heard && "Te aud — totul e în regulă, poți începe apelul."}
            {state === "denied" &&
              "Browserul a refuzat accesul. Verifică iconul de microfon din bara de adresă și permite manual."}
          </p>
        </div>
      </div>

      {/* Level bar — shows while the test is running, hides otherwise. */}
      {(state === "active" || state === "requesting") && (
        <div
          role="meter"
          aria-label="Nivelul microfonului"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level * 100)}
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300 transition-[width] duration-75"
            style={{ width: barWidth }}
          />
        </div>
      )}

      {state !== "active" && (
        <button
          type="button"
          onClick={start}
          disabled={state === "requesting"}
          className={[
            "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-heading text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
            state === "denied"
              ? "border border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
              : "border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
            state === "requesting" ? "cursor-wait opacity-60" : "",
          ].join(" ")}
        >
          <Mic className="size-3.5" />
          {state === "denied" ? "Încearcă din nou" : "Testează microfonul"}
        </button>
      )}
    </div>
  );
}
