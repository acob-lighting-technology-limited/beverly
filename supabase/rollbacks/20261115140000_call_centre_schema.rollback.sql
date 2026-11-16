-- Rollback for 20261115140000_call_centre_schema.sql
--
-- Refuses to drop while the schema holds data. The audit log is a legal record of STS token
-- unmasking and must be exported and archived first; tickets and callbacks are customer-facing.

do $$
declare
  n bigint;
begin
  if to_regclass('call_centre.audit_log') is not null then
    select count(*) into n from call_centre.audit_log;
    if n > 0 then
      raise exception 'call_centre.audit_log holds % rows; export and archive them before rolling back', n;
    end if;
  end if;
  if to_regclass('call_centre.tickets') is not null then
    select count(*) into n from call_centre.tickets;
    if n > 0 then
      raise exception 'call_centre.tickets holds % rows; export them before rolling back', n;
    end if;
  end if;
  if to_regclass('call_centre.callbacks') is not null then
    select count(*) into n from call_centre.callbacks where status in ('pending', 'assigned');
    if n > 0 then
      raise exception 'call_centre.callbacks has % open callbacks; complete or export them first', n;
    end if;
  end if;
end $$;

drop schema if exists call_centre cascade;

-- Role is dropped last; it owns nothing and holds no remaining grants.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'beverly_call_api') then
    drop owned by beverly_call_api;
    drop role beverly_call_api;
  end if;
end $$;

notify pgrst, 'reload schema';
