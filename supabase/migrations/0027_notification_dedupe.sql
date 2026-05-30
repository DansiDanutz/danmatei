-- 0027 — Notification dedupe keys
--
-- Some external providers retry webhooks concurrently. Application-level
-- "already completed" checks are not enough when two requests read the same
-- pre-completion row before either writes. Give server-side notification
-- writers a nullable dedupe key so retried deliveries can be made idempotent
-- without weakening normal notification fanout.

alter table fotbal.notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_unique
  on fotbal.notifications (dedupe_key)
  where dedupe_key is not null;
