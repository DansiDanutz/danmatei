-- 0036 — group-aware public reads for /campionat (2026-10 audit).
--
-- /campionat groups matches by trainer and attaches each match's score, but
-- read schedule_events / match_results directly, which visitors can't do
-- (RLS), so every group showed "0 meciuri". The 0035 functions don't return
-- trainer_id (public_schedule) or event_id (public_match_results), so they
-- couldn't be grouped or joined. Recreate both with those columns, and let
-- public_schedule filter by kind so matches aren't crowded out of its row
-- cap by trainings. Existing callers keep working: the new columns are
-- additive and p_kind defaults to every kind.
--
-- Self-contained (drop + create) so it applies with or without 0035 first.

drop function if exists fotbal.public_schedule(timestamptz, timestamptz);
drop function if exists fotbal.public_schedule(timestamptz, timestamptz, fotbal.schedule_kind);
create function fotbal.public_schedule(
    p_from timestamptz,
    p_to timestamptz,
    p_kind fotbal.schedule_kind default null
  )
  returns table (
    id uuid,
    kind fotbal.schedule_kind,
    title text,
    starts_at timestamptz,
    ends_at timestamptz,
    location text,
    opponent text,
    trainer_id uuid
  )
  language sql
  stable
  security definer
  set search_path = fotbal, public
as $$
  select e.id, e.kind, e.title, e.starts_at, e.ends_at, e.location, e.opponent,
         e.trainer_id
    from fotbal.schedule_events e
   where e.approval_status = 'approved'
     and e.cancelled_at is null
     and e.starts_at >= p_from
     and e.starts_at <= p_to
     and (p_kind is null or e.kind = p_kind)
   order by e.starts_at
   limit 200;
$$;

drop function if exists fotbal.public_match_results(int);
create function fotbal.public_match_results(p_limit int default 40)
  returns table (
    id uuid,
    our_score int,
    opponent_score int,
    recap_md text,
    title text,
    starts_at timestamptz,
    location text,
    opponent text,
    event_id uuid
  )
  language sql
  stable
  security definer
  set search_path = fotbal, public
as $$
  select r.id, r.our_score, r.opponent_score, r.recap_md,
         e.title, e.starts_at, e.location, e.opponent, e.id
    from fotbal.match_results r
    join fotbal.schedule_events e on e.id = r.event_id
   where e.approval_status = 'approved'
     and e.cancelled_at is null
   order by r.created_at desc
   -- /campionat needs every group's results, so allow up to 500.
   limit least(greatest(coalesce(p_limit, 40), 1), 500);
$$;

revoke all on function fotbal.public_schedule(timestamptz, timestamptz, fotbal.schedule_kind) from public;
revoke all on function fotbal.public_match_results(int) from public;
grant execute on function fotbal.public_schedule(timestamptz, timestamptz, fotbal.schedule_kind) to anon, authenticated;
grant execute on function fotbal.public_match_results(int) to anon, authenticated;
