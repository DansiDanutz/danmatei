-- Chat read tracking (migration 0042). Run with `supabase test db`.
--
-- Covers fotbal.chat_reads, fotbal.chat_unread_counts() and
-- fotbal.chat_mark_read(). now() is frozen inside a pgTAP transaction, so the
-- fixture uses explicit created_at and last_read_at values, all relative to
-- the same now().
--
-- Fixture: parent A (child in thread TA with trainer 1), parent B (child in
-- thread TB with trainer 2), and the academy-wide `parents` thread P.
--   TA messages (from trainer 1): -5h, -3h, -2h (exactly last_read_at), -1h;
--                  from parent A: -30min
--   TB messages (from trainer 2): -4h, -1h
--   A's chat_reads row for TA: last_read_at = -2h
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- ---------------------------------------------------------------------------
-- Fixture (as postgres)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000b1', 'reads-parent-a@test.invalid', '{"app":"fotbal"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'reads-parent-b@test.invalid', '{"app":"fotbal"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'reads-trainer-1@test.invalid', '{"app":"fotbal","role":"trainer"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'reads-trainer-2@test.invalid', '{"app":"fotbal","role":"trainer"}', 'authenticated', 'authenticated');

update fotbal.profiles set role = 'trainer'
 where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');

insert into fotbal.trainers (id, profile_id, age_min, age_max) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 9, 11),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', 15, 17);

insert into fotbal.children (id, parent_id, full_name, dob) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 'Copil A', '2015-05-01'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000b2', 'Copil B', '2009-05-01');

insert into fotbal.chat_threads (id, kind, trainer_id, child_id, title) values
  ('00000000-0000-0000-0000-0000000000a1', 'parent_trainer', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000f1', 'TA'),
  ('00000000-0000-0000-0000-0000000000a2', 'parent_trainer', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000f2', 'TB'),
  ('00000000-0000-0000-0000-0000000000a3', 'parents', null, null, 'P');

insert into fotbal.chat_messages (thread_id, sender_id, body, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'ta-1', now() - interval '5 hours'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'ta-2', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'ta-tie', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'ta-3', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'ta-own', now() - interval '30 minutes'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2', 'tb-1', now() - interval '4 hours'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2', 'tb-2', now() - interval '1 hour');

insert into fotbal.chat_reads (user_id, thread_id, last_read_at) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', now() - interval '6 hours');

-- ---------------------------------------------------------------------------
-- (a) Privileges
-- ---------------------------------------------------------------------------
select ok(not has_table_privilege('anon', 'fotbal.chat_reads', 'select'), 'anon cannot select chat_reads');
select ok(not has_function_privilege('anon', 'fotbal.chat_unread_counts()', 'execute'), 'anon cannot execute chat_unread_counts');
select ok(not has_function_privilege('anon', 'fotbal.chat_mark_read(uuid)', 'execute'), 'anon cannot execute chat_mark_read');
select ok(has_function_privilege('authenticated', 'fotbal.chat_unread_counts()', 'execute'), 'authenticated can execute chat_unread_counts');

-- ---------------------------------------------------------------------------
-- Parent A
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

-- (b) own rows only
select is((select count(*)::int from fotbal.chat_reads), 1, 'parent A sees only their own chat_reads row');

-- (f)(g)(h) strict >, tie and own message: only ta-3 counts
select is(
  (select unread from fotbal.chat_unread_counts() where thread_id = '00000000-0000-0000-0000-0000000000a1'),
  1,
  'unread counts only other people''s messages newer than last_read_at (a message at last_read_at and the caller''s own do not count)');

-- a visible thread with no messages still gets a row, with 0
select is(
  (select unread from fotbal.chat_unread_counts() where thread_id = '00000000-0000-0000-0000-0000000000a3'),
  0,
  'a visible thread with no messages is returned with unread 0');

select is(
  (select count(*)::int from fotbal.chat_unread_counts() where thread_id = '00000000-0000-0000-0000-0000000000a2'),
  0,
  'a thread parent A cannot see is not counted');

-- (c) chat_mark_read creates one row and a second call leaves one row
select lives_ok($$select fotbal.chat_mark_read('00000000-0000-0000-0000-0000000000a3')$$, 'parent A marks the parents thread read');
select lives_ok($$select fotbal.chat_mark_read('00000000-0000-0000-0000-0000000000a3')$$, 'marking read a second time works');
select is(
  (select count(*)::int from fotbal.chat_reads where thread_id = '00000000-0000-0000-0000-0000000000a3'),
  1,
  'two marks leave one chat_reads row');

-- after marking TA read, nothing newer than now() remains
select lives_ok($$select fotbal.chat_mark_read('00000000-0000-0000-0000-0000000000a1')$$, 'parent A marks their thread read');
select is(
  (select unread from fotbal.chat_unread_counts() where thread_id = '00000000-0000-0000-0000-0000000000a1'),
  0,
  'unread is 0 after chat_mark_read');

-- (d) another family's thread and a nonexistent thread both fail the RLS check
select throws_ok($$select fotbal.chat_mark_read('00000000-0000-0000-0000-0000000000a2')$$, '42501', null, 'marking another family''s thread read is denied');
select throws_ok($$select fotbal.chat_mark_read('00000000-0000-0000-0000-00000000dead')$$, '42501', null, 'marking a nonexistent thread read is denied with 42501, not a foreign key error');
reset role;

-- ---------------------------------------------------------------------------
-- Parent B: before any read by B in TB since -6h, both trainer messages count;
-- A's activity did not change B's numbers.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is(
  (select unread from fotbal.chat_unread_counts() where thread_id = '00000000-0000-0000-0000-0000000000a2'),
  2,
  'parent B''s unread count is not affected by parent A''s reads');
reset role;

-- (d) the denied calls wrote nothing
select is(
  (select count(*)::int from fotbal.chat_reads where user_id = '00000000-0000-0000-0000-0000000000b1' and thread_id = '00000000-0000-0000-0000-0000000000a2'),
  0,
  'a denied chat_mark_read writes no row');

select * from finish();
rollback;
