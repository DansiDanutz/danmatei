# Voice Agent — Pipecat (local Whisper + Ollama + Piper)

Self-hosted Romanian voice agent that runs a 3-5 minute discovery conversation
with an interested parent. Triggered via WebRTC (LiveKit or Daily) from the
`/apel/:token` page, posts the transcript + summary to `/api/voice/webhook`
on disconnect.

This service intentionally **does not** depend on any per-minute SaaS:

| Layer | Software | Notes |
| --- | --- | --- |
| Framework | [Pipecat](https://github.com/pipecat-ai/pipecat) | Real-time audio pipeline |
| STT | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) `large-v3` (or `medium` on smaller GPUs) | Local, very accurate Romanian |
| LLM | [Ollama](https://ollama.com) running `llama3.1:8b-instruct` or `gemma2:9b` | Local; swap to NVIDIA NIM if you have a GPU server |
| TTS | [Piper](https://github.com/rhasspy/piper) — voice `ro_RO-mihai-medium` | Fast CPU TTS |
| Transport | LiveKit (open source) or Daily WebRTC | Browser-based, no PSTN |

## Quick start

```bash
cd services/voice-agent
docker compose up
# pull the LLM model the first time:
docker compose exec ollama ollama pull llama3.1:8b-instruct-q4_K_M
```

Then visit `https://danmatei.vercel.app/programare`, fill the form, click
the WhatsApp link → browser opens `/apel/<token>` → mic access → the agent
joins the LiveKit room and starts the conversation.

## Files

- `pipeline.py` — Pipecat pipeline: STT → LLM → TTS, including the webhook
  hook that fires at end-of-call.
- `prompt.ro.md` — Romanian system prompt for the agent ("Andra, consilier al
  Academiei Dan Matei"). Tone, goals, anti-goals.
- `Dockerfile` — Python 3.12 + faster-whisper + Pipecat + Piper.
- `docker-compose.yml` — agent + ollama + livekit-server.

## Webhook payload

When the call ends (`on_disconnect`), the agent POSTs to
`POST {API_BASE}/api/voice/webhook` with:

```json
{
  "leadId": "uuid",
  "vendor_call_id": "pipecat-...",
  "started_at": "2026-05-09T18:30:00Z",
  "ended_at":   "2026-05-09T18:34:12Z",
  "duration_seconds": 252,
  "status": "completed",
  "recording_url": "https://...",
  "transcript": [
    { "role": "agent",  "text": "Bună ziua...", "started_at_ms": 0 },
    { "role": "parent", "text": "Bună!",        "started_at_ms": 1800 }
  ],
  "summary": "Părintele este interesat de Grupa U7...",
  "intent": "register",
  "next_steps": ["Programează vizită joi 16:00", "Trimite ofertă lunară"]
}
```

The webhook is HMAC-signed with `VAPI_WEBHOOK_SECRET` (kept the env name even
though we use Pipecat — easy to swap providers later).

## Environment

```
API_BASE=https://danmatei.vercel.app
WEBHOOK_SECRET=...                     # HMAC sign the outbound webhook
LIVEKIT_URL=wss://livekit.example.com
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.1:8b-instruct-q4_K_M
WHISPER_MODEL=large-v3                 # or "medium" on CPU/8GB GPU
PIPER_VOICE=ro_RO-mihai-medium
```

## Why no PSTN?

We send a WhatsApp message with a one-tap web link instead of dialing the
parent's phone. The "call" is a WebRTC session in the browser. This:

- avoids per-minute Twilio/Vonage fees ($0 marginal cost);
- gives us a richer experience (we can show the trainer's photo on screen
  during the call);
- works fully offline of the PSTN network (parent only needs internet).

If a phone-based fallback is ever needed, Twilio Media Streams can be added
without changing the Pipecat pipeline — just plug a different transport in.

## TODO before shipping

- [ ] Wire `pipeline.py` to LiveKit room URL passed via env or arg
- [ ] Implement HMAC signing on the outbound webhook
- [ ] Add summarization step using the same Ollama model
- [ ] Add "always greet by parent + child name" via a per-room metadata field
- [ ] Containerize and deploy on the academy's GPU box
