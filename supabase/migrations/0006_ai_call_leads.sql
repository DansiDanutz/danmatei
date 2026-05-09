-- =============================================================================
-- AI-call lead intake (under the `fotbal` schema).
-- =============================================================================
-- Parent submits a quick form, gets a WhatsApp link, speaks to a self-hosted
-- AI agent in Romanian. Transcript is then routed to the trainer who handles
-- that age group + the boss. See docs/AI_CALL_FLOW.md for the full design.

create extension if not exists "pgcrypto";

-- =====================================================================
-- leads
-- =====================================================================
create table if not exists fotbal.leads (
  id                  uuid primary key default gen_random_uuid(),
  parent_name         text not null,
  parent_phone        text not null,
  parent_phone_e164   text not null,
  child_name          text not null,
  child_age           int  not null check (child_age between 4 and 18),
  child_position      text,
  source              text not null default 'web'
    check (source in ('web','app','whatsapp_inbound')),
  status              text not null default 'new'
    check (status in ('new','wa_sent','calling','transcribed','routed','contacted','closed','failed')),
  assigned_trainer_id text not null,
  cc_trainer_ids      text[] not null default array['t-dan'],
  consent_at          timestamptz not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists leads_status_idx     on fotbal.leads(status);
create index if not exists leads_assigned_idx   on fotbal.leads(assigned_trainer_id);
create index if not exists leads_created_at_idx on fotbal.leads(created_at desc);

create or replace function fotbal.tg_set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists leads_set_updated_at on fotbal.leads;
create trigger leads_set_updated_at
  before update on fotbal.leads
  for each row execute function fotbal.tg_set_updated_at();

-- =====================================================================
-- lead_calls — one row per voice call attempt
-- =====================================================================
create table if not exists fotbal.lead_calls (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid not null references fotbal.leads(id) on delete cascade,
  vendor            text not null default 'pipecat',
  vendor_call_id    text,
  livekit_room      text,
  started_at        timestamptz,
  ended_at          timestamptz,
  duration_seconds  int,
  status            text not null default 'queued'
    check (status in ('queued','ringing','answered','completed','failed','no_answer','abandoned')),
  recording_url     text,
  transcript        jsonb,
  summary           text,
  intent            text check (intent in ('register','info','visit','price','schedule','other') or intent is null),
  next_steps        text[],
  raw_payload       jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists lead_calls_lead_idx    on fotbal.lead_calls(lead_id);
create index if not exists lead_calls_status_idx  on fotbal.lead_calls(status);
create index if not exists lead_calls_created_idx on fotbal.lead_calls(created_at desc);

-- =====================================================================
-- lead_notifications — outbox for trainer/boss alerts across channels
-- =====================================================================
create table if not exists fotbal.lead_notifications (
  id                   uuid primary key default gen_random_uuid(),
  recipient_trainer_id text not null,
  channel              text not null check (channel in ('push','whatsapp','email','inapp')),
  type                 text not null,                   -- 'new_lead_transcript' | ...
  payload              jsonb not null,
  read_at              timestamptz,
  delivered_at         timestamptz,
  delivery_error       text,
  created_at           timestamptz not null default now()
);

create index if not exists lead_notif_recipient_unread_idx
  on fotbal.lead_notifications(recipient_trainer_id) where read_at is null;
create index if not exists lead_notif_recipient_idx
  on fotbal.lead_notifications(recipient_trainer_id, created_at desc);

-- =====================================================================
-- RLS — trainers see only their assigned + cc'd leads
-- The session JWT must include `trainer_id` (set in the auth hook).
-- =====================================================================
alter table fotbal.leads               enable row level security;
alter table fotbal.lead_calls          enable row level security;
alter table fotbal.lead_notifications  enable row level security;

drop policy if exists "trainer reads own + cc leads" on fotbal.leads;
create policy "trainer reads own + cc leads" on fotbal.leads
  for select using (
    auth.jwt() ->> 'trainer_id' = assigned_trainer_id
    or (auth.jwt() ->> 'trainer_id') = any(cc_trainer_ids)
  );

drop policy if exists "trainer reads calls of own leads" on fotbal.lead_calls;
create policy "trainer reads calls of own leads" on fotbal.lead_calls
  for select using (
    exists(
      select 1 from fotbal.leads l
      where l.id = lead_calls.lead_id
        and (auth.jwt() ->> 'trainer_id' = l.assigned_trainer_id
             or (auth.jwt() ->> 'trainer_id') = any(l.cc_trainer_ids))
    )
  );

drop policy if exists "trainer reads own notifications" on fotbal.lead_notifications;
create policy "trainer reads own notifications" on fotbal.lead_notifications
  for select using (auth.jwt() ->> 'trainer_id' = recipient_trainer_id);

drop policy if exists "trainer marks own notifications read" on fotbal.lead_notifications;
create policy "trainer marks own notifications read" on fotbal.lead_notifications
  for update using (auth.jwt() ->> 'trainer_id' = recipient_trainer_id)
  with check  (auth.jwt() ->> 'trainer_id' = recipient_trainer_id);

-- =====================================================================
-- helpers
-- =====================================================================

-- Resolve trainer id from child age (mirrors AGE_GROUPS in landing.ts)
create or replace function fotbal.lead_trainer_for_age(age int)
returns text language sql immutable as $$
  select case
    when age between  5 and  9  then 't-sopi'
    when age between 10 and 13  then 't-kelemen'
    when age between 14 and 15  then 't-dan'
    else 't-dan'
  end
$$;

-- Convenience view for the trainer inbox
create or replace view fotbal.v_trainer_inbox as
  select
    l.id              as lead_id,
    l.parent_name,
    l.parent_phone_e164,
    l.child_name,
    l.child_age,
    l.status,
    l.assigned_trainer_id,
    l.cc_trainer_ids,
    l.created_at      as lead_created_at,
    lc.id             as call_id,
    lc.duration_seconds,
    lc.summary,
    lc.intent,
    lc.next_steps,
    lc.recording_url,
    lc.created_at     as call_created_at
  from fotbal.leads l
  left join lateral (
    select * from fotbal.lead_calls c
    where c.lead_id = l.id and c.status = 'completed'
    order by c.created_at desc
    limit 1
  ) lc on true;

comment on table fotbal.leads               is 'Inbound parent leads — populated by /api/lead/create.';
comment on table fotbal.lead_calls          is 'AI voice call records — populated by Pipecat webhook on call end.';
comment on table fotbal.lead_notifications  is 'Cross-channel notification outbox for trainers and the boss.';
