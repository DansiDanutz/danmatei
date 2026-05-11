# LiveKit Agents voice worker — Cloud Inference (Deepgram + OpenAI +
# ElevenLabs proxied through LiveKit Cloud). No local models needed.
#
# Build:    docker build -t danmatei/voice-agent ./services/voice-agent
# Run:      docker run --rm --env-file .env danmatei/voice-agent

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# System deps: just CA certs for HTTPS and curl for the healthcheck probe.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install -r requirements.txt

# Pre-download the silero VAD + turn-detector models so first call doesn't
# wait on Hugging Face.
RUN python -c "from livekit.plugins import silero; silero.VAD.load()" || true
RUN python -c "from livekit.plugins.turn_detector.multilingual import MultilingualModel; MultilingualModel()" || true

COPY agent.py prompt.ro.md ./

# LiveKit Agents workers expose a tiny HTTP debug server on this port —
# default port the framework binds to. Fly will probe it for readiness.
ENV HEALTH_PORT=8081

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8081/ >/dev/null || exit 1

# `start` = production worker mode (long-running, registers with LiveKit
# Cloud, waits for dispatch). `dev` would enable file watching.
CMD ["python", "-u", "agent.py", "start"]
