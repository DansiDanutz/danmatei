-- Row-level security on fotbal.children and the signup/placement triggers
-- (migrations 0030, 0033, 0034). Run with `supabase test db`.
--
-- Fixture: owner, two parents, two trainers. Trainer 1 has a group for birth
-- years 2014-2016; trainer 2 for 2008-2010. Parent A has a pending,
-- unassigned child born 2015.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- ---------------------------------------------------------------------------
-- Fixture (as postgres)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.invalid',   '{"app":"fotbal","role":"owner"}',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'parent-a@test.invalid', '{"app":"fotbal"}',                  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'parent-b@test.invalid', '{"app":"fotbal"}',                  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'trainer-1@test.invalid', '{"app":"fotbal","role":"trainer"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'trainer-2@test.invalid', '{"app":"fotbal","role":"trainer"}', 'authenticated', 'authenticated');

-- 0030: signup metadata can't grant a role.
select is(
  (select role::text from fotbal.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'parent',
  'self-signup claiming owner becomes a parent'
);

-- Roles are granted server-side (service role: auth.uid() is null).
update fotbal.profiles set role = 'owner'
 where id = '00000000-0000-0000-0000-0000000000a1';
update fotbal.profiles set role = 'trainer'
 where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');

insert into fotbal.trainers (id, profile_id, age_min, age_max) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 9, 11),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', 15, 17);

insert into fotbal.groups (id, label, trainer_id, birth_year_min, birth_year_max, created_by) values
  ('00000000-0000-0000-0000-0000000000e1', 'U11 test', '00000000-0000-0000-0000-0000000000d1', 2014, 2016, '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000e2', 'U17 test', '00000000-0000-0000-0000-0000000000d2', 2008, 2010, '00000000-0000-0000-0000-0000000000a1');

insert into fotbal.children (id, parent_id, full_name, dob, medical_notes) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 'Copil Test', '2015-05-01', 'astm');

-- ---------------------------------------------------------------------------
-- 0034: who can read the pending, unassigned child
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from fotbal.children), 0, 'anon cannot read any child');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from fotbal.children where id = '00000000-0000-0000-0000-0000000000f1'), 0, 'an unrelated parent cannot read the pending child');
with u as (update fotbal.children set medical_notes = 'x' where id = '00000000-0000-0000-0000-0000000000f1' returning 1)
select is((select count(*)::int from u), 0, 'an unrelated parent cannot update the pending child');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is((select count(*)::int from fotbal.children where id = '00000000-0000-0000-0000-0000000000f1'), 0, 'a trainer whose groups do not cover the birth year cannot read it');
with u as (update fotbal.children set medical_notes = 'x' where id = '00000000-0000-0000-0000-0000000000f1' returning 1)
select is((select count(*)::int from u), 0, 'a trainer whose groups do not cover the birth year cannot update it');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from fotbal.children where id = '00000000-0000-0000-0000-0000000000f1'), 1, 'the trainer whose group covers the birth year can read it');
-- That trainer may take the child into their own care (the row must end up
-- theirs); undone so the checks below still see it unassigned.
savepoint claim;
with u as (update fotbal.children set trainer_id = '00000000-0000-0000-0000-0000000000d1' where id = '00000000-0000-0000-0000-0000000000f1' returning 1)
select is((select count(*)::int from u), 1, 'that trainer can assign the pending child to themselves');
rollback to savepoint claim;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from fotbal.children where id = '00000000-0000-0000-0000-0000000000f1'), 1, 'the parent can read their own pending child');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from fotbal.children where id = '00000000-0000-0000-0000-0000000000f1'), 1, 'the owner can read the pending child');
reset role;

-- ---------------------------------------------------------------------------
-- 0030 + 0033: what a parent can and cannot set on their own children
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

insert into fotbal.children (id, parent_id, full_name, dob, trainer_id, group_id, assignment_status, status)
values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000b1', 'Copil Doi', '2015-02-02',
        '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'accepted', 'paused');

update fotbal.children
   set trainer_id = '00000000-0000-0000-0000-0000000000d2',
       assignment_status = 'accepted',
       status = 'left',
       school = 'Școala 1'
 where id = '00000000-0000-0000-0000-0000000000f1';
reset role;

select is(
  (select trainer_id from fotbal.children where id = '00000000-0000-0000-0000-0000000000f2'),
  null::uuid, 'a parent''s trainer pick does not become trainer_id'
);
select is(
  (select preferred_trainer_id from fotbal.children where id = '00000000-0000-0000-0000-0000000000f2'),
  '00000000-0000-0000-0000-0000000000d1'::uuid, 'it is kept as preferred_trainer_id'
);
select is(
  (select group_id from fotbal.children where id = '00000000-0000-0000-0000-0000000000f2'),
  null::uuid, 'a parent cannot place the child in a group'
);
select is(
  (select assignment_status::text || '/' || status::text from fotbal.children where id = '00000000-0000-0000-0000-0000000000f2'),
  'pending/active', 'a new child starts pending and active whatever the parent sends'
);
select is(
  (select trainer_id from fotbal.children where id = '00000000-0000-0000-0000-0000000000f1'),
  null::uuid, 'a parent cannot change their child''s trainer'
);
select is(
  (select assignment_status::text || '/' || status::text from fotbal.children where id = '00000000-0000-0000-0000-0000000000f1'),
  'pending/active', 'a parent cannot accept or change the status of their child'
);
select is(
  (select school from fotbal.children where id = '00000000-0000-0000-0000-0000000000f1'),
  'Școala 1', 'a parent can still edit their child''s details'
);

-- The matching trainer accepts the child through the enrollment RPC.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select fotbal.enroll_accept(
  '00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-0000000000d1'
);
reset role;
select is(
  (select trainer_id from fotbal.children where id = '00000000-0000-0000-0000-0000000000f1'),
  '00000000-0000-0000-0000-0000000000d1'::uuid, 'acceptance sets the trainer'
);

select * from finish();
rollback;
