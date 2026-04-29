-- =============================================================================
-- Școala de Fotbal Dan Matei — initial schema (lives in `fotbal` schema)
-- =============================================================================
-- Hosted in the existing "Memory" Supabase project. Everything lives in a
-- dedicated `fotbal` schema so it doesn't collide with the project's public
-- tables (chat_history, memories, adclaw_*, semeclaw_*, etc).
--
-- Roles: owner (Dan), trainer (UEFA-licensed coaches), parent (one per family).
-- Authorization is enforced by Postgres RLS — clients use the anon key with
-- `{ db: { schema: 'fotbal' } }`. Privileged operations go through serverless
-- functions in /api with the service role.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create schema if not exists fotbal;

-- -----------------------------------------------------------------------------
-- Enums (under `fotbal` so they can't collide with public)
-- -----------------------------------------------------------------------------
do $$ begin
  create type fotbal.user_role as enum ('owner', 'trainer', 'parent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fotbal.child_status as enum ('active', 'paused', 'left');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fotbal.news_audience as enum ('public', 'members', 'group');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fotbal.schedule_kind as enum ('training', 'match', 'tournament', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fotbal.participation_role as enum ('starter', 'sub', 'injured', 'absent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fotbal.player_event_kind as enum (
    'signup', 'profile_update', 'group_assigned', 'group_unassigned',
    'match', 'training', 'achievement', 'note', 'media', 'status_change'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type fotbal.media_kind as enum ('image', 'video');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fotbal.message_audience as enum ('group', 'child', 'parent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fotbal.landing_slot as enum ('hero', 'owner', 'trainers', 'players');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table if not exists fotbal.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role fotbal.user_role not null default 'parent',
  full_name text not null,
  phone text,
  locale text not null default 'ro',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fotbal.trainers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references fotbal.profiles(id) on delete cascade,
  bio text,
  position text,
  certifications jsonb not null default '[]'::jsonb,
  age_min int not null check (age_min between 4 and 25),
  age_max int not null check (age_max between 4 and 25 and age_max >= age_min),
  hero_photo_path text,
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trainers_active_idx on fotbal.trainers (active, display_order);
create index if not exists trainers_age_idx on fotbal.trainers (age_min, age_max);

create table if not exists fotbal.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references fotbal.profiles(id) on delete cascade,
  full_name text not null,
  dob date not null,
  gender text,
  photo_path text,
  school text,
  medical_notes text,
  trainer_id uuid references fotbal.trainers(id) on delete set null,
  age_group_label text,
  status fotbal.child_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists children_parent_idx on fotbal.children (parent_id);
create index if not exists children_trainer_idx on fotbal.children (trainer_id);
create index if not exists children_status_idx on fotbal.children (status);

create table if not exists fotbal.news (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references fotbal.profiles(id) on delete set null,
  title text not null,
  body_md text not null,
  cover_path text,
  audience fotbal.news_audience not null default 'public',
  group_trainer_id uuid references fotbal.trainers(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_audience_idx on fotbal.news (audience, published_at desc);
create index if not exists news_group_idx on fotbal.news (group_trainer_id);

create table if not exists fotbal.schedule_events (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid references fotbal.trainers(id) on delete set null,
  kind fotbal.schedule_kind not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  opponent text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schedule_trainer_idx on fotbal.schedule_events (trainer_id, starts_at desc);
create index if not exists schedule_starts_idx on fotbal.schedule_events (starts_at desc);

create table if not exists fotbal.match_results (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references fotbal.schedule_events(id) on delete cascade,
  our_score int not null check (our_score >= 0),
  opponent_score int not null check (opponent_score >= 0),
  scorers jsonb not null default '[]'::jsonb,
  recap_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fotbal.match_participations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references fotbal.schedule_events(id) on delete cascade,
  child_id uuid not null references fotbal.children(id) on delete cascade,
  role fotbal.participation_role not null default 'starter',
  goals int not null default 0 check (goals >= 0),
  assists int not null default 0 check (assists >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (event_id, child_id)
);

create index if not exists match_part_child_idx on fotbal.match_participations (child_id);

create table if not exists fotbal.player_events (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references fotbal.children(id) on delete cascade,
  kind fotbal.player_event_kind not null,
  title text not null,
  body_md text,
  occurred_at timestamptz not null default now(),
  source_table text,
  source_id uuid,
  created_by uuid references fotbal.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists player_events_child_idx on fotbal.player_events (child_id, occurred_at desc);

create table if not exists fotbal.media (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references fotbal.profiles(id) on delete cascade,
  child_id uuid references fotbal.children(id) on delete cascade,
  kind fotbal.media_kind not null,
  storage_path text not null,
  mime text not null,
  bytes bigint not null,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists media_child_idx on fotbal.media (child_id, created_at desc);
create index if not exists media_uploader_idx on fotbal.media (uploader_id);

create table if not exists fotbal.messages (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references fotbal.trainers(id) on delete cascade,
  audience fotbal.message_audience not null,
  child_id uuid references fotbal.children(id) on delete cascade,
  body_md text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_trainer_idx on fotbal.messages (trainer_id, created_at desc);
create index if not exists messages_child_idx on fotbal.messages (child_id, created_at desc);

create table if not exists fotbal.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references fotbal.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on fotbal.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx on fotbal.notifications (recipient_id, read_at) where read_at is null;

create table if not exists fotbal.landing_content (
  id uuid primary key default gen_random_uuid(),
  slot fotbal.landing_slot not null unique,
  payload jsonb not null,
  updated_by uuid references fotbal.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function fotbal.tg_set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','trainers','children','news','schedule_events',
    'match_results','landing_content'
  ]) loop
    execute format('drop trigger if exists set_updated_at on fotbal.%I', t);
    execute format('create trigger set_updated_at before update on fotbal.%I '
                   'for each row execute function fotbal.tg_set_updated_at()', t);
  end loop;
end $$;

create or replace function fotbal.current_role() returns fotbal.user_role
language sql stable security definer set search_path = fotbal, public as $$
  select role from fotbal.profiles where id = auth.uid();
$$;

create or replace function fotbal.is_owner() returns boolean
language sql stable security definer set search_path = fotbal, public as $$
  select coalesce((select role = 'owner'::fotbal.user_role from fotbal.profiles where id = auth.uid()), false);
$$;

create or replace function fotbal.is_trainer() returns boolean
language sql stable security definer set search_path = fotbal, public as $$
  select coalesce((select role = 'trainer'::fotbal.user_role from fotbal.profiles where id = auth.uid()), false);
$$;

create or replace function fotbal.my_trainer_id() returns uuid
language sql stable security definer set search_path = fotbal, public as $$
  select id from fotbal.trainers where profile_id = auth.uid() limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Auth user → fotbal.profiles trigger
-- We hook auth.users insert and check meta for an explicit `app = 'fotbal'`
-- marker so we don't accidentally create profiles for users who signed up to
-- another app in the same Memory project.
-- -----------------------------------------------------------------------------
create or replace function fotbal.handle_new_user() returns trigger
language plpgsql security definer set search_path = fotbal, public as $$
begin
  if (new.raw_user_meta_data->>'app') is distinct from 'fotbal' then
    return new;  -- not our user
  end if;
  insert into fotbal.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::fotbal.user_role, 'parent'::fotbal.user_role)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists fotbal_on_auth_user_created on auth.users;
create trigger fotbal_on_auth_user_created
after insert on auth.users
for each row execute function fotbal.handle_new_user();

-- Child signup → player_events log
create or replace function fotbal.tg_child_signup_event() returns trigger
language plpgsql security definer set search_path = fotbal, public as $$
begin
  insert into fotbal.player_events (child_id, kind, title, body_md, source_table, source_id, created_by)
  values (new.id, 'signup'::fotbal.player_event_kind, 'Înscriere în academie',
          format('Profil creat pentru %s.', new.full_name),
          'children', new.id, new.parent_id);
  if new.trainer_id is not null then
    insert into fotbal.player_events (child_id, kind, title, body_md, source_table, source_id, created_by)
    values (new.id, 'group_assigned'::fotbal.player_event_kind, 'Repartizare la grupă',
            'Atribuit antrenorului la momentul înscrierii.',
            'children', new.id, new.parent_id);
  end if;
  return new;
end $$;

drop trigger if exists on_child_inserted on fotbal.children;
create trigger on_child_inserted
after insert on fotbal.children
for each row execute function fotbal.tg_child_signup_event();

-- -----------------------------------------------------------------------------
-- Expose `fotbal` schema to PostgREST so the Supabase JS client can query it
-- with `{ db: { schema: 'fotbal' } }`.
-- -----------------------------------------------------------------------------
grant usage on schema fotbal to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema fotbal to authenticated, service_role;
grant select on all tables in schema fotbal to anon;
grant execute on all functions in schema fotbal to anon, authenticated, service_role;
alter default privileges in schema fotbal grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema fotbal grant select on tables to anon;
alter default privileges in schema fotbal grant execute on functions to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS — enable on every table
-- -----------------------------------------------------------------------------
alter table fotbal.profiles enable row level security;
alter table fotbal.trainers enable row level security;
alter table fotbal.children enable row level security;
alter table fotbal.news enable row level security;
alter table fotbal.schedule_events enable row level security;
alter table fotbal.match_results enable row level security;
alter table fotbal.match_participations enable row level security;
alter table fotbal.player_events enable row level security;
alter table fotbal.media enable row level security;
alter table fotbal.messages enable row level security;
alter table fotbal.notifications enable row level security;
alter table fotbal.landing_content enable row level security;

-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------
drop policy if exists "profiles read self or owner" on fotbal.profiles;
create policy "profiles read self or owner" on fotbal.profiles
  for select using (id = auth.uid() or fotbal.is_owner());

drop policy if exists "profiles update self" on fotbal.profiles;
create policy "profiles update self" on fotbal.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles owner update any" on fotbal.profiles;
create policy "profiles owner update any" on fotbal.profiles
  for update using (fotbal.is_owner()) with check (fotbal.is_owner());

drop policy if exists "trainers public read" on fotbal.trainers;
create policy "trainers public read" on fotbal.trainers
  for select using (active = true or fotbal.is_owner() or profile_id = auth.uid());

drop policy if exists "trainers owner write" on fotbal.trainers;
create policy "trainers owner write" on fotbal.trainers
  for all using (fotbal.is_owner()) with check (fotbal.is_owner());

drop policy if exists "trainers self update" on fotbal.trainers;
create policy "trainers self update" on fotbal.trainers
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "children parent read" on fotbal.children;
create policy "children parent read" on fotbal.children
  for select using (
    parent_id = auth.uid()
    or fotbal.is_owner()
    or trainer_id = fotbal.my_trainer_id()
  );

drop policy if exists "children parent insert" on fotbal.children;
create policy "children parent insert" on fotbal.children
  for insert with check (parent_id = auth.uid());

drop policy if exists "children parent update" on fotbal.children;
create policy "children parent update" on fotbal.children
  for update using (parent_id = auth.uid() or fotbal.is_owner())
              with check (parent_id = auth.uid() or fotbal.is_owner());

drop policy if exists "news public read" on fotbal.news;
create policy "news public read" on fotbal.news
  for select using (
    audience = 'public'::fotbal.news_audience
    or (audience = 'members'::fotbal.news_audience and auth.uid() is not null)
    or (audience = 'group'::fotbal.news_audience and group_trainer_id in (
        select trainer_id from fotbal.children where parent_id = auth.uid()
        union
        select fotbal.my_trainer_id()
    ))
    or fotbal.is_owner()
  );

drop policy if exists "news author write" on fotbal.news;
create policy "news author write" on fotbal.news
  for all using (author_id = auth.uid() or fotbal.is_owner())
              with check (author_id = auth.uid() or fotbal.is_owner());

drop policy if exists "schedule trainer read" on fotbal.schedule_events;
create policy "schedule trainer read" on fotbal.schedule_events
  for select using (
    trainer_id = fotbal.my_trainer_id()
    or trainer_id in (select trainer_id from fotbal.children where parent_id = auth.uid())
    or fotbal.is_owner()
  );

drop policy if exists "schedule trainer write" on fotbal.schedule_events;
create policy "schedule trainer write" on fotbal.schedule_events
  for all using (trainer_id = fotbal.my_trainer_id() or fotbal.is_owner())
              with check (trainer_id = fotbal.my_trainer_id() or fotbal.is_owner());

drop policy if exists "match_results read" on fotbal.match_results;
create policy "match_results read" on fotbal.match_results
  for select using (event_id in (select id from fotbal.schedule_events));

drop policy if exists "match_results write" on fotbal.match_results;
create policy "match_results write" on fotbal.match_results
  for all using (
    event_id in (select id from fotbal.schedule_events where trainer_id = fotbal.my_trainer_id())
    or fotbal.is_owner()
  ) with check (
    event_id in (select id from fotbal.schedule_events where trainer_id = fotbal.my_trainer_id())
    or fotbal.is_owner()
  );

drop policy if exists "match_part read" on fotbal.match_participations;
create policy "match_part read" on fotbal.match_participations
  for select using (child_id in (select id from fotbal.children));

drop policy if exists "match_part write" on fotbal.match_participations;
create policy "match_part write" on fotbal.match_participations
  for all using (
    event_id in (select id from fotbal.schedule_events where trainer_id = fotbal.my_trainer_id())
    or fotbal.is_owner()
  ) with check (
    event_id in (select id from fotbal.schedule_events where trainer_id = fotbal.my_trainer_id())
    or fotbal.is_owner()
  );

drop policy if exists "player_events read" on fotbal.player_events;
create policy "player_events read" on fotbal.player_events
  for select using (child_id in (select id from fotbal.children));

drop policy if exists "player_events insert" on fotbal.player_events;
create policy "player_events insert" on fotbal.player_events
  for insert with check (fotbal.is_owner() or created_by = auth.uid());

drop policy if exists "media read" on fotbal.media;
create policy "media read" on fotbal.media
  for select using (
    uploader_id = auth.uid()
    or fotbal.is_owner()
    or child_id in (select id from fotbal.children)
  );

drop policy if exists "media insert" on fotbal.media;
create policy "media insert" on fotbal.media
  for insert with check (uploader_id = auth.uid());

drop policy if exists "media delete" on fotbal.media;
create policy "media delete" on fotbal.media
  for delete using (uploader_id = auth.uid() or fotbal.is_owner());

drop policy if exists "messages read" on fotbal.messages;
create policy "messages read" on fotbal.messages
  for select using (
    trainer_id = fotbal.my_trainer_id()
    or fotbal.is_owner()
    or (audience = 'group'::fotbal.message_audience and trainer_id in (select trainer_id from fotbal.children where parent_id = auth.uid()))
    or (audience in ('child'::fotbal.message_audience, 'parent'::fotbal.message_audience) and child_id in (select id from fotbal.children where parent_id = auth.uid()))
  );

drop policy if exists "messages trainer write" on fotbal.messages;
create policy "messages trainer write" on fotbal.messages
  for insert with check (trainer_id = fotbal.my_trainer_id() or fotbal.is_owner());

drop policy if exists "notifications recipient read" on fotbal.notifications;
create policy "notifications recipient read" on fotbal.notifications
  for select using (recipient_id = auth.uid());

drop policy if exists "notifications recipient mark read" on fotbal.notifications;
create policy "notifications recipient mark read" on fotbal.notifications
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

drop policy if exists "landing public read" on fotbal.landing_content;
create policy "landing public read" on fotbal.landing_content
  for select using (true);

drop policy if exists "landing owner write" on fotbal.landing_content;
create policy "landing owner write" on fotbal.landing_content
  for all using (fotbal.is_owner()) with check (fotbal.is_owner());

-- -----------------------------------------------------------------------------
-- Storage buckets — namespaced with `fotbal-` prefix
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('fotbal-media-private', 'fotbal-media-private', false),
  ('fotbal-trainer-public', 'fotbal-trainer-public', true),
  ('fotbal-news-public', 'fotbal-news-public', true)
on conflict (id) do nothing;

drop policy if exists "fotbal media-private upload" on storage.objects;
create policy "fotbal media-private upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotbal-media-private' and (auth.uid()::text = (storage.foldername(name))[1] or fotbal.is_owner()));

drop policy if exists "fotbal media-private read own" on storage.objects;
create policy "fotbal media-private read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotbal-media-private' and (auth.uid()::text = (storage.foldername(name))[1] or fotbal.is_owner()));

drop policy if exists "fotbal trainer-public read" on storage.objects;
create policy "fotbal trainer-public read" on storage.objects
  for select using (bucket_id = 'fotbal-trainer-public');

drop policy if exists "fotbal trainer-public write" on storage.objects;
create policy "fotbal trainer-public write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotbal-trainer-public' and (fotbal.is_trainer() or fotbal.is_owner()));

drop policy if exists "fotbal news-public read" on storage.objects;
create policy "fotbal news-public read" on storage.objects
  for select using (bucket_id = 'fotbal-news-public');

drop policy if exists "fotbal news-public write" on storage.objects;
create policy "fotbal news-public write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotbal-news-public' and fotbal.is_owner());
