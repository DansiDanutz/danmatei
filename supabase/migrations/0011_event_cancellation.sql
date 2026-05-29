-- =============================================================================
-- 0011 — Event cancellation
-- =============================================================================
-- Adds soft-cancel to schedule_events (vs hard delete). Preserves history,
-- keeps match_results and match_participations intact, and lets the parent
-- side render an "Anulat" state instead of the row vanishing.

set search_path = fotbal, public;

alter table fotbal.schedule_events
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_reason text,
  add column if not exists cancelled_by uuid
    references fotbal.profiles(id) on delete set null;

create index if not exists schedule_events_cancelled_idx
  on fotbal.schedule_events (cancelled_at)
  where cancelled_at is not null;
