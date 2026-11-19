-- Beverly PUE appliances (fridges, grinders and similar): catalogue, stock units, sales to Beverly CRM
-- customers (full or instalment), append-only payments, and fault/service tickets.
-- Customers are the existing Beverly CRM customers (public.customers); the optional meter_id ties a sale
-- to one of that customer's meters (public.customer_meters.meter_id). No remote control lives here:
-- nothing in this schema claims a physical switch happened.

create table if not exists public.pue_appliance_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 120),
  category text not null default 'other' check (category in ('fridge', 'grinder', 'freezer', 'other')),
  default_price_minor bigint check (default_price_minor is null or default_price_minor >= 0),
  active boolean not null default true,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pue_appliances (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references public.pue_appliance_types(id) on delete restrict,
  serial_number text not null unique check (char_length(serial_number) between 3 and 64),
  site_id uuid references public.pue_sites(id) on delete set null,
  status text not null default 'in_stock' check (status in ('in_stock', 'sold', 'faulty', 'retired')),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pue_appliances_type_idx on public.pue_appliances (type_id);
create index if not exists pue_appliances_site_idx on public.pue_appliances (site_id);

create table if not exists public.pue_appliance_sales (
  id uuid primary key default gen_random_uuid(),
  appliance_id uuid not null references public.pue_appliances(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  meter_id text,
  sale_type text not null check (sale_type in ('full', 'instalment')),
  total_minor bigint not null check (total_minor > 0),
  deposit_minor bigint not null default 0 check (deposit_minor >= 0 and deposit_minor <= total_minor),
  status text not null default 'active' check (status in ('active', 'completed', 'repossessed', 'cancelled')),
  starts_on date not null default current_date,
  ended_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active') = (ended_at is null))
);
-- One live sale per appliance.
create unique index if not exists pue_appliance_sales_one_active
  on public.pue_appliance_sales (appliance_id) where status = 'active';
create index if not exists pue_appliance_sales_customer_idx on public.pue_appliance_sales (customer_id);

-- Money received. Append-only: a wrong entry is corrected by an operator process, never edited or deleted.
create table if not exists public.pue_appliance_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.pue_appliance_sales(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  method text not null check (method in ('cash', 'transfer', 'pos')),
  reference text check (reference is null or char_length(reference) <= 80),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 120),
  recorded_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists pue_appliance_payments_sale_idx on public.pue_appliance_payments (sale_id);

create or replace function public.pue_appliance_payments_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'pue_appliance_payments is append-only' using errcode = '55000';
end $$;
drop trigger if exists pue_appliance_payments_no_change on public.pue_appliance_payments;
create trigger pue_appliance_payments_no_change before update or delete on public.pue_appliance_payments
  for each row execute function public.pue_appliance_payments_immutable();

create table if not exists public.pue_appliance_faults (
  id uuid primary key default gen_random_uuid(),
  appliance_id uuid not null references public.pue_appliances(id) on delete restrict,
  summary text not null check (char_length(summary) between 3 and 300),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  resolution text check (resolution is null or char_length(resolution) <= 500),
  reported_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'resolved') = (resolved_at is not null))
);
create index if not exists pue_appliance_faults_appliance_idx on public.pue_appliance_faults (appliance_id);

do $$
declare t text;
begin
  foreach t in array array['pue_appliance_types', 'pue_appliances', 'pue_appliance_sales', 'pue_appliance_payments', 'pue_appliance_faults']
  loop
    if t <> 'pue_appliance_payments' then
      execute format('drop trigger if exists set_%1$s_updated_at on public.%1$I', t);
      execute format('create trigger set_%1$s_updated_at before update on public.%1$I for each row execute function public.set_updated_at()', t);
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_deny_clients', t);
    execute format('create policy %I on public.%I for all to anon, authenticated using (false) with check (false)', t || '_deny_clients', t);
    execute format('revoke all on public.%I from anon, authenticated, public', t);
  end loop;
end $$;
grant select, insert, update on public.pue_appliance_types, public.pue_appliances, public.pue_appliance_sales, public.pue_appliance_faults to service_role;
grant select, insert on public.pue_appliance_payments to service_role;

-- Sell one in-stock appliance to an active Beverly customer. A deposit is recorded as the first payment;
-- a sale paid in full is completed straight away.
create or replace function public.pue_sell_appliance(
  p_appliance_id uuid, p_customer_id uuid, p_meter_id text, p_sale_type text,
  p_total_minor bigint, p_deposit_minor bigint, p_deposit_method text, p_actor uuid
) returns public.pue_appliance_sales
language plpgsql security definer set search_path = public as $$
declare
  v_appliance public.pue_appliances;
  v_sale public.pue_appliance_sales;
  v_status text;
begin
  select * into v_appliance from public.pue_appliances where id = p_appliance_id for update;
  if not found then raise exception 'appliance_not_found' using errcode = 'P0002'; end if;
  if v_appliance.status <> 'in_stock' then raise exception 'appliance_not_available' using errcode = 'P0002'; end if;

  select status into v_status from public.customers where id = p_customer_id;
  if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;
  if v_status is distinct from 'active' then raise exception 'customer_not_active' using errcode = 'P0002'; end if;

  if p_meter_id is not null and not exists (
    select 1 from public.customer_meters where customer_id = p_customer_id and meter_id = p_meter_id
  ) then
    raise exception 'meter_not_on_customer' using errcode = 'P0002';
  end if;

  insert into public.pue_appliance_sales (appliance_id, customer_id, meter_id, sale_type, total_minor, deposit_minor, created_by)
  values (p_appliance_id, p_customer_id, p_meter_id, p_sale_type, p_total_minor, p_deposit_minor, p_actor)
  returning * into v_sale;

  if p_deposit_minor > 0 then
    insert into public.pue_appliance_payments (sale_id, amount_minor, method, reference, idempotency_key, recorded_by)
    values (v_sale.id, p_deposit_minor, coalesce(p_deposit_method, 'cash'), 'deposit', 'deposit:' || v_sale.id::text, p_actor);
  end if;

  update public.pue_appliances set status = 'sold' where id = p_appliance_id;

  if p_deposit_minor = p_total_minor then
    update public.pue_appliance_sales set status = 'completed', ended_at = now() where id = v_sale.id returning * into v_sale;
  end if;
  return v_sale;
end $$;

-- Record a payment against an active sale. Replaying the same idempotency key returns the same sale and adds nothing.
create or replace function public.pue_record_appliance_payment(
  p_sale_id uuid, p_amount_minor bigint, p_method text, p_reference text, p_key text, p_actor uuid
) returns public.pue_appliance_sales
language plpgsql security definer set search_path = public as $$
declare
  v_sale public.pue_appliance_sales;
  v_paid bigint;
  v_existing public.pue_appliance_payments;
begin
  select * into v_existing from public.pue_appliance_payments where idempotency_key = p_key;
  if found then
    if v_existing.sale_id <> p_sale_id or v_existing.amount_minor <> p_amount_minor then
      raise exception 'idempotency_conflict' using errcode = 'P0002';
    end if;
    select * into v_sale from public.pue_appliance_sales where id = p_sale_id;
    return v_sale;
  end if;

  select * into v_sale from public.pue_appliance_sales where id = p_sale_id for update;
  if not found then raise exception 'sale_not_found' using errcode = 'P0002'; end if;
  if v_sale.status <> 'active' then raise exception 'sale_not_active' using errcode = 'P0002'; end if;

  select coalesce(sum(amount_minor), 0) into v_paid from public.pue_appliance_payments where sale_id = p_sale_id;
  if v_paid + p_amount_minor > v_sale.total_minor then raise exception 'overpayment' using errcode = 'P0002'; end if;

  insert into public.pue_appliance_payments (sale_id, amount_minor, method, reference, idempotency_key, recorded_by)
  values (p_sale_id, p_amount_minor, p_method, p_reference, p_key, p_actor);

  if v_paid + p_amount_minor = v_sale.total_minor then
    update public.pue_appliance_sales set status = 'completed', ended_at = now() where id = p_sale_id returning * into v_sale;
  end if;
  return v_sale;
end $$;

-- Take an active sale back (repossessed) or cancel it. The unit returns to stock; money already received stays on record.
create or replace function public.pue_end_appliance_sale(p_id uuid, p_outcome text)
returns public.pue_appliance_sales
language plpgsql security definer set search_path = public as $$
declare v_sale public.pue_appliance_sales;
begin
  if p_outcome not in ('repossessed', 'cancelled') then raise exception 'invalid_outcome' using errcode = '22023'; end if;
  update public.pue_appliance_sales set status = p_outcome, ended_at = now()
  where id = p_id and status = 'active' returning * into v_sale;
  if not found then raise exception 'sale_not_active' using errcode = 'P0002'; end if;
  update public.pue_appliances set status = 'in_stock' where id = v_sale.appliance_id;
  return v_sale;
end $$;

revoke execute on function public.pue_sell_appliance(uuid, uuid, text, text, bigint, bigint, text, uuid) from public, anon, authenticated;
revoke execute on function public.pue_record_appliance_payment(uuid, bigint, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.pue_end_appliance_sale(uuid, text) from public, anon, authenticated;
revoke execute on function public.pue_appliance_payments_immutable() from public, anon, authenticated;
grant execute on function public.pue_sell_appliance(uuid, uuid, text, text, bigint, bigint, text, uuid) to service_role;
grant execute on function public.pue_record_appliance_payment(uuid, bigint, text, text, text, uuid) to service_role;
grant execute on function public.pue_end_appliance_sale(uuid, text) to service_role;
