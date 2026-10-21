-- 0037 — public_tournaments() must not publish trainer notes (review of #150).
--
-- 0035's public_tournaments() returned schedule_events.notes to anonymous
-- visitors. Trainers write those notes in the private schedule form, and the
-- table's read rules limit them to trainers, owners and linked parents;
-- approving an event doesn't make its notes public. Recreate the function
-- without notes. (Production had no tournaments when this shipped, so nothing
-- was exposed.)

drop function if exists fotbal.public_tournaments();
create function fotbal.public_tournaments()
  returns table (
    id uuid,
    title text,
    starts_at timestamptz,
    ends_at timestamptz,
    location text,
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
  select e.id, e.title, e.starts_at, e.ends_at, e.location,
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

revoke all on function fotbal.public_tournaments() from public;
grant execute on function fotbal.public_tournaments() to anon, authenticated;
