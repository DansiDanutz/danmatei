-- Close two access gaps left by earlier migrations.
--
-- 1. Payment tables. 0001 set `alter default privileges ... grant select on
--    tables to anon`, so group_fees, child_charges and child_payments (0014,
--    reconciled in 0032) were created with an anon SELECT grant that no
--    migration removed. RLS still filtered rows, but anon should have no
--    access at all. Parents and owners read them as `authenticated`; the cron
--    jobs use the service role.
--
-- 2. Staff RPCs. Postgres grants EXECUTE on new functions to PUBLIC by
--    default, and every role (anon included) inherits PUBLIC. 0024 and 0026
--    revoked EXECUTE from anon only, which left these callable through PUBLIC.
--    enroll_hold, enroll_reject and regenerate_trainings are called by signed-in
--    staff; trainer_slug_for_age is called by api/lead/create.ts with the
--    service role. The explicit grants to authenticated and service_role from
--    0024 and 0026 stay in place.

revoke all on fotbal.group_fees, fotbal.child_charges, fotbal.child_payments from anon;

revoke execute on function fotbal.enroll_hold(uuid) from public, anon;
revoke execute on function fotbal.enroll_reject(uuid) from public, anon;
revoke execute on function fotbal.regenerate_trainings(uuid, int) from public, anon;
revoke execute on function fotbal.trainer_slug_for_age(int) from public, anon;

grant execute on function fotbal.enroll_hold(uuid) to authenticated, service_role;
grant execute on function fotbal.enroll_reject(uuid) to authenticated, service_role;
grant execute on function fotbal.regenerate_trainings(uuid, int) to authenticated, service_role;
grant execute on function fotbal.trainer_slug_for_age(int) to authenticated, service_role;
