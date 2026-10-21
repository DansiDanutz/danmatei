-- 0034 — close anonymous read of pending children (review of PR #148).
--
-- "children read" / "children update" let anyone see a pending, unassigned
-- child whose birth year is inside fotbal.my_group_year_range(). For a caller
-- who isn't a trainer (including anon, which has SELECT on the table) that
-- range is null, and the coalesce(…, 0) / coalesce(…, 9999) defaults turned it
-- into "every year" — so visitors could read pending children's names, birth
-- dates, schools and medical notes. 0033 made every new signup pending and
-- unassigned, widening this. The branch now requires a signed-in trainer whose
-- own groups cover the child's birth year (no default range).

drop policy if exists "children read" on fotbal.children;
create policy "children read" on fotbal.children
  for select using (
    parent_id = auth.uid()
    or fotbal.is_owner()
    or trainer_id = fotbal.my_trainer_id()
    or (
      fotbal.my_trainer_id() is not null
      and trainer_id is null
      and assignment_status = 'pending'::fotbal.assignment_status
      and extract(year from dob)::int between
        (select year_min from fotbal.my_group_year_range())
        and (select year_max from fotbal.my_group_year_range())
    )
  );

drop policy if exists "children update" on fotbal.children;
create policy "children update" on fotbal.children
  for update using (
    parent_id = auth.uid()
    or fotbal.is_owner()
    or trainer_id = fotbal.my_trainer_id()
    or (
      fotbal.my_trainer_id() is not null
      and trainer_id is null
      and assignment_status = 'pending'::fotbal.assignment_status
      and extract(year from dob)::int between
        (select year_min from fotbal.my_group_year_range())
        and (select year_max from fotbal.my_group_year_range())
    )
  )
  with check (
    parent_id = auth.uid()
    or fotbal.is_owner()
    or trainer_id = fotbal.my_trainer_id()
  );
