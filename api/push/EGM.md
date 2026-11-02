# api/push

## Overview
Manages Web Push subscriptions and exposes the public VAPID key.

## Interface
- **`POST /api/push/subscribe`** (`subscribe.ts:handler`): bearer JWT.
  - Body (zod `Body`): `{endpoint: url ≤2048, keys:{p256dh: 10..512, auth: 10..512}, userAgent?: ≤500}`.
  - Returns 200 `{ok:true}`. Errors: 409 `endpoint_owned_by_another_user`; 400; 401; 405 for a method other than POST; 500 when the existing-endpoint lookup, the update or the insert fails.
  - Error bodies are free text, not snake_case codes. 401 is `{error:"Missing bearer token"}` with no bearer, or `{error:<JWT error message>}` for an invalid JWT; 405 is `{error:"Method not allowed"}` (same on `unsubscribe` and `vapid-key`) [subscribe.ts:handler].
- **`POST /api/push/unsubscribe`** (`unsubscribe.ts:handler`): bearer JWT. Body: `{endpoint: url ≤2048}`.
  - Returns 200 `{ok:true}`. Errors: 400 `Invalid body`; 401 for a missing or invalid bearer (same bodies as `subscribe`); 405 for a method other than POST; 500 on a DB error.
- **`GET /api/push/vapid-key`** (`vapid-key.ts:handler`): no auth. Returns 405 for a method other than GET.
  - Returns `{configured, publicKey}`. `publicKey` is `null` when VAPID is not configured.

## Invariants
- **Endpoint ownership:** an endpoint already owned by another user is never reassigned; the request gets 409. [subscribe.ts:handler]
- **Caller scope:** updates and deletes are filtered by `user_id = caller`. [subscribe.ts; unsubscribe.ts]
- **Public key only:** `vapid-key` exposes only the public key. [vapid-key.ts:handler]
- **No 503 on missing Supabase config:** `subscribe` and `unsubscribe` call `serviceClient()` outside any try/catch, so a missing service-role env var throws an unhandled error (platform 500) instead of returning 503 `supabase_unavailable`. [subscribe.ts:handler; unsubscribe.ts:handler; ../_lib/supabase.ts:serviceClient]

## Side Effects
- **`subscribe`:** updates the existing `fotbal.push_subscriptions` row (`p256dh`, `auth`, `user_agent`, `last_used_at`), or inserts a new row when none exists.
- **`unsubscribe`:** deletes the caller's row from `fotbal.push_subscriptions`.
- **`vapid-key`:** reads `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` through `../_lib/push.ts`.

## Verification
- Run: `pnpm test tests/api`
- Typecheck: `pnpm check:api`
