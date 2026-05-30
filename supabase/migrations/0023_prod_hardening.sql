-- 0023_prod_hardening.sql
-- Production-readiness hardening surfaced by the 2026-05-30 full audit.
--
-- 1. CRITICAL — close anon/over-broad read access on RLS-bypassing views.
-- 2. CRITICAL — fix enroll_accept's monthly-fee charge insert (it threw at
--    runtime, blocking enrollment acceptance whenever a fee was set).

-- ---------------------------------------------------------------------------
-- 1. Views must respect the querying user's RLS and must never be anon-readable.
--
-- Postgres views default to security_invoker = OFF, so they run with the view
-- OWNER's privileges and BYPASS row-level security on the underlying tables.
-- `v_child_stats` (granted to anon in 0007) and `v_trainer_inbox` (anon via the
-- 0001 blanket `alter default privileges ... to anon`) therefore exposed every
-- minor's stats and all lead PII (parent name/phone, child name/age, AI-call
-- summaries) to unauthenticated / unauthorized callers. Switch both to
-- security_invoker so RLS is enforced against the caller, and revoke anon.
alter view fotbal.v_child_stats set (security_invoker = on);
alter view fotbal.v_trainer_inbox set (security_invoker = on);

revoke select on fotbal.v_child_stats from anon;
revoke select on fotbal.v_trainer_inbox from anon;

-- player_skills holds minors' assessment data; it must never be anon-readable
-- (0007 granted it to anon directly). Legitimate access is parent/staff via RLS.
revoke select on fotbal.player_skills from anon;

-- ---------------------------------------------------------------------------
-- 2. Fix enroll_accept's monthly-fee charge insert.
--
-- The insert in 0021 omitted the NOT NULL `kind` column, wrote a date into the
-- `int` `period_month` column, and used `on conflict (child_id, period_month)`
-- which matches no constraint (the real one is
-- (child_id, kind, period_year, period_month)). Any of these throws, so
-- accepting a child into a group FAILED for every academy with a monthly fee.
-- This mirrors the canonical insert in api/cron/generate-monthly-charges.ts
-- (kind='monthly_fee', integer period_year/period_month, due_date = the 15th).
-- Signature unchanged: enroll_accept(p_child, p_group, p_trainer).
create or replace function fotbal.enroll_accept(p_child uuid, p_group uuid, p_trainer uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'fotbal', 'public'
as $function$
declare
  v_fee numeric;
  v_parent uuid;
  v_child_name text;
  v_group_label text;
begin
  if not (fotbal.is_owner() or (p_trainer is not null and p_trainer = fotbal.my_trainer_id())) then
    raise exception 'not_authorized';
  end if;

  update fotbal.children
     set trainer_id = p_trainer, group_id = p_group, assignment_status = 'accepted', updated_at = now()
   where id = p_child
   returning parent_id, full_name into v_parent, v_child_name;

  select monthly_fee_ron into v_fee from fotbal.academy_settings where id = true;
  if coalesce(v_fee, 0) > 0 then
    insert into fotbal.child_charges
      (child_id, kind, amount_ron, period_year, period_month, due_date, created_by)
    values (
      p_child,
      'monthly_fee',
      v_fee,
      extract(year from now())::int,
      extract(month from now())::int,
      (date_trunc('month', now()) + interval '14 days')::date,
      auth.uid()
    )
    on conflict (child_id, kind, period_year, period_month) do nothing;
  end if;

  if v_parent is not null then
    select label into v_group_label from fotbal.groups where id = p_group;
    insert into fotbal.notifications (recipient_id, kind, title, body, link)
    values (
      v_parent,
      'enrollment_accepted',
      'Copil acceptat în grupă',
      coalesce(v_child_name, 'Copilul tău') || ' a fost înscris'
        || coalesce(' în grupa ' || v_group_label, '')
        || case when coalesce(v_fee, 0) > 0
                then '. Taxa lunară: ' || v_fee || ' RON.'
                else '.' end,
      '/dashboard'
    );
  end if;
end $function$;
