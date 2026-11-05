# api/cron

## Overview
Scheduled Vercel Cron handlers. Each file is a route at `/api/cron/<name>`. The schedules live in `vercel.json` (UTC):

| Route | Schedule |
| --- | --- |
| `daily` | `0 5 * * *` |
| `weekly-digest` | `0 17 * * 0` |
| `reap-stale-calls` | `*/15 * * * *` |
| `generate-monthly-charges` | `30 0 1 * *` |
| `close-overdue-accounts` | `0 2 * * 1` |
| `schedule-reminder` | `0 9 * * 4` |
| `coaching-digest` | `0 6 * * *` |

## Interface
All handlers accept `GET` or `POST` and return 405 for anything else. They all use `serviceClient()` and return 503 `supabase_unavailable` if it throws.

Other 500 responses: `close-overdue-accounts` `fetch_children_failed`; `daily` and `weekly-digest` `fetch_failed` (with `detail`); `generate-monthly-charges` `fetch_children_failed` or `fetch_fees_failed`; `reap-stale-calls` with the DB error message when the lookup or update fails.

`coaching-digest` and `schedule-reminder` do not check errors from their initial reads (`trainers`, `profiles`, `schedule_events`, `coaching_tips`), so they have no 500 path. [coaching-digest.ts:handler; schedule-reminder.ts:handler]

- `close-overdue-accounts.ts:handler`: closes accounts more than 3 months overdue. Returns `{ok, ranAt, flipped}`.
- `coaching-digest.ts:handler`: sends a daily coaching tip to every active trainer and to owners/super_admins. Returns `{ok, date, recipients, delivered, skipped, failed, aiConfigured, aiGenerated, fromLibrary}`.
  - Also exports the pure helper `parseTip(text)`, which returns `{title, body, source} | null`.
- `daily.ts:handler`: sends birthday notifications and runs the next-day training RSVP checks (`sendTomorrowRsvpChecks`). Returns `{ok, ranAt, birthdays, notified, push, rsvpChecks}`. When there are no birthdays it returns early, and the RSVP checks are skipped.
  - The early response is `{ok, ranAt, birthdays:0, notified:0}`, with no `push` or `rsvpChecks`.
  - In the full response `push` is `{sent, skipped, removed}` and `rsvpChecks` is `{events, pushed, skippedExisting, pushSent, pushRemoved}`. [daily.ts:handler, sendTomorrowRsvpChecks]
- `generate-monthly-charges.ts:handler`: creates one `monthly_fee` charge per active child that has a group. Children whose group has no `group_fees` row with `effective_from <= today` are skipped. With no active grouped children it returns 200 `{ok:true, ranAt, generated:0}` early. Returns 200 `{ok:true, ranAt, generated}`, or 207 `{ok:false, ranAt, generated, failed, failures}`.
- `reap-stale-calls.ts:handler`: marks leads stuck in `calling` as `failed`. Returns `{ok, ranAt, reaped, ids}`, or `{ok, ranAt, reaped:0}` with no `ids` when nothing is stuck.
- `schedule-reminder.ts:handler`: notifies trainers with no training scheduled in the next 7 days, and owners. Returns `{ok, ranAt, trainersChecked, trainersMissingSchedule}`. `trainersMissingSchedule` counts only trainers that were notified: a trainer with no upcoming training is skipped, and not counted, when they have no `profile_id` and there are no owners.
- `weekly-digest.ts:handler`: sends each parent one digest covering all of their children. Parents with no activity in the period and no upcoming event are skipped. Returns `{ok, ranAt, parents, notified, push}`, where `parents` counts every parent with active children, not only those notified. With no active children it returns `{ok, ranAt, parents:0, notified:0}` with no `push`.

## Invariants
- **Auth.** Every handler requires `Authorization: Bearer ${CRON_SECRET}`. If `CRON_SECRET` is unset in production or preview the handler returns 503 `cron_secret_unset`. A wrong header returns 401.
  - All seven handlers use `requireCron` from [`api/_lib/cron-auth.ts`](../_lib/EGM.md), which compares the header in constant time. [daily.ts:handler et al.]
- **`close-overdue-accounts`** only evaluates `children.status='active'`. It flips a child only when `computePaymentStatus(...).status === 'closed'`. Errors for one child are logged and skipped. [close-overdue-accounts.ts:handler]
- **`coaching-digest`:**
  - Idempotent per day: recipients who already have a `coaching_tips` row for today's Bucharest date are skipped.
  - Each `coaching_tips` row is inserted on its own. A recipient whose insert fails is logged, gets no notification or push, and counts in `failed` instead of `delivered`. A failed `notifications` insert is only logged. [coaching-digest.ts:handler]
  - If the AI is not configured, errors, takes more than 6000 ms (`AI_TIMEOUT_MS`), or returns text that does not parse, the tip comes from `pickTip(band, dayIndex)` instead. [coaching-digest.ts:handler, aiTip]
- **`daily` birthdays** compare dob string slices against today's month and day in Europe/Bucharest. Feb 29 birthdays fire on Mar 1 in non-leap years. [daily.ts:handler, todayMonthDay]
- **`daily` RSVP checks:**
  - Only non-cancelled `training` events starting in `[now, now+36h]` are considered.
  - A child is skipped if any attendance row already exists for that event.
  - Events with no `trainer_id` are skipped. Targeted children are active children with `children.trainer_id = event.trainer_id` and a non-null `parent_id`.
  - A parent is skipped if they already got an `attendance_check` notification for the same event in the last 48 h. [daily.ts:sendTomorrowRsvpChecks]
- **`generate-monthly-charges`:**
  - The fee is the latest `group_fees` row with `effective_from <= today`. "Today" is the full Europe/Bucharest date (year, month and day). The due date is the 15th of the current Bucharest month.
  - A `23505` or duplicate error means the charge already exists, so a re-run is ignored. Any other error makes the response 207. [generate-monthly-charges.ts:handler]
- **`reap-stale-calls`** uses `STUCK_THRESHOLD_MIN = 10`, measured on `leads.created_at`. [reap-stale-calls.ts:STUCK_THRESHOLD_MIN]
- **Push gating differs by job.** Push is sent only after the `notifications` insert succeeds in `weekly-digest`, `daily` birthdays and the `daily` RSVP checks. When the `daily` birthday batch insert fails it is logged and no birthday push is sent. `schedule-reminder` does not check its `notifications` insert before the push. `schedule-reminder` and `weekly-digest` do not deduplicate across runs. [daily.ts:handler, sendTomorrowRsvpChecks; weekly-digest.ts; schedule-reminder.ts]

## Side Effects
All tables below are in the Supabase schema `fotbal`.

- **`close-overdue-accounts`:** reads `children`, `child_charges` and `child_payments`. Updates `children.status='closed_unpaid'`.
- **`coaching-digest`:** reads `trainers`, `profiles` and `coaching_tips`. Inserts `coaching_tips` and `notifications` (kind `coaching_tip`). Sends Web Push with tag `coaching-<date>`. Calls the LLM through `generateText`.
- **`daily`:**
  - Birthdays: reads `children` and inserts `notifications` (kind `birthday`).
  - RSVP checks: reads `schedule_events`, `children`, `attendance` and `notifications`, then inserts `notifications` (kind `attendance_check`).
  - Web Push uses tags `birthday-<childId>-<year>` and `attendance-<eventId>-<childId>`.
- **`generate-monthly-charges`:** reads `children` and `group_fees`. Inserts `child_charges`.
- **`reap-stale-calls`:** reads `leads`. Updates `leads.status='failed'`. Inserts `lead_notifications` (type `lead_failed`, channel `inapp`).
- **`schedule-reminder`:** reads `trainers`, `schedule_events` and `profiles`. Inserts `notifications` (kind `schedule_missing`). Sends Web Push with tag `sched-missing-<trainerId>`.
- **`weekly-digest`:** reads `children`, `attendance`, `media`, `schedule_events` and `match_participations`. Inserts `notifications` (kind `weekly_digest`). Sends Web Push with tag `weekly-digest-<YYYY-MM-DD>` (the UTC run date).
- **Push cleanup:** Web Push goes through `sendPushToUsers`, which reads `push_subscriptions` and deletes dead rows.
- **Env vars:** `CRON_SECRET`, `NODE_ENV`, `VERCEL_ENV`, the Supabase vars, the VAPID vars, and `OPENAI_*` (coaching-digest only). No handler calls WhatsApp or ElevenLabs.

## Verification
- Run: `pnpm test tests/api` (includes `coaching-digest-parse.test.ts`, `coaching-digest-delivery.test.ts`, `daily-birthday.test.ts` and `daily-birthday-push.test.ts`)
- Typecheck: `pnpm check:api`
