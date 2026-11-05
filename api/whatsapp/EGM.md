# api/whatsapp

## Overview
Sends a parent a one-time WhatsApp welcome containing a ConvAI share link, after their child has been accepted into a group.

## Interface
- **`POST /api/whatsapp/send-welcome`** (`send-welcome.ts:handler`): bearer JWT. Body (zod `Body`): `{childId: uuid}`.
  - Reads `children` with joined `parent` (`profiles`) and `trainer` (`trainers`) through the RLS `userClient`.
  - Validates the JWT with `getUserIdFromJwt` before the lookup. A missing bearer returns 401 `Missing bearer token` (checked first); an invalid or expired JWT returns 401 `Not authenticated`.
  - Returns 200 `{success, conversationId, link, whatsapp}`.
  - Errors: 400; 401; 404 (child not visible); 405 for a method other than POST; 409 `Child not accepted into a group yet`; 409 `Welcome already sent for this child`; 429; 500 when the claim update or the `ai_conversations` insert fails; 503 `supabase_unavailable` when `userClient(jwt)` or `serviceClient()` throws.
  - Body strings: 405 `Method not allowed` and 429 `{error:"rate_limited"}`.
  - `userClient(jwt)` is built inside a try/catch right after the bearer check and before `getUserIdFromJwt`, and `serviceClient()` inside one just before the claim. When one throws (a missing `SUPABASE_URL`, anon key or service-role env var) the response is 503 `{error:"supabase_unavailable", message:<the error message>}`. Because `userClient` runs first, a missing URL or anon key is a 503, not the 401 `Not authenticated` that `getUserIdFromJwt` would give for the same missing config; a token Auth rejects is still 401. [send-welcome.ts:handler]
  - A delivery failure is not an error response: with no parent phone, WhatsApp not configured or a failed Meta call the response is still 200 with `success:false` and `whatsapp:{sent:false, reason}`, and the claim is released. [send-welcome.ts:handler]

## Invariants
- **Accepted children only:** the welcome is sent only when `children.assignment_status === 'accepted'`. [send-welcome.ts:handler]
- **Rate limit:** 3 per 24 h per parent (`welcome:${parentId}`). [send-welcome.ts:handler]
- **One send per child:**
  - The send is claimed atomically with `UPDATE children SET welcome_claimed_at=now WHERE id=? AND welcome_claimed_at IS NULL`.
  - The claim is released when the `ai_conversations` insert fails or WhatsApp does not send, including when the parent has no phone. [send-welcome.ts:handler, releaseClaim]
  - The claim is released at only those two points. The calls between the claim and them are not in a try/catch in the handler: the `ai_conversations` lookup, `createConvAILink`, the `notifications` insert and `sendWhatsappText`. `createConvAILink` and `sendWhatsappText` catch their own network errors, and Supabase query errors are returned, not thrown, so no throwing path was found. If one did throw, the claim would stay set and later calls would return 409 `Welcome already sent for this child`. [send-welcome.ts:handler; _lib/elevenlabs.ts:createConvAILink; _lib/whatsapp.ts:sendWhatsappText]
- **Retries reuse the link:**
  - A retry reuses the latest `ai_conversations` row for the child instead of creating a new link. The row is picked by `child_id` only, regardless of who created it, so a row minted by `/api/ai/start-conversation` for the same child is also reused.
  - The in-app notification is inserted only when a new conversation is created. [send-welcome.ts:handler]

## Side Effects
- **Database (`fotbal`):**
  - Updates `children.welcome_claimed_at`.
  - Reads and inserts `ai_conversations`.
  - Inserts `notifications` (kind `ai_link_ready`; the insert error is not checked).
- **External calls:**
  - Supabase `GET /auth/v1/user` through `getUserIdFromJwt`.
  - ElevenLabs through `createConvAILink` (`ELEVENLABS_API_KEY`, `ELEVENLABS_DEFAULT_AGENT_ID`).
  - WhatsApp Cloud API through `sendWhatsappText` (`WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION`).
- Shared helpers are documented in [api/_lib](../_lib/EGM.md).

## Verification
- Run: `pnpm test tests/api` (`service-client-503.test.ts` and `send-welcome-missing-env.test.ts` cover the 503s)
- Typecheck: `pnpm check:api`
