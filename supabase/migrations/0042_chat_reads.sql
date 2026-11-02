-- Read tracking for the chat, used by the mobile app's unread badge.
--
-- fotbal.chat_reads keeps one row per (user, thread): the time the user last
-- read the thread. fotbal.chat_unread_counts() returns the number of messages
-- from other people that are newer than that, for every thread the caller can
-- see. fotbal.chat_mark_read(thread) records a read using the database clock.
--
-- Everything is `security invoker`, so the RLS policies on chat_threads,
-- chat_messages and chat_reads apply to the caller: a user only ever counts or
-- marks threads they can see. `anon` gets nothing (0001's default privileges
-- would otherwise grant it SELECT).
--
-- Design: docs/designs/mobile-profile-and-chat-backend.md. Like every migration
-- in this project it is applied to production by hand, and it must be live
-- before the API routes that call these functions are deployed.

create table if not exists fotbal.chat_reads (
  user_id uuid not null references fotbal.profiles(id) on delete cascade,
  thread_id uuid not null references fotbal.chat_threads(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

alter table fotbal.chat_reads enable row level security;

drop policy if exists "chat_reads select own" on fotbal.chat_reads;
create policy "chat_reads select own" on fotbal.chat_reads
  for select using (user_id = auth.uid());

-- The subquery runs as the caller, so it only matches threads that
-- "chat_threads visible" lets them see.
drop policy if exists "chat_reads insert own" on fotbal.chat_reads;
create policy "chat_reads insert own" on fotbal.chat_reads
  for insert with check (
    user_id = auth.uid()
    and thread_id in (select id from fotbal.chat_threads)
  );

drop policy if exists "chat_reads update own" on fotbal.chat_reads;
create policy "chat_reads update own" on fotbal.chat_reads
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and thread_id in (select id from fotbal.chat_threads)
  );

-- No delete policy: with RLS on, deletes are denied even though the default
-- privileges grant DELETE.

revoke all on fotbal.chat_reads from anon;
grant select, insert, update on fotbal.chat_reads to authenticated, service_role;

-- One row per visible thread, including threads with no messages. A message
-- created exactly at last_read_at counts as read (strict >). The caller's own
-- messages never count.
create or replace function fotbal.chat_unread_counts()
returns table (thread_id uuid, unread int)
language sql stable security invoker
set search_path = fotbal, public
as $$
  select t.id, count(m.id)::int
    from fotbal.chat_threads t
    left join fotbal.chat_reads r
           on r.thread_id = t.id and r.user_id = auth.uid()
    left join fotbal.chat_messages m
           on m.thread_id = t.id
          and m.sender_id <> auth.uid()
          and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
   group by t.id
$$;

-- Fails with 42501 (RLS) when the caller cannot see the thread, or when the
-- thread does not exist: the policy check runs before the foreign key.
create or replace function fotbal.chat_mark_read(p_thread uuid)
returns void
language sql volatile security invoker
set search_path = fotbal, public
as $$
  insert into fotbal.chat_reads (user_id, thread_id, last_read_at)
  values (auth.uid(), p_thread, now())
  on conflict (user_id, thread_id) do update set last_read_at = now()
$$;

-- Postgres grants new functions to PUBLIC, which anon inherits (see 0040).
revoke execute on function fotbal.chat_unread_counts() from public, anon;
revoke execute on function fotbal.chat_mark_read(uuid) from public, anon;
grant execute on function fotbal.chat_unread_counts() to authenticated, service_role;
grant execute on function fotbal.chat_mark_read(uuid) to authenticated, service_role;
