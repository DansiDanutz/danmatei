-- Phase 1 (match squads): owner-only override to assign ANY child of ANY age
-- into ANY group. Applied to production via MCP (migration
-- "assign_child_to_group_rpc"); kept here for source-control traceability.
--
-- Sets the target group, inherits that group's trainer, and marks the child
-- accepted. Deliberately does NOT create a fee charge (that is enrollment's
-- job) so moving a child between groups never double-charges.

create or replace function fotbal.assign_child_to_group(p_child uuid, p_group uuid)
returns void
language plpgsql
security definer
set search_path to 'fotbal', 'public'
as $function$
declare v_trainer uuid;
begin
  if not fotbal.is_owner() then
    raise exception 'not_authorized';
  end if;

  select trainer_id into v_trainer from fotbal.groups where id = p_group;

  update fotbal.children
     set group_id = p_group,
         trainer_id = v_trainer,
         assignment_status = 'accepted',
         updated_at = now()
   where id = p_child;
end;
$function$;

grant execute on function fotbal.assign_child_to_group(uuid, uuid) to authenticated, service_role;
