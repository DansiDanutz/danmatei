/**
 * /apel/:token — entry page for the AI voice call.
 *
 * The token is a signed lead identifier produced by /api/lead/create. We
 * POST it to /api/voice/start which:
 *   - verifies the token + resolves the lead,
 *   - creates a LiveKit room,
 *   - tells the Pipecat agent to join with the lead context,
 *   - returns a short-lived LiveKit JWT for the parent's browser.
 *
 * The page then renders a LiveKitRoom that the parent connects to with
 * their microphone. The Pipecat agent speaks; the parent answers; on
 * disconnect the agent posts the transcript to /api/voice/webhook.
 */
import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useTracks,
  useVoiceAssistant,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { useEffect, useState } from "react";
import { useRoute } from "wouter";

type SessionData = {
  ok: true;
  leadId: string;
  livekitUrl: string;
  room: string;
  token: string;
  // New auto-dispatch shape (current). LiveKit Cloud dispatches the named
  // agent when the parent joins — no separate spawn step on our side.
  agentDispatch?: { mode: "livekit-auto-dispatch"; agentName: string };
  // Legacy fields kept for back-compat with older deploys; safe to drop
  // once /api/voice/start.ts has been on auto-dispatch for a while.
  agentSpawned?: boolean;
  agentReason?: string | null;
};

type Phase = "idle" | "starting" | "asking_mic" | "live" | "ended" | "error";

export default function Apel() {
  const [, params] = useRoute<{ token?: string }>("/apel/:token");
  const token = params?.token ?? "";

  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setPhase("starting");
    setError(null);
    try {
      // First check mic permission so the connection failure mode is clean.
      try {
        setPhase("asking_mic");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        setError("Pentru a vorbi cu consilierul, te rugăm să accepți accesul la microfon.");
        setPhase("error");
        return;
      }

      setPhase("starting");
      const r = await fetch("/api/voice/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = (await r.json().catch(() => ({}))) as
        | SessionData
        | { error: string; message?: string };

      if (!r.ok || !("ok" in j)) {
        const errCode = "error" in j ? j.error : `HTTP ${r.status}`;
        if (errCode === "voice_not_configured") {
          setError(
            "Apelul live nu este încă disponibil. Antrenorul te va contacta direct pe WhatsApp.",
          );
        } else if (errCode === "invalid_token" || errCode === "missing_token") {
          setError("Linkul a expirat. Te rugăm să ceri unul nou din /programare.");
        } else if (errCode === "lead_not_found") {
          setError("Nu am găsit cererea ta. Reia procesul din /programare.");
        } else {
          setError(`Eroare la conectare (${errCode}).`);
        }
        setPhase("error");
        return;
      }

      setSession(j);
      setPhase("live");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare necunoscută.");
      setPhase("error");
    }
  };

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 py-12 bg-[radial-gradient(900px_500px_at_50%_-10%,oklch(0.78_0.13_210/0.18),transparent_55%)]">
      <div className="w-full max-w-md text-center">
        <div className="font-heading text-[10px] uppercase tracking-[0.32em] text-brand-cyan mb-4">
          Academia Dan Matei · Apel
        </div>

        {phase === "live" && session ? (
          <LiveKitRoom
            serverUrl={session.livekitUrl}
            token={session.token}
            audio
            video={false}
            connect
            onDisconnected={() => setPhase("ended")}
            onError={(e) => {
              setError(e.message || "Conexiune întreruptă.");
              setPhase("error");
            }}
            className="contents"
          >
            <RoomAudioRenderer />
            <CallStage
              autoDispatch={Boolean(session.agentDispatch)}
              legacySpawnFailed={
                session.agentSpawned === false && !session.agentDispatch
              }
            />
          </LiveKitRoom>
        ) : (
          <CallShell
            phase={phase}
            error={error}
            tokenPreview={token.slice(0, 12)}
            onStart={start}
          />
        )}
      </div>
    </main>
  );
}

function CallShell({
  phase,
  error,
  tokenPreview,
  onStart,
}: {
  phase: Phase;
  error: string | null;
  tokenPreview: string;
  onStart: () => void;
}) {
  return (
    <>
      <h1 className="font-heading text-4xl sm:text-5xl uppercase leading-[0.95] mb-3">
        {phase === "ended" ? (
          <span className="text-gradient-gold">Mulțumim!</span>
        ) : phase === "starting" || phase === "asking_mic" ? (
          <span className="text-gradient-cyan">Conectare...</span>
        ) : (
          <span className="text-white">Pregătit?</span>
        )}
      </h1>

      <p className="text-white/70 leading-relaxed mb-8">
        {phase === "idle" &&
          "Apasă butonul de mai jos pentru a porni apelul cu consilierul AI al academiei. Conversația durează 3-5 minute și este înregistrată pentru calitatea serviciului."}
        {phase === "asking_mic" && "Acceptă accesul la microfon din browser..."}
        {phase === "starting" && "Se conectează la consilierul Andra..."}
        {phase === "ended" &&
          "Apelul s-a încheiat. Antrenorul grupei copilului tău primește rezumatul și îți va scrie în curând."}
        {phase === "error" &&
          (error ?? "Ceva nu a funcționat. Te rugăm să încerci din nou.")}
      </p>

      {(phase === "idle" || phase === "error") && (
        <button
          type="button"
          onClick={onStart}
          className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-brand-cyan text-[oklch(0.08_0.02_250)] font-heading uppercase tracking-[0.16em] text-sm hover:opacity-90 transition"
        >
          🎙️ Începe apelul
        </button>
      )}

      {phase === "ended" && (
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-white/15 text-white text-sm font-heading uppercase tracking-[0.16em] hover:bg-white/[0.05]"
        >
          ← Înapoi la pagina principală
        </a>
      )}

      <p className="mt-8 text-[10px] uppercase tracking-[0.22em] text-white/35">
        Token · {tokenPreview}…
      </p>
    </>
  );
}

/**
 * Renders inside <LiveKitRoom>. Watches connection + agent state so the UI
 * can show "the agent is here, speak" or "connecting".
 */
function CallStage({
  autoDispatch,
  legacySpawnFailed,
}: {
  autoDispatch: boolean;
  legacySpawnFailed: boolean;
}) {
  const connection = useConnectionState();
  const { state: agentState } = useVoiceAssistant();
  const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });
  // In auto-dispatch the agent's identity is assigned by LiveKit Cloud; the
  // canonical way to find it is by `isAgent` flag on the participant.
  const agentTrack = tracks.find(
    (t) =>
      t.participant.isAgent === true ||
      t.participant.identity === "andra-agent" ||
      t.participant.identity?.startsWith("agent-"),
  );

  return (
    <div>
      <h1 className="font-heading text-4xl sm:text-5xl uppercase leading-[0.95] mb-3">
        <span className="text-gradient-cyan">Vorbim acum</span>
      </h1>

      <p className="text-white/70 leading-relaxed mb-8">
        {connection !== ConnectionState.Connected
          ? "Se conectează..."
          : legacySpawnFailed
            ? "Consilierul nu a putut fi pornit — antrenorul te va contacta direct."
            : agentState === "listening"
              ? "Andra te ascultă. Răspunde firesc — îți punem câteva întrebări scurte despre copil."
              : agentState === "speaking"
                ? "Andra vorbește..."
                : agentState === "thinking"
                  ? "Se gândește..."
                  : agentTrack
                    ? "Andra este conectată."
                    : autoDispatch
                      ? "Așteptăm consilierul Andra să intre în apel..."
                      : "Se așteaptă Andra..."}
      </p>

      <PulseRing speaking={agentState === "speaking"} />

      <p className="mt-8 text-[10px] uppercase tracking-[0.22em] text-white/35">
        {connection === ConnectionState.Connected ? "În direct" : "Se conectează"}
      </p>
    </div>
  );
}

function PulseRing({ speaking }: { speaking: boolean }) {
  return (
    <div className="relative inline-block">
      {speaking && (
        <>
          <span className="absolute inset-0 rounded-full bg-brand-cyan/30 animate-ping" />
          <span className="absolute inset-0 rounded-full bg-brand-cyan/15 animate-pulse" />
        </>
      )}
      <span className="relative flex items-center justify-center size-28 rounded-full bg-brand-cyan/15 border-2 border-brand-cyan/50">
        <span className="text-4xl">🎙️</span>
      </span>
    </div>
  );
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function _unused(phase: Phase) { return phase; }
useEffect; // keep import warm for future extensions
