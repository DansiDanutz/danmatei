/**
 * /apel/:token — entry page for the AI voice call.
 *
 * The token is a signed lead identifier produced by /api/lead/create.
 * In production, this page joins a LiveKit room and streams audio to a
 * Pipecat agent (Whisper + Ollama + Piper) running in services/voice-agent.
 *
 * For now, we stub the integration so the UX flow is testable end-to-end:
 * the page resolves the token (eventually via /api/lead/apel/:token), shows
 * a "tap to start" button, requests microphone access, and indicates that
 * the agent is connecting. The real LiveKit join + Pipecat client will land
 * in a follow-up commit.
 */
import { useEffect, useState } from "react";
import { useRoute } from "wouter";

type Phase = "idle" | "asking_mic" | "connecting" | "live" | "ended" | "error";

export default function Apel() {
  const [, params] = useRoute<{ token?: string }>("/apel/:token");
  const token = params?.token ?? "";
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (phase === "live") {
      const t = setTimeout(() => setPhase("ended"), 30_000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const start = async () => {
    setPhase("asking_mic");
    setError(null);
    try {
      // TODO: replace with /api/lead/apel/:token to fetch the LiveKit JWT.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // we just verify permission for the stub
      setPhase("connecting");
      await new Promise((r) => setTimeout(r, 1200));
      setPhase("live");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nu am putut accesa microfonul.",
      );
      setPhase("error");
    }
  };

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 py-12 bg-[radial-gradient(900px_500px_at_50%_-10%,oklch(0.78_0.13_210/0.18),transparent_55%)]">
      <div className="w-full max-w-md text-center">
        <div className="font-heading text-[10px] uppercase tracking-[0.32em] text-brand-cyan mb-4">
          Academia Dan Matei · Apel
        </div>

        <h1 className="font-heading text-4xl sm:text-5xl uppercase leading-[0.95] mb-3">
          {phase === "live" || phase === "connecting" ? (
            <span className="text-gradient-cyan">Vorbim acum</span>
          ) : phase === "ended" ? (
            <span className="text-gradient-gold">Mulțumim!</span>
          ) : (
            <span className="text-white">Pregătit?</span>
          )}
        </h1>

        <p className="text-white/70 leading-relaxed mb-8">
          {phase === "idle" &&
            "Apasă butonul de mai jos pentru a porni apelul cu consilierul AI al academiei. Conversația durează 3-5 minute și e înregistrată pentru calitatea serviciului."}
          {phase === "asking_mic" &&
            "Acceptă accesul la microfon din browser..."}
          {phase === "connecting" &&
            "Se conectează la consilierul Andra..."}
          {phase === "live" &&
            "Andra te ascultă. Răspunde firesc — îți punem câteva întrebări scurte despre copil."}
          {phase === "ended" &&
            "Apelul s-a încheiat. Antrenorul grupei copilului tău primește rezumatul și îți va scrie în curând."}
          {phase === "error" &&
            (error ?? "Ceva nu a funcționat. Te rugăm să încerci din nou.")}
        </p>

        {(phase === "idle" || phase === "error") && (
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-brand-cyan text-[oklch(0.08_0.02_250)] font-heading uppercase tracking-[0.16em] text-sm hover:opacity-90 transition"
          >
            🎙️ Începe apelul
          </button>
        )}

        {phase === "live" && <PulseRing />}

        {phase === "ended" && (
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-white/15 text-white text-sm font-heading uppercase tracking-[0.16em] hover:bg-white/[0.05]"
          >
            ← Înapoi la pagina principală
          </a>
        )}

        <p className="mt-8 text-[10px] uppercase tracking-[0.22em] text-white/35">
          Token · {token.slice(0, 12)}…
        </p>
      </div>
    </main>
  );
}

function PulseRing() {
  return (
    <div className="relative inline-block">
      <span className="absolute inset-0 rounded-full bg-brand-cyan/30 animate-ping" />
      <span className="absolute inset-0 rounded-full bg-brand-cyan/15 animate-pulse" />
      <span className="relative flex items-center justify-center size-28 rounded-full bg-brand-cyan/15 border-2 border-brand-cyan/50">
        <span className="text-4xl">🎙️</span>
      </span>
    </div>
  );
}
