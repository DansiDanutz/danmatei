-- =============================================================================
-- 0009 — Lead snooze
-- =============================================================================
-- Adds snoozed_until to fotbal.leads so a trainer can hide a lead from the
-- inbox for a chosen interval (default 24h via the UI). The lead reappears
-- automatically once the timestamp is in the past — server doesn't have to
-- run a job.

set search_path = fotbal, public;

alter table fotbal.leads
  add column if not exists snoozed_until timestamptz;

create index if not exists leads_snoozed_until_idx
  on fotbal.leads (snoozed_until)
  where snoozed_until is not null;
