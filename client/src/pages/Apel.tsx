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
  useRoomContext,
  useTracks,
  useVoiceAssistant,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { AnimatePresence, motion } from "framer-motion";
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
      <div className="w-full max-w-md lg:max-w-2xl text-center">
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

      <p className="text-white/70 leading-relaxed mb-4">
        {phase === "idle" &&
          "Apasă butonul de mai jos pentru a porni apelul cu consilierul AI al academiei. Conversația este înregistrată pentru calitatea serviciului."}
        {phase === "asking_mic" && "Acceptă accesul la microfon din browser..."}
        {phase === "starting" && "Se conectează la consilierul Andra..."}
        {phase === "ended" &&
          "Apelul s-a încheiat. Antrenorul grupei copilului tău primește rezumatul și îți va scrie în curând."}
        {phase === "error" &&
          (error ?? "Ceva nu a funcționat. Te rugăm să încerci din nou.")}
      </p>

      {phase === "idle" && (
        <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 font-heading text-[11px] uppercase tracking-[0.18em] text-brand-cyan">
          <ClockIcon />
          Conversație de fix 3 minute
        </div>
      )}

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
  const room = useRoomContext();
  const { state: agentState } = useVoiceAssistant();
  const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });
  const agentTrack = tracks.find(
    (t) =>
      t.participant.isAgent === true ||
      t.participant.identity === "andra-agent" ||
      t.participant.identity?.startsWith("agent-"),
  );

  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [ending, setEnding] = useState(false);
  // Latches true the first time Andra joins the room; lets us detect when
  // she leaves (hard-cap, finish_call tool, crash) so we can also disconnect
  // the parent's side instead of leaving them on a stale "Vorbim acum" UI.
  const [agentSeen, setAgentSeen] = useState(false);

  // Mirrors the agent's MAX_CALL_SECONDS env var (currently 180s = 3 min)
  // — the worker hard-caps server-side regardless, so this is purely for
  // the UI countdown. If the two ever drift, the server wins.
  const CALL_DURATION_S = 180;

  // End-call handler: politely ask Andra to close instead of yanking the
  // call. We send a `user_end_call_request` data message; the agent
  // responds with a short motivational close (see agent.py `graceful_close`)
  // then disconnects the room itself. The parent's <LiveKitRoom>
  // `onDisconnected` then flips Apel to the `ended` phase.
  //
  // A safety net forces a local disconnect after 12s in case the data
  // message can't reach the agent (network issue, agent already gone).
  const endCall = async () => {
    if (ending) return;
    setEnding(true);
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({ event: "user_end_call_request" }),
      );
      await room.localParticipant.publishData(payload, { reliable: true });
    } catch {
      // If we can't send the data message (no connection / no remote
      // participants), fall back to an immediate local disconnect.
      try {
        await room.disconnect();
      } catch {
        // disconnect throws if already disconnecting — onDisconnected fires anyway
      }
      return;
    }
    // Safety net for the rare case the agent doesn't disconnect itself.
    window.setTimeout(() => {
      room.disconnect().catch(() => {});
    }, 12000);
  };

  useEffect(() => {
    if (agentTrack && !agentSeen) setAgentSeen(true);
  }, [agentTrack, agentSeen]);

  // Auto-disconnect when Andra leaves the room. The server-side hard-cap
  // disconnects only the agent participant; without this hook the parent
  // would be stuck on "Așteptăm consilierul Andra..." indefinitely with
  // their mic still hot. 1.5s grace covers transient track drops.
  useEffect(() => {
    if (!agentSeen) return;
    if (agentTrack) return;
    if (connection !== ConnectionState.Connected) return;
    const t = window.setTimeout(() => {
      room.disconnect().catch(() => {});
    }, 1500);
    return () => window.clearTimeout(t);
  }, [agentSeen, agentTrack, connection, room]);

  const agentSpeaking = agentState === "speaking";
  const agentListening = agentState === "listening";

  const statusLine =
    connection !== ConnectionState.Connected
      ? "Se conectează..."
      : legacySpawnFailed
        ? "Consilierul nu a putut fi pornit — antrenorul te va contacta direct."
        : agentSpeaking
          ? "Andra vorbește..."
          : agentListening
            ? "Andra te ascultă. Răspunde firesc."
            : agentState === "thinking"
              ? "Se gândește..."
              : agentTrack
                ? "Andra este conectată."
                : autoDispatch
                  ? "Așteptăm consilierul Andra să intre în apel..."
                  : "Se așteaptă Andra...";

  return (
    <div>
      {/* Controls audio output volume — speakerMuted=true sets volume=0. */}
      <RoomAudioRenderer volume={speakerMuted ? 0 : 1} />

      <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
        <h1 className="font-heading text-3xl sm:text-4xl uppercase leading-[0.95]">
          <span className="text-gradient-cyan">Vorbim acum</span>
        </h1>
        <CallCountdown
          durationSeconds={CALL_DURATION_S}
          running={connection === ConnectionState.Connected && Boolean(agentTrack)}
        />
      </div>

      {/* Two cards facing each other across the gap:
            LEFT  = Andra (AI) — goalkeeper portrait, native facing
            RIGHT = You (parent) — illustrated kicker, mirrored so he
                    faces left toward Andra (native art kicks rightward)
          The ball passes between them — see <ConversationBall /> */}
      <div className="relative grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <ParticipantCard
          name="Andra"
          role="Consilier AI"
          src="/black-white.png"
          fallbackInitial="A"
          accent="cyan"
          active={agentSpeaking || agentState === "thinking"}
        />
        <ParticipantCard
          name="Tu"
          role="Părinte"
          src="/football-player.jpg"
          fallbackInitial="P"
          accent="emerald"
          active={agentListening}
          imageMirror
          imageGrayscale
        />

        <ConversationBall
          target={
            agentSpeaking || agentState === "thinking"
              ? "andra"
              : agentListening
                ? "user"
                : "idle"
          }
          visible={connection === ConnectionState.Connected && Boolean(agentTrack)}
        />
      </div>

      <p className="text-white/75 text-sm sm:text-base leading-relaxed mb-6 min-h-[3em]">
        {statusLine}
      </p>

      {/* Controls row */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
        <button
          type="button"
          onClick={() => setSpeakerMuted((m) => !m)}
          aria-pressed={speakerMuted}
          aria-label={speakerMuted ? "Activează sunetul" : "Oprește sunetul"}
          className={[
            "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-heading text-xs uppercase tracking-[0.16em] transition-colors",
            speakerMuted
              ? "bg-red-500/15 border border-red-400/50 text-red-200 hover:bg-red-500/25"
              : "bg-white/[0.04] border border-white/15 text-white/85 hover:border-white/30 hover:text-white",
          ].join(" ")}
        >
          {speakerMuted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
          {speakerMuted ? "Activează sunetul" : "Sunet"}
        </button>

        <a
          href="https://wa.me/40744311147?text=Bun%C4%83%21%20Sunt%20interesat%20de%20%C8%98coala%20de%20Fotbal%20Dan%20Matei."
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Scrie pe WhatsApp"
          className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-heading text-xs uppercase tracking-[0.16em] bg-[oklch(0.7_0.18_150)] text-[oklch(0.12_0.02_150)] hover:opacity-90 transition shadow-[0_18px_40px_-12px_oklch(0.7_0.18_150/0.5)]"
        >
          <WhatsAppIcon />
          Vorbește pe WhatsApp
        </a>

        <button
          type="button"
          onClick={endCall}
          disabled={ending || connection !== ConnectionState.Connected}
          aria-label="Încheie apelul"
          className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-heading text-xs uppercase tracking-[0.16em] bg-red-500/15 border border-red-400/50 text-red-200 hover:bg-red-500/25 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <EndCallIcon />
          {ending ? "Andra te salută..." : "Încheie apelul"}
        </button>
      </div>

      <p className="mt-6 text-[10px] uppercase tracking-[0.22em] text-white/35">
        {connection === ConnectionState.Connected ? "În direct" : "Se conectează"}
      </p>
    </div>
  );
}

/* ---------- ParticipantCard ---------- */

function ParticipantCard({
  name,
  role,
  src,
  fallbackInitial,
  accent,
  active,
  imageMirror,
  imageGrayscale,
}: {
  name: string;
  role: string;
  src: string;
  fallbackInitial: string;
  accent: "cyan" | "emerald";
  active: boolean;
  /** Flip image horizontally so the two cards face each other. */
  imageMirror?: boolean;
  /** Desaturate the image to match the B&W portrait on the other card. */
  imageGrayscale?: boolean;
}) {
  const [errored, setErrored] = useState(false);
  const ringActive =
    accent === "cyan" ? "ring-brand-cyan/70" : "ring-emerald-400/70";
  const ringIdle = "ring-white/15";
  const glow =
    active && accent === "cyan"
      ? "shadow-[0_0_0_2px_oklch(0.78_0.13_210/0.45),0_0_60px_-15px_oklch(0.78_0.13_210/0.6)]"
      : active && accent === "emerald"
        ? "shadow-[0_0_0_2px_rgba(52,211,153,0.45),0_0_60px_-15px_rgba(52,211,153,0.6)]"
        : "";

  return (
    <article
      className={[
        "rounded-2xl border bg-white/[0.02] p-3 sm:p-4 transition-all duration-500",
        active
          ? accent === "cyan"
            ? "border-brand-cyan/60"
            : "border-emerald-400/60"
          : "border-white/10",
        glow,
      ].join(" ")}
    >
      <div
        className={[
          "relative aspect-square overflow-hidden rounded-xl transition-all duration-500",
          "ring-2",
          active ? ringActive : ringIdle,
        ].join(" ")}
        style={{
          background:
            accent === "cyan"
              ? "radial-gradient(circle at 30% 30%, oklch(0.78 0.13 210 / 0.22), transparent 60%), oklch(0.12 0.025 250)"
              : "radial-gradient(circle at 70% 30%, rgba(52,211,153,0.18), transparent 60%), oklch(0.10 0.02 250)",
        }}
      >
        {!errored ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            onError={() => setErrored(true)}
            className={[
              "absolute inset-0 h-full w-full object-cover transition-all duration-500",
              imageMirror ? "scale-x-[-1]" : "",
              imageGrayscale ? "grayscale" : "",
              active
                ? "brightness-110 saturate-110"
                : "saturate-75 brightness-90 opacity-80",
            ].join(" ")}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <span className="font-heading text-4xl sm:text-5xl font-bold text-white/85">
              {fallbackInitial}
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 text-left px-0.5">
        <p className="font-heading text-sm font-semibold text-white truncate">
          {name}
        </p>
        <p
          className={[
            "text-[10px] uppercase tracking-[0.16em]",
            active
              ? accent === "cyan"
                ? "text-brand-cyan"
                : "text-emerald-300"
              : "text-white/45",
          ].join(" ")}
        >
          {role}
        </p>
      </div>
    </article>
  );
}

/* ---------- CallCountdown ----------
 *
 * Visible MM:SS countdown that mirrors the agent's server-side cap. Starts
 * when `running` flips to true (i.e. parent connected + Andra in the room).
 * Colour shifts cyan → amber at 30s remaining → red + pulse at 15s. When it
 * hits 0 the cap-task on the agent disconnects the room a beat later.
 */
function CallCountdown({
  durationSeconds,
  running,
}: {
  durationSeconds: number;
  running: boolean;
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (running && startedAt == null) {
      setStartedAt(Date.now());
    }
  }, [running, startedAt]);

  useEffect(() => {
    if (!running || startedAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [running, startedAt]);

  const elapsed = startedAt == null ? 0 : Math.floor((now - startedAt) / 1000);
  const remaining = Math.max(0, durationSeconds - elapsed);
  const mm = Math.floor(remaining / 60)
    .toString()
    .padStart(1, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");

  const tone =
    remaining <= 15
      ? "border-red-400/60 bg-red-500/15 text-red-200 animate-pulse"
      : remaining <= 30
        ? "border-amber-400/60 bg-amber-500/15 text-amber-200"
        : "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan";

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`Mai sunt ${mm}:${ss} din apel`}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-heading text-xs uppercase tracking-[0.16em] tabular-nums transition-colors",
        tone,
      ].join(" ")}
    >
      <ClockIcon />
      {mm}:{ss}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/* ---------- ConversationBall ----------
 *
 * Soccer ball thrown between two goalkeepers. While the AI speaks/thinks,
 * the ball sits with Andra (the kid on the left); when she finishes and
 * starts listening, the ball is thrown overhead across to the parent
 * (mirrored kid on the right). The outer motion handles the cross-card
 * throw with spring physics; the inner motion handles the continuous
 * overhead bounce + spin that makes the ball feel "in motion" as a
 * goalkeeper readies the next throw.
 */
function ConversationBall({
  target,
  visible,
}: {
  target: "andra" | "user" | "idle";
  visible: boolean;
}) {
  // 25% and 75% map to the centers of the two columns in the grid-cols-2
  // layout — LEFT is Andra, RIGHT is the user. 50% is a neutral resting
  // spot before either side has talked.
  const leftPct = target === "user" ? "75%" : target === "andra" ? "25%" : "50%";

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -translate-x-1/2 drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]"
          // bottom: ~38% sits the ball roughly at chest height of the
          // figure — where a goalkeeper would catch/throw it.
          style={{ bottom: "38%", width: 44, height: 44 }}
          initial={{ opacity: 0, scale: 0.4, left: leftPct }}
          animate={{ opacity: 1, scale: 1, left: leftPct }}
          exit={{ opacity: 0, scale: 0.4 }}
          transition={{
            // Slower, heavier spring → ball arcs more visibly across the
            // gap, like a goalkeeper throwing overhead.
            left: { type: "spring", stiffness: 60, damping: 13, mass: 1 },
            opacity: { duration: 0.3 },
            scale: { type: "spring", stiffness: 220, damping: 18 },
          }}
        >
          {/* Continuous overhead bounce + spin so the ball reads as
              "in play" even while parked on one side. */}
          <motion.div
            animate={{
              y: [0, -18, 0],
              rotate: 360,
            }}
            transition={{
              y: { duration: 0.9, repeat: Infinity, ease: "easeInOut" },
              rotate: { duration: 1.8, repeat: Infinity, ease: "linear" },
            }}
            style={{ width: 44, height: 44 }}
          >
            <SoccerBallIcon />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SoccerBallIcon() {
  return (
    <svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true">
      <defs>
        <radialGradient id="ballHi" cx="35%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#f0f0f0" />
          <stop offset="100%" stopColor="#c9c9c9" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#ballHi)" stroke="#1a1a1a" strokeWidth="1.3" />
      <polygon
        points="16,9 22,13.2 19.7,19.5 12.3,19.5 10,13.2"
        fill="#1a1a1a"
      />
      <path
        d="M16 9 L16 3 M22 13.2 L27 11 M19.7 19.5 L23.5 24 M12.3 19.5 L8.5 24 M10 13.2 L5 11"
        stroke="#1a1a1a"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function SpeakerOnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5L6 9H2v6h4l5 4z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5L6 9H2v6h4l5 4z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.73 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.24 8.24 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.25 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.06s.88 2.4 1.01 2.56c.12.17 1.74 2.66 4.21 3.73.59.25 1.05.4 1.4.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.29z"/>
    </svg>
  );
}

function EndCallIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function _unused(phase: Phase) { return phase; }
void useEffect; // keep import warm for future extensions
