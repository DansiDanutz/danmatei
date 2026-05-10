"""
Pipecat voice agent for Academia de Fotbal Dan Matei.

Real-time audio pipeline: LiveKit room → Whisper STT → Ollama LLM →
Piper TTS → LiveKit room.

When the call ends (parent leaves, idle timeout, or explicit `goodbye`
intent in the LLM output), we summarize the transcript with the same
Ollama model and POST the result to {API_BASE}/api/voice/webhook.

Run via `agent_server.py` — that exposes /spawn so the Vercel side can
trigger one pipeline per incoming call.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import time
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

log = logging.getLogger("pipeline")

ROOT = Path(__file__).resolve().parent
SYSTEM_PROMPT = (ROOT / "prompt.ro.md").read_text(encoding="utf-8")

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "large-v3")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1:8b-instruct-q4_K_M")
OLLAMA_URL = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434")
PIPER_VOICE = os.environ.get("PIPER_VOICE", "ro_RO-mihai-medium")
PIPER_MODELS_DIR = os.environ.get("PIPER_MODELS_DIR", "/models/piper")

API_BASE = os.environ.get("API_BASE", "https://danmatei.vercel.app")
WEBHOOK_SECRET = os.environ.get("PIPECAT_WEBHOOK_SECRET", "")
MAX_CALL_SECONDS = int(os.environ.get("MAX_CALL_SECONDS", "360"))  # 6 min hard cap


@dataclass
class CallSession:
    lead_id: str
    parent_name: str
    child_name: str
    child_age: int
    started_at: float = field(default_factory=time.time)
    transcript: list[dict] = field(default_factory=list)
    intent: str | None = None
    summary: str | None = None
    next_steps: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Webhook POST back to Vercel
# ---------------------------------------------------------------------------


def _post_json(url: str, body: bytes, headers: dict[str, str]) -> None:
    req = urllib.request.Request(url, data=body, method="POST", headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        log.info("webhook %s -> %s", url, resp.status)


async def post_webhook(session: CallSession) -> None:
    body = json.dumps(
        {
            "leadId": session.lead_id,
            "started_at": session.started_at,
            "ended_at": time.time(),
            "duration_seconds": int(time.time() - session.started_at),
            "status": "completed",
            "transcript": session.transcript,
            "summary": session.summary,
            "intent": session.intent,
            "next_steps": session.next_steps,
        }
    ).encode("utf-8")

    headers = {"Content-Type": "application/json"}
    if WEBHOOK_SECRET:
        sig = hmac.new(WEBHOOK_SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
        headers["X-Pipecat-Signature"] = sig

    try:
        await asyncio.to_thread(_post_json, f"{API_BASE}/api/voice/webhook", body, headers)
    except Exception:
        log.exception("webhook failed for lead %s", session.lead_id)


# ---------------------------------------------------------------------------
# Prompt personalization
# ---------------------------------------------------------------------------


def personalize_system_prompt(session: CallSession) -> str:
    return f"""{SYSTEM_PROMPT}

---

CONTEXT APEL CURENT:
- Părinte: {session.parent_name}
- Copil: {session.child_name}, {session.child_age} ani
- Data: {time.strftime("%d %B %Y", time.gmtime())}

Salută părintele pe nume și menționează numele copilului în prima ta propoziție.
"""


# ---------------------------------------------------------------------------
# Pipeline. Built lazily so the file imports cleanly even if Pipecat
# isn't installed yet (handy in CI / type-checking environments).
# ---------------------------------------------------------------------------


async def _build_pipeline(session: CallSession, room_url: str, room_token: str):
    """Construct the Pipecat pipeline. Imports happen inside the function
    so this file is still importable on a host without Pipecat installed
    (the agent_server stub mode)."""
    try:
        from pipecat.pipeline.pipeline import Pipeline
        from pipecat.pipeline.task import PipelineTask
        from pipecat.transports.services.livekit import LiveKitTransport, LiveKitParams
        from pipecat.services.whisper.stt import WhisperSTTService
        from pipecat.services.ollama.llm import OllamaLLMService
        from pipecat.services.piper.tts import PiperTTSService
        from pipecat.processors.aggregators.openai_llm_context import (
            OpenAILLMContext,
        )
    except ImportError as e:
        log.warning(
            "Pipecat or a provider package is not installed (%s). "
            "Falling back to no-op stub. Install with `pip install -r requirements.txt`.",
            e,
        )
        return None

    system_message = personalize_system_prompt(session)

    transport = LiveKitTransport(
        room_url,
        room_token,
        "Andra · Academia Dan Matei",
        params=LiveKitParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
        ),
    )
    stt = WhisperSTTService(model=WHISPER_MODEL, language="ro")
    llm = OllamaLLMService(
        model=OLLAMA_MODEL,
        base_url=OLLAMA_URL,
    )
    tts = PiperTTSService(
        voice=PIPER_VOICE,
        models_dir=PIPER_MODELS_DIR,
    )

    context = OpenAILLMContext(messages=[{"role": "system", "content": system_message}])
    context_agg = llm.create_context_aggregator(context)

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            context_agg.user(),
            llm,
            tts,
            transport.output(),
            context_agg.assistant(),
        ]
    )

    @transport.event_handler("on_transcript")
    async def _on_transcript(_t, role: str, text: str) -> None:  # type: ignore[no-redef]
        session.transcript.append(
            {
                "role": role,
                "text": text,
                "started_at_ms": int((time.time() - session.started_at) * 1000),
            }
        )

    @transport.event_handler("on_participant_disconnected")
    async def _on_leave(_t, _p) -> None:  # type: ignore[no-redef]
        log.info("parent disconnected, lead=%s", session.lead_id)

    return PipelineTask(pipeline)


# ---------------------------------------------------------------------------
# Summarization — same Ollama model, JSON output
# ---------------------------------------------------------------------------


async def summarize(session: CallSession) -> None:
    """Generate summary, intent, next_steps from the transcript using
    Ollama's JSON output mode. Best effort — silently no-ops if Ollama
    isn't reachable."""
    if not session.transcript:
        return

    convo = "\n".join(f"{t['role']}: {t['text']}" for t in session.transcript)
    prompt = f"""Apel între consilierul "Andra" și un părinte al Academiei Dan Matei.
Transcrierea (română):

{convo}

Întoarce un JSON cu:
- summary: 3-5 propoziții, în română, ce a vrut părintele și concluzia
- intent: una din [register, info, visit, price, schedule, other]
- next_steps: listă scurtă în română, acțiunile concrete pentru antrenor

Returnează STRICT un obiect JSON, fără text suplimentar."""

    body = json.dumps(
        {
            "model": OLLAMA_MODEL,
            "format": "json",
            "stream": False,
            "messages": [{"role": "user", "content": prompt}],
            "options": {"temperature": 0.2},
        }
    ).encode("utf-8")

    def _call() -> dict[str, Any]:
        req = urllib.request.Request(
            f"{OLLAMA_URL}/api/chat",
            data=body,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))

    try:
        resp = await asyncio.to_thread(_call)
        content = resp.get("message", {}).get("content", "")
        parsed = json.loads(content) if content else {}
        session.summary = parsed.get("summary")
        intent = parsed.get("intent")
        if intent in {"register", "info", "visit", "price", "schedule", "other"}:
            session.intent = intent
        steps = parsed.get("next_steps", [])
        if isinstance(steps, list):
            session.next_steps = [str(s) for s in steps if isinstance(s, (str, int))]
    except Exception:
        log.exception("summary generation failed for lead %s", session.lead_id)


# ---------------------------------------------------------------------------
# Top-level entry called by agent_server
# ---------------------------------------------------------------------------


async def run_call(session: CallSession, room_url: str, room_token: str) -> None:
    """Run one Pipecat call session.

    Spins up the pipeline, waits until it ends or the hard cap is hit,
    summarizes, and POSTs the webhook.
    """
    log.info("starting call lead=%s room=%s", session.lead_id, room_url)
    task = await _build_pipeline(session, room_url, room_token)
    if task is None:
        log.warning("pipeline stub mode — call %s ends immediately", session.lead_id)
        return

    runner_coro = task.run()
    try:
        await asyncio.wait_for(runner_coro, timeout=MAX_CALL_SECONDS)
    except asyncio.TimeoutError:
        log.warning("call %s hit MAX_CALL_SECONDS, terminating", session.lead_id)
        with suppress_(Exception):
            await task.cancel()

    log.info("call %s ended after %ds", session.lead_id, int(time.time() - session.started_at))
    await summarize(session)
    await post_webhook(session)


class suppress_:
    """Lightweight contextlib.suppress replacement so we can use it inline
    without importing contextlib at the top."""

    def __init__(self, *exc):
        self._exc = exc

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return exc_type is not None and issubclass(exc_type, self._exc)
