-- Daily coaching digest: one tailored tip/advice/report per trainer + owner.
-- Applied to production via MCP (migration "coaching_tips_table"); kept here
-- for source-control traceability.

create table if not exists fotbal.coaching_tips (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references fotbal.profiles(id) on delete cascade,
  age_band text,
  theme text,
  title text not null,
  body_md text not null,
  source text,
  tip_date date not null,
  created_at timestamptz not null default now(),
  unique (recipient_id, tip_date)
);

alter table fotbal.coaching_tips enable row level security;

-- Recipients read their own tips; the owner can read everyone's (oversight).
-- Inserts happen service-role only (the cron); no write policy for users.
create policy "coaching read own" on fotbal.coaching_tips
  for select using (recipient_id = auth.uid() or fotbal.is_owner());

grant select on fotbal.coaching_tips to authenticated;

create index if not exists coaching_tips_recipient_date_idx
  on fotbal.coaching_tips (recipient_id, tip_date desc);
