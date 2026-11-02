# supabase/migrations

## Overview

Ordered PostgreSQL migrations (`0001` to `0041`, plus `00081`) that define the `fotbal` schema: tables, enums, views, RLS policies, `SECURITY DEFINER` RPCs, triggers, storage buckets/policies, and realtime publication membership. Later files frequently `create or replace` functions and policies from earlier ones, so the **latest** file that touches a symbol is authoritative.

How they are applied, per repo docs (not CI): `README.md` ("Database setup") says to run `supabase db push` or paste the files into the SQL editor in order. `.github/workflows/verify.yml` only applies them to a fresh local database (`supabase db start`) and runs `supabase test db`; it does not deploy to a hosted project.

## Interface

### Enums

- `fotbal.user_role`: `owner | trainer | parent`, `+super_admin` (0003)
- `fotbal.child_status`: `active | paused | left`, `+closed_unpaid`, `+transferred` (0015)
- `fotbal.assignment_status`: `pending | accepted | rejected` (0003), `+on_hold` (0022)
- `fotbal.event_approval`: `proposed | approved | rejected` (0017)
- `fotbal.schedule_kind`: `training | match | tournament | other`
- `fotbal.news_audience`: `public | members | group`
- `fotbal.participation_role`: `starter | sub | injured | absent`
- `fotbal.attendance_status`: `present | absent | late | excused` (0004)
- `fotbal.ai_convo_status`: `pending | in_progress | completed | failed` (0002)
- `fotbal.chat_thread_kind`: `parent_trainer | group | parents` (0002)
- `fotbal.media_kind` (`image | video`), `fotbal.message_audience` (`group | child | parent`), `fotbal.landing_slot` (`hero | owner | trainers | players`), and `fotbal.player_event_kind` (10 values: `signup`, `group_assigned`, `group_unassigned`, `match`, ...)

### Tables (`fotbal.*`)

| Table | Introduced | Later changes |
| --- | --- | --- |
| `profiles` | 0001 | insert-self policy 0020; role lock 0021 |
| `trainers` | 0001 | `whatsapp_number`, `elevenlabs_agent_id` 0002; `slug` (unique) 0026; scope lock 0030 |
| `children` | 0001 | `group_id`, `assignment_status` 0003; `preferred_trainer_id`, `welcome_claimed_at` 0033 |
| `news`, `landing_content`, `player_events`, `notifications` | 0001 | `notifications.dedupe_key` 0027 |
| `schedule_events` | 0001 | recap 0010; cancellation 0011; approval workflow 0017; `call_time`, `fee_ron`, `group_notified_at`, `training_template_id` 0024 |
| `match_results`, `match_participations` | 0001 | |
| `media` | 0001 | `event_id`, `group_id` 0019 |
| `messages` | 0001 | `sender_role` (`trainer` or `parent`) 0013 |
| `ai_conversations`, `chat_threads`, `chat_messages` | 0002 | |
| `groups` | 0003 | |
| `attendance` | 0004 | |
| `leads`, `lead_calls`, `lead_notifications` | 0006 | `leads.snoozed_until` 0009 |
| `player_skills` | 0007 | |
| `push_subscriptions` | 00081 | composite unique 0012 |
| `group_fees`, `child_charges`, `child_payments` | 0014 | reconciled/recreated in 0032 |
| `coaching_tips` | 0018 | |
| `academy_settings` (singleton), `training_templates` | 0024 | 0024 inserts the singleton `academy_settings` row (`id = true`, `monthly_fee_ron = 0`) |

### Views

- `fotbal.v_trainer_inbox` (0006) and `fotbal.v_child_stats` (0007). Both are switched to `security_invoker = on` in 0023.

### Helper functions (`SECURITY DEFINER`, `search_path = fotbal, public`)

- `current_role()`, `is_owner()` (owner or super_admin since 0003), `is_trainer()`, `my_trainer_id()`, `my_group_year_range()`
- `trainer_slug_for_age(int)` (0026) and `lead_trainer_for_age(int)` (0006; immutable, not definer)

### RPCs (`SECURITY DEFINER`)

- Enrollment: `assign_child_to_group(p_child, p_group)` (0016); `enroll_accept(p_child, p_group, p_trainer)` (0021, replaced in 0023); `enroll_hold(p_child)` and `enroll_reject(p_child)` (0024)
- Matches: `propose_match(...)`, `accept_match(p_event)`, `reject_match(p_event)`, `set_match_score(p_event, p_our, p_opp, p_scorers)` (0017); `add_match_photo(p_event, p_path, p_mime, p_bytes, p_kind)` (0019, 5-arg version in 0028)
- Scheduling: `regenerate_trainings(p_trainer, p_weeks default 8)` (0024)
- Public, anon-callable reads: `public_trainer_names()` (0031); `public_schedule(p_from, p_to, p_kind)` (0035, 3-arg in 0036); `public_tournaments()` (0035, without `notes` since 0037); `public_match_results(p_limit default 40)` (0035, dropped and recreated in 0036); `public_championship()` (0038 `returns table (...)`; dropped and recreated in 0039 to return `json`)

### Storage buckets (0001)

- `fotbal-media-private` (private)
- `fotbal-trainer-public` (public)
- `fotbal-news-public` (public)

## Invariants

- Every `SECURITY DEFINER` function pins `search_path = fotbal, public`. RPCs raise `not_authorized` unless `is_owner()`, `my_trainer_id()`, or parent ownership checks pass.
- RLS is enabled on every `fotbal` table. Policies are permissive and additive, so 0001 policies that later files do not drop still apply alongside newer ones (0008 drops `children parent read` / `children parent update`; 0034 rewrites `children read` / `children update` so only signed-in trainers see pending, unassigned children in their birth-year range).
- Privilege-escalation guards:
  - `handle_new_user` (0030) always creates `role = 'parent'` and only for `raw_user_meta_data.app = 'fotbal'`.
  - `profiles_lock_role` (0021) resets `role` unless the caller is service role or owner.
  - `children_lock_placement` (0030, replaced in 0033) forces `pending`/unassigned placement on parent inserts and freezes placement columns on parent updates.
  - `trainers_lock_scope` (0030) freezes `profile_id`, `slug`, `active`, `display_order` for non-owners.
  - `profiles insert self` (0020) only permits `role = 'parent'`.
  - `media insert` (0030) lets non-owners insert only with `uploader_id = auth.uid()`, `event_id` and `group_id` null, a `storage_path` under their own `<uid>/` folder, and a `child_id` that is null or visible to them (`0030_privilege_escalation_fixes.sql:91-105`).
- Lead RLS (0029) is keyed on the caller's active `trainers.slug` matching `assigned_trainer_id`, `cc_trainer_ids`, or `recipient_trainer_id`. 0026 marks seeding `trainers.slug` in production as `ACTION REQUIRED`.
- Idempotency/dedupe unique indexes:
  - `lead_calls_vendor_call_id_unique (vendor, vendor_call_id)` (0025)
  - `notifications_dedupe_key_unique` (0027)
  - `push_subscriptions_user_endpoint_unique` (0012)
  - `coaching_tips (recipient_id, tip_date)` (0018)
  - `child_charges (child_id, kind, period_year, period_month)` and `group_fees (group_id, effective_from)` (0014/0032)
- Check constraints:
  - `leads.status` and `lead_calls.status`/`intent` value lists (0006)
  - `child_charges.kind` in (`monthly_fee`, `custom`); `child_payments.method` in (`cash`, `bank_transfer`, `card`, `other`); `amount_ron > 0` for payments
  - `player_skills` scores 1 to 5; `training_templates.weekday` 1 to 7
  - `academy_settings.id` is boolean with `CHECK (id)`, which makes it a singleton
- Match workflow: `set_match_score` requires `approval_status = 'approved'` and sets `finalized_at` on the first score. `add_match_photo` requires the path prefix `<uid>/`, a finalized match, and a call within 24h of `finalized_at`.
- Public reads: the `public_*` RPCs return only `approval_status = 'approved'` and non-cancelled events, `REVOKE ALL FROM PUBLIC`, and `GRANT EXECUTE` to `anon, authenticated`. `public_trainer_names` exposes only id and `full_name`.
- Grant model (0001, `0001_init.sql:327-333`): `anon` gets `SELECT` on all `fotbal` tables, and default privileges give `anon` `SELECT` on every later table and `EXECUTE` (with `authenticated`, `service_role`) on every later function. RLS still decides which rows `anon` sees. Later files must revoke `anon` explicitly to remove access.
- `anon` grants are revoked from `v_child_stats`, `v_trainer_inbox`, `player_skills` (0023), `academy_settings` and `training_templates` (0024), and `group_fees`, `child_charges` and `child_payments` (0040). Those payment tables are granted only to `authenticated, service_role` (`0032_reconcile_payments_schema.sql:122`).
- 0041 revokes all `anon` access to `chat_threads` and `chat_messages`. Their read policies apply to the `public` role and include `kind = 'parents'` with no sign-in check, so before 0041 anyone with the public anon key could read every `parents` thread and its messages; the production database had no threads when this was found. The policies are unchanged, so they now apply only to signed-in users. `supabase/tests/chat_anon_access.test.sql` checks the grants and the behavior.
- 0040 revokes `EXECUTE` on `enroll_hold`, `enroll_reject`, `regenerate_trainings` and `trainer_slug_for_age` from both `PUBLIC` and `anon` (Postgres grants new functions to `PUBLIC`, which every role inherits), and re-grants them to `authenticated, service_role`. `supabase/tests/grants.test.sql` checks these grants.
- 0032 aborts if a legacy-shaped `child_charges` table still has rows.
- Known caveats found in the code (unchanged):
  - `group_fees.created_by` and `child_payments.recorded_by` are `NOT NULL` with `ON DELETE SET NULL` (0014, 0032), so deleting the referenced profile will fail.

## Side Effects

- Triggers:
  - `fotbal_on_auth_user_created` on `auth.users` inserts `fotbal.profiles`.
  - `on_child_inserted` and `on_child_updated_assignment` insert `player_events`.
  - `chat_msg_bump_thread` updates `chat_threads.last_message_at`.
  - `set_updated_at` / `*_set_updated_at` on most tables.
- Notification fan-out (inserts into `fotbal.notifications`): `notify_message` (`tg_notify_message`, parent/trainer branches since 0013) and `notify_match_result`. `notify_match_scheduled` is dropped in 0021. `enroll_accept`, `enroll_hold`, and `enroll_reject` insert `enrollment_*` notifications.
- `enroll_accept` (0023) inserts a `monthly_fee` `child_charges` row when `academy_settings.monthly_fee_ron > 0`.
- `regenerate_trainings` deletes future non-cancelled template-generated trainings and inserts new `schedule_events` (Europe/Bucharest time).
- Realtime: `supabase_realtime` publication adds `fotbal.chat_messages` (0002), and `fotbal.notifications` and `fotbal.lead_notifications` (0008).
- Storage policies on `storage.objects` for the three buckets (0001, 0008); bucket rows are inserted in 0001.
- No `pg_net`/HTTP calls or cron jobs are defined in SQL; external integrations (ElevenLabs, WhatsApp, voice vendors) write through service-role APIs.

## Verification

- Apply all migrations to a fresh local DB: `supabase db start` (or `supabase db reset`)
- RLS regression tests in `supabase/tests/*.test.sql`: `supabase test db`
