# api/push

## Overview
Manages Web Push subscriptions and exposes the public VAPID key.

## Interface
- **`POST /api/push/subscribe`** (`subscribe.ts:handler`): bearer JWT.
  - Body (zod `Body`): `{endpoint: url ≤2048, keys:{p256dh: 10..512, auth: 10..512}, userAgent?: ≤500}`.
  - Returns 200 `{ok:true}`. Errors: 409 `endpoint_owned_by_another_user`; 400; 401; 405 for a method other than POST; 500 when the existing-endpoint lookup, the update or the insert fails.
- **`POST /api/push/unsubscribe`** (`unsubscribe.ts:handler`): bearer JWT. Body: `{endpoint: url ≤2048}`.
  - Returns 200 `{ok:true}`. Errors: 400 `Invalid body`; 401 for a missing or invalid bearer; 405 for a method other than POST; 500 on a DB error.
- **`GET /api/push/vapid-key`** (`vapid-key.ts:handler`): no auth. Returns 405 for a method other than GET.
  - Returns `{configured, publicKey}`. `publicKey` is `null` when VAPID is not configured.

## Invariants
- **Endpoint ownership:** an endpoint already owned by another user is never reassigned; the request gets 409. [subscribe.ts:handler]
- **Caller scope:** updates and deletes are filtered by `user_id = caller`. [subscribe.ts; unsubscribe.ts]
- **Public key only:** `vapid-key` exposes only the public key. [vapid-key.ts:handler]

## Side Effects
- **`subscribe`:** updates the existing `fotbal.push_subscriptions` row (`p256dh`, `auth`, `user_agent`, `last_used_at`), or inserts a new row when none exists.
- **`unsubscribe`:** deletes the caller's row from `fotbal.push_subscriptions`.
- **`vapid-key`:** reads `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` through `../_lib/push.ts`.

## Verification
- Run: `pnpm test tests/api`
- Typecheck: `pnpm check:api`
