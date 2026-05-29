-- =============================================================================
-- Audit hardening — realtime publication, hot-path indexes, missing storage
-- policies, and dead-policy cleanup. Idempotent so it can be re-applied.
-- =============================================================================
-- 1. Add notifications + lead_notifications to supabase_realtime so the
--    NotificationBell and useLeadRealtime client subscriptions actually fire.
-- 2. Btree index on leads.parent_phone_e164 — /api/voice/start counts repeat
--    callers on every voice call and was doing a seq scan.
-- 3. GIN index on leads.cc_trainer_ids — /api/lead/list filters with @>
--    containment on this array column.
-- 4. Storage DELETE policy on fotbal-media-private so uploaders (and owner)
--    can remove their own files; previously only INSERT/SELECT existed.
-- 5. Storage UPDATE policy on fotbal-news-public so the owner can overwrite
--    news covers in place instead of delete-then-reinsert.
-- 6. Drop the dead 'children parent read|update' policies from 0001 — the
--    broader 'children read|update' in 0003 supersede them; they're additive
--    OR clauses so the table works either way, but dead surface area is dead.

-- 1. Realtime publication ----------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table fotbal.notifications, fotbal.lead_notifications;
exception
  when duplicate_object then null;
end $$;

-- 2. Repeat-caller lookup index ---------------------------------------------
create index if not exists leads_phone_e164_idx
  on fotbal.leads (parent_phone_e164);

-- 3. Trainer-containment index ----------------------------------------------
create index if not exists leads_cc_trainer_ids_idx
  on fotbal.leads using gin (cc_trainer_ids);

-- 4. Private media: uploader DELETE -----------------------------------------
drop policy if exists "media private delete" on storage.objects;
create policy "media private delete" on storage.objects
  for delete using (
    bucket_id = 'fotbal-media-private'
    and (auth.uid()::text = (storage.foldername(name))[1] or fotbal.is_owner())
  );

-- 5. Public news: owner UPDATE ----------------------------------------------
drop policy if exists "news public update" on storage.objects;
create policy "news public update" on storage.objects
  for update using (
    bucket_id = 'fotbal-news-public' and fotbal.is_owner()
  ) with check (
    bucket_id = 'fotbal-news-public' and fotbal.is_owner()
  );

-- 6. Drop superseded children policies --------------------------------------
drop policy if exists "children parent read" on fotbal.children;
drop policy if exists "children parent update" on fotbal.children;
