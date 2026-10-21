-- Public read functions used by the visitor-facing pages (migrations
-- 0031, 0035-0039). Run with `supabase test db`.
--
-- Visitors (anon) can't read schedule_events / match_results directly (RLS),
-- so /program, /turnee, /rezultate and /campionat read through these
-- security-definer functions. They must return only approved, non-cancelled
-- events, never trainer notes, and public_championship() must return the
-- complete history (more than PostgREST's 1,000-row max_rows) as one JSON
-- value so /campionat's totals use consistent, complete data.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- ---------------------------------------------------------------------------
-- Fixture (as postgres). Hide any seeded matches/tournaments so counts are
-- exact; the transaction is rolled back at the end.
-- ---------------------------------------------------------------------------
update fotbal.schedule_events set cancelled_at = now()
 where kind in ('match', 'tournament') and cancelled_at is null;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-00000000aa01', 'pr-trainer@test.invalid', '{"app":"fotbal"}', 'authenticated', 'authenticated');
update fotbal.profiles set role = 'trainer', full_name = 'Antrenor Test'
 where id = '00000000-0000-0000-0000-00000000aa01';
insert into fotbal.trainers (id, profile_id, age_min, age_max, active) values
  ('00000000-0000-0000-0000-00000000ab01', '00000000-0000-0000-0000-00000000aa01', 9, 11, true);

-- ---------------------------------------------------------------------------
-- public_championship(): empty history
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(fotbal.public_championship()::text, '[]', 'public_championship returns [] when there are no matches');
reset role;

-- 1,205 approved, scored matches plus ones that must be left out.
insert into fotbal.schedule_events (id, trainer_id, kind, title, starts_at, approval_status)
select ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid,
       '00000000-0000-0000-0000-00000000ab01', 'match', 'Meci ' || i,
       '2020-01-01'::timestamptz + (i || ' hours')::interval, 'approved'
  from generate_series(1, 1205) i;
insert into fotbal.match_results (event_id, our_score, opponent_score)
select ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid, 2, 1
  from generate_series(1, 1205) i;

insert into fotbal.schedule_events (trainer_id, kind, title, starts_at, approval_status, notes) values
  ('00000000-0000-0000-0000-00000000ab01', 'match', 'Propus', '2030-01-01', 'proposed', null),
  ('00000000-0000-0000-0000-00000000ab01', 'tournament', 'Cupa Test', '2030-02-01', 'approved', 'NOTA PRIVATA');
insert into fotbal.schedule_events (trainer_id, kind, title, starts_at, approval_status, cancelled_at) values
  ('00000000-0000-0000-0000-00000000ab01', 'match', 'Anulat', '2030-01-02', 'approved', now());

-- ---------------------------------------------------------------------------
-- As an anonymous visitor
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*)::int from fotbal.schedule_events), 0, 'anon cannot read schedule_events directly');
select is((select count(*)::int from fotbal.match_results), 0, 'anon cannot read match_results directly');

select is(
  (select json_array_length(fotbal.public_championship())),
  1205,
  'public_championship returns all 1,205 approved matches (past the 1,000-row API cap) and excludes proposed and cancelled ones'
);
select is(
  (select count(*)::int from json_array_elements(fotbal.public_championship()) m where m->>'our_score' is not null),
  1205,
  'every returned match keeps its score'
);
select is(
  fotbal.public_championship()->0->>'title',
  'Meci 1205',
  'public_championship lists the newest match first'
);
select is(
  fotbal.public_championship()->0->>'trainer_id',
  '00000000-0000-0000-0000-00000000ab01',
  'each match carries its group (trainer_id)'
);
select set_eq(
  $$ select json_object_keys(fotbal.public_championship()->0) $$,
  array['id', 'trainer_id', 'title', 'starts_at', 'location', 'opponent', 'our_score', 'opponent_score', 'recap_md'],
  'public_championship returns only display fields'
);

select is(
  (select count(*)::int from fotbal.public_schedule('-infinity', 'infinity', 'match')),
  200,
  'public_schedule filters by kind (capped at 200 rows)'
);
select is(
  (select count(*)::int from fotbal.public_schedule('2029-12-31', '2030-12-31')),
  1,
  'public_schedule (two-argument call) returns approved events only'
);

select is(
  (select count(*)::int from fotbal.public_tournaments()),
  1,
  'public_tournaments returns the approved tournament'
);
select ok(
  (select bool_and(x::text not like '%NOTA PRIVATA%') from fotbal.public_tournaments() x),
  'public_tournaments never returns trainer notes'
);

select is(
  (select json_array_length(json_agg(r)) from fotbal.public_match_results(500) r),
  500,
  'public_match_results returns scored matches up to its cap'
);
select is(
  (select full_name from fotbal.public_trainer_names() where trainer_id = '00000000-0000-0000-0000-00000000ab01'),
  'Antrenor Test',
  'public_trainer_names exposes the active trainer''s name'
);
reset role;

select * from finish();
rollback;
