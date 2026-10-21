-- 0035 — public reads for /program, /turnee and /rezultate (2026-10 audit).
--
-- schedule_events is readable only by owners, trainers and parents linked to
-- the trainer, and match_results inherits that through its policy. The public
-- pages queried those tables directly, so visitors always got zero rows and
-- an honest empty state ("nothing scheduled") was shown even when events
-- existed. Opening the tables to anon would also expose notes, fees,
-- cancellation reasons and workflow columns, so expose only what the pages
-- display, for approved, non-cancelled events.

create or replace function fotbal.public_schedule(p_from timestamptz, p_to timestamptz)
  returns table (
    id uuid,
    kind fotbal.schedule_kind,
    title text,
    starts_at timestamptz,
    ends_at timestamptz,
    location text,
    opponent text
  )
  language sql
  stable
  security definer
  set search_path = fotbal, public
as $$
  select e.id, e.kind, e.title, e.starts_at, e.ends_at, e.location, e.opponent
    from fotbal.schedule_events e
   where e.approval_status = 'approved'
     and e.cancelled_at is null
     and e.starts_at >= p_from
     and e.starts_at <= p_to
   order by e.starts_at
   limit 200;
$$;

create or replace function fotbal.public_tournaments()
  returns table (
    id uuid,
    title text,
    starts_at timestamptz,
    ends_at timestamptz,
    location text,
    notes text,
    trainer_id uuid,
    age_min int,
    age_max int,
    trainer_name text
  )
  language sql
  stable
  security definer
  set search_path = fotbal, public
as $$
  select e.id, e.title, e.starts_at, e.ends_at, e.location, e.notes,
         t.id, t.age_min, t.age_max, case when t.active then p.full_name end
    from fotbal.schedule_events e
    left join fotbal.trainers t on t.id = e.trainer_id
    left join fotbal.profiles p on p.id = t.profile_id
   where e.kind = 'tournament'
     and e.approval_status = 'approved'
     and e.cancelled_at is null
   order by e.starts_at desc
   limit 200;
$$;

create or replace function fotbal.public_match_results(p_limit int default 40)
  returns table (
    id uuid,
    our_score int,
    opponent_score int,
    recap_md text,
    title text,
    starts_at timestamptz,
    location text,
    opponent text
  )
  language sql
  stable
  security definer
  set search_path = fotbal, public
as $$
  select r.id, r.our_score, r.opponent_score, r.recap_md,
         e.title, e.starts_at, e.location, e.opponent
    from fotbal.match_results r
    join fotbal.schedule_events e on e.id = r.event_id
   where e.approval_status = 'approved'
     and e.cancelled_at is null
   order by r.created_at desc
   limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke all on function fotbal.public_schedule(timestamptz, timestamptz) from public;
revoke all on function fotbal.public_tournaments() from public;
revoke all on function fotbal.public_match_results(int) from public;
grant execute on function fotbal.public_schedule(timestamptz, timestamptz) to anon, authenticated;
grant execute on function fotbal.public_tournaments() to anon, authenticated;
grant execute on function fotbal.public_match_results(int) to anon, authenticated;
