-- =============================================================================
-- 0015 — Extend child_status enum with closed_unpaid + transferred
-- =============================================================================
-- PR-R adds the weekly cron `close-overdue-accounts` that flips a child from
-- 'active' to 'closed_unpaid' after 3 months of unpaid charges. The admin can
-- also manually move a child to 'transferred' from the Membri tab.
--
-- Postgres ALTER TYPE … ADD VALUE is idempotent only on PG12+ with IF NOT
-- EXISTS, which Supabase supports. The values can't be added inside a
-- transaction, so each statement stands alone.

alter type fotbal.child_status add value if not exists 'closed_unpaid';
alter type fotbal.child_status add value if not exists 'transferred';
