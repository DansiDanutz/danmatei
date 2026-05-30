-- 0022_assignment_on_hold.sql
-- Adds the admin "on hold" enrollment state before RPCs use it. Keep this as
-- its own migration because new Postgres enum values should not be used in the
-- same transaction that adds them.

alter type fotbal.assignment_status add value if not exists 'on_hold';
