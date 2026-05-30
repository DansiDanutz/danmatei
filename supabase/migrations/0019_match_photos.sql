-- Phase 2b: 24h post-match photo upload window + per-group archive.
-- Applied to production via MCP (migrations "match_photos_24h_window",
-- "add_match_photo_bytes", "add_match_photo_null_guard_fix"); consolidated here
-- to the final state for source-control traceability.

alter table fotbal.media
  add column if not exists event_id uuid references fotbal.schedule_events(id) on delete cascade,
  add column if not exists group_id uuid references fotbal.groups(id) on delete set null;

create index if not exists media_event_idx on fotbal.media (event_id);
create index if not exists media_group_idx on fotbal.media (group_id);

-- Group members (owner / event trainer / a parent with a child in the group) can
-- attach photos to a finalised match, but only within 24h of the final score.
-- The path must live under the caller's own storage folder (matches storage RLS).
--
-- NOTE: the trainer branch guards on my_trainer_id() (nullable), NOT on the
-- event's trainer_id — otherwise `trainer_id = NULL` makes the OR-chain evaluate
-- to NULL, which `IF NOT (...)` treats as false and would let a non-member in.
create or replace function fotbal.add_match_photo(
  p_event uuid, p_path text, p_mime text, p_bytes bigint default 0
) returns uuid
language plpgsql security definer set search_path to 'fotbal','public' as $function$
declare
  v_uid uuid := auth.uid();
  v_my_trainer uuid := fotbal.my_trainer_id();
  v_ev record;
  v_group uuid;
  v_is_parent boolean;
  v_media uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_path is null or position(v_uid::text || '/' in p_path) <> 1 then
    raise exception 'invalid_path';
  end if;

  select id, trainer_id, approval_status, finalized_at into v_ev
    from fotbal.schedule_events where id = p_event and kind = 'match';
  if v_ev.id is null then raise exception 'event_not_found'; end if;
  if v_ev.approval_status <> 'approved' or v_ev.finalized_at is null then
    raise exception 'match_not_finalized';
  end if;
  if now() > v_ev.finalized_at + interval '24 hours' then
    raise exception 'window_closed';
  end if;

  select exists(
    select 1 from fotbal.children c
    where c.parent_id = v_uid and c.trainer_id = v_ev.trainer_id
  ) into v_is_parent;

  if not (fotbal.is_owner()
          or (v_my_trainer is not null and v_ev.trainer_id = v_my_trainer)
          or v_is_parent) then
    raise exception 'not_authorized';
  end if;

  select id into v_group from fotbal.groups
    where trainer_id = v_ev.trainer_id order by active desc limit 1;

  insert into fotbal.media (uploader_id, child_id, kind, storage_path, mime, bytes, event_id, group_id)
  values (v_uid, null, 'image', p_path, p_mime, greatest(coalesce(p_bytes, 0), 0), p_event, v_group)
  returning id into v_media;
  return v_media;
end $function$;

grant execute on function fotbal.add_match_photo(uuid, text, text, bigint) to authenticated;
