# api/chat

## Overview
The mobile chat routes that take a thread id in the path: read and post messages, and mark a thread as read. The list route, `GET /api/chat/threads`, lives in the child directory [`threads/`](./threads/EGM.md).

The two files here are plain files (`thread-messages.ts`, `thread-read.ts`). The thread id arrives as `req.query.id` because `vercel.json` rewrites `/api/chat/threads/:id/messages` and `/api/chat/threads/:id/read` to them with `?id=:id`. A bracket-named `[id]` file did not resolve on Vercel: the generic rewrites took the request first, and the SPA's `index.html` came back for `GET` and 405 for `POST`.

All routes use `mobileRoute` from [api/_lib](../_lib/EGM.md), query only through the RLS-scoped `userClient`, and never use the service client.

## Interface
All three routes need a bearer JWT. The thread id is read by `readThreadId`, which accepts a single UUID string and returns null otherwise.

- **`GET /api/chat/threads/:id/messages`** (`thread-messages.ts`, `["GET", "POST"]`): returns 200 with an array of `{id, threadId, authorId, content, createdAt}` (`mapMessage`), oldest first.
  - Errors: 400 `invalid_thread_id`; 404 `not_found` when RLS hides the thread or it does not exist; plus the common errors below.
- **`POST /api/chat/threads/:id/messages`** (`thread-messages.ts`): body `{content}`. `content` is trimmed and must be 1 to 4000 characters (zod `Content` in `_lib/mobile-api.ts`).
  - Returns 201 with the new message in the same shape.
  - Errors: 400 `invalid_thread_id` or `invalid_body`; 404 `not_found` on Postgres `42501`; 429 `rate_limited` with a `Retry-After` header in seconds (`ceil(resetIn / 1000)`); plus the common errors below.
- **`POST /api/chat/threads/:id/read`** (`thread-read.ts`, `["POST"]`): no body is read. Returns 204 with no body.
  - Errors: 400 `invalid_thread_id`; 404 `not_found` on Postgres `42501`; plus the common errors below.
- **Common errors:** 401 `missing_bearer` or `invalid_jwt`; 405 `method_not_allowed`; 500 `server_error`. Every error body is `{error, message}`.
- **CORS:** `OPTIONS` answers 204 without authentication, and responses (errors included) carry `Access-Control-Allow-Origin` for the allowed Expo Web origins. See `mobileRoute` in [api/_lib](../_lib/EGM.md).
- **Routing:** the public URLs are `/api/chat/threads/:id/messages` and `/api/chat/threads/:id/read`. They reach these files through the first two entries in `vercel.json` `rewrites`. [vercel.json; tests/api/chat-rewrites.test.ts]
- Child directory: [`threads/`](./threads/EGM.md) - `GET /api/chat/threads`.

## Invariants
- **The two chat rewrites stay before the generic `/api/(.*)` rewrite.** The first matching rewrite wins, so a later position sends the request to the SPA. `tests/api/chat-rewrites.test.ts` checks the order, the destination files and that the mobile client calls the same URLs. [vercel.json]
- **Newest 100 messages.** `GET` orders by `created_at` descending then `id` descending, takes 100, and reverses them to oldest first. There is no pagination, so older messages are not reachable. The comment in `thread-messages.ts` says the web chat loads the oldest 100 and this route deliberately does not. [thread-messages.ts:handler]
- **`GET` checks the thread first.** It selects the thread through RLS and returns 404 when no row comes back, so a hidden thread and a missing one look the same. [thread-messages.ts:handler]
- **The sender is always the caller.** `POST` inserts `sender_id = user.id`. `parseMessageBody` reads only `content`, so a `senderId` in the body is ignored. [thread-messages.ts:handler; _lib/mobile-api.ts:parseMessageBody]
- **Posting is decided by RLS.** The `chat_messages send if member` policy accepts the row only when the caller can see the thread. A hidden thread and a nonexistent one both fail with `42501` before the foreign key is checked, and both return 404. Any other insert error is a 500. The `parents` thread is open to every signed-in user. [thread-messages.ts:handler]
- **Rate limit: 30 posts per 60 s per user**, with key `chat-send:<userId>`. It is checked after the body is validated and before the insert. It is best-effort because `checkRateLimit` keeps counters in one function instance's memory. [thread-messages.ts:handler; _lib/ratelimit.ts]
- **The route does not bump `last_message_at`.** The trigger `chat_msg_bump_thread` does it on insert. [supabase/migrations/EGM.md]
- **`read` uses the database clock.** It calls `chat_mark_read(p_thread)`, which upserts `chat_reads.last_read_at = now()` in the database. An unseen or missing thread fails RLS with `42501` and returns 404. [thread-read.ts:handler; supabase/migrations/0042_chat_reads.sql]
- **`read` ignores the request body**, although the mobile client sends a JSON content type. [thread-read.ts]

## Side Effects
- `GET` reads `fotbal.chat_threads` and `fotbal.chat_messages`.
- `POST .../messages` inserts one `fotbal.chat_messages` row on every call (no idempotency). The database trigger then updates `chat_threads.last_message_at`. No Web Push is sent from this route.
- `POST .../read` calls the RPC `fotbal.chat_mark_read` and writes the caller's `fotbal.chat_reads` row.
- `POST .../messages` mutates the in-memory rate-limit map.
- Logs `[chat/threads/[id]/messages]` or `[chat/threads/[id]/read]` plus the error message on a 500.

## Verification
- Run: `pnpm test tests/api` (covers `mobile-chat.test.ts` and `chat-rewrites.test.ts`)
- Typecheck: `pnpm check:api`
- On the deployed site, without a token: `GET /api/chat/threads/<uuid>/messages` answers JSON `401 missing_bearer`. The SPA's HTML means the rewrite did not apply.
