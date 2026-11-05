# api/ai

## Overview
Parent-facing ElevenLabs ConvAI conversations. `start-conversation` creates a shareable agent link for a parent and child. `webhook` receives the ElevenLabs completion callback, stores the transcript and notifies the trainer.

## Interface
- **`POST /api/ai/start-conversation`** (`start-conversation.ts:handler`): bearer JWT. The caller must have a `profiles` row, read through the RLS `userClient`.
  - Body (zod `Body`): `{childId?: uuid}`.
  - Calls `createConvAILink(agentId, shareToken)`, where `shareToken` is 12 random bytes in base64url.
  - Returns 200 `{conversationId, link, token, source}`; 400, 401, 404, 405 (not POST), 429 or 500.
  - The 429 check runs before the `profiles` lookup. A missing `profiles` row returns 401 `Not authenticated`, the same body as an invalid JWT.
  - `serviceClient()` is not wrapped in try/catch here, so there is no 503; a throw from it or from `createConvAILink` is not caught.
- **`POST /api/ai/webhook`** (`webhook.ts:handler`): `export const config = { api: { bodyParser: false } }`. The raw body is limited to 256 KiB (`MAX_BODY_BYTES`, 413 when exceeded).
  - Verified with `verifyHmac(rawBody, headers, "ELEVENLABS_WEBHOOK_SECRET", {bindTimestamp:false})`. Signature headers: `x-elevenlabs-signature` or `elevenlabs-signature`. Timestamp headers: `x-elevenlabs-timestamp` or `elevenlabs-timestamp`.
  - Payload (zod `Payload`): `{type?, data:{conversation_id?, agent_id?, status?, conversation_token?}, conversation_id?, agent_id?}`.
  - The timestamp header is required (`verifyHmac` defaults `checkTimestamp` to true) even though it is not part of the signed payload. A missing or non-numeric timestamp returns 401 `missing_timestamp`; one more than 5 minutes from now returns 401 `timestamp_skew`. [webhook.ts:handler; _lib/webhook-hmac.ts:verifyHmac]
  - Responses: 200; 202 `{matched:false}`; 400; 401; 405 (not POST); 413 (body over the limit); 500 when the `ai_conversations` lookup or update fails, or the `notifications` insert fails with an error other than `23505`; 503 `elevenlabs_webhook_secret_unset` or `supabase_unavailable`.
  - 400 bodies: `body_read_failed` (with `detail`), `Invalid payload` (bad JSON or failed zod parse) and `Missing conversation_id` (absent from both the top level and `data`). [webhook.ts:handler]
  - 401 bodies: `Invalid signature` for a bad signature; otherwise the `verifyHmac` reason (`missing_timestamp`, `timestamp_skew` or `secret_unset`). [webhook.ts:handler]

## Invariants
- **`start-conversation`:**
  - Rate limit is 5 per hour per user (`convai:${userId}`).
  - The child is read through the RLS-bound `userClient`, so a child the caller cannot see returns 404.
  - Writes go through the service client. [start-conversation.ts:handler]
- **`webhook` verification:** nothing is parsed and nothing touches the DB until the signature passes. It fails closed with 503 when the secret is unset in production or preview. [webhook.ts:handler, requiresWebhookSecret]
- **`webhook` row matching:** the row is matched by `elevenlabs_conversation_id`, falling back to `share_token = data.conversation_token`. No row is ever created; an unknown conversation returns 202. [webhook.ts:handler]
- **`webhook` idempotency:**
  - A row that is already `completed` with both `ended_at` and `transcript_md` returns 200 `{duplicate:true}` and does nothing else.
  - The trainer is notified only on the first completion. A `23505` on `notifications.dedupe_key` is ignored. [webhook.ts:handler, isUniqueViolation]
- **`webhook` status values:** the stored status is limited to `completed`, `failed` or `in_progress`.
  - The input is `data.status ?? type ?? "completed"`. Any value other than `completed` or `failed` is stored as `in_progress`; when both fields are absent the input is `completed`.
  - `ended_at` is set to now on every non-duplicate update, including `failed` and `in_progress`. [webhook.ts:handler]

## Side Effects
- **`start-conversation`:**
  - Calls the ElevenLabs API through `createConvAILink` (`ELEVENLABS_API_KEY`, `ELEVENLABS_DEFAULT_AGENT_ID`).
  - Reads `fotbal.profiles` and `fotbal.children` (joined with `trainers`).
  - Inserts `fotbal.ai_conversations` with `status:'pending'`.
- **`webhook`:**
  - Calls ElevenLabs `fetchTranscript`.
  - Updates `fotbal.ai_conversations`: `elevenlabs_conversation_id` (always written, so a row matched by `share_token` gets the conversation id), status, `ended_at`, `transcript_md`, `transcript_summary`, `duration_seconds`, `recording_url`.
  - Reads `fotbal.trainers` and inserts `fotbal.notifications` (kind `ai_transcript_ready`, with `dedupe_key`).
- Shared helpers are documented in [api/_lib](../_lib/EGM.md).

## Verification
- Run: `pnpm test tests/api` (`webhook-idempotency.test.ts` exercises `webhook.ts`)
- Typecheck: `pnpm check:api`
