# AI-Call Lead Flow — Open-Source / Local-Model Stack

When an interested parent leaves a phone number, the academy answers in seconds — not days. A self-hosted AI voice agent talks to them in Romanian, then routes the transcript to the right trainer based on the child's age.

Everything below runs on **open-source software** with **local models** (no per-minute SaaS fees once self-hosted).

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Voice agent framework | **Pipecat** (Python) | Open source, real-time streaming pipeline (STT → LLM → TTS), pluggable providers, WebRTC native |
| Speech-to-text | **faster-whisper** (CTranslate2) — `large-v3` or `medium` | Local, GPU-accelerated, excellent Romanian support |
| LLM | **Ollama** running `llama3.1:8b-instruct` or `gemma2:9b` | Local, free, decent Romanian; swap to NVIDIA NIM if a GPU server is available |
| TTS | **Piper** with a Romanian voice (`ro_RO-mihai-medium`) | Local, fast CPU inference |
| Transport | **LiveKit Agents** (open source) or **Daily.co** WebRTC | Browser-based, no PSTN needed |
| WhatsApp | **Evolution API** (self-hosted, Baileys-based, MIT-style) | Open source, full WhatsApp Web protocol, supports media, groups, templates |
| Database | **Supabase** (already in stack) | Stores leads, transcripts, notifications |
| Email | **Resend** (free tier) or self-hosted **Postal** | Trainer transcript email |
| Push | **Expo Notifications** (already wired) | Mobile app |
| Lead capture | The web app + the mobile app | — |

## Why no phone number is needed

Traditional voice agents call the parent's **phone**, which forces a paid PSTN provider (Twilio, Vonage). We sidestep that:

1. Parent submits the form → backend sends a **WhatsApp** message via Evolution API.
2. The message contains a unique link `https://danmatei.vercel.app/apel/<token>`.
3. Parent taps it → browser opens → the page joins a **WebRTC** room.
4. The Pipecat agent joins the same room and starts talking.
5. When the call ends, the agent posts the transcript to the backend webhook.

PSTN is optional — we can add Twilio Media Streams later if we want a fallback for parents without a smartphone, but the MVP is WebRTC-only.

## End-to-end flow

```
 Parent           Web/App         Backend API           Evolution API       Pipecat Agent     Supabase           Trainer App
   │                │                  │                     │                  │              │                    │
   │ form submit ──▶│                  │                     │                  │              │                    │
   │  (name,phone,  │ POST /api/lead/  │                     │                  │              │                    │
   │   child age,   │  create  ──────▶ │  insert leads ────▶ │                  │              │                    │
   │   GDPR consent)│                  │                     │                  │              │ row inserted       │
   │                │                  │  WhatsApp send ───▶ │                  │              │                    │
   │                │                  │  (link to /apel)    │ ◀── send to parent's number ──▶ │                    │
   │ ◀────────── WhatsApp message ────────────────────────── │                  │              │                    │
   │                                                                                                                  │
   │ tap link  ───────────────────▶ /apel/<token>  ──── joins WebRTC room ────▶                                       │
   │                                                                                                                  │
   │ ◀────────────── Pipecat agent joins room, speaks Romanian ─────────────▶                                          │
   │ ◀────────── conversație 3-5 min: nume copil, vârstă, interes, întrebări ─────────────▶                            │
   │                                                                            on disconnect                          │
   │                                  │  POST /api/voice/webhook ◀────────────  │              │                    │
   │                                  │  {transcript, summary, intent}                          │                    │
   │                                  │  insert lead_calls + transcript ──────▶ │              │                    │
   │                                  │  determine trainer by age              │                                    │
   │                                  │  insert notifications  ───────────────▶ │              │                    │
   │                                  │                                          │              │ realtime channel ─▶│
   │                                  │  send WA + email summary  ─────────────▶ trainer + boss                       │
```

## Trainer routing rules

```
child_age 5–9   →  Sopi (t-sopi)
child_age 10–13 →  Kelemen Andrei (t-kelemen)
child_age 14–15 →  Dan Matei (t-dan)
always CC: Dan Matei (t-dan, "boss")
```

Source of truth: `AGE_GROUPS[]` and `TRAINERS[]` in `client/src/data/landing.ts`.

## Repository layout (additions)

```
api/
  lead/
    create.ts           # POST — accept form, route to trainer, send WhatsApp
    apel.ts             # GET  — resolve <token>, return WebRTC join token
  voice/
    webhook.ts          # POST — Pipecat end-of-call webhook
    livekit-token.ts    # GET  — issues LiveKit JWT for the parent room
  whatsapp/
    inbound.ts          # POST — Evolution API webhook for replies
    send.ts             # internal helper

services/
  voice-agent/          # Pipecat agent (Python, runs on a GPU box)
    pipeline.py         # STT (Whisper) → LLM (Ollama) → TTS (Piper)
    prompt.ro.md        # Romanian system prompt
    Dockerfile
    docker-compose.yml  # ollama + agent + (optional) livekit-server
    pyproject.toml
    README.md

supabase/
  migrations/
    20260510_ai_calls.sql

client/src/
  pages/
    Programare.tsx      # Public lead-capture page
    Apel.tsx            # /apel/<token> — WebRTC join page
  components/
    LeadForm.tsx
    AgentCallRoom.tsx   # LiveKit React room

apps/mobile/
  app/tabs/
    inbox.tsx           # Trainer inbox: new leads + transcripts
  src/features/
    leads/
      lead-service.ts
      use-lead-stream.ts
```

## Supabase schema

```sql
-- 20260510_ai_calls.sql
create extension if not exists "pgcrypto";

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  parent_name        text  not null,
  parent_phone       text  not null,
  parent_phone_e164  text  not null,
  child_name         text  not null,
  child_age          int   not null check (child_age between 4 and 18),
  child_position     text,
  source             text  not null default 'web',
  status             text  not null default 'new',
  -- new -> wa_sent -> calling -> transcribed -> routed -> contacted -> closed
  assigned_trainer_id text,                          -- t-sopi | t-kelemen | t-dan
  cc_trainer_ids      text[] not null default '{t-dan}',
  consent_at         timestamptz not null,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index leads_status_idx on public.leads(status);
create index leads_assigned_idx on public.leads(assigned_trainer_id);

create table public.lead_calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  vendor              text not null default 'pipecat',
  vendor_call_id      text,
  livekit_room        text,
  started_at          timestamptz,
  ended_at            timestamptz,
  duration_seconds    int,
  status              text not null default 'queued',
  -- queued | ringing | answered | completed | failed | no_answer | abandoned
  recording_url       text,
  transcript          jsonb,        -- [{role, text, started_at_ms, ended_at_ms}, ...]
  summary             text,
  intent              text,         -- 'register' | 'info' | 'visit' | 'price' | 'other'
  next_steps          text[],
  raw_payload         jsonb,
  created_at          timestamptz default now()
);
create index lead_calls_lead_idx on public.lead_calls(lead_id);
create index lead_calls_status_idx on public.lead_calls(status);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_trainer_id  text not null,
  channel               text not null,    -- 'push' | 'whatsapp' | 'email' | 'inapp'
  type                  text not null,    -- 'new_lead_transcript' | ...
  payload               jsonb not null,
  read_at               timestamptz,
  delivered_at          timestamptz,
  created_at            timestamptz default now()
);
create index notif_recipient_idx on public.notifications(recipient_trainer_id, read_at);

-- RLS
alter table public.leads enable row level security;
alter table public.lead_calls enable row level security;
alter table public.notifications enable row level security;

create policy "trainer reads own + cc leads" on public.leads
  for select using (
    auth.jwt() ->> 'trainer_id' = assigned_trainer_id
    or auth.jwt() ->> 'trainer_id' = any(cc_trainer_ids)
  );

create policy "trainer reads own calls" on public.lead_calls
  for select using (
    exists(
      select 1 from public.leads l
      where l.id = lead_id and (
        auth.jwt() ->> 'trainer_id' = l.assigned_trainer_id
        or auth.jwt() ->> 'trainer_id' = any(l.cc_trainer_ids)
      )
    )
  );

create policy "trainer reads own notifications" on public.notifications
  for select using (auth.jwt() ->> 'trainer_id' = recipient_trainer_id);
```

## API endpoints (Vercel serverless, in `api/`)

- `POST /api/lead/create` — Zod-validated body, normalizes phone to E.164, applies routing rule, inserts `leads`, calls `evolution-api.send()` with a templated Romanian message containing the `/apel/<token>` link.
- `GET /api/lead/apel/:token` — verifies signed token, returns LiveKit JWT for the room + the agent's room name.
- `POST /api/voice/webhook` — verifies HMAC, inserts `lead_calls`, runs LLM summarization (Ollama), writes notifications, fans out to WhatsApp/email/push/inapp.
- `POST /api/whatsapp/inbound` — Evolution API webhook for parent replies; appends to lead conversation.

## Voice agent — Pipecat pipeline

```python
# services/voice-agent/pipeline.py
from pipecat.pipeline.pipeline import Pipeline
from pipecat.transports.services.daily import DailyTransport         # or LiveKit
from pipecat.services.whisper.stt import WhisperSTTService           # local
from pipecat.services.ollama.llm import OllamaLLMService             # local
from pipecat.services.piper.tts import PiperTTSService               # local

# Romanian voice config
WHISPER_MODEL = "large-v3"        # or "medium" on smaller GPUs
OLLAMA_MODEL  = "llama3.1:8b-instruct-q4_K_M"
PIPER_VOICE   = "ro_RO-mihai-medium"

def build_pipeline(room_url: str, token: str, system_prompt: str) -> Pipeline:
    transport = DailyTransport(room_url, token, "Academia Dan Matei")
    stt = WhisperSTTService(model=WHISPER_MODEL, language="ro")
    llm = OllamaLLMService(model=OLLAMA_MODEL, base_url="http://ollama:11434")
    tts = PiperTTSService(voice=PIPER_VOICE)

    return Pipeline([transport.input(), stt, llm, tts, transport.output()])
```

The system prompt (`prompt.ro.md`) tells the agent:
- It is "Andra", an academy consultant, in Romanian
- Greet by parent name and child name
- Goal: collect interest level, preferred visit day, any special needs/medical info
- Tone: warm, parental, brief turns (≤2 sentences)
- Always confirm details before saying goodbye
- At the end, summarize next steps

After the call ends, an outro hook calls `POST {API}/api/voice/webhook` with `{lead_id, transcript, summary, intent, next_steps, recording_url}`. Pipecat's built-in observers expose the full transcript timestamped per turn.

## Notification fanout

`api/voice/webhook.ts` writes `notifications` rows for each channel:

```ts
async function fanout(call, lead) {
  const recipients = [lead.assigned_trainer_id, ...lead.cc_trainer_ids];
  for (const trainerId of new Set(recipients)) {
    await Promise.all([
      pushNotify(trainerId, call),       // Expo push
      waMessage(trainerId, call),        // Evolution API
      email(trainerId, call),            // Resend
      inApp(trainerId, call),            // notifications row, channel='inapp'
    ]);
  }
}
```

Mobile app subscribes to `supabase.channel('notifications:trainer_id={...}').on('INSERT', ...)` for live inbox.

## Privacy & legal

- Parent clicks a GDPR consent box on the form (Romanian copy).
- The opening line of the AI call is: *"Apelul este înregistrat și transcris pentru calitatea serviciului. Continuarea conversației înseamnă acord."*
- Recording retention: 90 days (configurable).
- Transcript retention: indefinite, with a "right to be forgotten" admin endpoint.
- Trainers see only leads where they are `assigned_trainer_id` or in `cc_trainer_ids` (RLS enforced).

## Deployment notes

Self-hosting layout (any VPS with a small GPU helps; CPU-only works for `medium` Whisper + 8B LLM but is ~2-3× slower):

```
docker-compose.yml
├── ollama           # 11434, persistent volume for the model
├── livekit-server   # 7880 (or use Daily managed)
├── voice-agent      # Pipecat python service
├── evolution-api    # 8080, persistent volume for WhatsApp session
└── nginx (optional, TLS termination)
```

Vercel serverless API in `api/` calls into these via internal HTTPS or a tunnel (e.g. Cloudflare Tunnel) when triggered from a web request.

## Cost (open-source path)

Once the GPU box is running:

| Item | Cost |
| --- | --- |
| Voice AI (Pipecat + local models) | $0/min |
| WhatsApp messages (Evolution API self-hosted, free WhatsApp number) | $0/msg |
| Supabase | existing tier |
| GPU host (Hetzner GPU or RTX 4090 desktop on home internet) | ~€100/mo |
| **Total marginal cost per lead conversation** | **~€0** |

For comparison: Vapi + Twilio WhatsApp would be ~€0.10–0.30 per conversation.
