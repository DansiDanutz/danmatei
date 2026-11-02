# admin

## Overview

Owner-only tab panels lazy-loaded by `client/src/pages/Admin.tsx`: groups and enrollment queue, attendance risk, payments, lead funnel analytics, news, broadcast notifications, schedule oversight and match squad selection. None of these files checks the user's role. Access is gated by `RequireRole roles=["owner","super_admin"]` on the `/admin` route and by database RLS.

## Interface

- `GroupsTab` (default, no props) - academy fee editor; group create/edit/delete/toggle-active/assign-trainer; enrollment queue with accept/hold/reject [GroupsTab.tsx:GroupsTab]
- `AtRiskTab` (default, no props) - active children with low attendance, with `tel:` and `wa.me` actions [AtRiskTab.tsx:AtRiskTab]
- `PaymentsTab` (default, no props) - computes a payment status per child, shows summary cards, filters and search, and records payments and custom charges [PaymentsTab.tsx:PaymentsTab]
- `LeadAnalyticsTab` (default, no props) - lead KPIs, area chart, status funnel, source/intent/trainer breakdowns [LeadAnalyticsTab.tsx:LeadAnalyticsTab]
- `NewsManager` (default, no props) - CRUD for news posts with cover upload and an AI weekly draft [NewsManager.tsx:NewsManager]
- `NotificationManager` (default, no props) - broadcast notification form [NotificationManager.tsx:NotificationManager]
- `ScheduleOversight` (default, props `{ refreshKey?: number }`) - all `schedule_events` filtered by trainer/kind/date range; embeds `WeeklyScheduleEditor` and `SetTeamModal`; internal `AdminMatchForm` creates matches [ScheduleOversight.tsx:ScheduleOversight]
- `SetTeamModal` (default, props `{ event: TeamEvent; onClose(); onDone() }`) and exported type `TeamEvent` `{id, title, opponent, starts_at, trainer_id}` [SetTeamModal.tsx:SetTeamModal, TeamEvent]
- Imported, not local: `computePaymentStatus` / `statusLabel` / `statusColorClass` (`client/src/lib/payment-status.ts`), `birthYearFromDob` (`@shared/date`), `WeeklyScheduleEditor` (`client/src/components/trainer`), `PaymentStatusInfo` (`client/src/components/payment-status-info.tsx`)

## Invariants

- `groupSchema`: label 1-60 chars; birth years 2000-2030; `birthYearMax >= birthYearMin` is checked on submit [GroupsTab.tsx:groupSchema, onSubmit]
- Enrollment queue = children with `assignment_status in ('pending','on_hold')` and `status='active'`. Accept defaults to the first active group whose birth-year range contains the child's birth year [GroupsTab.tsx:loadAll, acceptToGroup]
- Reject child and delete group require `window.confirm` [GroupsTab.tsx:rejectChild, deleteGroup]; so does deleting a news post [NewsManager.tsx:deletePost]
- At-risk thresholds: `RISK_PERCENT_THRESHOLD = 50`, `MIN_TRACKED_SESSIONS = 4`; only `status='active'` children [AtRiskTab.tsx:RISK_PERCENT_THRESHOLD, MIN_TRACKED_SESSIONS]
- PaymentsTab loads only children with status `active` or `closed_unpaid`. `annotateChargesFifo` spends payments on charges in `due_date` order [PaymentsTab.tsx:loadAll, annotateChargesFifo]
- `paymentSchema`: amount 1..100000 RON; method `cash|bank_transfer|card|other`; note max 500. A payment needs a `recorderId`, but custom charges can be inserted with `created_by` null [PaymentsTab.tsx:paymentSchema, CustomChargeForm]
- `customChargeSchema`: label 1-160 chars; amount 0..100000 RON, so a 0 RON charge is accepted; `due_date` required [PaymentsTab.tsx:customChargeSchema]
- Lead statuses shown: `new, wa_sent, calling, transcribed, routed, contacted, closed`; window 7/30/60/180 days [LeadAnalyticsTab.tsx:STATUS_LABEL, WINDOW_OPTIONS]
- `notifySchema`: target `all_parents|group|trainer`; title 2-200, body 2-2000, link max 500 [NotificationManager.tsx:notifySchema]
- `newsSchema`: title 2-200, body 10-5000, audience `public|members|group`. `group_trainer_id` is saved only for `group`. A blank `published_at` is saved as the current time [NewsManager.tsx:newsSchema, onSubmit]
- `cover_path` stores the storage path, not a URL. The UI turns it into a URL with `getPublicUrl` [NewsManager.tsx]
- Editing a news post without choosing a new cover leaves `cover_path` unchanged; it is only written when a new cover is uploaded [NewsManager.tsx:onSubmit]
- `AdminMatchForm` inserts matches with `approval_status: "approved"`, so admin-created matches skip approval [ScheduleOversight.tsx:AdminMatchForm]
- `SetTeamModal` blocks finalize when no players are selected. Participations upsert on `(event_id, child_id)` with role `starter` [SetTeamModal.tsx:finalize]

## Side Effects

- Supabase tables: `groups` (CRUD), `trainers` (read), `children` (read), `academy_settings` (read/update `monthly_fee_ron`), `v_child_stats` (read), `child_charges` / `child_payments` (read/insert), `news` (CRUD), `schedule_events` (read/insert match), `match_participations` (upsert/delete)
- Supabase RPCs: `enroll_accept`, `enroll_hold`, `enroll_reject` [GroupsTab.tsx]
- Storage: bucket `fotbal-news-public`, upload to `news/{timestamp}.{ext}` with `{ upsert: true }` [NewsManager.tsx:uploadCover]
- HTTP with a Bearer token from `supabase.auth.getSession`: GET `/api/leads/analytics?days=` [LeadAnalyticsTab.tsx], POST `/api/news/draft-weekly` [NewsManager.tsx], GET `/api/match/squad?eventId=`, GET `/api/academy/players?q=`, POST `/api/schedule/notify` [SetTeamModal.tsx]
- HTTP with a Bearer token from `useAuth().session`: POST `/api/notify` [NotificationManager.tsx]
- Sonner toasts; no localStorage

## Verification

- Run: `pnpm test` (Vitest over `tests/**/*.test.ts`; no test targets this directory directly)
- Type-check: `pnpm check:app`
