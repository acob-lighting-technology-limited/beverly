-- Rollback for 20261115130000_call_centre_agent_role.sql
-- Refuses to drop the role while staff still hold it, so nobody is silently left without a role.

do $$
begin
  if exists (select 1 from public.users where role_key = 'custom-call-centre-agent') then
    raise exception 'custom-call-centre-agent is still assigned to staff; reassign them before rolling back';
  end if;
end $$;

delete from public.permissions where role_key = 'custom-call-centre-agent';
delete from public.roles where role_key = 'custom-call-centre-agent';

notify pgrst, 'reload schema';
