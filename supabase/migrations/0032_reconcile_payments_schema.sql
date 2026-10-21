-- 0032 — reconcile production's payments schema with 0014 (2026-10 audit).
--
-- Production never received 0014_payments. A hand-applied migration
-- (enrollment_fees_and_rpcs) created a different fotbal.child_charges
-- (period_month date, status text, no kind/period_year/due_date) and no
-- group_fees / child_payments at all. Everything in the repo uses the 0014
-- shape, so in production:
--   - enroll_accept (0023) inserts kind/period_year/due_date and fails, which
--     blocks accepting any child while academy_settings.monthly_fee_ron > 0;
--   - cron/generate-monthly-charges and cron/close-overdue-accounts error out;
--   - the admin Payments tab and the parent's payments view cannot load.
--
-- On a database built from the repo this is a no-op: child_charges already has
-- due_date, and every statement below is idempotent. Run 0015 too — production
-- is also missing the closed_unpaid / transferred child_status values.

do $$
begin
  if to_regclass('fotbal.child_charges') is not null
     and not exists (
       select 1 from information_schema.columns
        where table_schema = 'fotbal'
          and table_name = 'child_charges'
          and column_name = 'due_date'
     ) then
    if exists (select 1 from fotbal.child_charges) then
      raise exception 'fotbal.child_charges has legacy-shaped rows; migrate them by hand before 0032';
    end if;
    drop table fotbal.child_charges;
  end if;
end $$;

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
  unique (child_id, kind, period_year, period_month)
);
create index if not exists child_charges_child_idx on fotbal.child_charges (child_id, due_date desc);
create index if not exists child_charges_due_idx on fotbal.child_charges (due_date);

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

alter table fotbal.group_fees enable row level security;
alter table fotbal.child_charges enable row level security;
alter table fotbal.child_payments enable row level security;

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

grant select, insert, update, delete on fotbal.group_fees, fotbal.child_charges, fotbal.child_payments to authenticated, service_role;
