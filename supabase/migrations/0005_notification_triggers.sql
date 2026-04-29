-- =============================================================================
-- 0005 — Notification triggers for key events
-- =============================================================================

set search_path = fotbal, public;

-- ---------------------------------------------------------------------------
-- 1) Message notifications
-- When a trainer sends a message (group or individual), notify relevant parents.
-- ---------------------------------------------------------------------------

create or replace function fotbal.tg_notify_message()
returns trigger
language plpgsql
as $$
declare
  trainer_name text;
  child_rec record;
begin
  select p.full_name into trainer_name
  from fotbal.profiles p
  join fotbal.trainers t on t.profile_id = p.id
  where t.id = new.trainer_id;

  -- Group message → all parents with children assigned to this trainer
  if new.audience = 'group' then
    for child_rec in
      select distinct c.parent_id
      from fotbal.children c
      where c.trainer_id = new.trainer_id and c.status = 'active'
    loop
      insert into fotbal.notifications (recipient_id, kind, title, body, link)
      values (
        child_rec.parent_id,
        'message_group',
        'Mesaj de la antrenor',
        coalesce(trainer_name, 'Antrenorul') || ': ' || left(new.body_md, 200),
        '/copil/' || (
          select c2.id from fotbal.children c2
          where c2.parent_id = child_rec.parent_id and c2.trainer_id = new.trainer_id
          limit 1
        ) || '/mesaje'
      );
    end loop;

  -- Individual child or parent message → specific child's parent
  elsif new.audience in ('child', 'parent') and new.child_id is not null then
    insert into fotbal.notifications (recipient_id, kind, title, body, link)
    select
      c.parent_id,
      'message_individual',
      'Mesaj individual',
      coalesce(trainer_name, 'Antrenorul') || ': ' || left(new.body_md, 200),
      '/copil/' || new.child_id || '/mesaje'
    from fotbal.children c
    where c.id = new.child_id;
  end if;

  return new;
end $$;

drop trigger if exists notify_message on fotbal.messages;
create trigger notify_message
  after insert on fotbal.messages
  for each row execute function fotbal.tg_notify_message();

-- ---------------------------------------------------------------------------
-- 2) Match scheduled notification
-- When a match event is created, notify parents of children in that trainer's group.
-- ---------------------------------------------------------------------------

create or replace function fotbal.tg_notify_match_scheduled()
returns trigger
language plpgsql
as $$
declare
  child_rec record;
begin
  if new.kind = 'match' then
    for child_rec in
      select distinct c.parent_id
      from fotbal.children c
      where c.trainer_id = new.trainer_id and c.status = 'active'
    loop
      insert into fotbal.notifications (recipient_id, kind, title, body, link)
      values (
        child_rec.parent_id,
        'match_scheduled',
        'Meci programat',
        new.title || ' — ' || coalesce(new.location, 'Locație nedeterminată'),
        null
      );
    end loop;
  end if;

  return new;
end $$;

drop trigger if exists notify_match_scheduled on fotbal.schedule_events;
create trigger notify_match_scheduled
  after insert on fotbal.schedule_events
  for each row execute function fotbal.tg_notify_match_scheduled();

-- ---------------------------------------------------------------------------
-- 3) Match result notification
-- When a match result is posted, notify parents of children who participated.
-- ---------------------------------------------------------------------------

create or replace function fotbal.tg_notify_match_result()
returns trigger
language plpgsql
as $$
declare
  event_title text;
  event_starts timestamptz;
  event_trainer uuid;
  child_rec record;
begin
  select s.title, s.starts_at, s.trainer_id
  into event_title, event_starts, event_trainer
  from fotbal.schedule_events s
  where s.id = new.event_id;

  -- Notify parents of participating children
  for child_rec in
    select distinct c.parent_id
    from fotbal.match_participations mp
    join fotbal.children c on c.id = mp.child_id
    where mp.event_id = new.event_id
  loop
    insert into fotbal.notifications (recipient_id, kind, title, body, link)
    values (
      child_rec.parent_id,
      'match_result',
      'Rezultat meci disponibil',
      coalesce(event_title, 'Meci') || ': '
        || new.our_score || ' - ' || new.opponent_score,
      null
    );
  end loop;

  -- Also notify parents of all children in the trainer group (in case some didn't participate)
  for child_rec in
    select distinct c.parent_id
    from fotbal.children c
    where c.trainer_id = event_trainer and c.status = 'active'
      and not exists (
        select 1 from fotbal.notifications n
        where n.recipient_id = c.parent_id
          and n.kind = 'match_result'
          and n.created_at > now() - interval '1 minute'
      )
  loop
    insert into fotbal.notifications (recipient_id, kind, title, body, link)
    values (
      child_rec.parent_id,
      'match_result',
      'Rezultat meci disponibil',
      coalesce(event_title, 'Meci') || ': '
        || new.our_score || ' - ' || new.opponent_score,
      null
    );
  end loop;

  return new;
end $$;

drop trigger if exists notify_match_result on fotbal.match_results;
create trigger notify_match_result
  after insert on fotbal.match_results
  for each row execute function fotbal.tg_notify_match_result();
