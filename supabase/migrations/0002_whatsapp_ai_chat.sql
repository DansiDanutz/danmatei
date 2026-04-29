-- =============================================================================
-- 0002 — WhatsApp + AI conversations + in-app chat threads
-- =============================================================================
-- Adds the data plane for the rebrand's three new flows:
--
--   1. Each trainer has a WhatsApp number that parents can reach. Stored on
--      `fotbal.trainers` and edited from the trainer's own dashboard.
--
--   2. After a parent signs up, we send them a WhatsApp message with a link
--      to a voice AI assistant (ElevenLabs ConvAI). The transcript of that
--      conversation is ingested via webhook and stored on
--      `fotbal.ai_conversations`, scoped to the assigned trainer + child.
--      The trainer can read all transcripts for parents in their group; the
--      parent can read only their own.
--
--   3. In-app chat threads between a parent and their assigned trainer (and
--      group-wide threads). Backed by `fotbal.chat_threads` +
--      `fotbal.chat_messages`. Realtime is enabled on chat_messages so the
--      client can subscribe to inserts.

set search_path = fotbal, public;

-- ── 1. Trainers: WhatsApp + ElevenLabs agent id ────────────────────────────
alter table fotbal.trainers
  add column if not exists whatsapp_number text,
  add column if not exists elevenlabs_agent_id text;

comment on column fotbal.trainers.whatsapp_number is
  'E.164-ish phone number used as the trainer''s WhatsApp contact (e.g. +40744311147). Optional.';
comment on column fotbal.trainers.elevenlabs_agent_id is
  'ElevenLabs Conversational AI agent ID assigned to this trainer. The parent''s welcome WhatsApp message links them to a voice session with this agent.';

-- ── 2. AI conversations ────────────────────────────────────────────────────
do $$ begin
  create type fotbal.ai_convo_status as enum (
    'pending', 'in_progress', 'completed', 'failed'
  );
exception when duplicate_object then null; end $$;

create table if not exists fotbal.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  -- Who the conversation is with / about. trainer_id is set when the parent
  -- has been assigned to a trainer at signup time. child_id may be null if
  -- the parent hasn't completed child onboarding yet.
  parent_id uuid not null references fotbal.profiles(id) on delete cascade,
  trainer_id uuid references fotbal.trainers(id) on delete set null,
  child_id uuid references fotbal.children(id) on delete set null,
  -- ElevenLabs side
  elevenlabs_agent_id text,
  elevenlabs_conversation_id text,        -- filled in on first webhook event
  share_link text not null,               -- the link sent to the parent via WhatsApp
  share_token text not null unique,       -- short token embedded in share_link, server-routed
  -- Outcome
  status fotbal.ai_convo_status not null default 'pending',
  transcript_md text,                     -- markdown-formatted full transcript
  transcript_summary text,                -- short summary the trainer reads first
  duration_seconds int,
  recording_url text,
  started_at timestamptz,
  ended_at timestamptz,
  -- Bookkeeping
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_convos_parent_idx on fotbal.ai_conversations (parent_id, created_at desc);
create index if not exists ai_convos_trainer_idx on fotbal.ai_conversations (trainer_id, created_at desc);
create index if not exists ai_convos_status_idx on fotbal.ai_conversations (status);

drop trigger if exists set_updated_at on fotbal.ai_conversations;
create trigger set_updated_at before update on fotbal.ai_conversations
  for each row execute function fotbal.tg_set_updated_at();

alter table fotbal.ai_conversations enable row level security;

drop policy if exists "ai_convos parent read own" on fotbal.ai_conversations;
create policy "ai_convos parent read own" on fotbal.ai_conversations
  for select using (parent_id = auth.uid());

drop policy if exists "ai_convos trainer read own group" on fotbal.ai_conversations;
create policy "ai_convos trainer read own group" on fotbal.ai_conversations
  for select using (trainer_id = fotbal.my_trainer_id());

drop policy if exists "ai_convos owner read all" on fotbal.ai_conversations;
create policy "ai_convos owner read all" on fotbal.ai_conversations
  for select using (fotbal.is_owner());

-- Inserts and updates flow through service role only (the webhook + the
-- /api/ai/start-conversation endpoint). Direct client writes are blocked.
drop policy if exists "ai_convos service writes only" on fotbal.ai_conversations;
create policy "ai_convos service writes only" on fotbal.ai_conversations
  for all using (false) with check (false);

-- ── 3. In-app chat ─────────────────────────────────────────────────────────
do $$ begin
  create type fotbal.chat_thread_kind as enum (
    'parent_trainer',  -- 1:1 parent ↔ assigned trainer (about a specific child)
    'group',           -- all parents in a trainer's group
    'parents'          -- broader academy-wide parents thread (owner-led)
  );
exception when duplicate_object then null; end $$;

create table if not exists fotbal.chat_threads (
  id uuid primary key default gen_random_uuid(),
  kind fotbal.chat_thread_kind not null,
  -- Optional anchors. parent_trainer threads link a child + trainer.
  -- group threads link a trainer (for the trainer's group).
  trainer_id uuid references fotbal.trainers(id) on delete cascade,
  child_id uuid references fotbal.children(id) on delete cascade,
  title text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  -- Each parent_trainer thread is unique per (trainer, child) pair.
  unique nulls not distinct (kind, trainer_id, child_id)
);

create index if not exists chat_threads_trainer_idx on fotbal.chat_threads (trainer_id, last_message_at desc);
create index if not exists chat_threads_child_idx on fotbal.chat_threads (child_id);

create table if not exists fotbal.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references fotbal.chat_threads(id) on delete cascade,
  sender_id uuid not null references fotbal.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  attachment_path text,
  attachment_mime text,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_idx on fotbal.chat_messages (thread_id, created_at);
create index if not exists chat_messages_sender_idx on fotbal.chat_messages (sender_id, created_at desc);

-- Bump thread.last_message_at on every new message.
create or replace function fotbal.tg_chat_bump_thread() returns trigger
language plpgsql
security definer set search_path = fotbal, public
as $$
begin
  update fotbal.chat_threads
     set last_message_at = new.created_at
   where id = new.thread_id;
  return new;
end $$;

drop trigger if exists chat_msg_bump_thread on fotbal.chat_messages;
create trigger chat_msg_bump_thread
after insert on fotbal.chat_messages
for each row execute function fotbal.tg_chat_bump_thread();

alter table fotbal.chat_threads enable row level security;
alter table fotbal.chat_messages enable row level security;

-- A parent can read a thread if: it's their parent_trainer thread (child_id
-- belongs to them), it's their group thread (their child's trainer matches),
-- or it's the academy-wide parents thread. The trainer can always read their
-- own trainer/group threads. Owner sees everything.
drop policy if exists "chat_threads visible" on fotbal.chat_threads;
create policy "chat_threads visible" on fotbal.chat_threads
  for select using (
    fotbal.is_owner()
    or trainer_id = fotbal.my_trainer_id()
    or (kind = 'parent_trainer'::fotbal.chat_thread_kind
        and child_id in (select id from fotbal.children where parent_id = auth.uid()))
    or (kind = 'group'::fotbal.chat_thread_kind
        and trainer_id in (select trainer_id from fotbal.children where parent_id = auth.uid()))
    or kind = 'parents'::fotbal.chat_thread_kind
  );

drop policy if exists "chat_threads owner+trainer write" on fotbal.chat_threads;
create policy "chat_threads owner+trainer write" on fotbal.chat_threads
  for insert with check (
    fotbal.is_owner()
    or fotbal.is_trainer()
    -- Parents can also create their 1:1 thread with their assigned trainer.
    or (kind = 'parent_trainer'::fotbal.chat_thread_kind
        and child_id in (select id from fotbal.children where parent_id = auth.uid()))
  );

-- Allow thread members (or owner) to update last_message_at via trigger
drop policy if exists "chat_threads bump update" on fotbal.chat_threads;
create policy "chat_threads bump update" on fotbal.chat_threads
  for update using (
    fotbal.is_owner()
    or trainer_id = fotbal.my_trainer_id()
    or (kind = 'parent_trainer'::fotbal.chat_thread_kind
        and child_id in (select id from fotbal.children where parent_id = auth.uid()))
    or (kind = 'group'::fotbal.chat_thread_kind
        and trainer_id in (select trainer_id from fotbal.children where parent_id = auth.uid()))
    or kind = 'parents'::fotbal.chat_thread_kind
  );

drop policy if exists "chat_messages read via thread" on fotbal.chat_messages;
create policy "chat_messages read via thread" on fotbal.chat_messages
  for select using (
    thread_id in (
      select id from fotbal.chat_threads
       where fotbal.is_owner()
          or trainer_id = fotbal.my_trainer_id()
          or (kind = 'parent_trainer'::fotbal.chat_thread_kind
              and child_id in (select id from fotbal.children where parent_id = auth.uid()))
          or (kind = 'group'::fotbal.chat_thread_kind
              and trainer_id in (select trainer_id from fotbal.children where parent_id = auth.uid()))
          or kind = 'parents'::fotbal.chat_thread_kind
    )
  );

drop policy if exists "chat_messages send if member" on fotbal.chat_messages;
create policy "chat_messages send if member" on fotbal.chat_messages
  for insert with check (
    sender_id = auth.uid()
    and thread_id in (
      select id from fotbal.chat_threads
       where fotbal.is_owner()
          or trainer_id = fotbal.my_trainer_id()
          or (kind = 'parent_trainer'::fotbal.chat_thread_kind
              and child_id in (select id from fotbal.children where parent_id = auth.uid()))
          or (kind = 'group'::fotbal.chat_thread_kind
              and trainer_id in (select trainer_id from fotbal.children where parent_id = auth.uid()))
          or kind = 'parents'::fotbal.chat_thread_kind
    )
  );

drop policy if exists "chat_messages edit own" on fotbal.chat_messages;
create policy "chat_messages edit own" on fotbal.chat_messages
  for update using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- Realtime publication for live chat updates
alter publication supabase_realtime add table fotbal.chat_messages;
