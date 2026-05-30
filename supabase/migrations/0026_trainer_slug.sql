-- 0026_trainer_slug.sql
-- Adds a text slug to the trainers table so lead routing (lead/create.ts,
-- voice/webhook.ts, lead_notifications) can be driven by the DB rather than
-- hardcoded mappings in application code.
--
-- The slug is the identifier used in fotbal.leads.assigned_trainer_id,
-- fotbal.lead_notifications.recipient_trainer_id, and the
-- TRAINER_PHONE_<SLUG> / TRAINER_WHATSAPP_<SLUG> environment variables.
-- Examples: 't-dan', 't-sopi', 't-kelemen'.
--
-- ACTION REQUIRED after applying this migration to production:
--   Run the following (substituting real trainer UUIDs from fotbal.trainers):
--
--   update fotbal.trainers set slug = 't-dan'     where profile_id = '<dan_uuid>';
--   update fotbal.trainers set slug = 't-sopi'    where profile_id = '<sopi_uuid>';
--   update fotbal.trainers set slug = 't-kelemen' where profile_id = '<kelemen_uuid>';
--
--   Until slugs are set, lead/create.ts falls back to the hardcoded heuristic.

set search_path = fotbal, public;

alter table fotbal.trainers
  add column if not exists slug text unique;

create index if not exists trainers_slug_idx on fotbal.trainers (slug)
  where slug is not null;

-- Helper function: given a child age, return the slug of the active trainer
-- whose [age_min, age_max] band covers that age, ordered by display_order.
-- Returns NULL when no trainer has their slug set yet (falls back to hardcode).
create or replace function fotbal.trainer_slug_for_age(p_age int)
  returns text
  language sql
  stable
  security definer
  set search_path to 'fotbal', 'public'
as $$
  select slug
    from fotbal.trainers
   where active = true
     and slug is not null
     and p_age between age_min and age_max
   order by display_order asc
   limit 1;
$$;

grant execute on function fotbal.trainer_slug_for_age(int) to authenticated, service_role;
revoke execute on function fotbal.trainer_slug_for_age(int) from anon;
