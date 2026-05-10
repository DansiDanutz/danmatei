"""
Lightweight HTTP server in front of the Pipecat agent.

Vercel's /api/voice/start posts a "spawn" request here when a parent
clicks the WhatsApp link. We then launch a Pipecat pipeline that joins
the same LiveKit room and runs the conversation.

Endpoints:
    POST /spawn   — start a pipeline for a (room, leadId, parent context)
    GET  /health  — liveness probe

Auth: Bearer token equal to VOICE_AGENT_AUTH_TOKEN env var (matched
on the Vercel side). Skipped if the env var is unset, for local dev.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import suppress
from dataclasses import dataclass
from typing import Optional

from aiohttp import web

from pipeline import CallSession, run_call

log = logging.getLogger("agent-server")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

AUTH_TOKEN = os.environ.get("VOICE_AGENT_AUTH_TOKEN")
PORT = int(os.environ.get("PORT", "8080"))


@dataclass
class SpawnRequest:
    lead_id: str
    parent_name: str
    child_name: str
    child_age: int
    livekit_url: str
    room: str
    token: str

    @classmethod
    def from_payload(cls, body: dict) -> "SpawnRequest":
        required = (
            "leadId",
            "parentName",
            "childName",
            "childAge",
            "livekitUrl",
            "room",
            "token",
        )
        missing = [k for k in required if k not in body]
        if missing:
            raise ValueError(f"missing fields: {missing}")
        return cls(
            lead_id=str(body["leadId"]),
            parent_name=str(body["parentName"]),
            child_name=str(body["childName"]),
            child_age=int(body["childAge"]),
            livekit_url=str(body["livekitUrl"]),
            room=str(body["room"]),
            token=str(body["token"]),
        )


def _authorized(request: web.Request) -> bool:
    if not AUTH_TOKEN:
        return True
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return False
    return header.split(" ", 1)[1].strip() == AUTH_TOKEN


async def health(_: web.Request) -> web.Response:
    return web.json_response({"ok": True, "service": "voice-agent"})


async def spawn(request: web.Request) -> web.Response:
    if not _authorized(request):
        return web.json_response({"error": "unauthorized"}, status=401)
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": "invalid_json", "detail": str(e)}, status=400)

    try:
        spec = SpawnRequest.from_payload(body)
    except ValueError as e:
        return web.json_response({"error": "invalid_payload", "detail": str(e)}, status=400)

    log.info("spawn: lead=%s room=%s parent=%s", spec.lead_id, spec.room, spec.parent_name)

    session = CallSession(
        lead_id=spec.lead_id,
        parent_name=spec.parent_name,
        child_name=spec.child_name,
        child_age=spec.child_age,
    )

    # Fire-and-forget: don't keep the HTTP request open for the whole call.
    asyncio.create_task(_run(session, spec))
    return web.json_response({"ok": True, "room": spec.room})


async def _run(session: CallSession, spec: SpawnRequest) -> None:
    try:
        await run_call(session, room_url=spec.livekit_url, room_token=spec.token)
    except Exception:
        log.exception("call %s failed", session.lead_id)


def build_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/health", health)
    app.router.add_post("/spawn", spawn)
    return app


def main() -> None:
    app = build_app()
    log.info("voice-agent listening on :%d", PORT)
    web.run_app(app, host="0.0.0.0", port=PORT, print=None)


if __name__ == "__main__":
    main()
