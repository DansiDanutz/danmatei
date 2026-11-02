# api/_lib

## Overview
Shared server-only helpers for the Vercel route handlers under `api/`. These files are imported by the handlers and are not routes themselves. They cover:

- Supabase clients bound to the `fotbal` schema
- shared request handling for the mobile profile and chat routes
- auth helpers for cron jobs and JWTs
- webhook and signed-link HMAC verification
- an in-memory rate limiter
- outbound integrations: OpenAI-compatible LLM, ElevenLabs ConvAI, WhatsApp Cloud API and Web Push
- pure domain logic: payment status and coaching tips

## Interface
- `supabase.ts` -- `FOTBAL_SCHEMA = "fotbal"`
  - `serviceClient()`: service-role key, bypasses RLS
  - `userClient(jwt)`: anon key plus the caller's bearer token, so RLS applies
  - `getAuthUser(jwt)`: calls `GET /auth/v1/user` and returns `{id, email}`, where `email` is `null` when Auth returns none or an empty one. Throws `Not authenticated` on a non-OK response or a missing id.
  - `getUserIdFromJwt(jwt)`: delegates to `getAuthUser` and returns only the id, so it throws the same way
  - `getJwtFromHeader(auth)`: extracts the token with `/^Bearer\s+(.+)$/i`
- `mobile-api.ts` -- shared plumbing for `profile.ts` and the `chat/` routes. It never imports `serviceClient`; every route queries through `userClient(jwt)`.
  - `mobileRoute(route, methods, fn)` returns the handler: `applyCors` (which answers an `OPTIONS` preflight), then the method check, then `authenticate`, then `fn({req, res, jwt, user})`. Anything `fn` throws becomes a logged 500.
  - `applyCors(req, res, methods)` sets `Vary: Origin` on every response. When the `Origin` header is exactly one of `allowedWebOrigins()` it also sets `Access-Control-Allow-Origin` to that origin, and `Access-Control-Expose-Headers: Retry-After` on non-preflight requests. For `OPTIONS` it sets `Access-Control-Allow-Methods` (the route's methods plus `OPTIONS`), `Access-Control-Allow-Headers: Authorization, Content-Type` and `Access-Control-Max-Age: 600`, sends 204 with no body and returns `true`. The preflight is answered before the method check and authentication, for any origin; an unlisted origin just gets no allow headers. There is no credentials mode: auth is a bearer header.
  - `allowedWebOrigins()` returns `http://localhost:8081`, `http://localhost:19006` and the comma-separated `MOBILE_WEB_ORIGINS` env var (trimmed, trailing slashes removed). It reads the env on each call.
  - `authenticate(req, res)` reads the bearer with `getJwtFromHeader`, resolves the caller with `getAuthUser`, and returns `{jwt, user: {id, email}}`, or sends the 401 and returns `null`.
  - `sendError(res, status, code, message?)` sends `{error, message}`. Codes (`ErrorCode`): `method_not_allowed` (405), `missing_bearer` (401), `invalid_jwt` (401), `invalid_thread_id` (400), `invalid_body` (400), `forbidden_fields` (400), `not_found` (404), `rate_limited` (429), `server_error` (500). The `message` is a Romanian default per code.
  - `serverError(res, route, err)` logs `[route]` and the error message and sends 500 `server_error` without echoing database text. `pgCode(err)` returns the Postgres SQLSTATE of an error, if any.
  - `readThreadId(req)` returns `req.query.id` if it is a single UUID string, else `null`.
  - `parseProfileUpdate(body)` accepts only `fullName` (trimmed, 2..120); `parseMessageBody(body)` returns `content` (trimmed, 1..4000) and ignores other keys.
  - `mapProfile`, `mapThread`, `mapMessage` turn database rows into the mobile shapes. Types: `Req`, `Res`, `MobileUser`, `MobileContext`.
- `cron-auth.ts` -- `requireCron(req, res, label)`: checks `Authorization: Bearer ${CRON_SECRET}`. When it returns `false` it has already sent a 401 or 503 response.
- `webhook-hmac.ts` -- `verifyHmac(rawBody, headers, envName, opts)` returning `VerifyResult`. Also exports `MAX_TIMESTAMP_SKEW_MS` (5 min) and `WebhookVendor = "pipecat" | "elevenlabs"`.
  - Default headers: `x-pipecat-signature` / `x-elevenlabs-signature` and `x-pipecat-timestamp` / `x-elevenlabs-timestamp`
  - Options: `bindTimestamp` and `checkTimestamp`, both default `true`; `now` (overrides `Date.now()`); `signatureHeaders` and `timestampHeaders` (override the default header names)
- `elevenlabs-signature.ts` -- `verifyElevenLabsSignature(rawBody, header, opts)`, `parseSignatureHeader(header)` and `ELEVENLABS_MAX_SKEW_MS` (30 min). The header format is `t=<unix>,v0=<hex>`, where the hex value is the HMAC-SHA256 of `${t}.${body}`.
  - `opts.secret` overrides `ELEVENLABS_WEBHOOK_SECRET`; `opts.now` overrides `Date.now()`.
  - Returns `missing_signature` when the header does not parse, before any timestamp check.
- `elevenlabs.ts`:
  - `createConvAILink(agentIdOrNull, shareToken)` returning `AgentLinkResult` with `source: "elevenlabs" | "stub"`
  - `fetchTranscript(conversationId)` returning `TranscriptResult | null`
  - `transcriptToMarkdown`, `transcriptSummary`
- `lead-call-result.ts` -- `recordLeadCall(supabase, LeadCallResult)` returning `RecordLeadCallOutcome {status, body}`. Also exports `LEAD_CALL_INTENTS = ["register","info","visit","price","schedule","other"]`.
- `openai.ts` -- `generateText({system, user, maxTokens?, temperature?})`, `isConfigured()` and `OpenAINotConfiguredError`. `maxTokens` defaults to 600 and `temperature` to 0.6; with a Gemini base URL the request also sends `reasoning_effort: "none"`.
- `push.ts` -- `sendPushToUsers(userIds, PushPayload)` returning `{sent, skipped, removed}` and never throwing. Also `isConfigured()` and `getVapidPublicKey()`.
- `whatsapp.ts` -- `sendWhatsappText(to, body)` returning `SendTextResult {sent, reason?, messageId?}` and never throwing. `WHATSAPP_API_VERSION` defaults to `v21.0`.
- `ratelimit.ts` -- `checkRateLimit(key, limit, windowMs)` returning `{ok, resetIn}`.
- `sign-token.ts` -- `signToken(leadId, {expiresAt?, ttlMs?})`, `verifyToken(token)` returning `{leadId} | null`, and `isLeadLinkSigningConfigured()`.
- `public-url.ts` -- `configuredPublicBaseUrl()` and `publicBaseUrlFromHeaders(headers)`. The canonical fallback is `https://www.danmatei.ro`.
- `payment-status.ts` -- `computePaymentStatus(charges, payments, now)` returning `StatusResult`. `PaymentStatus` is `green | yellow | orange | red | closed`. The file comment says it is a server copy of `client/src/lib/payment-status.ts`.
- `coaching-tips.ts` -- `AgeBand` (`U5-U8 | U9-U12 | U13-U15 | U16-U19 | owner`), `bandForAge`, `bandLabel`, `tipsForBand`, `pickTip` and the static `COACHING_TIPS` library.
- `like.ts` -- `escapeLike(input)` escapes `\`, `%` and `_` for PostgREST LIKE/ILIKE.

## Invariants
- **Secrets fail closed outside local dev.**
  - `requireCron` responds 503 `cron_secret_unset` when `CRON_SECRET` is unset and `NODE_ENV=production` or `VERCEL_ENV` is `production` or `preview`. Otherwise an unset secret only warns. [cron-auth.ts:requireCron]
  - `verifyHmac` and `verifyElevenLabsSignature` allow unsigned requests only under the same dev-only condition. Otherwise they return `secret_unset`. [webhook-hmac.ts:bypassAllowed; elevenlabs-signature.ts:verifyElevenLabsSignature]
  - `resolveSecret` throws in production when `LEAD_LINK_SIGNING_SECRET` is missing. Outside production it falls back to a dev-only literal. [sign-token.ts:resolveSecret]
  - `isProd` checks only `NODE_ENV` and `VERCEL_ENV=production`; preview does not count. [sign-token.ts:isProd]
- **Signatures and tokens use constant-time checks.** `verifyHmac`, `verifyElevenLabsSignature`, `verifyToken` and `requireCron` all check length first and then use `timingSafeEqual`. [webhook-hmac.ts:verifyHmac; elevenlabs-signature.ts; sign-token.ts:verifyToken; cron-auth.ts:requireCron]
- **Timestamp checks run before the signature check.**
  - `verifyHmac` takes epoch milliseconds and allows 5 min of skew. [webhook-hmac.ts:MAX_TIMESTAMP_SKEW_MS]
  - The ElevenLabs header uses epoch seconds and allows 30 min of skew. [elevenlabs-signature.ts:ELEVENLABS_MAX_SKEW_MS]
- **Signed lead links default to a 24 h TTL.** `verifyToken` returns `null` on a malformed or bad token or after expiry. It catches a `resolveSecret()` throw, so in production with `LEAD_LINK_SIGNING_SECRET` unset it fails closed and returns `null`. [sign-token.ts:DEFAULT_TTL_MS, verifyToken, resolveSecret]
- **Mobile routes fail closed on authentication.** `authenticate` answers 401 `missing_bearer` when there is no bearer token, and 401 `invalid_jwt` when `getAuthUser` throws or returns no email. A route's handler is not called in either case. [mobile-api.ts:authenticate]
- **`parseProfileUpdate` rejects the whole request** with `forbidden_fields` (listing the keys) when the body has any key other than `fullName`, even beside a valid name. A non-object body or an invalid `fullName` gives `invalid_body`. [mobile-api.ts:parseProfileUpdate]
- **Error bodies never carry database text.** `serverError` logs the error and sends only the fixed `server_error` message. [mobile-api.ts:serverError]
- **The rate limiter is per process.** It keeps an in-memory `Map`, is not distributed, and resets on cold start. [ratelimit.ts:buckets]
- **`computePaymentStatus` applies payments FIFO by `due_date`.**
  - Months overdue are counted in calendar months from the first unpaid charge.
  - Status mapping: 0 = green, 1 = yellow, 2 = orange, 3 = red, 4 or more = closed. [payment-status.ts:computePaymentStatus]
- **`recordLeadCall` is idempotent on `(vendor, vendor_call_id)`.** A pre-check or a `23505` unique violation both return 200 `{duplicate:true}`. A missing lead returns 404 `lead_not_found`. A failed pre-check lookup returns 500 `call_lookup_failed`, and a failed insert (other than `23505`) returns 500 `call_insert_failed`. [lead-call-result.ts:recordLeadCall]
- **The OpenAI base URL comes only from env, never from caller input.**
  - Model defaults to `gpt-4o-mini`. A Gemini base URL switches a `gpt-*` model to `gemini-2.5-flash`.
  - `generateText` throws on HTTP errors and on empty content. [openai.ts:BASE_URL, MODEL, generateText]
- **`publicBaseUrlFromHeaders` never trusts Host or `X-Forwarded-Host` in production or preview.** [public-url.ts:isProductionLike]
- **`sendPushToUsers` is a no-op when VAPID is not configured.** It returns everyone as skipped. Subscriptions that fail with 404 or 410 are deleted. Push TTL is 24 h. [push.ts:sendPushToUsers]
- **`sendWhatsappText` never throws.** A missing env returns `reason: "whatsapp_not_configured"`; an empty `to` or `body` returns `reason: "missing_to_or_body"`. [whatsapp.ts:sendWhatsappText]

## Side Effects
- **Supabase (schema `fotbal`):**
  - `push_subscriptions`: select, and delete of dead rows [push.ts:sendPushToUsers]
  - `leads`: read, and update `status='routed'` [lead-call-result.ts:recordLeadCall]
  - `lead_calls`: select and insert [lead-call-result.ts:recordLeadCall]
  - `lead_notifications`: insert of 4 rows per trainer, on channels inapp, push, email and whatsapp, with type `new_lead_transcript` [lead-call-result.ts:recordLeadCall]
- **Outbound HTTP:**
  - Supabase `GET /auth/v1/user` [supabase.ts:getAuthUser]
  - `${OPENAI_BASE_URL}/chat/completions` [openai.ts:generateText]
  - ElevenLabs `GET /v1/convai/conversation/get_signed_url` and `GET /v1/convai/conversations/{id}` [elevenlabs.ts]
  - `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_ID}/messages` [whatsapp.ts:sendWhatsappText]
  - The Web Push endpoints stored on each subscription [push.ts:sendPushToUsers]
- **Env vars read:**
  - Supabase: `SUPABASE_URL`/`VITE_SUPABASE_URL`, `SUPABASE_ANON_KEY`/`VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`
  - Cron and runtime: `CRON_SECRET`, `NODE_ENV`, `VERCEL_ENV`
  - Mobile CORS: `MOBILE_WEB_ORIGINS`, read by `allowedWebOrigins()` [mobile-api.ts:allowedWebOrigins]
  - LLM: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
  - Web Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  - WhatsApp: `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION`
  - ElevenLabs: `ELEVENLABS_API_KEY`, `ELEVENLABS_DEFAULT_AGENT_ID`, `ELEVENLABS_WEBHOOK_SECRET`
  - Signing and URLs: `LEAD_LINK_SIGNING_SECRET`, `PUBLIC_BASE_URL`/`VITE_APP_URL`/`NEXT_PUBLIC_APP_URL`
  - Per-trainer `TRAINER_PHONE_<ID>`, used by `recordLeadCall` for a WhatsApp ping
- **Process state:** `webpush.setVapidDetails` sets global config when the module loads. The rate-limit `Map` is mutated in memory.

## Verification
- Run: `pnpm test tests/api` (covers `cron-auth.test.ts`, `sign-token.test.ts`, `like.test.ts`, `public-url.test.ts`, `voice-webhook-hmac.test.ts` and `elevenlabs-interview.test.ts`)
- Typecheck: `pnpm check:api`
