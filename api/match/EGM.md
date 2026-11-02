# api/match

## Overview
Read endpoints for a single match event: its photo gallery (signed URLs from private storage) and its squad list.

## Interface
- **`GET /api/match/photos?eventId=<uuid>`** (`photos.ts:handler`): bearer JWT.
  - Returns 200 `{photos:[{id, url, mime, createdAt, mine}], canUpload, windowEndsAt}`.
  - Errors: 400 `invalid_event_id`; 401; 403; 404 `event_not_found`; 405 `method_not_allowed`; 503 `supabase_unavailable`.
- **`GET /api/match/squad?eventId=<uuid>`** (`squad.ts:handler`): bearer JWT.
  - Returns 200 `{squad:[{id, childId, role, goals, assists, name, yearOfBirth, groupId, groupLabel}]}`, sorted by name using the `ro` locale.
  - Errors: 400 `invalid_event_id`; 401 `missing_bearer` or `invalid_jwt`; 403 `forbidden`; 404 `event_not_found`; 405 `method_not_allowed`; 500 with the DB message when the `match_participations` query fails; 503 `supabase_unavailable`.
- In both handlers, a request with no method passes the method check.

## Invariants
- **`eventId` format:** must match `UUID_RE`. [photos.ts; squad.ts]
- **Who can see photos:** `owner`/`super_admin`, the event's trainer, or a parent with a child under the same `trainer_id`. The parent check runs only when the event has a `trainer_id`. [photos.ts:isAdmin, isTrainer, isParent]
- **Who can see the squad:** `owner`/`super_admin`, the event's trainer, or a parent of a child in the squad. [squad.ts:isAdmin, isAssigned, isSquadParent]
- **Photo URLs:**
  - Photos are returned only as signed URLs from bucket `fotbal-media-private`, valid for 4 h (`SIGN_TTL`).
  - Rows that fail to sign are dropped. [photos.ts:BUCKET, SIGN_TTL]
- **Upload window:** `canUpload` requires `approval_status === 'approved'`, `finalized_at` set, and the current time within 24 h after `finalized_at` (`WINDOW_MS`). [photos.ts:canUpload]

## Side Effects
- **Database reads** (service role):
  - `fotbal.profiles`
  - `schedule_events`
  - `children`
  - `media`
  - `match_participations`
- **Storage:** creates signed storage URLs.
- **No writes.**

## Verification
- Run: `pnpm test tests/api`
- Typecheck: `pnpm check:api`
