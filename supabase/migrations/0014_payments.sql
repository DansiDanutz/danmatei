-- =============================================================================
-- 0014 — Payments / financial tracking
-- =============================================================================
-- Three tables:
-- 1. group_fees — historical fee per group (effective-dated)
-- 2. child_charges — one row per (child, month) for monthly_fee + custom charges
-- 3. child_payments — payments received

set search_path = fotbal, public;

-- 1. group_fees ---------------------------------------------------------
create table if not exists fotbal.group_fees (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references fotbal.groups(id) on delete cascade,
  monthly_fee_ron numeric(10,2) not null check (monthly_fee_ron >= 0),
  effective_from date not null default current_date,
  created_by uuid not null references fotbal.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, effective_from)
);
create index if not exists group_fees_group_idx on fotbal.group_fees (group_id, effective_from desc);

-- 2. child_charges ------------------------------------------------------
create table if not exists fotbal.child_charges (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references fotbal.children(id) on delete cascade,
  kind text not null check (kind in ('monthly_fee','custom')),
  label text,
  amount_ron numeric(10,2) not null check (amount_ron >= 0),
  period_year int,
  period_month int check (period_month between 1 and 12),
  due_date date not null,
  created_by uuid references fotbal.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (child_id, kind, period_year, period_month) -- prevent duplicate monthly_fee for same period
);
create index if not exists child_charges_child_idx on fotbal.child_charges (child_id, due_date desc);
create index if not exists child_charges_due_idx on fotbal.child_charges (due_date);

-- 3. child_payments ----------------------------------------------------
create table if not exists fotbal.child_payments (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references fotbal.children(id) on delete cascade,
  amount_ron numeric(10,2) not null check (amount_ron > 0),
  paid_at date not null default current_date,
  method text check (method in ('cash','bank_transfer','card','other')),
  note text,
  recorded_by uuid not null references fotbal.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists child_payments_child_idx on fotbal.child_payments (child_id, paid_at desc);

-- RLS ------------------------------------------------------------------
alter table fotbal.group_fees enable row level security;
alter table fotbal.child_charges enable row level security;
alter table fotbal.child_payments enable row level security;

-- group_fees: owner writes; everyone with group access can read
drop policy if exists "group_fees read" on fotbal.group_fees;
create policy "group_fees read" on fotbal.group_fees
  for select using (
    fotbal.is_owner()
    or exists (
      select 1 from fotbal.groups g where g.id = group_id
      and (g.trainer_id = fotbal.my_trainer_id() or
        exists (select 1 from fotbal.children c where c.group_id = g.id and c.parent_id = auth.uid()))
    )
  );

drop policy if exists "group_fees write" on fotbal.group_fees;
create policy "group_fees write" on fotbal.group_fees
  for all using (fotbal.is_owner()) with check (fotbal.is_owner());

-- child_charges: owner writes; trainer reads own; parent reads own children
drop policy if exists "child_charges read" on fotbal.child_charges;
create policy "child_charges read" on fotbal.child_charges
  for select using (
    fotbal.is_owner()
    or exists (
      select 1 from fotbal.children c
      where c.id = child_id and (
        c.parent_id = auth.uid()
        or c.trainer_id = fotbal.my_trainer_id()
      )
    )
  );

drop policy if exists "child_charges write" on fotbal.child_charges;
create policy "child_charges write" on fotbal.child_charges
  for all using (fotbal.is_owner()) with check (fotbal.is_owner());

-- child_payments: same read scope; owner writes
drop policy if exists "child_payments read" on fotbal.child_payments;
create policy "child_payments read" on fotbal.child_payments
  for select using (
    fotbal.is_owner()
    or exists (
      select 1 from fotbal.children c
      where c.id = child_id and (
        c.parent_id = auth.uid()
        or c.trainer_id = fotbal.my_trainer_id()
      )
    )
  );

drop policy if exists "child_payments write" on fotbal.child_payments;
create policy "child_payments write" on fotbal.child_payments
  for all using (fotbal.is_owner()) with check (fotbal.is_owner());

-- Add 'closed_unpaid' to children.status enum (if exists as enum) ----
-- Note: children.status is likely a text col. If enum, this matters.
-- Check first; assume text and rely on app-layer values.
