-- Role grants on the payment tables and staff RPCs (migration 0040).
-- Run with `supabase test db`.
--
-- anon must not read the payment tables, and must not be able to call the
-- staff RPCs through the default PUBLIC execute grant. Signed-in users and
-- the service role keep their access.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select ok(not has_table_privilege('anon', 'fotbal.group_fees', 'select'), 'anon cannot select group_fees');
select ok(not has_table_privilege('anon', 'fotbal.child_charges', 'select'), 'anon cannot select child_charges');
select ok(not has_table_privilege('anon', 'fotbal.child_payments', 'select'), 'anon cannot select child_payments');
select ok(has_table_privilege('authenticated', 'fotbal.child_charges', 'select'), 'authenticated can still select child_charges');
select ok(has_table_privilege('service_role', 'fotbal.child_payments', 'insert'), 'service_role can still insert child_payments');

select ok(not has_function_privilege('anon', 'fotbal.enroll_hold(uuid)', 'execute'), 'anon cannot execute enroll_hold');
select ok(not has_function_privilege('anon', 'fotbal.enroll_reject(uuid)', 'execute'), 'anon cannot execute enroll_reject');
select ok(not has_function_privilege('anon', 'fotbal.regenerate_trainings(uuid, int)', 'execute'), 'anon cannot execute regenerate_trainings');
select ok(not has_function_privilege('anon', 'fotbal.trainer_slug_for_age(int)', 'execute'), 'anon cannot execute trainer_slug_for_age');

select ok(has_function_privilege('authenticated', 'fotbal.enroll_hold(uuid)', 'execute'), 'authenticated can execute enroll_hold');
select ok(has_function_privilege('authenticated', 'fotbal.enroll_reject(uuid)', 'execute'), 'authenticated can execute enroll_reject');
select ok(has_function_privilege('authenticated', 'fotbal.regenerate_trainings(uuid, int)', 'execute'), 'authenticated can execute regenerate_trainings');
select ok(has_function_privilege('service_role', 'fotbal.trainer_slug_for_age(int)', 'execute'), 'service_role can execute trainer_slug_for_age');

-- Visitor pages still work: the public read functions stay callable by anon.
select ok(has_function_privilege('anon', 'fotbal.public_championship()', 'execute'), 'anon can still execute public_championship');

select * from finish();
rollback;
