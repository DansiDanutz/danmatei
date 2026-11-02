# api/training

## Overview
Training recap workflow. A trainer or owner first generates a recap from their notes with the LLM. They then publish it, which saves it on the event and notifies the parents.

## Interface
- **`POST /api/training/recap-generate`** (`recap-generate.ts:handler`): body (zod `Body`) `{eventId: uuid, notes: 5..2000}`.
  - Returns 200 `{ok:true, recap}`.
  - Errors: 503 `ai_not_configured`, checked before auth; 400; 401; 403 `forbidden`; 404 `event_not_found`; 405 `method_not_allowed`; 429 `rate_limited` with a `Retry-After` header; 502 `ai_generation_failed`; 503 `supabase_unavailable`.
- **`POST /api/training/recap-publish`** (`recap-publish.ts:handler`): body `{eventId: uuid, recap: 20..4000, renotify?: boolean = false}`.
  - Returns 200 `{ok, eventId, publishedAt, notified, push, isFirstPublish}`.
  - Errors: 400 `invalid_body`; 401 `missing_bearer`, `invalid_jwt` or `no_profile`; 403 `forbidden`; 404; 405 `method_not_allowed`; 429 `renotify_cooldown` with `remainingSeconds` and a `Retry-After` header; 500 `save_failed`; 503.
- Both handlers parse string bodies with `readBody`.

## Invariants
- **Access:** the caller must be `owner`/`super_admin` or the event's assigned trainer (`trainers.profile_id === caller`). [recap-generate.ts:handler; recap-publish.ts:handler]
- **Generate:** `recap-generate` saves nothing. Its rate limit is 20 per hour per user (`recap-generate:${userId}`). [recap-generate.ts]
- **When notifications go out:**
  - Only on the first publish, or when `renotify=true`. [recap-publish.ts:shouldNotify]
  - A renotify less than 1 h after the last publish gets 429. [recap-publish.ts:cooldownMs]
- **Recipients:**
  - Recipients are the distinct `parent_id` values of active children with `trainer_id = event.trainer_id`.
  - No one is notified when the event has no trainer. [recap-publish.ts:recipientSet]
- **Notification failures:** a failed notification insert is only logged and does not fail the publish. Web Push is skipped and `notified` reports 0. [recap-publish.ts:handler]

## Side Effects
- **`recap-generate`:**
  - LLM call through `generateText` (maxTokens 350, temperature 0.6).
  - Updates the in-memory rate limit.
  - Env: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`.
- **`recap-publish`:**
  - Updates `fotbal.schedule_events`: `recap_md`, `recap_published_at`, `recap_published_by`, `updated_at`.
  - Reads `children` and inserts `notifications` (kind `training_recap`, link `/dashboard`).
  - Sends Web Push with tag `training-recap-<eventId>`. Env: the VAPID vars.

## Verification
- Run: `pnpm test tests/api`
- Typecheck: `pnpm check:api`
