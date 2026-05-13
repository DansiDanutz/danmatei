"""
Andra — Academia de Fotbal Dan Matei voice agent.

LiveKit Agents framework. Auto-dispatched when a parent joins a room whose
config includes `{ agents: [{ agentName: "danmatei-voice-agent" }] }`. Reads
the parent + child context from the room's `metadata` field (set by
/api/voice/start.ts on the Vercel side).

Pipeline: Deepgram STT (Nova-3 Romanian) -> OpenAI gpt-4o-mini LLM ->
ElevenLabs multilingual TTS. These provider plugins are called directly, so
the service needs LIVEKIT_URL/KEY/SECRET plus provider API keys at runtime.
No GPU, no local models, no Ollama sidecar.

On call end (room disconnect or `finish_call` tool), POSTs the transcript
+ summary + intent to {API_BASE}/api/voice/webhook, HMAC-signed with
PIPECAT_WEBHOOK_SECRET (env name kept for backwards compat with the
existing Vercel handler).
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
    JobProcess,
    RoomInputOptions,
    WorkerOptions,
    cli,
    metrics,
)
from livekit.plugins import deepgram, elevenlabs, openai, silero

try:
    from livekit.plugins.turn_detector.multilingual import MultilingualModel  # type: ignore
except Exception:  # pragma: no cover
    MultilingualModel = None  # type: ignore

# Force UTF-8 on stdout/stderr so Romanian characters don't crash logging
# on Windows CI / cp1252 consoles.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]

load_dotenv()
log = logging.getLogger("andra")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

ROOT = Path(__file__).resolve().parent
SYSTEM_PROMPT_BASE = (ROOT / "prompt.ro.md").read_text(encoding="utf-8")

AGENT_NAME = os.environ.get("LIVEKIT_AGENT_NAME", "danmatei-voice-agent")
API_BASE = os.environ.get("API_BASE", "https://danmatei.vercel.app")
WEBHOOK_SECRET = os.environ.get("PIPECAT_WEBHOOK_SECRET", "")
MAX_CALL_SECONDS = int(os.environ.get("MAX_CALL_SECONDS", "180"))  # 3 min hard cap
WRAPUP_AT_SECONDS = max(MAX_CALL_SECONDS - 30, MAX_CALL_SECONDS // 2)  # 150s if cap=180


# ---------------------------------------------------------------------------
# Webhook back to Vercel
# ---------------------------------------------------------------------------


async def post_webhook(payload: dict[str, Any]) -> None:
    """POST end-of-call payload to /api/voice/webhook, HMAC-signed."""
    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if WEBHOOK_SECRET:
        sig = hmac.new(WEBHOOK_SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
        headers["X-Pipecat-Signature"] = sig
    url = f"{API_BASE.rstrip('/')}/api/voice/webhook"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, content=body, headers=headers)
            log.info("webhook -> %s status=%s", url, r.status_code)
            if r.status_code >= 300:
                log.warning("webhook body: %s", r.text[:500])
    except Exception:
        log.exception("webhook POST failed")


# ---------------------------------------------------------------------------
# Per-call state
# ---------------------------------------------------------------------------


class CallState:
    def __init__(
        self,
        lead_id: str,
        parent_name: str,
        child_name: str,
        child_age: int | None,
        is_existing_parent: bool = False,
        previous_calls_count: int = 0,
    ) -> None:
        self.lead_id = lead_id
        self.parent_name = parent_name
        self.child_name = child_name
        self.child_age = child_age
        # True when Vercel's /api/voice/start found other leads with this
        # same phone number that already completed an AI call. We use this
        # to skip the "are you new or already enrolled?" branch — for repeat
        # callers we greet them as known and dive into the current need.
        self.is_existing_parent = is_existing_parent
        self.previous_calls_count = previous_calls_count
        self.transcript: list[dict[str, Any]] = []
        self.started_at = time.time()
        self.intent: str | None = None
        self.summary: str | None = None
        self.next_steps: list[str] = []
        self.finalized = False
        self._finalize_lock = asyncio.Lock()

    def add_turn(self, role: str, text: str) -> dict[str, Any]:
        # The Vercel webhook validator expects role to be one of:
        # agent | parent | system
        mapped_role = "agent" if role == "assistant" else (
            "parent" if role == "user" else role
        )
        turn = {
            "role": mapped_role,
            "text": text,
            "started_at_ms": int((time.time() - self.started_at) * 1000),
        }
        self.transcript.append(turn)
        return turn

    def transcript_text(self) -> str:
        return "\n".join(f"{t['role']}: {t['text']}" for t in self.transcript)


def _personalized_instructions(state: CallState) -> str:
    if state.is_existing_parent:
        # We already know this parent — Vercel's start endpoint found their
        # phone number on a previously-routed lead. Skip the "new vs
        # enrolled?" branch entirely and greet them as known.
        history_hint = (
            f"- Status: PĂRINTE CUNOSCUT — a vorbit cu Andra anterior "
            f"({state.previous_calls_count} apel"
            f"{'uri' if state.previous_calls_count != 1 else ''} înregistrat"
            f"{'e' if state.previous_calls_count != 1 else ''} pe acest "
            f"număr de telefon).\n"
        )
        opening = (
            "Salută părintele pe nume cu o formulă caldă pentru cineva "
            "cunoscut (ex. 'Mă bucur că ne auzim din nou, [Nume]!'), "
            "menționează scurt înregistrarea, apoi întreabă DIRECT cu ce "
            "îl putem ajuta astăzi (NU mai pune întrebarea „ești nou sau "
            "deja înscris?\" — știm deja că e cunoscut)."
        )
    else:
        history_hint = "- Status: Părinte nou — primul apel cu noi de pe acest număr.\n"
        opening = (
            "Salută părintele pe nume și menționează numele copilului în "
            "prima ta propoziție. Anunță scurt înregistrarea, apoi pune "
            "întrebarea de ramură („copilul este deja înscris la Dan "
            "Matei sau ești la primul contact cu noi?\")."
        )
    return (
        f"{SYSTEM_PROMPT_BASE}\n\n"
        "---\n\n"
        "CONTEXT APEL CURENT:\n"
        f"- Părinte: {state.parent_name or '[necunoscut]'}\n"
        f"- Copil: {state.child_name or '[necunoscut]'}"
        f"{f', {state.child_age} ani' if state.child_age else ''}\n"
        f"- Data: {datetime.now(timezone.utc).strftime('%d %B %Y')}\n"
        f"{history_hint}\n"
        f"{opening}"
    )


# ---------------------------------------------------------------------------
# Agent definition
# ---------------------------------------------------------------------------


class AndraAgent(Agent):
    def __init__(self, state: CallState) -> None:
        super().__init__(instructions=_personalized_instructions(state))
        self._state = state

    @agents.function_tool(
        name="set_intent",
        description=(
            "Marchează intenția identificată în conversație. Cheamă această "
            "funcție DOAR după ce înțelegi clar ce vrea părintele. "
            "Valori valide: register, info, visit, price, schedule, other."
        ),
    )
    async def set_intent(self, intent: str) -> str:
        valid = {"register", "info", "visit", "price", "schedule", "other"}
        if intent not in valid:
            return f"invalid intent — must be one of {sorted(valid)}"
        self._state.intent = intent
        log.info("intent=%s", intent)
        return "ok"

    @agents.function_tool(
        name="add_next_step",
        description=(
            "Adaugă un pas de urmărit pentru antrenor (ex: 'Trimite oferta U7', "
            "'Programează vizită joi 16:00'). Cheamă o dată pentru fiecare "
            "acțiune concretă rezultată din conversație."
        ),
    )
    async def add_next_step(self, step: str) -> str:
        clean = step.strip()
        if clean and clean not in self._state.next_steps:
            self._state.next_steps.append(clean)
        return "ok"

    @agents.function_tool(
        name="finish_call",
        description=(
            "Încheie politicos apelul. Cheamă DOAR după ce ai mulțumit "
            "părintelui și i-ai spus ce urmează (antrenorul îl contactează pe "
            "WhatsApp). Oferă un motiv scurt în 'reason'."
        ),
    )
    async def finish_call(self, reason: str) -> str:
        log.info("agent ending call: %s", reason)
        room = self.session.room if hasattr(self, "session") else None
        if room is not None:
            try:
                await room.disconnect()
            except Exception:
                log.exception("room.disconnect failed")
        return "ok"


# ---------------------------------------------------------------------------
# Worker hooks
# ---------------------------------------------------------------------------


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Parent context — Vercel writes it into BOTH `agents[0].metadata`
    # (becomes ctx.job.metadata) and `roomConfig.metadata` (becomes
    # ctx.room.metadata). Prefer job.metadata since it's set per-dispatch
    # and is guaranteed populated before entrypoint runs.
    raw_meta = ""
    job_meta = getattr(ctx, "job", None)
    if job_meta is not None:
        raw_meta = getattr(job_meta, "metadata", "") or ""
    if not raw_meta:
        raw_meta = ctx.room.metadata or ""
    meta: dict[str, Any] = {}
    if raw_meta:
        try:
            meta = json.loads(raw_meta)
        except json.JSONDecodeError:
            log.warning("metadata is not JSON: %r", raw_meta[:200])

    state = CallState(
        lead_id=str(meta.get("leadId") or meta.get("lead_id") or ""),
        parent_name=str(meta.get("parentName") or meta.get("parent_name") or ""),
        child_name=str(meta.get("childName") or meta.get("child_name") or ""),
        child_age=int(meta["childAge"]) if meta.get("childAge") else None,
        is_existing_parent=bool(meta.get("isExistingParent", False)),
        previous_calls_count=int(meta.get("previousCallsCount") or 0),
    )
    log.info(
        "entrypoint room=%s lead=%s parent=%s child=%s/%s existing=%s prior=%d",
        ctx.room.name, state.lead_id, state.parent_name, state.child_name,
        state.child_age, state.is_existing_parent, state.previous_calls_count,
    )

    # ----- Build session -----
    # Direct provider plugins (Deepgram / OpenAI / ElevenLabs) — we used to
    # route through LiveKit Cloud's inference gateway but that shared a
    # single credit pool with every other LiveKit project and exhausted
    # under normal testing load (issue: status_code=429 inference_quota
    # _exceeded). Each provider now uses its own API key, so quota is
    # independent and much higher.
    stt_lang = os.environ.get("LIVEKIT_STT_LANGUAGE", "ro")
    stt_model_name = os.environ.get("LIVEKIT_STT_MODEL", "deepgram/nova-3").split("/")[-1]
    llm_model_name = os.environ.get("LIVEKIT_LLM_MODEL", "openai/gpt-4o-mini").split("/")[-1]
    tts_model_name = os.environ.get(
        "LIVEKIT_TTS_MODEL", "elevenlabs/eleven_multilingual_v2"
    ).split("/")[-1]
    tts_voice = os.environ.get("LIVEKIT_TTS_VOICE", "hpp4J3VqNfWAUOO0d1Us")  # Bella premade

    # Multilingual turn detector needs ~50MB of HuggingFace model files. If
    # the build didn't pre-download them, instantiation throws at runtime —
    # fall back to plain VAD-based detection so the call still works.
    turn_detector: Any
    if MultilingualModel is not None:
        try:
            turn_detector = MultilingualModel()
        except Exception as exc:  # noqa: BLE001
            log.warning("MultilingualModel unavailable (%s), falling back to vad", exc)
            turn_detector = "vad"
    else:
        turn_detector = "vad"

    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=deepgram.STT(model=stt_model_name, language=stt_lang),
        llm=openai.LLM(model=llm_model_name),
        tts=elevenlabs.TTS(model=tts_model_name, voice_id=tts_voice),
        turn_detection=turn_detector,
    )

    # ----- Transcript capture -----
    @session.on("conversation_item_added")
    def _on_item(event: Any) -> None:  # noqa: ANN401
        try:
            item = event.item
            role = getattr(item, "role", "unknown")
            text = getattr(item, "text_content", None) or getattr(item, "text", None) or ""
            if text:
                state.add_turn(role, text)
        except Exception:
            log.exception("conversation_item_added handler failed")

    usage = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics(ev: Any) -> None:  # noqa: ANN401
        try:
            usage.collect(ev.metrics)
        except Exception:
            pass

    # Latch so a polite-close, by data-message or by timer, only fires once.
    closing_in_progress = asyncio.Event()

    async def graceful_close(reason: str) -> None:
        """Have Andra deliver the canonical close, then disconnect.

        Called from:
          - the T=150s wrap-up timer (parent has had ~2:30 of conversation
            and we're about to hit the 3-min cap), OR
          - a `user_end_call_request` data message (parent pressed
            "Încheie apelul" — we DON'T just yank the call, we let Andra
            say goodbye first).

        Both paths use the same canonical script:
          "Mai ai vreo întrebare? Dacă nu, încheiem aici discuția noastră
           și vă așteptăm la Baza Unirea la primul antrenament. Mult succes."
        """
        if closing_in_progress.is_set() or state.finalized:
            return
        closing_in_progress.set()
        log.info("graceful close (%s) — letting Andra finish politely", reason)

        # Slightly different framing depending on which path triggered us.
        # Timer path → still ask "Mai ai vreo întrebare?" because the parent
        # might. User-end path → skip the question (they already said done)
        # and go straight to the closing line.
        if reason == "user_request":
            extra = (
                "Părintele tocmai a cerut să închidem apelul, deci NU mai "
                "întreba 'mai ai vreo întrebare' — sări direct la "
                "închiderea oficială."
            )
        else:
            extra = (
                "Pune scurt întrebarea 'Mai ai vreo întrebare?' într-o "
                "propoziție, apoi imediat după trece la închiderea "
                "oficială (nu aștepta răspuns lung)."
            )

        try:
            await session.generate_reply(
                instructions=(
                    "ÎNCHEIE APELUL ACUM. EXCLUSIV ÎN LIMBA ROMÂNĂ, "
                    "fără niciun cuvânt în engleză. "
                    + extra
                    + " "
                    "Închiderea OFICIALĂ pe care TREBUIE să o spui "
                    "(adaptează cu numele părintelui și al copilului): "
                    "'Mai ai vreo întrebare? Dacă nu, încheiem aici "
                    "discuția noastră și vă așteptăm la Baza Unirea la "
                    "primul antrenament. Mult succes!' "
                    "MAX 2 propoziții. Ton cald, sincer, NU robotic. "
                    "Nu inventa alte formule, folosește această "
                    "închidere ca template."
                )
            )
        except RuntimeError as exc:
            # Race: session already shut down (e.g. user dropped the
            # connection a moment before the timer fired). Not a bug.
            if "AgentSession isn't running" in str(exc):
                log.info("graceful close (%s) skipped: session already closed", reason)
            else:
                log.exception("graceful close generate_reply runtime error")
        except Exception:
            log.exception("graceful close generate_reply failed")

        # Buffer for the TTS playback before we yank the room. Without
        # this the closing voice gets cut off mid-sentence.
        await asyncio.sleep(3)
        try:
            await ctx.room.disconnect()
        except Exception:
            pass

    # ----- Wrap-up signal at T=95s (server-side soft warning) -----
    async def wrap_up_signal() -> None:
        await asyncio.sleep(WRAPUP_AT_SECONDS)
        if state.finalized or closing_in_progress.is_set():
            return
        log.info("wrap-up signal at %ds — telling agent to close", WRAPUP_AT_SECONDS)
        await graceful_close("timer")

    # ----- Hard call-duration cap at T=120s -----
    async def hard_cap() -> None:
        await asyncio.sleep(MAX_CALL_SECONDS)
        log.info("hard cap reached (%ds), disconnecting", MAX_CALL_SECONDS)
        try:
            await ctx.room.disconnect()
        except Exception:
            pass

    # ----- Parent-initiated end (data message from the /apel client) -----
    @ctx.room.on("data_received")
    def _on_data(payload: Any) -> None:  # noqa: ANN401
        try:
            raw = getattr(payload, "data", b"") or b""
            text = raw.decode("utf-8", errors="ignore") if isinstance(raw, (bytes, bytearray)) else str(raw)
            if "user_end_call_request" not in text:
                return
            log.info("user_end_call_request received from parent")
            asyncio.create_task(graceful_close("user_request"))
        except Exception:
            log.exception("data_received handler failed")

    cap_task = asyncio.create_task(hard_cap())
    wrap_task = asyncio.create_task(wrap_up_signal())

    # ----- Finalize on shutdown -----
    async def finalize() -> None:
        async with state._finalize_lock:
            if state.finalized:
                return
            state.finalized = True
        cap_task.cancel()
        wrap_task.cancel()
        if not state.lead_id:
            log.info("no leadId in room metadata, skipping webhook")
            return
        # If we don't have a summary yet (agent didn't call set_intent), do a
        # cheap concatenation-based fallback.
        summary = state.summary or (
            f"Apel cu {state.parent_name} despre {state.child_name}"
            + (f" ({state.child_age} ani)" if state.child_age else "")
            + f". {len(state.transcript)} ture înregistrate."
        )
        payload = {
            "leadId": state.lead_id,
            "started_at": state.started_at,
            "ended_at": time.time(),
            "duration_seconds": int(time.time() - state.started_at),
            "status": "completed",
            "transcript": state.transcript,
            "summary": summary,
            "intent": state.intent,
            "next_steps": state.next_steps,
        }
        await post_webhook(payload)

    ctx.add_shutdown_callback(finalize)

    # ----- Start the session and greet -----
    agent = AndraAgent(state=state)
    await session.start(
        agent=agent,
        room=ctx.room,
        room_input_options=RoomInputOptions(),
    )

    await session.generate_reply(
        instructions=(
            "ÎNCEPE CONVERSAȚIA ÎN LIMBA ROMÂNĂ. "
            "REGULA ABSOLUTĂ: răspunde EXCLUSIV în limba română. ZERO "
            "cuvinte în engleză — nici 'ok', nici 'sorry', nici 'thanks'. "
            "Doar nume proprii (WhatsApp, Google, Cluj-Napoca, Dan Matei) "
            "rămân așa cum sunt. "
            "Salută părintele pe nume, menționează numele copilului, "
            "anunță scurt înregistrarea, apoi întreabă-l dacă e deja "
            "înscris la academie sau e prima dată. Ton cald, NU robotic. "
            "Maxim 2 propoziții."
        )
    )


def main() -> None:
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name=AGENT_NAME,
        )
    )


if __name__ == "__main__":
    main()
