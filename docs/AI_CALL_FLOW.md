# AI-Call Lead Flow - ElevenLabs Conversational AI

When an interested parent leaves a phone number, the academy responds with a
link to a browser call (by WhatsApp when configured, and always on screen).
The parent opens `/apel/:token` and talks to **Andra**, an ElevenLabs
Conversational AI agent, in Romanian. When the call ends, ElevenLabs posts the
transcript and its post-call analysis to Vercel, which records the call and
notifies the trainers.

The flow is WebRTC/WebSocket in the browser: no phone number, no PSTN costs,
and no server of our own to run for the voice part.

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Voice agent | ElevenLabs Conversational AI | Speech-to-text, LLM (`gemini-2.5-flash`), voice (`eleven_flash_v2_5`), turn-taking |
| Agent config | `services/elevenlabs-agent/` | `agent.json` + `prompt.ro.md`, applied by `scripts/elevenlabs-agent.mjs` |
| Browser client | `@elevenlabs/react` | Audio worklets self-hosted (CSP `script-src 'self'`), see `client/src/lib/elevenlabs-audio.ts` |
| Post-call data | ElevenLabs analysis | Romanian summary, `intent`, `next_steps`, experience, availability |
| WhatsApp | Evolution API → Meta Cloud API fallback | Sends the `/apel/:token` link |
| Database | Supabase | `leads`, `lead_calls`, `lead_notifications` |

## End-to-end Flow

```text
Parent        /programare        Vercel API               ElevenLabs               Supabase / trainers
  | form ------> POST /api/lead/create ------------------------------------------> lead row
  |<------------ link on screen (+ WhatsApp when configured)
  | /apel/<token> -> POST /api/voice/start
  |                 verify token, get signed URL ------> get-signed-url
  |<---------------- signedUrl + dynamic variables (names, call_token)
  | browser <================ voice conversation ================> agent "Andra"
  |                                               call ends
  |                 POST /api/voice/elevenlabs-webhook <-- post_call_transcription (HMAC)
  |                 verify signature + call_token ------------------------------> lead_calls,
  |                                                                               lead → routed,
  |                                                                               trainer notifications
```

## Security

- The ElevenLabs API key stays on Vercel. The browser only gets a short-lived
  signed URL, and the agent has `auth.enable_auth = true`, so it can't be
  called without one.
- `/api/voice/start` mints a 2-hour `call_token` (same HMAC scheme as the
  `/apel` link) and passes it as a dynamic variable. The webhook attaches the
  call to the lead in that token, so a call can't be attributed to another
  lead. The token is never used in the prompt.
- The webhook verifies `ElevenLabs-Signature: t=<secs>,v0=<hex>` =
  HMAC-SHA256(`ELEVENLABS_WEBHOOK_SECRET`, `t.body`) with a 30-minute window.
  Other event types and calls without a valid token are acknowledged and
  ignored.

## Setup

1. Create or update the agent and its post-call webhook (needs an ElevenLabs
   API key with agent + workspace-webhook write access):

   ```bash
   ELEVENLABS_API_KEY=... node scripts/elevenlabs-agent.mjs
   ```

   It writes `ELEVENLABS_INTERVIEW_AGENT_ID`, `ELEVENLABS_POST_CALL_WEBHOOK_ID`
   and the new webhook's `ELEVENLABS_WEBHOOK_SECRET` to
   `services/elevenlabs-agent/.output.local.json` (gitignored). To change the
   prompt or settings later, edit `services/elevenlabs-agent/` and re-run with
   `ELEVENLABS_INTERVIEW_AGENT_ID` and `ELEVENLABS_POST_CALL_WEBHOOK_ID` set.

2. Set on Vercel (production): `ELEVENLABS_API_KEY`,
   `ELEVENLABS_INTERVIEW_AGENT_ID`, `ELEVENLABS_WEBHOOK_SECRET`,
   `LEAD_LINK_SIGNING_SECRET`. Optional: `EVOLUTION_API_URL`,
   `EVOLUTION_API_KEY`, `EVOLUTION_API_INSTANCE` to send the link by WhatsApp.

Without the ElevenLabs variables `/api/voice/start` returns
`voice_not_configured` and the page tells the parent the trainer will contact
them on WhatsApp.

## Routing Rules

Age routing happens when the lead is created (`trainer_slug_for_age`), with
Dan Matei CC'd on every lead he isn't already assigned to.

## Privacy

- The parent accepts GDPR consent on the lead form, and the agent's first
  message says the call is recorded.
- Transcripts are stored in `lead_calls` and in the ElevenLabs workspace; set
  a retention period in the ElevenLabs agent's privacy settings to match the
  academy's policy.
