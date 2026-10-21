-- 0038 — complete match history for /campionat (review of #152).
--
-- /campionat stitched public_schedule (earliest 200 rows by start time) and
-- public_match_results (newest 500 by entry time) together on the client.
-- Past those caps the newest matches vanished, scores went missing (shown as
-- "Programat" and left out of the totals), and a failed score request looked
-- the same as no scores. Return every approved, non-cancelled match with its
-- score in one read instead. There's no row cap here: the page reads it in
-- pages (PostgREST's max-rows still applies per request) until it has all
-- rows, so per-group totals are computed from complete data. Each match has
-- at most one result (match_results.event_id is unique).

create or replace function fotbal.public_championship()
  returns table (
    id uuid,
    trainer_id uuid,
    title text,
    starts_at timestamptz,
    location text,
    opponent text,
    our_score int,
    opponent_score int,
    recap_md text
  )
  language sql
  stable
  security definer
  set search_path = fotbal, public
as $$
  select e.id, e.trainer_id, e.title, e.starts_at, e.location, e.opponent,
         r.our_score, r.opponent_score, r.recap_md
    from fotbal.schedule_events e
    left join fotbal.match_results r on r.event_id = e.id
   where e.kind = 'match'
     and e.approval_status = 'approved'
     and e.cancelled_at is null
   order by e.starts_at desc, e.id;
$$;

revoke all on function fotbal.public_championship() from public;
grant execute on function fotbal.public_championship() to anon, authenticated;
