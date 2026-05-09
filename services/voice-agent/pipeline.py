"""
Pipecat voice agent for Academia de Fotbal Dan Matei.

Pipeline: WebRTC mic in → Whisper STT (local) → Ollama LLM (local)
         → Piper TTS (local) → WebRTC out

This is a skeleton. The full Pipecat installation, model loading,
and LiveKit/Daily wiring should be filled in before deploying. See
the README for the runtime instructions.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path

# These imports are commented in the skeleton — uncomment when the host
# environment has Pipecat + the local STT/LLM/TTS providers installed.
#
# from pipecat.pipeline.pipeline import Pipeline
# from pipecat.pipeline.task import PipelineTask
# from pipecat.transports.services.daily import DailyTransport
# from pipecat.services.whisper.stt import WhisperSTTService
# from pipecat.services.ollama.llm import OllamaLLMService
# from pipecat.services.piper.tts import PiperTTSService
# from pipecat.frames.frames import EndFrame, TranscriptionFrame, TextFrame

ROOT = Path(__file__).resolve().parent
SYSTEM_PROMPT = (ROOT / "prompt.ro.md").read_text(encoding="utf-8")

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "large-v3")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1:8b-instruct-q4_K_M")
OLLAMA_URL = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434")
PIPER_VOICE = os.environ.get("PIPER_VOICE", "ro_RO-mihai-medium")

API_BASE = os.environ.get("API_BASE", "https://danmatei.vercel.app")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
LIVEKIT_URL = os.environ.get("LIVEKIT_URL", "")


@dataclass
class CallSession:
    lead_id: str
    parent_name: str
    child_name: str
    child_age: int
    started_at: float = field(default_factory=time.time)
    transcript: list[dict] = field(default_factory=list)


async def post_webhook(session: CallSession, summary: str, intent: str, next_steps: list[str]) -> None:
    """POST end-of-call payload back to /api/voice/webhook."""
    import hmac
    import hashlib
    import urllib.request

    body = json.dumps(
        {
            "leadId": session.lead_id,
            "started_at": session.started_at,
            "ended_at": time.time(),
            "duration_seconds": int(time.time() - session.started_at),
            "status": "completed",
            "transcript": session.transcript,
            "summary": summary,
            "intent": intent,
            "next_steps": next_steps,
        }
    ).encode("utf-8")

    sig = hmac.new(WEBHOOK_SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
    req = urllib.request.Request(
        f"{API_BASE}/api/voice/webhook",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Pipecat-Signature": sig,
        },
    )
    await asyncio.to_thread(urllib.request.urlopen, req, timeout=10)


def build_personalized_prompt(session: CallSession) -> str:
    return f"""{SYSTEM_PROMPT}

---

CONTEXT APEL CURENT:
- Părinte: {session.parent_name}
- Copil: {session.child_name}, {session.child_age} ani
- Data: {time.strftime('%d %B %Y', time.gmtime())}

Salută părintele pe nume și menționează numele copilului în prima ta propoziție.
"""


async def run_call(session: CallSession, room_url: str, room_token: str) -> None:
    """Spin up a Pipecat pipeline for one call session.

    NOTE: this is a runtime stub. Uncomment the imports above and fill in
    the transport / stt / llm / tts construction once the dependencies are
    installed on the host. The shape below mirrors what the full pipeline
    will look like.
    """
    system = build_personalized_prompt(session)

    # transport = DailyTransport(room_url, room_token, "Andra · Academia Dan Matei")
    # stt = WhisperSTTService(model=WHISPER_MODEL, language="ro")
    # llm = OllamaLLMService(model=OLLAMA_MODEL, base_url=OLLAMA_URL,
    #                        system_message=system)
    # tts = PiperTTSService(voice=PIPER_VOICE)
    #
    # pipeline = Pipeline([transport.input(), stt, llm, tts, transport.output()])
    # task = PipelineTask(pipeline)
    # await task.run()
    #
    # # When the room closes, summarize and post webhook:
    # summary, intent, next_steps = await summarize_with_ollama(session)
    # await post_webhook(session, summary, intent, next_steps)

    # Skeleton no-op so the file imports cleanly:
    print(f"[pipeline stub] would join {room_url} for lead {session.lead_id}")
    await asyncio.sleep(0)


if __name__ == "__main__":
    # Manual harness for ad-hoc testing
    demo = CallSession(
        lead_id=os.environ.get("LEAD_ID", "demo-lead"),
        parent_name=os.environ.get("PARENT_NAME", "Părinte"),
        child_name=os.environ.get("CHILD_NAME", "Copil"),
        child_age=int(os.environ.get("CHILD_AGE", "9")),
    )
    asyncio.run(run_call(demo, os.environ.get("ROOM_URL", ""), os.environ.get("ROOM_TOKEN", "")))
