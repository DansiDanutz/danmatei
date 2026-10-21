# Operationalize the AI-call lead flow

Step-by-step deploy guide. End state: a real parent submits `/programare`,
gets a WhatsApp link with the agent within seconds, taps it, talks to
**Andra** (Romanian voice agent) for up to 3 minutes, and the transcript lands
in `/antrenor → Inbox AI` for the right trainer.

The voice part runs on **ElevenLabs Conversational AI** (no server of our
own). The only self-hosted piece is the WhatsApp gateway (Evolution API).
See `docs/AI_CALL_FLOW.md` for how the pieces fit.

---

## What you need

- A Supabase project (free tier is fine)
- A Vercel project (already at `www.danmatei.ro`)
- An ElevenLabs account (a paid plan for commercial use) and an API key with
  agent write and webhook write permissions.
- One small host that can run Docker, for the WhatsApp gateway.
- A domain + DNS A record for that host, so Evolution API can receive HTTPS
  traffic.
- A WhatsApp-eligible phone number you can scan with a QR code (for
  Evolution API to log in to WhatsApp Web).

---

## Step 1 — Apply the database migration

The schema lives in `supabase/migrations/0006_ai_call_leads.sql`.

```bash
# from the repo root, with the Supabase CLI installed
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Verify in the Supabase Studio → SQL Editor:

```sql
select * from fotbal.leads limit 1;
select * from fotbal.lead_calls limit 1;
select * from fotbal.lead_notifications limit 1;
```

All three should return zero rows (not an error).

---

## Step 2 — Bring up the WhatsApp gateway on the host

```bash
# 1. Clone the repo
git clone https://github.com/DansiDanutz/danmatei.git
cd danmatei

# 2. Create .env from the template
cp .env.example .env
# Edit .env and set:
#  - EVOLUTION_API_KEY        (32-char random)
#  - API_BASE                 (https://www.danmatei.ro — where inbound
#                              WhatsApp messages are posted)

# 3. Start Evolution API
docker compose --env-file .env up -d
```

### Public TLS (optional, recommended once you go live)

For prod self-hosting, point a domain at the host and let Caddy provision TLS:

```bash
# DNS: A record wa.example.com → <your-host-ip>
PUBLIC_HOST=example.com docker compose --profile public --env-file .env up -d caddy

# evolution → https://wa.example.com        (admin UI)
```

---

## Step 3 — Pair the WhatsApp number (one-time)

Evolution API needs to log into a real WhatsApp account on first start.

```bash
# Create the instance Vercel will talk to
curl -X POST http://localhost:8081/instance/create \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "academia",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'

# Fetch the QR code (returns a base64 PNG)
curl http://localhost:8081/instance/connect/academia \
  -H "apikey: $EVOLUTION_API_KEY"
```

Decode the QR (paste the data URL into a browser, or pipe through `base64
-d` to a file). Scan it from the WhatsApp app on the academy phone:
**Settings → Linked Devices → Link a Device → scan**.

Once paired, the session persists in the `evolution_data` Docker volume.

Test:

```bash
curl -X POST http://localhost:8081/message/sendText/academia \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"number":"40712345678","text":"Test from Evolution API"}'
```

---

## Step 4 — Create the interview agent (Andra)

```bash
ELEVENLABS_API_KEY=... node scripts/elevenlabs-agent.mjs
```

It creates the agent from `services/elevenlabs-agent/` and a post-call
webhook pointing at `https://www.danmatei.ro/api/voice/elevenlabs-webhook`,
and writes the agent id, webhook id and webhook secret to
`services/elevenlabs-agent/.output.local.json` (gitignored).

---

## Step 5 — Set Vercel environment variables

In the Vercel dashboard → `danmatei` project → **Settings → Environment
Variables**, add:

| Variable                        | Scope      | Value                       |
| ------------------------------- | ---------- | --------------------------- |
| `VITE_APP_URL`                  | Production | `https://www.danmatei.ro`   |
| `PUBLIC_BASE_URL`               | Production | `https://www.danmatei.ro`   |
| `LEAD_LINK_SIGNING_SECRET`      | Production | 32-char random              |
| `ELEVENLABS_API_KEY`            | Production | your ElevenLabs key         |
| `ELEVENLABS_INTERVIEW_AGENT_ID` | Production | from Step 4                 |
| `ELEVENLABS_WEBHOOK_SECRET`     | Production | from Step 4                 |
| `EVOLUTION_API_URL`             | Production | `https://wa.example.com`    |
| `EVOLUTION_API_KEY`             | Production | (same as host)              |
| `EVOLUTION_API_INSTANCE`        | Production | `academia`                  |
| `TRAINER_PHONE_T_SOPI`          | Production | `+407xxxxxxxx`              |
| `TRAINER_PHONE_T_KELEMEN`       | Production | `+407xxxxxxxx`              |
| `TRAINER_PHONE_T_DAN`           | Production | `+407xxxxxxxx`              |

Also set the Supabase, cron, Web Push and text-LLM variables from
`.env.example` in Vercel. The two app-origin variables above are important:
they keep invite links, Google OAuth redirects, WhatsApp call links and
assistant fallback links on the custom domain instead of the Vercel preview URL.

Trigger a redeploy:

```bash
# from your laptop with the Vercel CLI logged in
vercel --prod
```

---

## Step 6 — End-to-end smoke test

```bash
# 1. Submit a lead with your own phone
curl -X POST https://www.danmatei.ro/api/lead/create \
  -H "Content-Type: application/json" \
  -d '{
    "parentName": "Dan Test",
    "parentPhone": "+40712345678",
    "childName": "Test Junior",
    "childAge": 9,
    "source": "web",
    "consent": true
  }'
```

Expect:

- HTTP 200 with `{ ok: true, leadId, trainerId, callLink, whatsapp: { sent: true } }`
- Your phone receives a WhatsApp message containing a `/apel/<token>` link
- Tap the link → page asks for mic → Andra greets you in Romanian
- Hang up → check `https://www.danmatei.ro/antrenor` → tab **Inbox AI**
  → the transcript + summary is there

If Andra doesn't answer:

- `/apel` shows "not available" → `ELEVENLABS_API_KEY` or
  `ELEVENLABS_INTERVIEW_AGENT_ID` is missing on Vercel.
- The call connects but no transcript arrives → check the post-call webhook
  in the ElevenLabs dashboard (URL and recent deliveries) and that
  `ELEVENLABS_WEBHOOK_SECRET` matches its secret.

If the WhatsApp message doesn't arrive:

- `docker compose logs evolution-api` — check for QR drop / session loss
- `curl http://localhost:8081/instance/connectionState/academia`

---

## Cost expectation

- Vercel: existing tier
- Supabase: existing tier
- ElevenLabs: per-minute agent usage on your plan
- WhatsApp: Evolution API hosting; no PSTN per-minute cost

Compare to Twilio + Vapi: ~€0.15-0.30 per 5-min call.

---

## Going further

Once the loop is working, the natural follow-ups in `AUDIT_AND_ROADMAP.md` P0:

- **Player profiles** — the inbox now feeds new leads; build the screen
  parents will spend the most time in.
- **Push notifications** — Web Push is wired through VAPID; validate real
  browser delivery after production credentials are set.
- **Highlight clips per child** — add a media pipeline when the academy has
  confirmed the desired parent/trainer workflow.
