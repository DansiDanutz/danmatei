# api/messages

## Overview
Lets a trainer, owner or super_admin post a message to a trainer's whole group or to one child's parent. Parents get a Web Push.

## Interface
- **`POST /api/messages/send`** (`send.ts:handler`): bearer JWT.
  - Body (zod `Body`): `{trainerId: uuid, audience: 'group'|'child', childId?: uuid|null, body: 1..4000}`.
  - Returns 200 `{ok, messageId, recipients, push}`.
  - Errors: 400 `invalid_body` or `child_id_required`; 401 `missing_bearer`, `invalid_jwt` or `no_profile`; 403 `forbidden` or `child_not_in_your_group`; 404 `trainer_not_found` or `child_not_found`; 405 `method_not_allowed`; 500 `save_failed`; 503 `supabase_unavailable`.

## Invariants
- **Who can post:** only `owner`, `super_admin`, or the trainer whose `trainers.profile_id` is the caller can post for `trainerId`. [send.ts:handler]
- **Audience rules:**
  - `audience='child'` requires `childId`, and that child's `trainer_id` must equal `trainerId`.
  - Only `group` and `child` are accepted as audiences. [send.ts:Body, handler]
- **No idempotency:** every call inserts a new `messages` row. [send.ts:handler]

## Side Effects
- **Insert:** `fotbal.messages` (`trainer_id`, `audience`, `child_id`, `body_md`). A code comment says the `tg_notify_message` DB trigger creates the in-app notifications. [send.ts:handler]
- **Reads:** `fotbal.profiles`, `trainers` and `children` through the service client.
- **Web Push:** `sendPushToUsers` with title `Mesaj nou de la <name>`, tag `message-<id>` and url `/notificari`. It needs the VAPID env vars. [send.ts:handler]
  - `<name>` is the sending trainer's `profiles.full_name` (the `trainerId` row's profile, fallback `Antrenor`), also when an owner or super_admin posts on the trainer's behalf.
  - Recipients: for `audience='group'`, the parents of active children with `children.trainer_id = trainerId`; for `audience='child'`, that child's parent.
  - A body longer than 140 chars is cut to its first 137 chars (trimmed) plus `…`.
- Shared helpers are documented in [api/_lib](../_lib/EGM.md).

## Verification
- Run: `pnpm test tests/api`
- Typecheck: `pnpm check:api`
