-- 0021_notify_security_fixes.sql
-- Three correctness/security fixes surfaced by the full-flow audit.

-- ---------------------------------------------------------------------------
-- 1. SECURITY: stop self-role-escalation on fotbal.profiles.
--
-- The "profiles update self" RLS policy only checks (id = auth.uid()) in its
-- WITH CHECK — it does NOT constrain `role`. So any authenticated parent could
-- PATCH /rest/v1/profiles?id=eq.<self> with {"role":"owner"} and promote
-- themselves to owner (is_owner() -> full admin). RLS WITH CHECK can't see the
-- OLD row, so we enforce role immutability with a BEFORE UPDATE trigger.
--
-- Allowed to change a role:
--   * the service role / trusted server context (auth.uid() is null) — e.g. the
--     trainer-invite endpoint provisioning role='trainer';
--   * academy owners / super_admins (is_owner()).
-- Everyone else editing their own profile keeps their existing role silently.
create or replace function fotbal.tg_profiles_lock_role()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'fotbal', 'public'
as $function$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not fotbal.is_owner() then
    new.role := old.role;
  end if;
  return new;
end $function$;

drop trigger if exists profiles_lock_role on fotbal.profiles;
create trigger profiles_lock_role
  before update on fotbal.profiles
  for each row execute function fotbal.tg_profiles_lock_role();

-- ---------------------------------------------------------------------------
-- 2. NOTIFICATIONS: drop the buggy auto match-scheduled notification.
--
-- tg_notify_match_scheduled fired AFTER INSERT on EVERY schedule_events match,
-- ignoring approval_status and notifying the trainer's WHOLE active group. That
-- meant (a) parent-proposed matches (approval_status='proposed') notified the
-- whole group before any trainer approved them, and (b) trainer-created matches
-- were notified twice — once here (whole group) and once by the explicit,
-- squad-scoped /api/schedule/notify ("Notifică echipa") the trainer clicks after
-- building the squad. The explicit API path is the intended mechanism (squad
-- recipients + Web Push + group_notified_at), so this trigger is pure breakage.
drop trigger if exists notify_match_scheduled on fotbal.schedule_events;
drop function if exists fotbal.tg_notify_match_scheduled();

-- ---------------------------------------------------------------------------
-- 3. NOTIFICATIONS: tell the parent when their child is accepted into a group.
--
-- enroll_accept assigned the child + created the monthly charge but never
-- notified the parent. Add an in-app notification (notifications.kind is text,
-- so 'enrollment_accepted' is fine). Signature is unchanged — the client calls
-- enroll_accept(p_child, p_group, p_trainer).
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
    insert into fotbal.child_charges (child_id, amount_ron, period_month, created_by)
    values (p_child, v_fee, date_trunc('month', now())::date, auth.uid())
    on conflict (child_id, period_month) do nothing;
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
