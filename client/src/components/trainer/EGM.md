# trainer

## Overview

Trainer dashboard tab panels used by `client/src/pages/Antrenor.tsx`. Some of them are also reused by `client/src/pages/Admin.tsx` (`InboxAITab`, `ProposedMatchesQueue`, `CoachingTips`) and by `client/src/components/admin/ScheduleOversight.tsx` (`WeeklyScheduleEditor`). They cover the lead inbox, enrollment requests, matches and squads, attendance, the schedule, training recaps and coaching tips. None of these files checks the user's role; access relies on RLS and the `/api` routes.

## Interface

- `InboxAITab` (default) - props `{ trainerSlug: string | null }`; lead inbox with status changes, snooze, bulk actions, AI reply draft, call transcript and recording [InboxAITab.tsx:InboxAITab]
- `CoachingTips` (default) - props `{ recipientId: string }`; latest tip plus a collapsible history [CoachingTips.tsx:CoachingTips]
- `AtribuiriTab` (default) - props `{ trainerId: string }`; pending enrollment queue with accept/reject [AtribuiriTab.tsx:AtribuiriTab]
- `MatchesTab` (default) - props `{ trainerId; children: {id, full_name}[] }`; approved matches, squad builder, results, per-player stats [MatchesTab.tsx:MatchesTab]
- `AttendanceTab` (default) - props `{ trainerId; children }`; attendance for trainings in the last 7 days [AttendanceTab.tsx:AttendanceTab]
- `MatchPhotos` (default) - props `{ eventId: string }`; per-match media gallery and upload [MatchPhotos.tsx:MatchPhotos]
- `ProposedMatchesQueue` (default) - props `{ trainerId?; onChanged? }`; approve/reject proposed matches. Without `trainerId` it shows all proposals (owner mode) [ProposedMatchesQueue.tsx:ProposedMatchesQueue]
- `ScheduleCalendar` (default) - props `{ events: CalEvent[]; onSelectDay? }`; Monday-start month grid with no I/O. Exported type `CalEvent` [ScheduleCalendar.tsx:ScheduleCalendar, CalEvent]
- `TrainingRecapDialog` (default) - props `{ open; onOpenChange; event; onPublished? }`; flow: notes, then AI draft, then publish [TrainingRecapDialog.tsx:TrainingRecapDialog]
- `WeeklyScheduleEditor` (default) - props `{ trainerId; onChanged }`; CRUD for recurring training templates [WeeklyScheduleEditor.tsx:WeeklyScheduleEditor]

## Invariants

- Lead status writes are limited to `routed|contacted|closed` (bulk: `contacted|closed`). Leads are grouped into the buckets new, contacted and closed [InboxAITab.tsx:updateStatus, bucketOf]
- Snooze is a separate write to POST `/api/lead/status` with body `{ id, snoozedUntil }`, where `snoozedUntil` is now plus the chosen hours, or `null` to cancel. Leads with `snoozed_until` later than now are hidden from the inbox unless "show snoozed" is on [InboxAITab.tsx:snoozeLead, isSnoozed, visibleLeads]
- A 503 with `ai_not_configured` disables the AI draft / AI recap and switches to manual mode [InboxAITab.tsx:requestDraft; TrainingRecapDialog.tsx:generate]
- Optimistic lead updates are rolled back by refetching on any failure [InboxAITab.tsx:updateStatus]
- Attendance statuses are `present|absent|late|excused`. A tap cycles unset, present, absent, unset; setting null deletes the row [AttendanceTab.tsx:cycle, persist]
- A status chip sets any of the four statuses directly; choosing the current status again sets it to null [AttendanceTab.tsx:setSecondary]
- Bulk set upserts one row per child for the event; bulk reset deletes the event's rows for the trainer's children [AttendanceTab.tsx:bulkSet]
- `attendance` upserts on `(event_id, child_id)` [AttendanceTab.tsx:persist, bulkSet]
- Squad roles are `starter|sub|injured|absent`. On submit, `match_results` upserts on `event_id` and `match_participations` upserts on `(event_id, child_id)` [MatchesTab.tsx:onSubmit]
- Adding a player to the squad inserts a `match_participations` row right away (role `starter`, 0 goals, 0 assists); removing one deletes the row [MatchesTab.tsx:addToSquad, removeFromSquad]
- `resultSchema`: scores are integers >= 0; recap at most 2000 chars [MatchesTab.tsx:resultSchema]
- An unassigned pending child is shown only if its birth year falls in an active group's range [AtribuiriTab.tsx:loadPending]
- Match media: `image/*` or `video/*` only, videos at most 50 MB. Path `${uid}/match/${eventId}/${uuid}.${ext}`. The 24h upload window is enforced server-side (`window_closed`) [MatchPhotos.tsx:onPick]
- Recap: AI generation needs notes of at least 5 chars; publishing needs a draft of at least 20 chars [TrainingRecapDialog.tsx:generate, publish]
- Template weekdays are 1..7, Monday first. Regeneration always uses `p_weeks: 8` [WeeklyScheduleEditor.tsx:regenerate]

## Side Effects

- HTTP (Bearer token): GET `/api/lead/list`, POST `/api/lead/status`, POST `/api/lead/reply-draft`, GET `/api/match/squad`, GET `/api/academy/players`, POST `/api/schedule/notify`, GET `/api/match/photos`, POST `/api/training/recap-generate`, POST `/api/training/recap-publish`
- Supabase tables: `schedule_events`, `match_results`, `match_participations`, `attendance`, `groups`, `children`, `training_templates`, `coaching_tips`
- Supabase RPCs: `enroll_accept`, `enroll_reject`, `accept_match`, `reject_match`, `add_match_photo`, `regenerate_trainings`
- Storage bucket `fotbal-media-private`: upload, and removal of the orphaned file on RPC failure [MatchPhotos.tsx]
- Realtime lead events via `useLeadRealtime` (`client/src/lib/use-lead-realtime.ts`); native browser notifications; `<audio>` playback of call recordings; `tel:` and `wa.me` links [InboxAITab.tsx]
- No localStorage

## Verification

- Run: `pnpm test` (no test targets this directory directly)
- Type-check: `pnpm check:app`
