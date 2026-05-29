-- =============================================================================
-- 0010 — Training recap
-- =============================================================================
-- Adds parent-facing recap copy to schedule_events. Only meaningful for
-- training-kind events (matches use match_results.recap_md), but storing it
-- on the event itself keeps the read path simple — CopilProfil already pulls
-- the row, no JOINs needed to render.

set search_path = fotbal, public;

alter table fotbal.schedule_events
  add column if not exists recap_md text,
  add column if not exists recap_published_at timestamptz,
  add column if not exists recap_published_by uuid
    references fotbal.profiles(id) on delete set null;

create index if not exists schedule_events_recap_published_idx
  on fotbal.schedule_events (recap_published_at desc)
  where recap_published_at is not null;
