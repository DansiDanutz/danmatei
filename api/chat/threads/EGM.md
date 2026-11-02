# api/chat/threads

## Overview
Lists the chat threads the signed-in user may see, for the mobile chat list. The per-thread routes (messages and read) live in the parent directory, [api/chat](../EGM.md).

## Interface
- **`GET /api/chat/threads`** (`index.ts`, built with `mobileRoute("chat/threads", ["GET"], ...)`): bearer JWT, no body.
  - Returns 200 with an array of `{id, title, updatedAt, unreadCount}`, built by `mapThread`. [index.ts; _lib/mobile-api.ts:mapThread]
    - `title` is `chat_threads.title` when it is a non-empty string. Otherwise it comes from the thread kind: `parent_trainer` is `Antrenor`, `group` is `Grupa`, `parents` is `Părinți`. An unknown kind gives `""`.
    - `updatedAt` is `last_message_at`, falling back to `created_at`.
    - `unreadCount` comes from `chat_unread_counts()`, or 0 when the thread is not in its result.
  - CORS: `OPTIONS` answers 204 without authentication, and responses carry the allow-origin header for allowed Expo Web origins (`mobileRoute`).
  - Errors: 401 `missing_bearer` or `invalid_jwt`; 405 `method_not_allowed`; 500 `server_error`. Each body is `{error, message}` with a Romanian `message`. See [api/_lib](../../_lib/EGM.md).
- Per-thread routes: [../EGM.md](../EGM.md).

## Invariants
- **RLS decides which threads are returned.** The query selects from `chat_threads` through `userClient(jwt)` with no filter, so the `chat_threads visible` policy chooses the rows. An owner or super_admin sees every thread. [index.ts]
- **Capped at 100, no pagination.** The query uses `.limit(100)`, so a caller with more threads loses the oldest ones silently. [index.ts]
- **Order:** `last_message_at` descending with nulls last, then `created_at` descending, then `id` descending. Threads without messages therefore sort last; the order is not by `coalesce(last_message_at, created_at)`. [index.ts]
- **A failed unread count fails the request.** If the `chat_unread_counts` call errors, the route returns 500 and does not send threads with made-up counts. [index.ts]
- **Unread counts are filtered to the returned threads.** `chat_unread_counts()` returns a row for every visible thread in no particular order, and PostgREST caps a response at `max_rows` (1000), so the route filters the result with `.in("thread_id", ids)` for the (at most 100) threads it returns. With no threads it does not call the function. [index.ts]
- **A thread created between the two queries counts as 0 unread**, because the count map has no entry for it. [index.ts]
- **Titles are not personalised.** The route does not look up trainer or child names, so two `parent_trainer` threads without a stored title show the same `Antrenor` title. [_lib/mobile-api.ts:mapThread]

## Side Effects
- Read-only. Reads `fotbal.chat_threads` and calls the RPC `fotbal.chat_unread_counts()` (migration `0042`) through `userClient`. [index.ts; supabase/migrations/0042_chat_reads.sql]
- No writes, no push, no outbound HTTP besides the Supabase Auth call in `authenticate`.
- Logs `[chat/threads]` plus the error message on a 500.

## Verification
- Run: `pnpm test tests/api` (covers `mobile-chat.test.ts`)
- Typecheck: `pnpm check:api`
