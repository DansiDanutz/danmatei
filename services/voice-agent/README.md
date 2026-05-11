# Voice Agent — Andra (LiveKit Agents + Cloud Inference)

Romanian voice agent that runs a 3–5 minute discovery conversation with an
interested parent. Triggered by **LiveKit auto-dispatch** when the parent
joins their `lead-*` room from `/apel/:token` on the website. On disconnect,
POSTs the transcript + summary + intent to `/api/voice/webhook`,
HMAC-signed with `PIPECAT_WEBHOOK_SECRET`.

| Layer | Provider | Notes |
| --- | --- | --- |
| Framework | [LiveKit Agents](https://docs.livekit.io/agents/) | Python, async, auto-dispatch |
| STT | Deepgram **Nova-3** (Romanian) via LiveKit Inference | ~200 ms |
| LLM | OpenAI **gpt-4o-mini** via LiveKit Inference | ~1 s typical turn |
| TTS | ElevenLabs `eleven_multilingual_v2` (voice: Bella, premade) via Inference | ~1 s |
| Transport | LiveKit Cloud WebRTC | parent connects from browser |
| Hosting | Fly.io single shared-cpu-1x 1GB machine | ~$2/month |

No GPU, no local models, no Ollama sidecar. Models proxied through your
LiveKit Cloud billing — set `LIVEKIT_*` and the agent works.

## Architecture

```
parent's browser  ──WebRTC──▶  LiveKit Cloud (danmatei-y9jlaz1k.livekit.cloud)
       ▲                              │
       │                              │ dispatches agentName=danmatei-voice-agent
       │ audio                        ▼
       │                       Fly machine running this service
       │                              │
       │ ◀────────agent audio─────────┘
                                      │
                  on disconnect       │  POST /api/voice/webhook
                  ─────────────────▶ Vercel (Next.js)
                                      │  HMAC X-Pipecat-Signature
                                      ▼
                                  Supabase (lead_calls)
```

## Deploy to Fly.io

```bash
# 1. Authenticate (once)
flyctl auth login

# 2. Create the app (once — uses fly.toml in this directory)
cd services/voice-agent
flyctl apps create danmatei-voice-agent --org personal

# 3. Set secrets BEFORE first deploy (otherwise the worker can't register
#    with LiveKit Cloud and the machine crashloops).
flyctl secrets set \
  LIVEKIT_URL="wss://danmatei-y9jlaz1k.livekit.cloud" \
  LIVEKIT_API_KEY="..." \
  LIVEKIT_API_SECRET="..." \
  PIPECAT_WEBHOOK_SECRET="$(openssl rand -base64 32)" \
  --app danmatei-voice-agent

# 4. Deploy
flyctl deploy --app danmatei-voice-agent

# 5. Watch logs
flyctl logs --app danmatei-voice-agent
```

Expected log on healthy startup:

```
INFO livekit.agents starting worker  {"version": "1.5.x"}
INFO livekit.agents plugin registered  {"plugin": "livekit.plugins.silero"}
INFO livekit.agents starting inference executor
INFO livekit.agents registered worker  {"agent_name": "danmatei-voice-agent", "url": "wss://...livekit.cloud"}
```

## Vercel env vars (the matching side)

The Vercel-hosted `/api/voice/start.ts` and `/api/voice/webhook.ts` need:

| Env var | Where | Value |
|---|---|---|
| `LIVEKIT_URL` | already set | same as Fly |
| `LIVEKIT_API_KEY` | already set | same as Fly |
| `LIVEKIT_API_SECRET` | already set | same as Fly |
| `LIVEKIT_AGENT_NAME` | **NEW** | `danmatei-voice-agent` |
| `PIPECAT_WEBHOOK_SECRET` | **NEW** | **must match Fly's value exactly** |

Old vars no longer used (safe to delete on Vercel):
- `VOICE_AGENT_SPAWN_URL`
- `VOICE_AGENT_AUTH_TOKEN`

## Webhook payload

The agent POSTs this shape to `POST {API_BASE}/api/voice/webhook` on disconnect:

```json
{
  "leadId": "uuid",
  "started_at": 1715000000.0,
  "ended_at":   1715000252.0,
  "duration_seconds": 252,
  "status": "completed",
  "transcript": [
    { "role": "agent",  "text": "Bună ziua...", "started_at_ms": 0 },
    { "role": "parent", "text": "Bună!",        "started_at_ms": 1800 }
  ],
  "summary": "Părintele este interesat de Grupa U7...",
  "intent": "register",
  "next_steps": ["Programează vizită joi 16:00", "Trimite ofertă lunară"]
}
```

Header `X-Pipecat-Signature` = `HMAC-SHA256(PIPECAT_WEBHOOK_SECRET, body)` hex.

## Local development

```bash
cd services/voice-agent
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

export LIVEKIT_URL=wss://danmatei-y9jlaz1k.livekit.cloud
export LIVEKIT_API_KEY=...
export LIVEKIT_API_SECRET=...
export PIPECAT_WEBHOOK_SECRET=dev-secret
export API_BASE=http://localhost:3030

python agent.py dev    # watches files, reloads
# or
python agent.py start  # production-mode worker
```

The worker registers with LiveKit Cloud immediately. Trigger a call from
`https://danmatei.vercel.app/programare` (or the local Vite dev URL) and
the agent dispatches automatically.

## Tunables (env)

- `LIVEKIT_AGENT_NAME` — must match what `/api/voice/start.ts` sets in the
  participant's `roomConfig.agents`. Default `danmatei-voice-agent`.
- `LIVEKIT_STT_MODEL` / `LIVEKIT_STT_LANGUAGE` — Inference STT (default
  `deepgram/nova-3` / `ro`).
- `LIVEKIT_LLM_MODEL` — Inference LLM (default `openai/gpt-4o-mini`).
- `LIVEKIT_TTS_MODEL` / `LIVEKIT_TTS_VOICE` — Inference TTS (default
  `elevenlabs/eleven_multilingual_v2` / `hpp4J3VqNfWAUOO0d1Us` Bella).
- `MAX_CALL_SECONDS` — hard cap before agent disconnects. Default 360 (6 min).
- `API_BASE` — where the webhook posts to. Default `https://danmatei.vercel.app`.
