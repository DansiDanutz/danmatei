-- =============================================================================
-- 0013 — Two-way messaging
-- =============================================================================
-- Adds sender_role to fotbal.messages so parents can reply. Trainer remains
-- the default for back-compat. New parent-write RLS lets a parent post when
-- the child belongs to them. Updates the notify trigger to fire to the trainer
-- instead of the parent for parent-authored rows.

set search_path = fotbal, public;

-- Column
alter table fotbal.messages
  add column if not exists sender_role text not null default 'trainer'
    check (sender_role in ('trainer','parent'));

-- Parent INSERT policy: child must belong to the caller, audience must be
-- 'child' or 'parent' (parents don't post group broadcasts), sender_role='parent'.
drop policy if exists "messages parent write" on fotbal.messages;
create policy "messages parent write" on fotbal.messages
  for insert with check (
    sender_role = 'parent'
    and audience in ('child','parent')
    and child_id is not null
    and exists (
      select 1 from fotbal.children c
      where c.id = child_id and c.parent_id = auth.uid()
    )
  );

-- Replace tg_notify_message so it fans differently depending on sender_role
create or replace function fotbal.tg_notify_message()
returns trigger
language plpgsql
security definer
set search_path = fotbal, public
as $$
declare
  trainer_profile uuid;
  child_parent uuid;
begin
  if new.sender_role = 'parent' then
    -- Parent → trainer: notify the trainer that owns this group
    select t.profile_id into trainer_profile from fotbal.trainers t where t.id = new.trainer_id;
    if trainer_profile is not null then
      insert into fotbal.notifications (recipient_id, kind, title, body, link)
      values (trainer_profile, 'message_from_parent',
              'Mesaj nou de la părinte',
              left(new.body_md, 280),
              '/antrenor#mesaje');
    end if;
  else
    -- Trainer → parent(s) (original behavior preserved)
    if new.audience = 'group' then
      insert into fotbal.notifications (recipient_id, kind, title, body, link)
      select c.parent_id, 'message_group', 'Mesaj nou de la antrenor',
             left(new.body_md, 280), '/copil/' || c.id
      from fotbal.children c
      where c.trainer_id = new.trainer_id and c.status = 'active';
    elsif new.audience in ('child','parent') and new.child_id is not null then
      select c.parent_id into child_parent from fotbal.children c where c.id = new.child_id;
      if child_parent is not null then
        insert into fotbal.notifications (recipient_id, kind, title, body, link)
        values (child_parent, 'message_individual', 'Mesaj nou de la antrenor',
                left(new.body_md, 280), '/copil/' || new.child_id);
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Trigger doesn't need to be recreated; CREATE OR REPLACE FUNCTION suffices.
