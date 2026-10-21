-- 0031 — public trainer names (2026-10 audit).
--
-- Public pages (/grupe, /campionat, /turnee) and parents embed
-- `trainers → profiles(full_name)`, but profiles RLS only allows self/owner,
-- so every visitor saw the placeholder "Antrenor" instead of the coach's name.
-- Opening profiles rows would also expose trainers' personal phone numbers, so
-- expose just (trainer id, name) for active trainers instead.

create or replace function fotbal.public_trainer_names()
  returns table (trainer_id uuid, full_name text)
  language sql
  stable
  security definer
  set search_path = fotbal, public
as $$
  select t.id, p.full_name
    from fotbal.trainers t
    join fotbal.profiles p on p.id = t.profile_id
   where t.active;
$$;

revoke all on function fotbal.public_trainer_names() from public;
grant execute on function fotbal.public_trainer_names() to anon, authenticated;
