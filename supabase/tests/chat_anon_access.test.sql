-- Anonymous access to the chat tables (migration 0041). Run with
-- `supabase test db`.
--
-- anon must not read or write chat_threads or chat_messages. Before 0041 it
-- could read every `parents` thread and its messages, because the read
-- policies have no sign-in check. Signed-in users and the service role keep
-- their access.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- ---------------------------------------------------------------------------
-- Fixture (as postgres): one parent, an academy-wide `parents` thread and one
-- message in it.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000b1', 'chat-parent@test.invalid', '{"app":"fotbal"}', 'authenticated', 'authenticated');

insert into fotbal.chat_threads (id, kind, title) values
  ('00000000-0000-0000-0000-0000000000c1', 'parents', 'Academy parents');

insert into fotbal.chat_messages (id, thread_id, sender_id, body) values
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'Mesaj de test');

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
select ok(not has_table_privilege('anon', 'fotbal.chat_threads', 'select'), 'anon cannot select chat_threads');
select ok(not has_table_privilege('anon', 'fotbal.chat_messages', 'select'), 'anon cannot select chat_messages');
select ok(has_table_privilege('authenticated', 'fotbal.chat_threads', 'select'), 'authenticated can still select chat_threads');
select ok(has_table_privilege('authenticated', 'fotbal.chat_messages', 'select'), 'authenticated can still select chat_messages');
select ok(has_table_privilege('service_role', 'fotbal.chat_threads', 'select'), 'service_role can still select chat_threads');
select ok(has_table_privilege('service_role', 'fotbal.chat_messages', 'select'), 'service_role can still select chat_messages');

-- ---------------------------------------------------------------------------
-- Behaviour as anon: the `parents` thread and its message are not readable,
-- and nothing can be written.
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select count(*) from fotbal.chat_threads$$, '42501', null, 'anon cannot read the parents thread');
select throws_ok($$select count(*) from fotbal.chat_messages$$, '42501', null, 'anon cannot read messages in the parents thread');
select throws_ok(
  $$insert into fotbal.chat_messages (thread_id, sender_id, body) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'x')$$,
  '42501', null, 'anon cannot post a message');
reset role;

-- ---------------------------------------------------------------------------
-- Behaviour as a signed-in parent: the academy-wide thread is still visible.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from fotbal.chat_threads where kind = 'parents'), 1, 'a signed-in parent still sees the parents thread');
select is((select count(*)::int from fotbal.chat_messages where thread_id = '00000000-0000-0000-0000-0000000000c1'), 1, 'a signed-in parent still sees its messages');
reset role;

select * from finish();
rollback;
