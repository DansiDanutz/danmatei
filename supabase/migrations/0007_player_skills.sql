-- =============================================================================
-- Player skill tree — per-child rating across 5 dimensions.
-- =============================================================================
-- The skill tree is the trainer's evaluation, not the child's self-assessment.
-- Trainers + the boss can edit; parents read. Default rating is 3/5 (neutral)
-- so every child starts in the middle and earns their stars.
--
-- 5 dimensions tracked, mirrors AUDIT_AND_ROADMAP.md design:
--   - pasare       (passing)
--   - conducere    (ball handling / dribbling)
--   - tehnica      (technique / shooting / control)
--   - cooperare    (teamwork / communication)
--   - disciplina   (attitude / focus / respect)

create table if not exists fotbal.player_skills (
  child_id     uuid primary key references fotbal.children(id) on delete cascade,
  pasare       int  not null default 3 check (pasare       between 1 and 5),
  conducere    int  not null default 3 check (conducere    between 1 and 5),
  tehnica      int  not null default 3 check (tehnica      between 1 and 5),
  cooperare    int  not null default 3 check (cooperare    between 1 and 5),
  disciplina   int  not null default 3 check (disciplina   between 1 and 5),
  notes        text,
  updated_by   uuid references fotbal.profiles(id) on delete set null,
  updated_at   timestamptz not null default now()
);

create index if not exists player_skills_updated_idx
  on fotbal.player_skills(updated_at desc);

-- Auto-touch updated_at on update
drop trigger if exists player_skills_set_updated_at on fotbal.player_skills;
create trigger player_skills_set_updated_at
  before update on fotbal.player_skills
  for each row execute function fotbal.tg_set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────
alter table fotbal.player_skills enable row level security;

-- Read: any authenticated user. RLS on `children` already filters which kids
-- a given parent / trainer can see; player_skills is a 1:1 extension table
-- so the same visibility rules apply.
drop policy if exists "player_skills read" on fotbal.player_skills;
create policy "player_skills read" on fotbal.player_skills
  for select using (
    child_id in (select id from fotbal.children)
  );

-- Write: only trainers + owner + super_admin. Parents cannot rate their
-- own child.
drop policy if exists "player_skills trainer write" on fotbal.player_skills;
create policy "player_skills trainer write" on fotbal.player_skills
  for insert with check (
    exists(
      select 1 from fotbal.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'owner', 'super_admin')
    )
  );

drop policy if exists "player_skills trainer update" on fotbal.player_skills;
create policy "player_skills trainer update" on fotbal.player_skills
  for update using (
    exists(
      select 1 from fotbal.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'owner', 'super_admin')
    )
  ) with check (
    exists(
      select 1 from fotbal.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'owner', 'super_admin')
    )
  );

grant select, insert, update on fotbal.player_skills to authenticated;
grant select on fotbal.player_skills to anon;

-- ─── Helper view: child summary stats ─────────────────────────────────────
-- Aggregates the numbers shown on the player profile header into one query.
--   - attendance_total / attendance_present → percentage
--   - current_streak — most recent run of 'present' attendances
--   - matches_played / goals_total / assists_total — from match_participations

create or replace view fotbal.v_child_stats as
with att as (
  select
    a.child_id,
    count(*)                                          as total,
    count(*) filter (where status = 'present')        as present
  from fotbal.attendance a
  group by a.child_id
),
streak as (
  -- Count consecutive 'present' attendances ending at the most recent
  -- record. We count present rows whose created_at is more recent than
  -- the last non-present row (if there is one — otherwise every present
  -- row counts).
  select
    a.child_id,
    count(*) filter (
      where a.status = 'present'
        and a.created_at > coalesce(
          (select max(a2.created_at) from fotbal.attendance a2
             where a2.child_id = a.child_id and a2.status <> 'present'),
          '-infinity'
        )
    ) as current_streak
  from fotbal.attendance a
  group by a.child_id
),
mp as (
  select
    p.child_id,
    count(*)                              as matches_played,
    coalesce(sum(p.goals), 0)             as goals_total,
    coalesce(sum(p.assists), 0)           as assists_total
  from fotbal.match_participations p
  group by p.child_id
)
select
  c.id                                                                       as child_id,
  coalesce(att.total, 0)                                                     as attendance_total,
  coalesce(att.present, 0)                                                   as attendance_present,
  case when coalesce(att.total, 0) > 0
    then round(att.present::numeric * 100 / att.total, 0)::int
    else null
  end                                                                        as attendance_percent,
  coalesce(streak.current_streak, 0)                                         as current_streak,
  coalesce(mp.matches_played, 0)                                             as matches_played,
  coalesce(mp.goals_total, 0)                                                as goals_total,
  coalesce(mp.assists_total, 0)                                              as assists_total
from fotbal.children c
left join att    on att.child_id    = c.id
left join streak on streak.child_id = c.id
left join mp     on mp.child_id     = c.id;

grant select on fotbal.v_child_stats to authenticated, anon;

comment on table fotbal.player_skills is
  'Trainer-maintained skill rating per child. 1-5 scale across 5 dimensions.';
comment on view fotbal.v_child_stats is
  'Aggregated per-child stats shown on the profile header — attendance %, current streak, total matches / goals / assists.';
