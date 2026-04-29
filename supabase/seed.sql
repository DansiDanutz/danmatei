-- =============================================================================
-- Dev seed — sample data for local Supabase + previews.
-- =============================================================================
set search_path = fotbal, public;
-- This script is idempotent. It expects the schema from 0001_init.sql to be
-- already applied. The sample auth users below use deterministic UUIDs so the
-- seed can be re-run without duplication.
--
-- Sample accounts (password: `parola123`):
--   dan@scoala-dan-matei.ro      → owner
--   andrei@scoala-dan-matei.ro   → trainer (U7–U9)
--   radu@scoala-dan-matei.ro     → trainer (U10–U12)
--   cristi@scoala-dan-matei.ro   → trainer (U13–U15)
--   parinte@example.com          → parent
-- =============================================================================

-- Helper: insert into auth.users + profiles together, with deterministic UUIDs.
do $$
declare
  hashed_pw text := crypt('parola123', gen_salt('bf'));
  ids record;
begin
  for ids in select * from (values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'dan@scoala-dan-matei.ro',     'Dan Matei',       'owner'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'andrei@scoala-dan-matei.ro',  'Andrei Popa',     'trainer'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'radu@scoala-dan-matei.ro',    'Radu Mureșan',    'trainer'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'cristi@scoala-dan-matei.ro',  'Cristian Ilea',   'trainer'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'parinte@example.com',         'Maria Popescu',   'parent')
  ) as t(id, email, full_name, role)
  loop
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data, created_at, updated_at
    ) values (
      ids.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      ids.email, hashed_pw, now(),
      jsonb_build_object('full_name', ids.full_name, 'role', ids.role),
      now(), now()
    ) on conflict (id) do nothing;

    -- Trigger creates the profile automatically; force role + name in case of conflict
    update fotbal.profiles
       set role = ids.role::user_role,
           full_name = ids.full_name
     where id = ids.id;
  end loop;
end $$;

-- Trainers
insert into fotbal.trainers (id, profile_id, bio, position, certifications, age_min, age_max, display_order)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '22222222-2222-2222-2222-222222222222',
   'Fost jucător profesionist la nivel național. Formează grupele mici prin joc, mișcare și încredere.',
   'Antrenor Principal U7–U9',
   '["UEFA C", "Prim ajutor pediatric"]'::jsonb,
   6, 9, 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '33333333-3333-3333-3333-333333333333',
   'Specializat în dezvoltarea tehnicii individuale. A pregătit 12 copii care joacă acum la centre de juniori din Liga 1.',
   'Antrenor U10–U12',
   '["UEFA B", "Antrenor Federal"]'::jsonb,
   10, 12, 2),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '44444444-4444-4444-4444-444444444444',
   'Pune accent pe tactică și citirea jocului. Echipa lui a câștigat Cupa Transilvaniei de două ori consecutiv.',
   'Antrenor U13–U15',
   '["UEFA B", "Pregătire fizică"]'::jsonb,
   13, 15, 3)
on conflict (id) do nothing;

-- Sample children (parent: Maria Popescu)
insert into fotbal.children (id, parent_id, full_name, dob, gender, school, trainer_id, age_group_label)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', '55555555-5555-5555-5555-555555555555',
   'Andrei Popescu', '2017-05-14', 'M', 'Școala 16 Cluj-Napoca',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'U8–U9'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02', '55555555-5555-5555-5555-555555555555',
   'Sofia Popescu', '2014-09-02', 'F', 'Liceul Avram Iancu',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'U10–U11')
on conflict (id) do nothing;

-- Landing content slots (consumed by /cunoaste once Phase 5 wires admin editing)
insert into fotbal.landing_content (slot, payload, updated_by)
values
  ('hero', jsonb_build_object(
     'tagline', 'Academia unde copiii devin fotbaliști — și oameni.',
     'badge', 'Licență UEFA · Din 2017'),
   '11111111-1111-1111-1111-111111111111'),
  ('owner', jsonb_build_object(
     'name', 'Dan Matei',
     'role', 'Fondator & Antrenor Principal',
     'quote', 'Fotbalul nu este doar un joc. Este școala unde copiii învață caracter, disciplină și prietenie pentru o viață.'),
   '11111111-1111-1111-1111-111111111111')
on conflict (slot) do update
  set payload = excluded.payload,
      updated_by = excluded.updated_by,
      updated_at = now();

-- Sample news, schedule and a finished match
insert into fotbal.news (id, author_id, title, body_md, audience, published_at)
values
  ('11111111-2222-3333-4444-555555555501', '11111111-1111-1111-1111-111111111111',
   'Antrenamentele reîncep luni',
   E'Bine ați revenit! Programul rămâne luni–vineri 16:00–19:00.\n\nPrima săptămână este dedicată pregătirii fizice.',
   'public', now() - interval '2 days')
on conflict (id) do nothing;

insert into fotbal.schedule_events (id, trainer_id, kind, title, starts_at, ends_at, location, opponent, notes)
values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
   'training', 'Antrenament U8–U9',
   now() + interval '1 day', now() + interval '1 day 90 minutes',
   'Baza Sportivă Mănăștur', null, 'Antrenament tehnică + joc.'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
   'match', 'Meci amical vs ACS Sănătatea',
   now() + interval '5 days', now() + interval '5 days 90 minutes',
   'Stadion Cetatea', 'ACS Sănătatea', 'Meci amical, joc 7×7.')
on conflict (id) do nothing;
