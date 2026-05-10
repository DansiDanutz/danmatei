# Operationalize the AI-call lead flow

Step-by-step deploy guide. End state: a real parent submits `/programare`,
gets a WhatsApp link with the agent within seconds, taps it, talks to
**Andra** (Romanian voice agent) for 3-5 min, and the transcript lands
in `/antrenor → Inbox AI` for the right trainer.

The whole pipeline is **open source** and self-hostable — no per-minute
SaaS fees once the box is running.

---

## What you need

- A Supabase project (free tier is fine)
- A Vercel project (already at `danmatei.vercel.app`)
- One host that can run Docker:
  - **Minimum (CPU only):** 8 cores, 16 GB RAM. Uses `WHISPER_MODEL=medium`,
    `OLLAMA_MODEL=gemma2:2b`. Call latency 1.5-3s per turn.
  - **Recommended (small GPU):** RTX 4060 / 3060 / 4070. Uses
    `WHISPER_MODEL=large-v3` + `OLLAMA_MODEL=llama3.1:8b-instruct-q4_K_M`.
    Sub-second latency per turn.
- A domain + DNS A record for the voice host (so the LiveKit transport
  and the agent's `/spawn` endpoint have HTTPS).
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

## Step 2 — Bring up the voice stack on the host

```bash
# 1. Clone the repo
git clone https://github.com/DansiDanutz/danmatei.git
cd danmatei

# 2. Create .env from the template
cp .env.example .env
# Edit .env and set:
#  - LIVEKIT_API_KEY        (any string, e.g. "academia-livekit")
#  - LIVEKIT_API_SECRET     (32-char random)
#  - VOICE_AGENT_AUTH_TOKEN (32-char random)
#  - PIPECAT_WEBHOOK_SECRET (32-char random)
#  - EVOLUTION_API_KEY      (32-char random)
#  - LEAD_LINK_SIGNING_SECRET (32-char random)
#  - SUPABASE_URL, SUPABASE_SERVICE_ROLE (used by the agent's webhook)

# 3. Start everything (Ollama, LiveKit, Pipecat agent, Evolution API)
docker compose --env-file .env up -d

# 4. Pull the LLM model into Ollama. This is one-time and may take ~5 min.
docker compose exec ollama ollama pull llama3.1:8b-instruct-q4_K_M

# 5. Check health
curl http://localhost:8080/health   # voice-agent → {"ok":true,...}
curl http://localhost:11434/api/tags # ollama
curl http://localhost:7880/         # livekit (returns 404, that's fine)
```

### Public TLS (optional, recommended once you go live)

The Vercel side calls the voice agent via HTTPS. For dev you can tunnel
with [`cloudflared`](https://github.com/cloudflare/cloudflared) or
[`ngrok`](https://ngrok.com). For prod, point a domain at the host and
let Caddy provision TLS:

```bash
# DNS: A record voice.example.com → <your-host-ip>
PUBLIC_HOST=example.com docker compose --profile public --env-file .env up -d caddy

# voice-agent → https://voice.example.com
# livekit     → https://livekit.example.com   (use wss://livekit.example.com in env)
# evolution   → https://wa.example.com        (admin UI)
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

## Step 4 — Set Vercel environment variables

In the Vercel dashboard → `danmatei` project → **Settings → Environment
Variables**, add (paste from your local `.env`):

| Variable | Scope | Value |
| --- | --- | --- |
| `LEAD_LINK_SIGNING_SECRET` | Production | (same as host) |
| `LIVEKIT_URL` | Production | `wss://livekit.example.com` |
| `LIVEKIT_API_KEY` | Production | (same as host) |
| `LIVEKIT_API_SECRET` | Production | (same as host) |
| `VOICE_AGENT_SPAWN_URL` | Production | `https://voice.example.com/spawn` |
| `VOICE_AGENT_AUTH_TOKEN` | Production | (same as host) |
| `PIPECAT_WEBHOOK_SECRET` | Production | (same as host) |
| `EVOLUTION_API_URL` | Production | `https://wa.example.com` |
| `EVOLUTION_API_KEY` | Production | (same as host) |
| `EVOLUTION_API_INSTANCE` | Production | `academia` |
| `TRAINER_PHONE_T_SOPI` | Production | `+407xxxxxxxx` |
| `TRAINER_PHONE_T_KELEMEN` | Production | `+407xxxxxxxx` |
| `TRAINER_PHONE_T_DAN` | Production | `+407xxxxxxxx` |

Trigger a redeploy:
```bash
# from your laptop with the Vercel CLI logged in
vercel --prod
```

---

## Step 5 — End-to-end smoke test

```bash
# 1. Submit a lead with your own phone
curl -X POST https://danmatei.vercel.app/api/lead/create \
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
- Hang up → check `https://danmatei.vercel.app/antrenor` → tab **Inbox AI**
  → the transcript + summary is there

If the agent doesn't speak:
- `docker compose logs voice-agent` should show "starting call lead=…"
- Make sure `LIVEKIT_URL` is reachable from both the browser AND the
  voice-agent container. The browser uses `wss://`; the agent uses the
  same URL.

If the WhatsApp message doesn't arrive:
- `docker compose logs evolution-api` — check for QR drop / session loss
- `curl http://localhost:8081/instance/connectionState/academia`

---

## Cost expectation

- Vercel: existing tier
- Supabase: existing tier
- Host: ~€60-150/month depending on GPU
- WhatsApp + voice AI: **€0 / call** (open source, local models)

Compare to Twilio + Vapi: ~€0.15-0.30 per 5-min call.

---

## Going further

Once the loop is working, the natural follow-ups in `AUDIT_AND_ROADMAP.md` P0:
- **Player profiles** — the inbox now feeds new leads; build the screen
  parents will spend the most time in.
- **Push notifications** — the `lead_notifications` table is already
  populated; wire `expo-notifications` against `recipient_trainer_id`.
- **Highlight clips per child** — use the hyperframes pipeline already
  in `apps/mobile/hyperframes/`.
