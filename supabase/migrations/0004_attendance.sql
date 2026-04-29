-- =============================================================================
-- 0004 — Attendance tracking for training sessions
-- =============================================================================

set search_path = fotbal, public;

-- Attendance status enum
do $$ begin
  create type fotbal.attendance_status as enum ('present', 'absent', 'late', 'excused');
exception when duplicate_object then null; end $$;

-- Attendance table
create table if not exists fotbal.attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references fotbal.schedule_events(id) on delete cascade,
  child_id uuid not null references fotbal.children(id) on delete cascade,
  status fotbal.attendance_status not null default 'present',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, child_id)
);

create index if not exists attendance_event_idx on fotbal.attendance (event_id);
create index if not exists attendance_child_idx on fotbal.attendance (child_id, created_at desc);

-- updated_at trigger
drop trigger if exists set_updated_at on fotbal.attendance;
create trigger set_updated_at before update on fotbal.attendance
  for each row execute function fotbal.tg_set_updated_at();

-- RLS
alter table fotbal.attendance enable row level security;

drop policy if exists "attendance read" on fotbal.attendance;
create policy "attendance read" on fotbal.attendance
  for select using (
    child_id in (select id from fotbal.children)
  );

drop policy if exists "attendance trainer write" on fotbal.attendance;
create policy "attendance trainer write" on fotbal.attendance
  for all using (
    event_id in (select id from fotbal.schedule_events where trainer_id = fotbal.my_trainer_id())
    or fotbal.is_owner()
  ) with check (
    event_id in (select id from fotbal.schedule_events where trainer_id = fotbal.my_trainer_id())
    or fotbal.is_owner()
  );

-- Grant permissions
grant select, insert, update, delete on fotbal.attendance to authenticated, service_role;
grant select on fotbal.attendance to anon;
