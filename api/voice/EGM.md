# api/voice

## Overview
The browser voice-interview flow for leads:

1. `start` exchanges a signed lead link token for an ElevenLabs signed WebSocket URL and the call's dynamic variables.
2. `elevenlabs-webhook` receives the post-call transcription and records it against the lead.

## Interface
- **`POST /api/voice/start`** (`start.ts:handler`): body `{token: string}`. No JWT; auth is the signed lead token.
  - Calls ElevenLabs `GET https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=...` (`ELEVENLABS_API` constant).
  - Returns 200 `{ok, leadId, signedUrl, dynamicVariables:{parent_name, child_name, child_age, is_existing_parent, previous_calls_count, call_token}}`.
  - Errors: 400 `missing_token`, 401 `invalid_token`, 404 `lead_not_found`, 405 `method_not_allowed`, 429 `rate_limited`, 502 `voice_unavailable`, 503 `lead_link_signing_unavailable`, `voice_not_configured` or `supabase_unavailable`.
- **`POST /api/voice/elevenlabs-webhook`** (`elevenlabs-webhook.ts:handler`): `bodyParser: false`. The raw body is limited to 2 MiB (413 when exceeded).
  - Verified with `verifyElevenLabsSignature` on the `elevenlabs-signature` header.
  - Any `type` other than `post_call_transcription` gets 200 `{ok:true, ignored: type ?? "unknown"}`. A payload without a valid `call_token` gets 200 `{ok:true, ignored:'no_call_token'}`.
  - Otherwise it returns the status and body from `recordLeadCall`.
  - Errors: 400 `body_read_failed`, `invalid_json`, or `invalid_body` (zod failure); 401 with the verifier's reason (`secret_unset`, `missing_signature`, `missing_timestamp`, `timestamp_skew` or `invalid_signature`); 405 `method_not_allowed`; 413; 503 `supabase_unavailable`.
- **Exports:**
  - type `ElevenLabsPostCall`
  - `toLeadCallResult(payload)` returning `LeadCallResult | null`. It maps `status`, `intent` (from `LEAD_CALL_INTENTS`), `nextSteps` and `summary`. [elevenlabs-webhook.ts]

## Invariants
- **Lead resolution:** the lead is identified only by a signed `call_token` from `dynamic_variables`, checked with `verifyToken`. An unsigned lead id is never used. [elevenlabs-webhook.ts:toLeadCallResult]
- **Signature first:**
  - Nothing is parsed or written until the signature passes. The signature allows 30 min of skew.
  - Unsigned requests are allowed only in dev, with no secret set and not in production or preview. [elevenlabs-webhook.ts:handler; ../_lib/elevenlabs-signature.ts]
- **Idempotency:** a call recorded twice with the same `(vendor, vendor_call_id)` returns 200 `{duplicate:true}`. [../_lib/lead-call-result.ts:recordLeadCall]
- **`toLeadCallResult` mapping:**
  - Status is `failed` when `data.status` is set and is not `done`; `completed` when a parent turn exists; otherwise `abandoned`.
  - Empty turns are dropped.
  - `summary` joins `analysis.transcript_summary` with the `child_experience` and `availability` data-collection values. [elevenlabs-webhook.ts:trainerSummary]
  - `nextSteps` is split on newlines or `;`, with bullet and number prefixes stripped.
  - `recordingUrl` is always `null`. [elevenlabs-webhook.ts:toLeadCallResult]
- **`start` limits:**
  - Rate limit is 3 per hour per lead (`voice:${leadId}`).
  - The `call_token` TTL is 2 h (`CALL_TOKEN_TTL_MS`).
  - The ElevenLabs API key is never returned to the client. [start.ts]

## Side Effects
- **`start`:**
  - Reads `fotbal.leads`. It also counts earlier leads with the same `parent_phone_e164` whose status is `routed` or `transcribed`.
  - Updates `leads.status='calling'` on a best-effort basis (the error is ignored).
  - Calls ElevenLabs (`ELEVENLABS_API_KEY`, `ELEVENLABS_INTERVIEW_AGENT_ID`).
  - Updates the in-memory rate limit.
- **`elevenlabs-webhook`:** goes through `recordLeadCall`. That reads `fotbal.leads`, inserts `fotbal.lead_calls`, updates `leads.status='routed'` and inserts `fotbal.lead_notifications`. It also sends a best-effort WhatsApp summary through `sendWhatsappText` to each trainer that has a `TRAINER_PHONE_<ID>` env var set. [../_lib/lead-call-result.ts:recordLeadCall]
- **Env:** `ELEVENLABS_WEBHOOK_SECRET`, `LEAD_LINK_SIGNING_SECRET`, `SUPABASE_SERVICE_ROLE`, `TRAINER_PHONE_<ID>`, and the WhatsApp vars (`WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION`).
- Shared helpers are documented in [api/_lib](../_lib/EGM.md).

## Verification
- Run: `pnpm test tests/api` (`elevenlabs-interview.test.ts` covers `toLeadCallResult` and the signature)
- Typecheck: `pnpm check:api`
