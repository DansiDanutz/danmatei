-- 0024_admin_scheduler_contracts.sql
-- Source-control contracts for admin enrollment settings and trainer recurring
-- schedule templates. These are referenced by the React app and must exist in a
-- fresh production database, not only in the current live Supabase project.

set search_path = fotbal, public;

-- ---------------------------------------------------------------------------
-- Academy-wide fee setting used by Admin -> Grupe and enroll_accept.
create table if not exists fotbal.academy_settings (
  id boolean primary key default true check (id),
  monthly_fee_ron numeric(10, 2) not null default 0 check (monthly_fee_ron >= 0),
  updated_by uuid references fotbal.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into fotbal.academy_settings (id, monthly_fee_ron)
values (true, 0)
on conflict (id) do nothing;

drop trigger if exists set_updated_at on fotbal.academy_settings;
create trigger set_updated_at
  before update on fotbal.academy_settings
  for each row execute function fotbal.tg_set_updated_at();

alter table fotbal.academy_settings enable row level security;

drop policy if exists "academy_settings owner read" on fotbal.academy_settings;
create policy "academy_settings owner read" on fotbal.academy_settings
  for select using (fotbal.is_owner());

drop policy if exists "academy_settings owner update" on fotbal.academy_settings;
create policy "academy_settings owner update" on fotbal.academy_settings
  for update using (fotbal.is_owner()) with check (fotbal.is_owner());

grant select, update on fotbal.academy_settings to authenticated, service_role;
revoke all on fotbal.academy_settings from anon;

-- ---------------------------------------------------------------------------
-- Recurring trainer templates used by WeeklyScheduleEditor.
create table if not exists fotbal.training_templates (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references fotbal.trainers(id) on delete cascade,
  weekday int not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time,
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_templates_end_after_start
    check (end_time is null or end_time > start_time)
);

create index if not exists training_templates_trainer_idx
  on fotbal.training_templates (trainer_id, weekday, start_time);

drop trigger if exists set_updated_at on fotbal.training_templates;
create trigger set_updated_at
  before update on fotbal.training_templates
  for each row execute function fotbal.tg_set_updated_at();

alter table fotbal.training_templates enable row level security;

drop policy if exists "training_templates trainer read" on fotbal.training_templates;
create policy "training_templates trainer read" on fotbal.training_templates
  for select using (
    fotbal.is_owner()
    or trainer_id = fotbal.my_trainer_id()
  );

drop policy if exists "training_templates trainer write" on fotbal.training_templates;
create policy "training_templates trainer write" on fotbal.training_templates
  for all using (
    fotbal.is_owner()
    or trainer_id = fotbal.my_trainer_id()
  ) with check (
    fotbal.is_owner()
    or trainer_id = fotbal.my_trainer_id()
  );

grant select, insert, update, delete on fotbal.training_templates
  to authenticated, service_role;
revoke all on fotbal.training_templates from anon;

alter table fotbal.schedule_events
  add column if not exists call_time timestamptz,
  add column if not exists fee_ron numeric(10, 2) check (fee_ron is null or fee_ron >= 0),
  add column if not exists group_notified_at timestamptz,
  add column if not exists training_template_id uuid
    references fotbal.training_templates(id) on delete set null;

create index if not exists schedule_events_training_template_idx
  on fotbal.schedule_events (training_template_id, starts_at);

create index if not exists schedule_events_group_notified_idx
  on fotbal.schedule_events (group_notified_at)
  where group_notified_at is not null;

-- ---------------------------------------------------------------------------
-- Enrollment queue RPCs used by Admin -> Grupe and Antrenor -> Atribuiri.
create or replace function fotbal.enroll_hold(p_child uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'fotbal', 'public'
as $function$
declare
  v_parent uuid;
  v_child_name text;
begin
  if not fotbal.is_owner() then
    raise exception 'not_authorized';
  end if;

  update fotbal.children
     set trainer_id = null,
         group_id = null,
         assignment_status = 'on_hold',
         updated_at = now()
   where id = p_child
     and assignment_status in ('pending', 'on_hold')
   returning parent_id, full_name
        into v_parent, v_child_name;

  if not found then
    raise exception 'child_not_found_or_not_pending';
  end if;

  if v_parent is not null then
    insert into fotbal.notifications (recipient_id, kind, title, body, link)
    values (
      v_parent,
      'enrollment_on_hold',
      'Înscriere în așteptare',
      coalesce(v_child_name, 'Copilul tău') || ' este pe lista de așteptare. Revenim cu detalii.',
      '/dashboard'
    );
  end if;
end $function$;

create or replace function fotbal.enroll_reject(p_child uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'fotbal', 'public'
as $function$
declare
  v_parent uuid;
  v_child_name text;
  v_status fotbal.assignment_status;
  v_my_trainer uuid := fotbal.my_trainer_id();
  v_birth_year int;
  v_authorized boolean;
begin
  select c.parent_id, c.full_name, c.assignment_status, extract(year from c.dob)::int
    into v_parent, v_child_name, v_status, v_birth_year
    from fotbal.children c
   where c.id = p_child;

  if not found then
    raise exception 'child_not_found';
  end if;

  if v_status not in ('pending', 'on_hold') then
    raise exception 'child_not_pending';
  end if;

  v_authorized := fotbal.is_owner()
    or exists (
      select 1
        from fotbal.children c
       where c.id = p_child
         and c.trainer_id = v_my_trainer
    )
    or exists (
      select 1
        from fotbal.groups g
       where g.trainer_id = v_my_trainer
         and g.active = true
         and v_birth_year between g.birth_year_min and g.birth_year_max
    );

  if not v_authorized then
    raise exception 'not_authorized';
  end if;

  update fotbal.children
     set trainer_id = null,
         group_id = null,
         assignment_status = 'rejected',
         updated_at = now()
   where id = p_child;

  if v_parent is not null then
    insert into fotbal.notifications (recipient_id, kind, title, body, link)
    values (
      v_parent,
      'enrollment_rejected',
      'Înscriere neconfirmată',
      coalesce(v_child_name, 'Copilul tău') || ' nu a fost confirmat pentru grupă momentan.',
      '/dashboard'
    );
  end if;
end $function$;

-- ---------------------------------------------------------------------------
-- Materialise recurring templates into real schedule_events for the next N
-- weeks. Future generated events are refreshed; manual, past, and cancelled
-- events are preserved.
create or replace function fotbal.regenerate_trainings(p_trainer uuid, p_weeks int default 8)
  returns int
  language plpgsql
  security definer
  set search_path to 'fotbal', 'public'
as $function$
declare
  v_weeks int := greatest(1, least(coalesce(p_weeks, 8), 26));
  v_until_date date;
  v_day date;
  v_template record;
  v_start timestamptz;
  v_end timestamptz;
  v_inserted int := 0;
begin
  v_until_date := current_date + (v_weeks * 7);

  if not (
    fotbal.is_owner()
    or p_trainer = fotbal.my_trainer_id()
  ) then
    raise exception 'not_authorized';
  end if;

  delete from fotbal.schedule_events
   where trainer_id = p_trainer
     and kind = 'training'
     and training_template_id is not null
     and starts_at >= now()
     and starts_at < v_until_date::timestamptz
     and cancelled_at is null;

  for v_template in
    select *
      from fotbal.training_templates
     where trainer_id = p_trainer
       and active = true
  loop
    v_day := current_date;
    while v_day < v_until_date loop
      if extract(isodow from v_day)::int = v_template.weekday then
        v_start := make_timestamptz(
          extract(year from v_day)::int,
          extract(month from v_day)::int,
          extract(day from v_day)::int,
          extract(hour from v_template.start_time)::int,
          extract(minute from v_template.start_time)::int,
          0,
          'Europe/Bucharest'
        );
        v_end := case
          when v_template.end_time is null then v_start + interval '90 minutes'
          else make_timestamptz(
            extract(year from v_day)::int,
            extract(month from v_day)::int,
            extract(day from v_day)::int,
            extract(hour from v_template.end_time)::int,
            extract(minute from v_template.end_time)::int,
            0,
            'Europe/Bucharest'
          )
        end;

        if not exists (
          select 1
            from fotbal.schedule_events existing
           where existing.training_template_id = v_template.id
             and existing.starts_at = v_start
        ) then
          insert into fotbal.schedule_events (
            trainer_id,
            kind,
            title,
            starts_at,
            ends_at,
            location,
            training_template_id
          ) values (
            p_trainer,
            'training',
            'Antrenament',
            v_start,
            v_end,
            v_template.location,
            v_template.id
          );
          v_inserted := v_inserted + 1;
        end if;
      end if;

      v_day := v_day + 1;
    end loop;
  end loop;

  return v_inserted;
end $function$;

grant execute on function fotbal.enroll_hold(uuid) to authenticated, service_role;
grant execute on function fotbal.enroll_reject(uuid) to authenticated, service_role;
grant execute on function fotbal.regenerate_trainings(uuid, int) to authenticated, service_role;
revoke execute on function fotbal.enroll_hold(uuid) from anon;
revoke execute on function fotbal.enroll_reject(uuid) from anon;
revoke execute on function fotbal.regenerate_trainings(uuid, int) from anon;
