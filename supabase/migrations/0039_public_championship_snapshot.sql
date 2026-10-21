-- 0039 — /campionat reads one consistent snapshot (review of #152).
--
-- 0038's public_championship() returned rows that the page read in
-- offset pages. If a match was approved or cancelled between two page
-- requests, the offsets shifted, so a match could be counted twice or
-- skipped and the per-group totals were wrong with no error. Return the
-- whole history as a single JSON array instead: one statement, one
-- snapshot, and PostgREST's max-rows cap doesn't apply to a single value.
-- Same rows and order as 0038 (each match with its score; match_results
-- .event_id is unique).

drop function if exists fotbal.public_championship();
create function fotbal.public_championship()
  returns json
  language sql
  stable
  security definer
  set search_path = fotbal, public
as $$
  select coalesce(
    json_agg(m order by m.starts_at desc, m.id),
    '[]'::json
  )
  from (
    select e.id, e.trainer_id, e.title, e.starts_at, e.location, e.opponent,
           r.our_score, r.opponent_score, r.recap_md
      from fotbal.schedule_events e
      left join fotbal.match_results r on r.event_id = e.id
     where e.kind = 'match'
       and e.approval_status = 'approved'
       and e.cancelled_at is null
  ) m;
$$;

revoke all on function fotbal.public_championship() from public;
grant execute on function fotbal.public_championship() to anon, authenticated;
