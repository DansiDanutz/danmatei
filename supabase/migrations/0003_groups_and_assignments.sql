-- =============================================================================
-- Migration 0003: Groups, assignments, super_admin role, profile completion
-- =============================================================================

-- 1. Expand role enum to include super_admin
alter type fotbal.user_role add value if not exists 'super_admin';

-- 2. Update is_owner() to include both owner and super_admin
--    (this automatically grants full visibility to both roles)
create or replace function fotbal.is_owner() returns boolean
language sql stable security definer set search_path = fotbal, public as $$
  select coalesce((select role in ('owner'::fotbal.user_role, 'super_admin'::fotbal.user_role) from fotbal.profiles where id = auth.uid()), false);
$$;

-- 3. Helper: does current user have a trainer row?
create or replace function fotbal.my_trainer_id() returns uuid
language sql stable security definer set search_path = fotbal, public as $$
  select id from fotbal.trainers where profile_id = auth.uid() limit 1;
$$;

-- 4. Assignment status enum for children
do $$ begin
  create type fotbal.assignment_status as enum ('pending', 'accepted', 'rejected');
exception when duplicate_object then null; end $$;

-- 5. Groups table — owner creates groups and assigns them to trainers
--    Each group covers a birth-year range (e.g., U10 = 2015, U12 = 2013)
create table if not exists fotbal.groups (
  id uuid primary key default gen_random_uuid(),
  label text not null,                          -- e.g., "U10", "U12 2013"
  birth_year_min int not null check (birth_year_min between 2000 and 2030),
  birth_year_max int not null check (birth_year_max between 2000 and 2030 and birth_year_max >= birth_year_min),
  trainer_id uuid references fotbal.trainers(id) on delete set null,
  active boolean not null default true,
  created_by uuid not null references fotbal.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists groups_trainer_idx on fotbal.groups (trainer_id, active);
create index if not exists groups_year_idx on fotbal.groups (birth_year_min, birth_year_max);

-- updated_at trigger for groups
drop trigger if exists set_updated_at on fotbal.groups;
create trigger set_updated_at before update on fotbal.groups
  for each row execute function fotbal.tg_set_updated_at();

-- 6. Extend children with group linkage + assignment status
alter table fotbal.children add column if not exists group_id uuid references fotbal.groups(id) on delete set null;
alter table fotbal.children add column if not exists assignment_status fotbal.assignment_status not null default 'pending';

create index if not exists children_group_idx on fotbal.children (group_id, assignment_status);

-- 7. Helper: min/max birth-year for the current trainer's groups
create or replace function fotbal.my_group_year_range() returns table(year_min int, year_max int)
language sql stable security definer set search_path = fotbal, public as $$
  select min(birth_year_min)::int, max(birth_year_max)::int
  from fotbal.groups
  where trainer_id = fotbal.my_trainer_id() and active = true;
$$;

-- 8. RLS for groups
alter table fotbal.groups enable row level security;

drop policy if exists "groups read" on fotbal.groups;
create policy "groups read" on fotbal.groups
  for select using (
    fotbal.is_owner()
    or trainer_id = fotbal.my_trainer_id()
  );

drop policy if exists "groups owner write" on fotbal.groups;
create policy "groups owner write" on fotbal.groups
  for all using (fotbal.is_owner()) with check (fotbal.is_owner());

-- 9. Unified children read policy
--    parent  → own children
--    owner   → all children
--    trainer → own assigned children + pending children in group year range
drop policy if exists "children parent read" on fotbal.children;
create policy "children read" on fotbal.children
  for select using (
    parent_id = auth.uid()
    or fotbal.is_owner()
    or trainer_id = fotbal.my_trainer_id()
    or (
      trainer_id is null
      and assignment_status = 'pending'
      and extract(year from dob)::int between coalesce((select year_min from fotbal.my_group_year_range()), 0)
                                           and coalesce((select year_max from fotbal.my_group_year_range()), 9999)
    )
  );

-- 10. Unified children update policy
--     parent  → own children (basic info)
--     owner   → any child (full control)
--     trainer → can claim unassigned children in their group range
drop policy if exists "children parent update" on fotbal.children;
create policy "children update" on fotbal.children
  for update using (
    parent_id = auth.uid()
    or fotbal.is_owner()
    or trainer_id = fotbal.my_trainer_id()
    or (
      trainer_id is null
      and assignment_status = 'pending'
      and extract(year from dob)::int between coalesce((select year_min from fotbal.my_group_year_range()), 0)
                                           and coalesce((select year_max from fotbal.my_group_year_range()), 9999)
    )
  ) with check (
    parent_id = auth.uid()
    or fotbal.is_owner()
    or trainer_id = fotbal.my_trainer_id()
  );

-- 11. Keep parent insert policy (only parents create their own children)
--     No change needed.

-- 12. Player events: log when a child is assigned to a trainer/group
create or replace function fotbal.tg_child_assignment_event() returns trigger
language plpgsql security definer set search_path = fotbal, public as $$
begin
  if old.trainer_id is distinct from new.trainer_id then
    insert into fotbal.player_events (child_id, kind, title, body_md, source_table, source_id, created_by)
    values (
      new.id,
      case
        when new.trainer_id is null and old.trainer_id is not null then 'group_unassigned'::fotbal.player_event_kind
        else 'group_assigned'::fotbal.player_event_kind
      end,
      case
        when new.trainer_id is null then 'Scos din grupă'
        else 'Repartizare la grupă'
      end,
      case
        when new.trainer_id is null then format('%s a fost scos din grupa antrenorului.', new.full_name)
        else format('%s a fost repartizat la o grupă nouă.', new.full_name)
      end,
      'children', new.id, auth.uid()
    );
  end if;
  return new;
end $$;

drop trigger if exists on_child_updated_assignment on fotbal.children;
create trigger on_child_updated_assignment
  after update on fotbal.children
  for each row
  when (old.trainer_id is distinct from new.trainer_id or old.group_id is distinct from new.group_id)
  execute function fotbal.tg_child_assignment_event();
