# api

## Overview
Vercel serverless functions (Node runtime `@vercel/node@5.1.10`, per `vercel.json` `functions["api/**/*.ts"]`).

- **Routing.** Routes follow the file path: `api/<path>.ts` is served at `/api/<path>`. Each file default-exports a handler that checks the HTTP method itself.
- **What lives here.** Everything that needs the Supabase service-role key (RLS bypass), fan-out notifications, or third-party integrations (ElevenLabs, WhatsApp, OpenAI-compatible LLM, Web Push).
- **Database.** All Supabase access targets the `fotbal` schema.
- **Shared helpers.** These live in `_lib/`. Cron jobs live in `cron/` and are scheduled in `vercel.json`.

## Interface
Direct route files in this directory:

- **`GET /api/groups`** (`groups.ts:handler`): public, no auth. A request with no method passes the method check.
  - Returns `{groups:[{id, label, birthYearMin, birthYearMax, trainerName, childCount, players:[{name, yearOfBirth}]}]}`. `players` holds at most `SAMPLE_SIZE = 4` entries.
  - On error returns 500 `groups_unavailable`.
  - Exports the pure helper `maskName(full)`, which turns `"First Last"` into `"First L."`.
- **`POST /api/notify`** (`notify.ts:handler`): bearer JWT; the role must be `owner` or `super_admin`.
  - Body (zod `Body`): `{target: 'all_parents'|'group'|'trainer', trainerId?, trainerProfileId?, title: 2..200, body: 2..2000, link?: ≤500}`.
  - Returns `{sent, recipients, push}`. When no recipients resolve, returns `{sent: 0, recipients: []}` with no `push` field, and inserts and pushes nothing.
- **`GET /api/profile`** and **`PUT /api/profile`** (`profile.ts`, built with `mobileRoute` from `_lib/mobile-api.ts`): the signed-in user's profile for the mobile app, bearer JWT.
  - `GET` returns `{id, fullName, email, role, createdAt}`. The email comes from Supabase Auth, not from `fotbal.profiles`.
  - `PUT` accepts only `{fullName}` (trimmed, 2..120 characters) and returns the updated profile in the same shape. Any other key returns 400 `forbidden_fields`; a bad `fullName` or a non-object body returns 400 `invalid_body`.
  - Other errors: 401 `missing_bearer` or `invalid_jwt`; 404 `not_found` when no row matches; 405 `method_not_allowed`; 500 `server_error`. Error bodies are `{error, message}`.
  - CORS: `OPTIONS` answers 204 without authentication, and responses carry the allow-origin header for allowed Expo Web origins (`mobileRoute`, see [_lib](./_lib/EGM.md)).
- **`POST /api/trainers`** (`trainers.ts:handler`, zod `Body`): invites a trainer.
  - Body: `{email, fullName, phone?, whatsappNumber?, elevenlabsAgentId?, position?, bio?, ageMin 4..25, ageMax 4..25, certifications? ≤10}`.
  - Returns `{trainer, inviteEmailSent:true}`.
- **`DELETE /api/trainers`** (`trainers.ts:handler`, `DeleteBody`): body `{profileId: uuid}`.
  - Returns `{deleted:true}`. A foreign-key-style failure returns 409; any other Auth delete failure returns 400 with the raw Auth error message.
  - Returns 404 `Trainer not found` when no `fotbal.trainers` row exists for `profileId` or its profile role is not `trainer`.
- **`trainers` auth:** bearer JWT; the role must be `owner` or `super_admin`.

Subdirectories:
- [`_lib/`](./_lib/EGM.md) - shared helpers:
  - Supabase clients and JWT helpers
  - `requireCron`
  - HMAC and ElevenLabs signature checks, signed lead tokens
  - in-memory rate limiting
  - OpenAI, ElevenLabs, WhatsApp and Web Push clients
  - payment status and coaching tips
- [`academy/`](./academy/EGM.md) - `GET /api/academy/players`: staff roster search.
- [`ai/`](./ai/EGM.md) - `POST /api/ai/start-conversation` and `POST /api/ai/webhook`: parent ConvAI links and the signed transcript webhook.
- [`attendance/`](./attendance/EGM.md) - `POST /api/attendance/confirm`: training RSVP upsert.
- [`chat/`](./chat/EGM.md) - `GET /api/chat/threads` and the per-thread routes `GET` and `POST /api/chat/threads/:id/messages` and `POST /api/chat/threads/:id/read`: the mobile chat.
- [`cron/`](./cron/EGM.md) - 7 `CRON_SECRET`-guarded jobs:
  - `daily`
  - `weekly-digest`
  - `reap-stale-calls`
  - `generate-monthly-charges`
  - `close-overdue-accounts`
  - `schedule-reminder`
  - `coaching-digest`
- [`enrollment/`](./enrollment/EGM.md) - `POST /api/enrollment/created`: enrollment push to trainers and owners.
- [`lead/`](./lead/EGM.md) - `POST /api/lead/create`, `GET /api/lead/list`, `POST /api/lead/reply-draft`, `POST /api/lead/status`: the lead lifecycle.
- [`leads/`](./leads/EGM.md) - `GET /api/leads/analytics`: owner funnel analytics.
- [`match/`](./match/EGM.md) - `GET /api/match/photos` and `GET /api/match/squad`.
- [`messages/`](./messages/EGM.md) - `POST /api/messages/send`: trainer message plus push.
- [`news/`](./news/EGM.md) - `POST /api/news/draft-weekly`: LLM weekly news draft, not persisted.
- [`push/`](./push/EGM.md) - `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `GET /api/push/vapid-key`.
- [`schedule/`](./schedule/EGM.md) - `POST /api/schedule/cancel` and `POST /api/schedule/notify`.
- [`training/`](./training/EGM.md) - `POST /api/training/recap-generate` and `POST /api/training/recap-publish`.
- [`voice/`](./voice/EGM.md) - `POST /api/voice/start` and `POST /api/voice/elevenlabs-webhook`: lead voice interview.
- [`whatsapp/`](./whatsapp/EGM.md) - `POST /api/whatsapp/send-welcome`: one-time welcome with a ConvAI link.

## Invariants
- **Authentication.** Authenticated routes extract the bearer token with `getJwtFromHeader` and resolve the user with `getUserIdFromJwt`. Exception: `lead/reply-draft` and `lead/status` parse the bearer with their own regex. Roles come from `fotbal.profiles.role`: `owner`, `super_admin`, `trainer`, or parent. Trainer scope comes from active `fotbal.trainers` rows. `_lib/supabase.ts` provides only the clients and JWT helpers; each handler queries `profiles` and `trainers` itself. The exceptions are `profile.ts` and the `chat/` routes: they resolve the caller (id and email) with `getAuthUser` through `authenticate` in `_lib/mobile-api.ts`, and query only through `userClient`, so they do not query `profiles` themselves for the role and RLS decides what the caller sees. [_lib/supabase.ts:getAuthUser; _lib/mobile-api.ts:authenticate; notify.ts:handler]
- **Fail closed in production and preview.** Unsigned webhooks and a missing `CRON_SECRET` are allowed only in local dev. [_lib/cron-auth.ts; _lib/webhook-hmac.ts; _lib/elevenlabs-signature.ts]
- **Rate limits are per instance.** `checkRateLimit` keeps its state in memory, so limits are not global. [_lib/ratelimit.ts]
- **Groups never expose surnames.** `groups` returns only active groups and active children, with surnames masked by `maskName`. [groups.ts:handler]
- **Group membership.** A child belongs to a group either by `group_id`, or, when `group_id` is null, by birth year falling within the group's range. [groups.ts:handler]
- **`notify` targets.**
  - `target='group'` requires `trainerId`; `target='trainer'` requires `trainerProfileId`.
  - Push is sent only after the `notifications` insert succeeds. [notify.ts:handler]
- **`trainers` rules.**
  - POST requires `ageMax >= ageMin`.
  - DELETE only removes accounts whose profile role is `trainer`.
  - The invite metadata is always `{app:'fotbal', role:'trainer', full_name, phone}`, with `phone` null when not given. [trainers.ts:handler]
- **`notify` and `trainers` read the caller's role through the RLS-scoped `userClient`.** [notify.ts; trainers.ts]

## Side Effects
- **`groups`.**
  - Read-only, using the service client.
  - Reads `fotbal.groups` (joined to `trainers` and `profiles`) and `fotbal.children`.
  - Sets `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
- **`notify`.**
  - Inserts `fotbal.notifications` rows with `kind = target`.
  - Sends Web Push with tag `notify-<target>`.
  - Needs the VAPID env vars.
- **`trainers` POST.**
  - Sends an invite email through Supabase Auth admin `inviteUserByEmail`, redirecting to `${configuredPublicBaseUrl()}/seteaza-parola`.
  - Upserts `fotbal.profiles`; errors from this upsert are ignored.
  - Inserts `fotbal.trainers`.
- **`trainers` DELETE.** First reads `fotbal.trainers` joined to `profiles!trainers_profile_id_fkey(role)` with the service client to enforce the trainer-only rule. Then calls Supabase Auth admin `deleteUser(profileId)`. A comment in the handler says this cascades to `profiles` and `trainers`.
- **Subtree-wide.**
  - Writes to many `fotbal` tables: `leads`, `lead_calls`, `lead_notifications`, `notifications`, `ai_conversations`, `attendance`, `children`, `child_charges`, `coaching_tips`, `messages`, `push_subscriptions`, `schedule_events`.
  - Calls external services: ElevenLabs, WhatsApp (Meta Cloud API and the Evolution API), the OpenAI-compatible LLM, and Web Push.
  - See the child contracts for details.

## Verification
- Run: `pnpm test tests/api`
- Typecheck: `pnpm check:api`
