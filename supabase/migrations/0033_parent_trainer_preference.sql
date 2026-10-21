-- 0033 — follow-up to 0030 (review of PR #148).
--
-- 1. 0030 kept the trainer a parent picks at signup in children.trainer_id
--    while forcing the child to 'pending'. But trainer_id is what grants
--    membership everywhere (group messages, schedule, match photos,
--    add_match_photo, attendance), so a parent could still read a group's
--    private data before staff accepted the child. Keep the parent's pick as a
--    preference instead: trainer_id is only ever set by acceptance (owner /
--    trainer / server code). Pending children stay visible to trainers through
--    the birth-year rule in "children read". The client still sends
--    trainer_id; this trigger moves it.
--
-- 2. children.welcome_claimed_at lets api/whatsapp/send-welcome claim a
--    child's welcome atomically (no duplicate sends from overlapping
--    requests) and release the claim when delivery fails so it can retry.

alter table fotbal.children
  add column if not exists preferred_trainer_id uuid
    references fotbal.trainers(id) on delete set null,
  add column if not exists welcome_claimed_at timestamptz;

create or replace function fotbal.tg_children_lock_placement() returns trigger
language plpgsql security definer set search_path = fotbal, public as $$
begin
  -- Service role (auth.uid() null), owners and trainers manage placement.
  if auth.uid() is null or fotbal.is_owner() or fotbal.my_trainer_id() is not null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.preferred_trainer_id := coalesce(new.preferred_trainer_id, new.trainer_id);
    new.trainer_id := null;
    new.group_id := null;
    new.assignment_status := 'pending'::fotbal.assignment_status;
    new.status := 'active'::fotbal.child_status;
  else
    new.parent_id := old.parent_id;
    new.trainer_id := old.trainer_id;
    new.group_id := old.group_id;
    new.assignment_status := old.assignment_status;
    new.status := old.status;
    new.welcome_claimed_at := old.welcome_claimed_at;
  end if;
  return new;
end $$;
