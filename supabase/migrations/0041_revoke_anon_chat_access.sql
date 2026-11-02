-- Revoke anonymous access to the chat tables.
--
-- 0001 sets `alter default privileges ... grant select on tables to anon`, so
-- chat_threads and chat_messages (0002) were created with an anon SELECT
-- grant. Their read policies apply to the `public` role and end with
-- `or kind = 'parents'` with no sign-in check, so anyone holding the project's
-- public anon key could read every `parents` thread and its messages through
-- the REST API. The production database has no chat threads yet, so nothing has
-- been exposed; this closes the gap before the first one is created.
--
-- Nothing reads chat while signed out: the web chat needs a signed-in profile,
-- and the mobile chat routes will query with the caller's own token. Signed-in
-- users (`authenticated`) and the service role keep their grants, and the RLS
-- policies are unchanged.

revoke all on fotbal.chat_threads, fotbal.chat_messages from anon;
