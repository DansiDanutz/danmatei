# api/attendance

## Overview
Lets a parent (or an admin) RSVP a child for a training event.

## Interface
- **`POST /api/attendance/confirm`** (`confirm.ts:handler`): bearer JWT. Body (zod `Body`): `{childId: uuid, eventId: uuid, coming: boolean}`. A string body is JSON-parsed (`readBody`).
  - Returns 200 `{ok, childId, eventId, status}`.
  - Errors:
    - 400 `invalid_body` or `event_not_training`
    - 401 `missing_bearer` or `invalid_jwt`
    - 403 `forbidden`, `child_no_trainer` or `wrong_trainer_event`
    - 404 `child_not_found` or `event_not_found`
    - 405 `method_not_allowed` for a method other than POST
    - 500 `save_failed`
    - 503 `supabase_unavailable` when `serviceClient()` throws

## Invariants
- **Who can RSVP:** the child's parent (`children.parent_id`) or an `owner`/`super_admin`. [confirm.ts:isAdmin]
- **Which events:** only `schedule_events.kind === 'training'`. When the event has a `trainer_id`, the child's `trainer_id` must match it. [confirm.ts:handler]
- **One row per child and event:** the write is an upsert with `onConflict: 'event_id, child_id'`, so there is at most one `attendance` row per pair. `coming=true` stores `'present'`; `coming=false` stores `'absent'`. [confirm.ts:handler]

## Side Effects
- **Reads:** `fotbal.children`, `profiles` and `schedule_events`.
- **Write:** upsert into `fotbal.attendance`, using the service role.

## Verification
- Run: `pnpm test tests/api`
- Typecheck: `pnpm check:api`
