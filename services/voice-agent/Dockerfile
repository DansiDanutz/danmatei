# Pipecat voice agent — Whisper STT + Ollama LLM + Piper TTS, LiveKit transport.
#
# The image bundles the runtime; the Piper voice model is downloaded at
# build time. Ollama itself runs in a separate container — set
# OLLAMA_BASE_URL to point at it.
#
# Build:    docker build -t danmatei/voice-agent ./services/voice-agent
# Run:      docker run --rm -p 8080:8080 --env-file .env danmatei/voice-agent

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# System deps: ffmpeg (audio resampling), libsndfile (Piper / soundfile),
# curl (Piper model download).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Romanian Piper voice (Mihai, medium quality). Cached in the image so
# cold-starts don't have to wait on a download.
RUN mkdir -p /models/piper && cd /models/piper && \
    curl -fL -o ro_RO-mihai-medium.onnx \
      https://huggingface.co/rhasspy/piper-voices/resolve/main/ro/ro_RO/mihai/medium/ro_RO-mihai-medium.onnx && \
    curl -fL -o ro_RO-mihai-medium.onnx.json \
      https://huggingface.co/rhasspy/piper-voices/resolve/main/ro/ro_RO/mihai/medium/ro_RO-mihai-medium.onnx.json

# faster-whisper will lazily download the model on first call; if you
# want a warm image, pre-fetch by running once inside the container or
# bind-mount a host cache directory at /root/.cache/huggingface.

# App
COPY pipeline.py agent_server.py prompt.ro.md ./

ENV PORT=8080 \
    OLLAMA_BASE_URL=http://ollama:11434 \
    PIPER_MODELS_DIR=/models/piper \
    WHISPER_MODEL=medium

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=4).status == 200 else 1)"

CMD ["python", "-u", "agent_server.py"]
