-- The existing chat policies as access rules (migration 0002, plus 0041).
-- Run with `supabase test db`.
--
-- The API handler tests only prove mapping and error handling. This file proves
-- who can read and post in which thread, which is what the mobile routes rely on.
--
-- Fixture: owner, super_admin, parent A (child in thread TA with trainer 1),
-- parent B (child in thread TB with trainer 2), and the academy-wide `parents`
-- thread P.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- ---------------------------------------------------------------------------
-- Fixture (as postgres)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a0', 'access-owner@test.invalid', '{"app":"fotbal"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a9', 'access-super@test.invalid', '{"app":"fotbal"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'access-parent-a@test.invalid', '{"app":"fotbal"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'access-parent-b@test.invalid', '{"app":"fotbal"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'access-trainer-1@test.invalid', '{"app":"fotbal","role":"trainer"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'access-trainer-2@test.invalid', '{"app":"fotbal","role":"trainer"}', 'authenticated', 'authenticated');

update fotbal.profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a0';
update fotbal.profiles set role = 'super_admin' where id = '00000000-0000-0000-0000-0000000000a9';
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

insert into fotbal.chat_messages (thread_id, sender_id, body) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'ta-1'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2', 'tb-1');

-- ---------------------------------------------------------------------------
-- Parent A
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select is((select count(*)::int from fotbal.chat_threads where id = '00000000-0000-0000-0000-0000000000a1'), 1, 'parent A sees their parent_trainer thread');
select is((select count(*)::int from fotbal.chat_threads where id = '00000000-0000-0000-0000-0000000000a3'), 1, 'parent A sees the parents thread');
select is((select count(*)::int from fotbal.chat_threads where id = '00000000-0000-0000-0000-0000000000a2'), 0, 'parent A does not see another family''s thread');
select is((select count(*)::int from fotbal.chat_messages where thread_id = '00000000-0000-0000-0000-0000000000a1'), 1, 'parent A reads messages in their thread');
select is((select count(*)::int from fotbal.chat_messages where thread_id = '00000000-0000-0000-0000-0000000000a2'), 0, 'parent A cannot read another family''s messages');
select throws_ok(
  $$insert into fotbal.chat_messages (thread_id, sender_id, body) values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', 'x')$$,
  '42501', null, 'parent A cannot post in another family''s thread');
select lives_ok(
  $$insert into fotbal.chat_messages (thread_id, sender_id, body) values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1', 'salut')$$,
  'parent A can post in the parents thread (open posting is intended)');
reset role;

-- ---------------------------------------------------------------------------
-- Trainer 1: only their own threads, plus the parents thread
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

select is((select count(*)::int from fotbal.chat_threads where id = '00000000-0000-0000-0000-0000000000a1'), 1, 'trainer 1 sees their own thread');
select is((select count(*)::int from fotbal.chat_threads where id = '00000000-0000-0000-0000-0000000000a2'), 0, 'trainer 1 does not see trainer 2''s thread');
select is((select count(*)::int from fotbal.chat_threads where id = '00000000-0000-0000-0000-0000000000a3'), 1, 'trainer 1 sees the parents thread');
reset role;

-- ---------------------------------------------------------------------------
-- Owner and super_admin: every thread, and can post in any of them
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is((select count(*)::int from fotbal.chat_threads), 3, 'an owner sees every thread');
select lives_ok(
  $$insert into fotbal.chat_messages (thread_id, sender_id, body) values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a0', 'owner')$$,
  'an owner can post in any thread');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select is((select count(*)::int from fotbal.chat_threads), 3, 'a super_admin sees every thread');
select lives_ok(
  $$insert into fotbal.chat_messages (thread_id, sender_id, body) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a9', 'super')$$,
  'a super_admin can post in any thread');
reset role;

select * from finish();
rollback;
