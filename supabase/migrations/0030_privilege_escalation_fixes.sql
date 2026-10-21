-- 0030 — close self-service privilege escalation paths (2026-10 audit).
--
-- 1. handle_new_user copied `role` from raw_user_meta_data, which the browser
--    controls on supabase.auth.signUp(). Anyone could register as owner or
--    super_admin. Every self-signup is now a parent; elevated roles are set
--    server-side only (api/trainers.ts upserts role='trainer' with the service
--    role, which tg_profiles_lock_role allows because auth.uid() is null).
--
-- 2. Parents could insert/update their own child row with any trainer_id,
--    group_id, assignment_status or status — skipping enrollment acceptance,
--    joining any group's schedule/messages/match media, or reactivating a
--    child closed for unpaid fees. Placement columns are now owned by
--    owner/trainer/server code. A parent may still pick a preferred trainer at
--    signup (InregistrareCopil), which stays 'pending' until accepted.
--
-- 3. Trainers could change their own slug/active/profile_id/display_order via
--    "trainers self update" (e.g. take over another trainer's slug-scoped lead
--    notifications, or reactivate themselves). Age range stays self-editable —
--    the trainer profile form in Antrenor.tsx edits it on purpose.
--
-- 4. "media insert" only checked uploader_id, so any account could attach rows
--    to any match (event_id) or child, or point storage_path at someone else's
--    file and have /api/match/photos sign it. Direct inserts are now limited
--    to the uploader's own folder and visible children; match media keeps
--    going through the add_match_photo RPC (security definer).

-- 1 ---------------------------------------------------------------------------
create or replace function fotbal.handle_new_user() returns trigger
language plpgsql security definer set search_path = fotbal, public as $$
begin
  if (new.raw_user_meta_data->>'app') is distinct from 'fotbal' then
    return new;  -- not our user
  end if;
  insert into fotbal.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'parent'::fotbal.user_role
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- 2 ---------------------------------------------------------------------------
create or replace function fotbal.tg_children_lock_placement() returns trigger
language plpgsql security definer set search_path = fotbal, public as $$
begin
  -- Service role (auth.uid() null), owners and trainers manage placement.
  if auth.uid() is null or fotbal.is_owner() or fotbal.my_trainer_id() is not null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.group_id := null;
    new.assignment_status := 'pending'::fotbal.assignment_status;
    new.status := 'active'::fotbal.child_status;
  else
    new.parent_id := old.parent_id;
    new.trainer_id := old.trainer_id;
    new.group_id := old.group_id;
    new.assignment_status := old.assignment_status;
    new.status := old.status;
  end if;
  return new;
end $$;

drop trigger if exists children_lock_placement on fotbal.children;
create trigger children_lock_placement
  before insert or update on fotbal.children
  for each row execute function fotbal.tg_children_lock_placement();

-- 3 ---------------------------------------------------------------------------
create or replace function fotbal.tg_trainers_lock_scope() returns trigger
language plpgsql security definer set search_path = fotbal, public as $$
begin
  if auth.uid() is not null and not fotbal.is_owner() then
    new.profile_id := old.profile_id;
    new.slug := old.slug;
    new.active := old.active;
    new.display_order := old.display_order;
  end if;
  return new;
end $$;

drop trigger if exists trainers_lock_scope on fotbal.trainers;
create trigger trainers_lock_scope
  before update on fotbal.trainers
  for each row execute function fotbal.tg_trainers_lock_scope();

-- 4 ---------------------------------------------------------------------------
drop policy if exists "media insert" on fotbal.media;
create policy "media insert" on fotbal.media
  for insert with check (
    uploader_id = auth.uid()
    and (
      fotbal.is_owner()
      or (
        event_id is null
        and group_id is null
        and position(auth.uid()::text || '/' in storage_path) = 1
        and (
          child_id is null
          or exists (select 1 from fotbal.children c where c.id = child_id)
        )
      )
    )
  );
