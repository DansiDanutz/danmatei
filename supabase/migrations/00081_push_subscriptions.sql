-- =============================================================================
-- 0008 — Web Push subscriptions
-- =============================================================================
-- Stores one row per (user, browser endpoint) so the server can fan out
-- background push notifications via web-push (VAPID).
--
-- A single user can have many subscriptions (phone PWA, laptop Chrome,
-- desktop Firefox, etc.) — uniqueness is on the endpoint URL.

set search_path = fotbal, public;

create table if not exists fotbal.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references fotbal.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx
  on fotbal.push_subscriptions (user_id);

alter table fotbal.push_subscriptions enable row level security;

-- Users manage their own subscriptions. Owners can read all (for debugging).
drop policy if exists "push_subs read self or owner" on fotbal.push_subscriptions;
create policy "push_subs read self or owner" on fotbal.push_subscriptions
  for select using (user_id = auth.uid() or fotbal.is_owner());

drop policy if exists "push_subs insert self" on fotbal.push_subscriptions;
create policy "push_subs insert self" on fotbal.push_subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists "push_subs delete self or owner" on fotbal.push_subscriptions;
create policy "push_subs delete self or owner" on fotbal.push_subscriptions
  for delete using (user_id = auth.uid() or fotbal.is_owner());

-- The server uses service-role to upsert and to delete dead endpoints
-- (410 Gone responses from push services), so no UPDATE policy for end-users.
