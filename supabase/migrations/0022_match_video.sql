-- Phase 2b follow-up: allow short video clips (not just photos) in the 24h
-- post-match media window. The fotbal.media_kind enum already carries 'video';
-- this just stops add_match_photo from hardcoding 'image'.
--
-- Applied to production via MCP (migration "match_video_support"); consolidated
-- here to the final state for source-control traceability.
--
-- The old 4-argument signature is dropped first: keeping both the 4-arg and the
-- new 5-arg overload would make PostgREST raise PGRST203 (ambiguous overload)
-- when the client posts only the original four named params.

drop function if exists fotbal.add_match_photo(uuid, text, text, bigint);

-- Group members (owner / event trainer / a parent with a child in the group) can
-- attach photos OR short videos to a finalised match, but only within 24h of the
-- final score. The path must live under the caller's own storage folder.
--
-- NOTE: the trainer branch guards on my_trainer_id() (nullable), NOT on the
-- event's trainer_id — otherwise `trainer_id = NULL` makes the OR-chain evaluate
-- to NULL, which `IF NOT (...)` treats as false and would let a non-member in.
create or replace function fotbal.add_match_photo(
  p_event uuid,
  p_path text,
  p_mime text,
  p_bytes bigint default 0,
  p_kind text default 'image'
) returns uuid
language plpgsql security definer set search_path to 'fotbal','public' as $function$
declare
  v_uid uuid := auth.uid();
  v_my_trainer uuid := fotbal.my_trainer_id();
  v_ev record;
  v_group uuid;
  v_is_parent boolean;
  v_media uuid;
  v_kind text := coalesce(p_kind, 'image');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_kind not in ('image', 'video') then raise exception 'invalid_kind'; end if;
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
  values (v_uid, null, v_kind::fotbal.media_kind, p_path, p_mime, greatest(coalesce(p_bytes, 0), 0), p_event, v_group)
  returning id into v_media;
  return v_media;
end $function$;

grant execute on function fotbal.add_match_photo(uuid, text, text, bigint, text) to authenticated;
