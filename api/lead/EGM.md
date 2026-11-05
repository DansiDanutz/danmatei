# api/lead

## Overview
Endpoints for the lead lifecycle:

- public lead capture
- the trainer and owner inbox
- AI reply drafts
- status updates

Leads come from the web or app enrollment form. Each lead is routed to a trainer by the child's age.

## Interface
- **`POST /api/lead/create`** (`create.ts:handler`): public, no JWT.
  - Body (zod `Body`): `parentName`, `childName`, `parentPhone`, `childAge` (4-18), `childPosition?`, `source?` (`web|app`, default `web`), `consent: true`.
  - Responses: 200 `{ok, success, leadId, trainerId, callLink, whatsapp}`; 400, 405 `method_not_allowed`, 429, 503 or 500. The 500 body is `lead_insert_failed`.
- **`GET /api/lead/list?limit=1..100`** (`list.ts:handler`): bearer JWT. `limit` defaults to 50. The caller must have role `trainer`, `owner` or `super_admin`. A trainer also needs an active `trainers` row.
  - Errors: 400 `invalid_query`; 401 `missing_bearer_token` or `not_authenticated`; 403 `trainer_role_required` or `trainer_profile_required`; 405 `method_not_allowed`; 500 `query_failed`; 503 `supabase_unavailable`.
  - Returns `{ok, items:[lead + latestCall], count}`. `latestCall` is the newest embedded call with `status === 'completed'`, or `null`.
- **`POST /api/lead/reply-draft`** (`reply-draft.ts:handler`): bearer JWT. Body `{leadId: uuid}`. Returns `{ok, reply}` from `generateText` (maxTokens 300, temperature 0.7).
  - Returns 503 `ai_not_configured` before the auth check runs.
  - Errors: 400 `invalid_body`; 401 `missing_bearer`, `invalid_jwt` or `no_profile`; 403 `forbidden`; 404 `lead_not_found`; 405 `method_not_allowed`; 429 `rate_limited` with a `Retry-After` header; 502 `ai_generation_failed` when the LLM call fails; 503 `supabase_unavailable`.
- **`POST /api/lead/status`** (`status.ts:handler`): body `{id? | ids?[1..100], status?: routed|contacted|closed, snoozedUntil?, note?}`.
  - The schema requires `id` or `ids`, and at least one of `status` or `snoozedUntil` ("Provide status or snoozedUntil"). `snoozedUntil` is an ISO datetime or null. `note` is trimmed and capped at 2000 chars.
  - Returns `{ok, updated, denied, status, snoozedUntil, leadId?}`. `leadId` is set only when the request used `id`, not a one-element `ids`.
  - Other errors: 400 `invalid_body` and `note_single_only`; 401 `missing_bearer`, `invalid_jwt` or `no_profile`; 405 `method_not_allowed`; 500 `fetch_failed` or `update_failed`; 503 `supabase_unavailable`.
  - Single-lead path (one target id): returns 404 `lead_not_found` or 403 `forbidden` instead of that body. In bulk, ids that do not exist appear in neither `updated` nor `denied`.
- **Helpers:**
  - `normalizePhone`: libphonenumber-js with `RO` as the default region, then E.164.
  - `trainerForAge`: calls RPC `trainer_slug_for_age`.
  - `trainerForAgeFallback`: ages 5-9 go to `t-sopi`, 10-13 to `t-kelemen`, and all others to `t-dan`. [create.ts]

## Invariants
- **`create` validation:**
  - Requires `consent === true` and a child age from 4 to 18.
  - Names must match `PERSON_NAME` and must not look like a domain (`DOMAIN_LIKE`). [create.ts:Body]
- **`create` rate limits:**
  - 5 per hour per IP, in memory (`lead:${ip}`).
  - 5 per hour per `parent_phone_e164`, checked by counting `leads` rows. The check fails open: if the count query errors, the request proceeds. [create.ts:handler]
- **`create` lead state:**
  - Fails closed with 503 `lead_link_signing_unavailable` when link signing is not configured. [create.ts:handler]
  - Leads are inserted with `status 'new'`. Status becomes `'wa_sent'` only after WhatsApp delivery succeeds.
  - `cc_trainer_ids` is `['t-dan']` unless the assigned trainer is `t-dan`. [create.ts:handler]
- **Trainer scope:** a trainer can see and change leads where `child_age` is within their active `[age_min, age_max]`. `owner` and `super_admin` are unrestricted. Scope is not based on `assigned_trainer_id`. [list.ts; status.ts; reply-draft.ts]
- **`status` behavior:**
  - The status can only be set to `routed`, `contacted` or `closed`.
  - `note` is allowed for a single lead only (400 `note_single_only`).
  - The note is appended to the latest `lead_calls` row's `summary` (by `created_at`, any status). When the lead has no `lead_calls` row the note is silently dropped. The summary is capped at 16384 chars (`MAX_SUMMARY`); over the cap the code keeps the newest text and prefixes `[…]`. [status.ts:Body, handler]
- **`reply-draft` rate limit:** 20 per hour per user. [reply-draft.ts:handler]
- **`reply-draft` and `status` bearer parsing:** they do not use `getJwtFromHeader`. They test the header with their own `/^bearer\s+/i` regex and strip it, then resolve the user with `getUserIdFromJwt`. [reply-draft.ts:handler; status.ts:handler]

## Side Effects
- **`create`:**
  - Calls RPC `fotbal.trainer_slug_for_age`, then inserts into `fotbal.leads`. On a successful send it updates the lead to `status='wa_sent'`.
  - Sends WhatsApp through the Evolution API first (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_API_INSTANCE`), falling back to the Meta Cloud API through `sendWhatsappText`. [create.ts:tryEvolution, handler]
  - Signs the call link `/apel/<token>` with `LEAD_LINK_SIGNING_SECRET`.
- **`list`:** reads `profiles` with the RLS user client, and `trainers` and `leads` with embedded `lead_calls` with the service client. [list.ts]
- **`reply-draft`:** reads `profiles`, `trainers`, `leads` and `lead_calls`, all with the service client. Calls the OpenAI-compatible API (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`). [reply-draft.ts]
- **`status`:** reads `profiles`, `trainers` and `leads` with the service client. Updates `fotbal.leads` (`status`, `snoozed_until`, `updated_at`). When a note is given it also updates `fotbal.lead_calls.summary`. [status.ts]
- Shared helpers are documented in [api/_lib](../_lib/EGM.md).

## Verification
- Run: `pnpm test tests/api`
- Typecheck: `pnpm check:api`
