# api/schedule

## Overview
Actions on schedule events: cancelling or un-cancelling an event, and announcing an event to the affected parents. Both actions fan out in-app notifications and Web Push.

## Interface
- **`POST /api/schedule/cancel`** (`cancel.ts:handler`): bearer JWT. Body (zod `Body`): `{eventId: uuid, reason?: ≤500|null, uncancel?: boolean}`.
  - Un-cancel returns `{ok, cancelled:false, notified:0}`.
  - A fresh cancellation returns `{ok, cancelled:true, notified, push}`. `push` is `null` when the event has no `trainer_id` or no recipients.
  - Re-cancelling an already-cancelled event returns `{ok, cancelled:true, notified:0}`.
  - Errors: 500 `save_failed` when the `schedule_events` update fails.
- **`POST /api/schedule/notify`** (`notify.ts:handler`): bearer JWT. Body: `{eventId: uuid}`.
  - Returns 200 `{ok, notified, push}`. `push` is `null` when there are no recipients.
  - Errors: 400 `event_cancelled` or `no_group`.
- **Common errors for both:** 400 `invalid_body`; 401 `missing_bearer`, `invalid_jwt` or `no_profile`; 403; 404 `event_not_found`; 405 `method_not_allowed`; 503 `supabase_unavailable`.

## Invariants
- **Who can act:** only `owner`, `super_admin`, or the event's assigned trainer (`trainers.profile_id`) may cancel or notify. [cancel.ts; notify.ts: isAdmin, isAssigned]
- **Cancellation:**
  - Cancellation is soft: it sets `cancelled_at`, `cancelled_reason` and `cancelled_by`. Rows are never deleted. [cancel.ts:handler]
  - Un-cancelling, or cancelling an event that is already cancelled, sends no notifications. [cancel.ts:wantUncancel, wasCancelled]
  - When the event has no `trainer_id`, `cancel` skips all fan-out. [cancel.ts:handler]
- **Announcing:** `notify` refuses cancelled events and events without a `trainer_id`. [notify.ts:handler]
- **Recipients:**
  - For `cancel`: parents of active children of the event's trainer.
  - For `notify` on `match` events: parents from `match_participations`. For other kinds: parents of active children of the event's trainer.
  - Recipients are de-duplicated. [cancel.ts; notify.ts: recipients]
- **Notified count:** `notified` is counted only when the `notifications` insert succeeds. Web Push is sent to the recipients even when that insert fails. [cancel.ts; notify.ts]

## Side Effects
- **`cancel`:**
  - Updates `fotbal.schedule_events` (`cancelled_at`, `cancelled_reason`, `cancelled_by`, `updated_at`).
  - Inserts `notifications` (kind `event_cancelled`).
  - Sends Web Push with tag `cancelled-<eventId>`.
- **`notify`:**
  - Inserts `notifications` (kind `event_announced`).
  - Sends Web Push with tag `event-<eventId>`.
  - Always updates `schedule_events.group_notified_at=now`, even when there are no recipients; the result of that update is not checked.

## Verification
- Run: `pnpm test tests/api`
- Typecheck: `pnpm check:api`
