-- Application checks provide quick feedback. This trigger makes the active
-- KYC meter allowance authoritative during concurrent meter-link requests.
create or replace function public.enforce_customer_meter_tier_allowance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier integer;
  v_limit integer;
  v_active_count integer;
begin
  if new.status = 'rejected' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.customer_id::text));

  select kyc_tier into v_tier
  from public.customers
  where id = new.customer_id
  for key share;
  if not found then
    raise exception using errcode = 'P0001', message = 'customer_meter_customer_missing';
  end if;

  select case v_tier
    when 1 then tier1_meter_limit
    when 2 then tier2_meter_limit
    else tier0_meter_limit
  end into v_limit
  from public.kyc_tier_settings
  where singleton = true;
  if v_limit is null then
    raise exception using errcode = 'P0001', message = 'customer_meter_policy_unavailable';
  end if;

  select count(*) into v_active_count
  from public.customer_meters
  where customer_id = new.customer_id
    and status <> 'rejected'
    and (tg_op = 'INSERT' or id <> new.id);

  if v_active_count >= v_limit then
    raise exception using errcode = 'P0001', message = 'customer_meter_limit_reached';
  end if;
  return new;
end;
$$;

drop trigger if exists customer_meter_tier_allowance on public.customer_meters;
create trigger customer_meter_tier_allowance
before insert or update of status, customer_id on public.customer_meters
for each row execute function public.enforce_customer_meter_tier_allowance();

revoke all on function public.enforce_customer_meter_tier_allowance() from public, anon, authenticated;
grant execute on function public.enforce_customer_meter_tier_allowance() to service_role;

notify pgrst, 'reload schema';
