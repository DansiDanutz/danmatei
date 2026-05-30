-- Phase 2a: open match proposals + approval + parent score editing.
-- Applied to production via MCP (migration "match_workflow_approval_and_scoring");
-- kept here for source-control traceability.

do $$ begin
  create type fotbal.event_approval as enum ('proposed','approved','rejected');
exception when duplicate_object then null; end $$;

alter table fotbal.schedule_events
  add column if not exists created_by uuid references fotbal.profiles(id),
  add column if not exists approval_status fotbal.event_approval not null default 'approved',
  add column if not exists accepted_by uuid references fotbal.profiles(id),
  add column if not exists accepted_at timestamptz,
  add column if not exists finalized_at timestamptz;

-- Anyone (owner/trainer/parent) proposes a match for a child's group. Owner &
-- the group's trainer create it already approved; a parent's proposal waits.
create or replace function fotbal.propose_match(
  p_child uuid, p_title text, p_starts_at timestamptz,
  p_location text default null, p_opponent text default null, p_notes text default null
) returns uuid
language plpgsql security definer set search_path to 'fotbal','public' as $function$
declare
  v_uid uuid := auth.uid();
  v_child record;
  v_my_trainer uuid := fotbal.my_trainer_id();
  v_status fotbal.event_approval;
  v_event uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id, parent_id, trainer_id, group_id, full_name into v_child
    from fotbal.children where id = p_child;
  if v_child.id is null then raise exception 'child_not_found'; end if;

  if fotbal.is_owner() then
    v_status := 'approved';
  elsif v_my_trainer is not null and v_child.trainer_id = v_my_trainer then
    v_status := 'approved';
  elsif v_child.parent_id = v_uid then
    v_status := 'proposed';
  else
    raise exception 'not_authorized';
  end if;

  if p_title is null or length(btrim(p_title)) = 0 then raise exception 'title_required'; end if;
  if p_starts_at is null then raise exception 'starts_required'; end if;

  insert into fotbal.schedule_events
    (trainer_id, kind, title, starts_at, location, opponent, notes, created_by, approval_status)
  values
    (v_child.trainer_id, 'match', btrim(p_title), p_starts_at,
     nullif(btrim(p_location), ''), nullif(btrim(p_opponent), ''),
     nullif(btrim(p_notes), ''), v_uid, v_status)
  returning id into v_event;

  insert into fotbal.match_participations (event_id, child_id, role)
  values (v_event, p_child, 'starter')
  on conflict (event_id, child_id) do nothing;

  return v_event;
end $function$;

create or replace function fotbal.accept_match(p_event uuid)
returns void language plpgsql security definer set search_path to 'fotbal','public' as $function$
declare v_ev record; v_my_trainer uuid := fotbal.my_trainer_id();
begin
  select id, trainer_id into v_ev from fotbal.schedule_events
    where id = p_event and kind = 'match';
  if v_ev.id is null then raise exception 'event_not_found'; end if;
  if not (fotbal.is_owner() or (v_my_trainer is not null and v_ev.trainer_id = v_my_trainer)) then
    raise exception 'not_authorized';
  end if;
  update fotbal.schedule_events
     set approval_status = 'approved', accepted_by = auth.uid(), accepted_at = now(), updated_at = now()
   where id = p_event;
end $function$;

create or replace function fotbal.reject_match(p_event uuid)
returns void language plpgsql security definer set search_path to 'fotbal','public' as $function$
declare v_ev record; v_my_trainer uuid := fotbal.my_trainer_id();
begin
  select id, trainer_id into v_ev from fotbal.schedule_events
    where id = p_event and kind = 'match';
  if v_ev.id is null then raise exception 'event_not_found'; end if;
  if not (fotbal.is_owner() or (v_my_trainer is not null and v_ev.trainer_id = v_my_trainer)) then
    raise exception 'not_authorized';
  end if;
  update fotbal.schedule_events
     set approval_status = 'rejected', updated_at = now()
   where id = p_event;
end $function$;

-- Owner / event trainer / a parent with a child in the squad can set the score
-- of an ACTIVE (approved) match. Scorer names are resolved server-side from the
-- squad. First score stamps finalized_at (starts the Phase 2b photo window).
create or replace function fotbal.set_match_score(
  p_event uuid, p_our int, p_opp int, p_scorers jsonb default '[]'::jsonb
) returns void
language plpgsql security definer set search_path to 'fotbal','public' as $function$
declare
  v_uid uuid := auth.uid();
  v_ev record;
  v_my_trainer uuid := fotbal.my_trainer_id();
  v_parent_in_squad boolean;
  v_scorers jsonb;
begin
  select id, trainer_id, approval_status, finalized_at into v_ev
    from fotbal.schedule_events where id = p_event and kind = 'match';
  if v_ev.id is null then raise exception 'event_not_found'; end if;
  if v_ev.approval_status <> 'approved' then raise exception 'match_not_active'; end if;
  if p_our < 0 or p_opp < 0 then raise exception 'invalid_score'; end if;

  select exists(
    select 1 from fotbal.match_participations mp
    join fotbal.children c on c.id = mp.child_id
    where mp.event_id = p_event and c.parent_id = v_uid
  ) into v_parent_in_squad;

  if not (fotbal.is_owner()
          or (v_my_trainer is not null and v_ev.trainer_id = v_my_trainer)
          or v_parent_in_squad) then
    raise exception 'not_authorized';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
            'child_id', c.id, 'name', c.full_name, 'goals', (e->>'goals')::int)), '[]'::jsonb)
    into v_scorers
  from jsonb_array_elements(coalesce(p_scorers, '[]'::jsonb)) e
  join fotbal.children c on c.id = (e->>'child_id')::uuid
  join fotbal.match_participations mp on mp.event_id = p_event and mp.child_id = c.id
  where coalesce((e->>'goals')::int, 0) > 0;

  insert into fotbal.match_results (event_id, our_score, opponent_score, scorers, updated_at)
  values (p_event, p_our, p_opp, v_scorers, now())
  on conflict (event_id) do update
    set our_score = excluded.our_score,
        opponent_score = excluded.opponent_score,
        scorers = excluded.scorers,
        updated_at = now();

  if v_ev.finalized_at is null then
    update fotbal.schedule_events set finalized_at = now(), updated_at = now() where id = p_event;
  end if;
end $function$;

grant execute on function fotbal.propose_match(uuid, text, timestamptz, text, text, text) to authenticated;
grant execute on function fotbal.accept_match(uuid) to authenticated;
grant execute on function fotbal.reject_match(uuid) to authenticated;
grant execute on function fotbal.set_match_score(uuid, int, int, jsonb) to authenticated;
