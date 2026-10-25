begin;

create or replace function public.invoke_consumption_sync()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_secret text; v_request_id bigint;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets
    where name='beverly_cron_secret';
  if coalesce(v_secret,'')='' then raise exception 'Consumption cron secret unavailable'; end if;
  select net.http_get(
    url := 'https://beverly.acoblighting.com/api/cron/consumption-sync?budgetMs=45000&maxPagesPerStation=20',
    headers := jsonb_build_object('Authorization','Bearer '||v_secret,'Accept','application/json'),
    timeout_milliseconds := 65000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.invoke_consumption_sync() from public,anon,authenticated;
grant execute on function public.invoke_consumption_sync() to service_role;

-- Activate only after the corrected production handler has passed its canary.
select cron.schedule('consumption-sync-hourly','20 * * * *',$job$select public.invoke_consumption_sync()$job$);
select cron.alter_job(jobid,active:=false) from cron.job where jobname='consumption-sync-hourly';

commit;
