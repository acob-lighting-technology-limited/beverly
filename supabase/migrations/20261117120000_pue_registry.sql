-- Beverly PUE registry: sites, swap stations, bikes, batteries, riders, and bike sales.
--
-- PUE (battery swap) has its OWN rider registry: riders may have no electricity meter,
-- so they are NOT rows in public.customers. pue_riders.beverly_customer_id is a
-- nullable link for binding a rider to a Beverly customer later; nothing requires it.
--
-- Telemetry (state of charge, cell voltages, location) is never stored here as
-- invented values. This migration holds identity and ownership only; live readings
-- come from the Yunhe gateway.
--
-- Access: every table has RLS enabled and a deny-all policy for anon and authenticated.
-- The wallet backend uses the service role and enforces staff roles and audit logging.

create table if not exists public.pue_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  state text not null check (length(btrim(state)) between 2 and 60),
  community text,
  -- Beverly mini-grid station id (e.g. MUSHA) when the site sits on one. No FK: stations are config-driven.
  beverly_station_id text,
  -- Site id on the Yunhe platform, when one has been created there.
  yunhe_site_id text unique,
  address text,
  lat numeric(9,6) check (lat is null or lat between -90 and 90),
  lng numeric(9,6) check (lng is null or lng between -180 and 180),
  status text not null default 'planned' check (status in ('planned', 'active', 'inactive')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state, name)
);

create table if not exists public.pue_swap_stations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.pue_sites(id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 120),
  -- attendant: a person verifies the receipt and hands over the battery. cabinet: the cabinet releases the bay.
  handover_mode text not null default 'attendant' check (handover_mode in ('attendant', 'cabinet')),
  bay_count integer check (bay_count is null or bay_count between 0 and 200),
  yunhe_station_id text unique,
  status text not null default 'planned' check (status in ('planned', 'active', 'inactive')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, name)
);

create table if not exists public.pue_bikes (
  id uuid primary key default gen_random_uuid(),
  serial_number text not null unique check (length(btrim(serial_number)) between 3 and 64),
  model text,
  status text not null default 'in_stock' check (status in ('in_stock', 'sold', 'repossessed', 'retired')),
  -- Where an unsold bike is stocked.
  site_id uuid references public.pue_sites(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pue_batteries (
  id uuid primary key default gen_random_uuid(),
  -- Yunhe "battery number" (BT...), the key used with the platform API.
  battery_number text not null unique check (length(btrim(battery_number)) between 3 and 64),
  serial_number text unique,
  imsi text unique,
  -- Cell count is read from the platform, never assumed. The demo battery reports 15.
  cell_count integer check (cell_count is null or cell_count between 1 and 64),
  status text not null default 'in_stock' check (status in ('in_stock', 'in_bay', 'with_rider', 'maintenance', 'lost', 'retired')),
  station_id uuid references public.pue_swap_stations(id) on delete set null,
  bike_id uuid references public.pue_bikes(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pue_riders (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  phone text not null unique check (phone ~ '^\+?[0-9]{7,15}$'),
  email text,
  address text,
  site_id uuid references public.pue_sites(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  -- Optional later binding to a Beverly customer. Deleting the customer keeps the rider.
  beverly_customer_id uuid references public.customers(id) on delete set null,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pue_riders_beverly_customer_key
  on public.pue_riders (beverly_customer_id) where beverly_customer_id is not null;

-- A bike sale or hire-purchase. Payments are recorded in the shared ledger, not here.
create table if not exists public.pue_bike_assignments (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.pue_riders(id) on delete restrict,
  bike_id uuid not null references public.pue_bikes(id) on delete restrict,
  sale_type text not null check (sale_type in ('full', 'instalment')),
  total_minor bigint not null check (total_minor >= 0),
  deposit_minor bigint not null default 0 check (deposit_minor >= 0 and deposit_minor <= total_minor),
  status text not null default 'active' check (status in ('active', 'completed', 'repossessed', 'cancelled')),
  starts_on date not null default current_date,
  ended_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active') = (ended_at is null))
);

-- One live assignment per bike.
create unique index if not exists pue_bike_assignments_one_active_per_bike
  on public.pue_bike_assignments (bike_id) where status = 'active';
create index if not exists pue_bike_assignments_rider_idx on public.pue_bike_assignments (rider_id);
create index if not exists pue_batteries_station_idx on public.pue_batteries (station_id);
create index if not exists pue_batteries_bike_idx on public.pue_batteries (bike_id);
create index if not exists pue_swap_stations_site_idx on public.pue_swap_stations (site_id);
create index if not exists pue_riders_site_idx on public.pue_riders (site_id);

do $$
declare t text;
begin
  foreach t in array array['pue_sites', 'pue_swap_stations', 'pue_bikes', 'pue_batteries', 'pue_riders', 'pue_bike_assignments']
  loop
    execute format('drop trigger if exists set_%1$s_updated_at on public.%1$I', t);
    execute format('create trigger set_%1$s_updated_at before update on public.%1$I for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_deny_clients', t);
    execute format('create policy %I on public.%I for all to anon, authenticated using (false) with check (false)', t || '_deny_clients', t);
    execute format('revoke all on public.%I from anon, authenticated, public', t);
    execute format('grant select, insert, update on public.%I to service_role', t);
  end loop;
end $$;

comment on table public.pue_riders is 'Beverly PUE riders (own CRM). beverly_customer_id is an optional later binding.';

-- Atomic sale: assigns a bike to a rider and marks the bike sold in one transaction.
-- Raises 'rider_not_active' or 'bike_not_available' (errcode P0002); a second live
-- assignment for the same bike is also blocked by pue_bike_assignments_one_active_per_bike.
create or replace function public.pue_assign_bike(
  p_rider_id uuid, p_bike_id uuid, p_sale_type text,
  p_total_minor bigint, p_deposit_minor bigint, p_actor uuid
) returns public.pue_bike_assignments
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.pue_bike_assignments;
begin
  if not exists (select 1 from public.pue_riders where id = p_rider_id and status = 'active') then
    raise exception 'rider_not_active' using errcode = 'P0002';
  end if;
  perform 1 from public.pue_bikes where id = p_bike_id and status in ('in_stock', 'repossessed') for update;
  if not found then
    raise exception 'bike_not_available' using errcode = 'P0002';
  end if;
  insert into public.pue_bike_assignments (rider_id, bike_id, sale_type, total_minor, deposit_minor, created_by)
  values (p_rider_id, p_bike_id, p_sale_type, p_total_minor, p_deposit_minor, p_actor)
  returning * into v_row;
  update public.pue_bikes set status = 'sold' where id = p_bike_id;
  return v_row;
end $$;

-- Ends a live assignment and sets the bike status to match the outcome.
create or replace function public.pue_end_assignment(p_id uuid, p_outcome text)
returns public.pue_bike_assignments
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.pue_bike_assignments;
begin
  if p_outcome not in ('completed', 'repossessed', 'cancelled') then
    raise exception 'invalid_outcome' using errcode = '22023';
  end if;
  update public.pue_bike_assignments set status = p_outcome, ended_at = now()
  where id = p_id and status = 'active' returning * into v_row;
  if not found then
    raise exception 'assignment_not_active' using errcode = 'P0002';
  end if;
  update public.pue_bikes
  set status = case p_outcome when 'completed' then 'sold' when 'repossessed' then 'repossessed' else 'in_stock' end
  where id = v_row.bike_id;
  return v_row;
end $$;

revoke execute on function public.pue_assign_bike(uuid, uuid, text, bigint, bigint, uuid) from public, anon, authenticated;
revoke execute on function public.pue_end_assignment(uuid, text) from public, anon, authenticated;
grant execute on function public.pue_assign_bike(uuid, uuid, text, bigint, bigint, uuid) to service_role;
grant execute on function public.pue_end_assignment(uuid, text) to service_role;
