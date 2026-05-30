# AI-Call Lead Flow - LiveKit Voice Agent

When an interested parent leaves a phone number, the academy responds with a
WhatsApp link to a browser call. The parent joins a LiveKit room from
`/apel/:token`, and LiveKit auto-dispatches the `danmatei-voice-agent` worker.
The worker speaks Romanian, captures transcript/summary/intent, then posts a
signed webhook back to Vercel so trainers can follow up quickly.

This flow is WebRTC-first: no PSTN number is required. Twilio/Vonage-style phone
calling can be added later as a fallback, but production readiness for the
current app is based on browser audio plus WhatsApp delivery.

## Current Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Voice worker | LiveKit Agents Python worker | Auto-dispatched from `api/voice/start.ts` with `roomConfig.agents` |
| Speech-to-text | Deepgram Nova-3 | Romanian STT via direct provider key |
| LLM | OpenAI-compatible endpoint | Defaults to Gemini OpenAI-compatible endpoint; can point at OpenAI/OpenRouter/etc. |
| TTS | ElevenLabs | Direct provider key; default model `eleven_turbo_v2_5` |
| Transport | LiveKit Cloud or self-hosted LiveKit | Parent browser joins the same room as the worker |
| WhatsApp | Evolution API | Sends the `/apel/:token` link and optional trainer summaries |
| Database | Supabase | Leads, call rows, notifications, push subscriptions |
| Push | Web Push (VAPID) | Trainer/admin browser notifications when configured |
| Hosting | Vercel + Fly.io | Vercel for web/API, Fly for the persistent worker |

The repository no longer uses a separate `/spawn` HTTP service or local
Ollama/Whisper/Piper sidecars for the production voice flow. The
`PIPECAT_WEBHOOK_SECRET` name is kept only for backwards compatibility with the
existing signed webhook.

## End-to-end Flow

```text
Parent            Web/App           Vercel API          Evolution API       LiveKit/Fly Worker      Supabase        Trainer UI
  |                 |                   |                    |                    |                   |                |
  | form submit --->| POST /api/lead/create                 |                    |                   |                |
  |                 |------------------>| insert lead + signed token             |                   | lead row       |
  |                 |                   | WhatsApp link ---->| send to parent     |                   |                |
  |<---------------- WhatsApp message with /apel/<token> -----------------------|                   |                |
  | tap link -------------------------> /apel/<token>                           |                   |                |
  |                 | GET /api/voice/start ---------------->| create LiveKit room metadata + token   |                |
  | joins room -----------------------> LiveKit room                             | auto-dispatch job | lead calling   |
  |<---------------- Romanian voice conversation over WebRTC ------------------>|                   |                |
  |                 |                   | POST /api/voice/webhook <--------------| signed transcript |                |
  |                 |                   | insert lead_calls + notifications ---------------------->| realtime ---->|
```

## Routing Rules

Age routing is enforced when the lead is created:

```text
child_age 5-9   -> Sopi (t-sopi)
child_age 10-13 -> Kelemen Andrei (t-kelemen)
child_age 14-15 -> Dan Matei (t-dan)
always CC       -> Dan Matei (t-dan)
```

The current source of truth is the trainer/age configuration used by the lead
creation API and landing data.

## Repository Layout

```text
api/
  lead/
    create.ts            # create lead, route trainer, send WhatsApp link
    list.ts              # trainer/admin lead inbox data
    reply-draft.ts       # AI-assisted response draft
    status.ts            # lead status updates
  voice/
    start.ts             # verify call token, create LiveKit access token/room metadata
    webhook.ts           # signed end-of-call webhook from the worker
  whatsapp/
    send-welcome.ts      # WhatsApp helper endpoint

services/
  voice-agent/
    agent.py             # LiveKit Agents worker
    prompt.ro.md         # Romanian system prompt for Andra
    Dockerfile
    requirements.txt
    fly.toml
    README.md

client/src/
  pages/
    Programare.tsx       # public lead-capture page
    Apel.tsx             # /apel/:token call page
  components/
    leads/LeadForm.tsx
    MicTest.tsx
    SpeakerTest.tsx

supabase/migrations/
  0006_ai_call_leads.sql
  0025_webhook_idempotency.sql
```

## Data Model

`0006_ai_call_leads.sql` defines the lead-call tables:

- `fotbal.leads`: parent/child lead details, trainer routing, status.
- `fotbal.lead_calls`: one row per voice call, including transcript, summary,
  intent, next steps, and `vendor_call_id`.
- `fotbal.lead_notifications`: outbox rows for trainer/boss in-app, push,
  email, and WhatsApp fanout.

`0025_webhook_idempotency.sql` adds a unique partial index on
`(vendor, vendor_call_id)` so retried end-of-call webhooks do not duplicate
trainer notifications. If an older worker omits `vendor_call_id`, the webhook
uses a SHA-256 hash of the signed raw payload as a fallback id.

## API Contracts

- `POST /api/lead/create`: validates lead form input, normalizes phone number,
  assigns trainer/CC, inserts the lead, signs the call link, and sends WhatsApp.
- `POST /api/voice/start`: verifies the call token, creates/updates LiveKit room
  metadata, includes `roomConfig.agents` for auto-dispatch, and returns a parent
  join token.
- `POST /api/voice/webhook`: verifies HMAC signature + timestamp, upserts one
  call result by `vendor_call_id`, marks the lead routed, inserts
  `lead_notifications`, and sends best-effort WhatsApp summaries.

The webhook expects these headers:

```text
X-Pipecat-Timestamp: <unix epoch milliseconds>
X-Pipecat-Signature: hex HMAC-SHA256(PIPECAT_WEBHOOK_SECRET, "{timestamp}.{raw_body}")
```

## Voice Worker Runtime

The worker reads LiveKit room metadata set by `api/voice/start.ts`:

```json
{
  "leadId": "uuid",
  "callId": "lead-...",
  "parentName": "Maria",
  "childName": "Alex",
  "childAge": 8,
  "isExistingParent": false,
  "previousCallsCount": 0
}
```

At startup it connects to LiveKit using `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and
`LIVEKIT_API_SECRET`. For each dispatched call it creates a LiveKit Agents
session:

- Deepgram STT: `LIVEKIT_STT_MODEL`, `LIVEKIT_STT_LANGUAGE`,
  `LIVEKIT_STT_ENDPOINTING_MS`.
- LLM: `LIVEKIT_LLM_BASE_URL`, `LIVEKIT_LLM_API_KEY` or `GEMINI_API_KEY`, and
  `LIVEKIT_LLM_MODEL`.
- ElevenLabs TTS: `ELEVENLABS_API_KEY` or `ELEVEN_API_KEY`,
  `LIVEKIT_TTS_MODEL`, `LIVEKIT_TTS_VOICE`.

The prompt in `services/voice-agent/prompt.ro.md` tells Andra to:

- introduce the recording/transcription notice;
- greet parent and child by name;
- ask short Romanian questions about interest, schedule, and needs;
- avoid repeating the "new or already enrolled" branch for returning parents;
- confirm next steps before ending the call.

## Required Production Environment

Vercel needs:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE
VITE_APP_URL
LEAD_LINK_SIGNING_SECRET
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
LIVEKIT_AGENT_NAME
PIPECAT_WEBHOOK_SECRET
EVOLUTION_BASE_URL
EVOLUTION_API_KEY
EVOLUTION_INSTANCE
CRON_SECRET
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Fly needs:

```text
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
DEEPGRAM_API_KEY
LIVEKIT_LLM_BASE_URL
LIVEKIT_LLM_API_KEY
LIVEKIT_LLM_MODEL
GEMINI_API_KEY
ELEVENLABS_API_KEY
ELEVEN_API_KEY
PIPECAT_WEBHOOK_SECRET
API_BASE
MAX_CALL_SECONDS
```

See `.env.example`, `docs/OPERATIONALIZE.md`, and
`services/voice-agent/README.md` for the full deployment checklist.

## Privacy And Legal

- Parent must accept GDPR consent on the lead form.
- The call opening states that the conversation is recorded/transcribed for
  service quality.
- Trainer/admin access is controlled by Supabase RLS and service-role-only
  server APIs.
- Production retention/deletion policy still needs a live operational owner
  before launch.

## Cost Shape

There is no PSTN per-minute charge in the current WebRTC flow. Marginal cost is
provider usage for Deepgram, the configured OpenAI-compatible LLM endpoint,
ElevenLabs, Evolution/WhatsApp hosting, Supabase, Vercel, and the always-on Fly
worker. At launch readiness, validate those quotas and billing caps in the live
provider dashboards.
