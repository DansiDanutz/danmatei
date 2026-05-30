-- 0029_lead_realtime_rls.sql
-- Fix dead RLS policies on the leads inbox tables.
--
-- Context:
--   Migration 0006 wrote all three lead-inbox policies with:
--     auth.jwt() ->> 'trainer_id' = recipient_trainer_id
--   (or  assigned_trainer_id / cc_trainer_ids)
--
--   Supabase does NOT inject a custom `trainer_id` claim into JWTs by default.
--   Every policy check therefore evaluates to NULL = text, which is always
--   false, so:
--     * Supabase Realtime delivers no rows to trainer clients (channel
--       always shows "error" state in the UI).
--     * Direct PostgREST reads from the client also return nothing.
--   The inbox only works because every API read goes through the service-role
--   helpers (api/lead/list.ts, etc.) which bypass RLS entirely.
--
-- Fix:
--   Replace the dead JWT-claim checks with a profile-UUID → trainers.slug
--   lookup that works with the standard Supabase JWT (which only contains
--   auth.uid() = profile UUID). This requires:
--     1. Migration 0026 to have been applied (adds trainers.slug column).
--     2. Trainer slugs to have been seeded in prod (see 0026 ACTION REQUIRED).
--
--   Until both prerequisites are met, the policies fall back to service_role
--   only (same as today, no regression). Trainers using the app will gain
--   working realtime as soon as slugs are seeded.
--
-- Depends on: 0026_trainer_slug.sql (trainers.slug column)

set search_path = fotbal, public;

-- ---------------------------------------------------------------------------
-- 1. lead_notifications — SELECT and UPDATE
-- ---------------------------------------------------------------------------
drop policy if exists "trainer reads own notifications" on fotbal.lead_notifications;
create policy "trainer reads own notifications" on fotbal.lead_notifications
  for select using (
    -- Owner / super_admin sees every notification.
    fotbal.is_owner()
    or
    -- Trainer sees notifications addressed to their slug (from trainers.slug).
    exists (
      select 1
        from fotbal.trainers t
       where t.profile_id = auth.uid()
         and t.active = true
         and t.slug = recipient_trainer_id
    )
  );

drop policy if exists "trainer marks own notifications read" on fotbal.lead_notifications;
create policy "trainer marks own notifications read" on fotbal.lead_notifications
  for update
  using (
    exists (
      select 1
        from fotbal.trainers t
       where t.profile_id = auth.uid()
         and t.active = true
         and t.slug = recipient_trainer_id
    )
  )
  with check (
    exists (
      select 1
        from fotbal.trainers t
       where t.profile_id = auth.uid()
         and t.active = true
         and t.slug = recipient_trainer_id
    )
  );

-- ---------------------------------------------------------------------------
-- 2. leads — SELECT
-- ---------------------------------------------------------------------------
drop policy if exists "trainer reads own + cc leads" on fotbal.leads;
create policy "trainer reads own + cc leads" on fotbal.leads
  for select using (
    fotbal.is_owner()
    or exists (
      select 1
        from fotbal.trainers t
       where t.profile_id = auth.uid()
         and t.active = true
         and (
           t.slug = assigned_trainer_id
           or t.slug = any(cc_trainer_ids)
         )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. lead_calls — SELECT
-- ---------------------------------------------------------------------------
drop policy if exists "trainer reads calls of own leads" on fotbal.lead_calls;
create policy "trainer reads calls of own leads" on fotbal.lead_calls
  for select using (
    fotbal.is_owner()
    or exists (
      select 1
        from fotbal.leads l
        join fotbal.trainers t on t.profile_id = auth.uid()
         and t.active = true
         and (t.slug = l.assigned_trainer_id or t.slug = any(l.cc_trainer_ids))
       where l.id = lead_id
    )
  );
