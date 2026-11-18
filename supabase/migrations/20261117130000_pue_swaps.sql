-- Beverly PUE battery swaps: reservation, payment, handover, and battery custody.
--
-- Flow: reserve a charged battery for a rider (status reserved) -> attendant records the
-- payment (paid) -> attendant hands over the reserved battery and takes back the old one
-- (completed). A reserved swap that is never paid expires. A paid swap that cannot be
-- completed is cancelled and a refund entry is recorded.
--
-- Truth rules:
--   * Charge level is NOT stored here. The backend picks the battery from live Yunhe readings
--     and passes its id in; this schema only checks the battery is free and at the station.
--   * Payments and custody are append-only (blocked update/delete/truncate). Corrections are
--     new rows. Every payment carries an idempotency key, so a retry never charges twice.
--   * Every rule that spans several tables runs inside one SECURITY DEFINER function, callable
--     only by the service role.

create table if not exists public.pue_settings (
  key text primary key check (key ~ '^[a-z_]+$'),
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

-- Defaults from the business model: NGN 1,300 per swap (in kobo), batteries issued at 90% charge or more,
-- reservations held for 30 minutes. Changeable in the app by a super admin.
insert into public.pue_settings (key, value) values
  ('swap_price_minor', '130000'::jsonb),
  ('swap_min_soc', '90'::jsonb),
  ('swap_reservation_minutes', '30'::jsonb),
  -- A battery is only offered if its last live reading is newer than this, so an old reading is never trusted.
  ('swap_max_reading_age_minutes', '120'::jsonb)
on conflict (key) do nothing;

create table if not exists public.pue_swaps (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.pue_riders(id) on delete restrict,
  station_id uuid not null references public.pue_swap_stations(id) on delete restrict,
  bike_id uuid not null references public.pue_bikes(id) on delete restrict,
  battery_out_id uuid not null references public.pue_batteries(id) on delete restrict,
  battery_in_id uuid references public.pue_batteries(id) on delete restrict,
  -- The price at the moment of reservation. Later price changes never alter it.
  price_minor bigint not null check (price_minor >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'paid', 'completed', 'cancelled', 'expired')),
  reservation_code text not null check (reservation_code ~ '^[A-Z0-9]{6}$'),
  reserved_until timestamptz not null,
  idempotency_key text not null unique check (length(idempotency_key) between 8 and 120),
  cancel_reason text,
  paid_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Concurrency guards: a rider has at most one open swap, a battery is promised to at most one open swap,
-- and a pickup code identifies one open swap.
create unique index if not exists pue_swaps_one_open_per_rider on public.pue_swaps (rider_id) where status in ('reserved', 'paid');
create unique index if not exists pue_swaps_one_open_per_battery on public.pue_swaps (battery_out_id) where status in ('reserved', 'paid');
create unique index if not exists pue_swaps_open_code on public.pue_swaps (reservation_code) where status in ('reserved', 'paid');
create index if not exists pue_swaps_station_idx on public.pue_swaps (station_id, created_at desc);
create index if not exists pue_swaps_rider_idx on public.pue_swaps (rider_id, created_at desc);

create table if not exists public.pue_swap_payments (
  id uuid primary key default gen_random_uuid(),
  swap_id uuid not null references public.pue_swaps(id) on delete restrict,
  -- A refund row records money owed back to the rider. Paying it out is done by finance.
  kind text not null check (kind in ('payment', 'refund')),
  amount_minor bigint not null check (amount_minor > 0),
  method text not null check (method in ('cash', 'transfer', 'pos', 'paystack')),
  reference text check (reference is null or length(btrim(reference)) between 3 and 80),
  idempotency_key text not null unique check (length(idempotency_key) between 8 and 120),
  recorded_by uuid,
  created_at timestamptz not null default now()
);
-- A transfer or POS reference can back only one payment.
create unique index if not exists pue_swap_payments_reference_once
  on public.pue_swap_payments (method, reference) where reference is not null and kind = 'payment';
create index if not exists pue_swap_payments_swap_idx on public.pue_swap_payments (swap_id);

create table if not exists public.pue_battery_custody (
  id uuid primary key default gen_random_uuid(),
  battery_id uuid not null references public.pue_batteries(id) on delete restrict,
  event text not null check (event in ('reserved', 'reservation_released', 'issued_to_rider', 'returned_to_station')),
  station_id uuid references public.pue_swap_stations(id) on delete restrict,
  rider_id uuid references public.pue_riders(id) on delete restrict,
  bike_id uuid references public.pue_bikes(id) on delete restrict,
  swap_id uuid references public.pue_swaps(id) on delete restrict,
  note text,
  recorded_by uuid,
  created_at timestamptz not null default now()
);
-- One row per Paystack checkout started for a swap. The webhook finds the swap through this row, never
-- through anything the payer sends. A paid attempt that cannot be applied (for example the reservation
-- expired) is marked needs_review so finance can refund it.
create table if not exists public.pue_swap_paystack_attempts (
  reference text primary key check (reference ~ '^pue-swap-[a-f0-9]{32}-[0-9]{1,3}$'),
  swap_id uuid not null references public.pue_swaps(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  -- The checkout link, kept so a second tap reuses the open checkout instead of starting another.
  authorization_url text,
  status text not null default 'initialized' check (status in ('initialized', 'succeeded', 'failed', 'needs_review')),
  review_reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pue_swap_paystack_attempts_swap_idx on public.pue_swap_paystack_attempts (swap_id);

create index if not exists pue_battery_custody_battery_idx on public.pue_battery_custody (battery_id, created_at desc);

-- Append-only: payments and custody can never be edited or removed.
create or replace function public.pue_block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only (% blocked)', tg_table_name, tg_op using errcode = '42501';
end $$;

drop trigger if exists pue_swap_payments_append_only on public.pue_swap_payments;
create trigger pue_swap_payments_append_only before update or delete on public.pue_swap_payments for each row execute function public.pue_block_mutation();
drop trigger if exists pue_swap_payments_no_truncate on public.pue_swap_payments;
create trigger pue_swap_payments_no_truncate before truncate on public.pue_swap_payments for each statement execute function public.pue_block_mutation();
drop trigger if exists pue_battery_custody_append_only on public.pue_battery_custody;
create trigger pue_battery_custody_append_only before update or delete on public.pue_battery_custody for each row execute function public.pue_block_mutation();
drop trigger if exists pue_battery_custody_no_truncate on public.pue_battery_custody;
create trigger pue_battery_custody_no_truncate before truncate on public.pue_battery_custody for each statement execute function public.pue_block_mutation();

drop trigger if exists set_pue_swap_paystack_attempts_updated_at on public.pue_swap_paystack_attempts;
create trigger set_pue_swap_paystack_attempts_updated_at before update on public.pue_swap_paystack_attempts for each row execute function public.set_updated_at();
drop trigger if exists set_pue_swaps_updated_at on public.pue_swaps;
create trigger set_pue_swaps_updated_at before update on public.pue_swaps for each row execute function public.set_updated_at();

-- RLS and privileges: no direct client access to any of these tables.
do $$
declare t text;
begin
  foreach t in array array['pue_settings', 'pue_swaps', 'pue_swap_payments', 'pue_battery_custody', 'pue_swap_paystack_attempts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_deny_clients', t);
    execute format('create policy %I on public.%I for all to anon, authenticated using (false) with check (false)', t || '_deny_clients', t);
    execute format('revoke all on public.%I from anon, authenticated, public', t);
  end loop;
end $$;
grant select, insert, update on public.pue_settings to service_role;
grant select, insert, update on public.pue_swaps to service_role;
grant select, insert on public.pue_swap_payments to service_role;
grant select, insert on public.pue_battery_custody to service_role;
grant select, insert, update on public.pue_swap_paystack_attempts to service_role;

-- ── Business rules ─────────────────────────────────────────────────────────────
-- Rule failures raise a short code with errcode P0002; the backend turns each code into a clear message.

create or replace function public.pue_setting_int(p_key text) returns bigint
language sql stable security definer set search_path = public, pg_temp as $$
  select (value #>> '{}')::bigint from public.pue_settings where key = p_key
$$;

-- Reserves a specific battery for a rider. The backend chooses p_battery_id from live charge readings.
create or replace function public.pue_reserve_swap(
  p_rider_id uuid, p_station_id uuid, p_battery_id uuid, p_code text, p_idempotency_key text, p_actor uuid
) returns public.pue_swaps
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_swap public.pue_swaps;
  v_bikes uuid[];
  v_price bigint;
  v_minutes bigint;
begin
  select * into v_swap from public.pue_swaps where idempotency_key = p_idempotency_key;
  if found then
    if v_swap.rider_id <> p_rider_id or v_swap.station_id <> p_station_id then
      raise exception 'idempotency_conflict' using errcode = 'P0002';
    end if;
    return v_swap;
  end if;

  update public.pue_swaps set status = 'expired' where status = 'reserved' and reserved_until < now();

  if not exists (select 1 from public.pue_riders where id = p_rider_id and status = 'active') then
    raise exception 'rider_not_active' using errcode = 'P0002';
  end if;
  select array_agg(bike_id) into v_bikes from public.pue_bike_assignments where rider_id = p_rider_id and status = 'active';
  if v_bikes is null then
    raise exception 'no_active_bike' using errcode = 'P0002';
  end if;
  if array_length(v_bikes, 1) > 1 then
    raise exception 'several_bikes' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.pue_swap_stations where id = p_station_id and status = 'active') then
    raise exception 'station_not_active' using errcode = 'P0002';
  end if;
  perform 1 from public.pue_batteries where id = p_battery_id and status = 'in_bay' and station_id = p_station_id for update;
  if not found then
    raise exception 'battery_not_available' using errcode = 'P0002';
  end if;

  v_price := public.pue_setting_int('swap_price_minor');
  v_minutes := public.pue_setting_int('swap_reservation_minutes');
  if v_price is null or v_minutes is null then
    raise exception 'settings_missing' using errcode = 'P0002';
  end if;

  insert into public.pue_swaps (rider_id, station_id, bike_id, battery_out_id, price_minor, reservation_code, reserved_until, idempotency_key, created_by)
  values (p_rider_id, p_station_id, v_bikes[1], p_battery_id, v_price, p_code, now() + make_interval(mins => v_minutes::int), p_idempotency_key, p_actor)
  returning * into v_swap;

  insert into public.pue_battery_custody (battery_id, event, station_id, rider_id, bike_id, swap_id, recorded_by)
  values (p_battery_id, 'reserved', p_station_id, p_rider_id, v_bikes[1], v_swap.id, p_actor);
  return v_swap;
end $$;

-- Records the payment for a reserved swap. Exactly the swap price, once.
create or replace function public.pue_record_swap_payment(
  p_swap_id uuid, p_amount_minor bigint, p_method text, p_reference text, p_idempotency_key text, p_actor uuid
) returns public.pue_swaps
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_swap public.pue_swaps; v_existing public.pue_swap_payments;
begin
  select * into v_existing from public.pue_swap_payments where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.swap_id <> p_swap_id then raise exception 'idempotency_conflict' using errcode = 'P0002'; end if;
    select * into v_swap from public.pue_swaps where id = p_swap_id;
    return v_swap;
  end if;

  select * into v_swap from public.pue_swaps where id = p_swap_id for update;
  if not found then raise exception 'swap_not_found' using errcode = 'P0002'; end if;
  if v_swap.status = 'paid' then raise exception 'already_paid' using errcode = 'P0002'; end if;
  if v_swap.status <> 'reserved' then raise exception 'swap_not_open' using errcode = 'P0002'; end if;
  -- The row is marked expired by the sweep at the start of pue_reserve_swap. Raising here rolls back any
  -- update, so this only refuses the payment.
  if v_swap.reserved_until < now() then
    raise exception 'reservation_expired' using errcode = 'P0002';
  end if;
  if p_amount_minor <> v_swap.price_minor then raise exception 'amount_mismatch' using errcode = 'P0002'; end if;

  insert into public.pue_swap_payments (swap_id, kind, amount_minor, method, reference, idempotency_key, recorded_by)
  values (p_swap_id, 'payment', p_amount_minor, p_method, nullif(btrim(p_reference), ''), p_idempotency_key, p_actor);
  update public.pue_swaps set status = 'paid', paid_at = now() where id = p_swap_id returning * into v_swap;
  return v_swap;
end $$;

-- Hands over the reserved battery and takes back the one on the bike, in one transaction.
create or replace function public.pue_complete_swap(p_swap_id uuid, p_returned_battery_id uuid, p_actor uuid)
returns public.pue_swaps
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_swap public.pue_swaps; v_on_bike uuid;
begin
  select * into v_swap from public.pue_swaps where id = p_swap_id for update;
  if not found then raise exception 'swap_not_found' using errcode = 'P0002'; end if;
  if v_swap.status = 'completed' then return v_swap; end if;
  if v_swap.status <> 'paid' then raise exception 'not_paid' using errcode = 'P0002'; end if;

  select id into v_on_bike from public.pue_batteries where bike_id = v_swap.bike_id and status = 'with_rider' limit 1;
  if v_on_bike is not null and (p_returned_battery_id is null or p_returned_battery_id <> v_on_bike) then
    raise exception 'returned_battery_mismatch' using errcode = 'P0002';
  end if;
  if v_on_bike is null and p_returned_battery_id is not null then
    raise exception 'returned_battery_mismatch' using errcode = 'P0002';
  end if;
  perform 1 from public.pue_batteries where id = v_swap.battery_out_id and status = 'in_bay' and station_id = v_swap.station_id for update;
  if not found then raise exception 'battery_not_available' using errcode = 'P0002'; end if;

  update public.pue_batteries set status = 'with_rider', station_id = null, bike_id = v_swap.bike_id where id = v_swap.battery_out_id;
  insert into public.pue_battery_custody (battery_id, event, station_id, rider_id, bike_id, swap_id, recorded_by)
  values (v_swap.battery_out_id, 'issued_to_rider', v_swap.station_id, v_swap.rider_id, v_swap.bike_id, v_swap.id, p_actor);

  if p_returned_battery_id is not null then
    update public.pue_batteries set status = 'in_bay', station_id = v_swap.station_id, bike_id = null where id = p_returned_battery_id;
    insert into public.pue_battery_custody (battery_id, event, station_id, rider_id, bike_id, swap_id, recorded_by)
    values (p_returned_battery_id, 'returned_to_station', v_swap.station_id, v_swap.rider_id, v_swap.bike_id, v_swap.id, p_actor);
  end if;

  update public.pue_swaps set status = 'completed', completed_at = now(), battery_in_id = p_returned_battery_id
  where id = p_swap_id returning * into v_swap;
  return v_swap;
end $$;

-- Cancels an open swap. If it was paid, a refund entry is recorded for the same amount.
create or replace function public.pue_cancel_swap(p_swap_id uuid, p_reason text, p_actor uuid)
returns public.pue_swaps
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_swap public.pue_swaps; v_payment public.pue_swap_payments;
begin
  select * into v_swap from public.pue_swaps where id = p_swap_id for update;
  if not found then raise exception 'swap_not_found' using errcode = 'P0002'; end if;
  if v_swap.status = 'cancelled' then return v_swap; end if;
  if v_swap.status not in ('reserved', 'paid') then raise exception 'swap_not_open' using errcode = 'P0002'; end if;

  if v_swap.status = 'paid' then
    select * into v_payment from public.pue_swap_payments where swap_id = p_swap_id and kind = 'payment' order by created_at desc limit 1;
    insert into public.pue_swap_payments (swap_id, kind, amount_minor, method, reference, idempotency_key, recorded_by)
    values (p_swap_id, 'refund', v_payment.amount_minor, v_payment.method, null, 'refund:' || p_swap_id::text, p_actor);
  end if;

  update public.pue_swaps set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
  where id = p_swap_id returning * into v_swap;
  insert into public.pue_battery_custody (battery_id, event, station_id, rider_id, bike_id, swap_id, note, recorded_by)
  values (v_swap.battery_out_id, 'reservation_released', v_swap.station_id, v_swap.rider_id, v_swap.bike_id, v_swap.id, p_reason, p_actor);
  return v_swap;
end $$;

revoke execute on function public.pue_setting_int(text) from public, anon, authenticated;
revoke execute on function public.pue_reserve_swap(uuid, uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.pue_record_swap_payment(uuid, bigint, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.pue_complete_swap(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.pue_cancel_swap(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.pue_setting_int(text) to service_role;
grant execute on function public.pue_reserve_swap(uuid, uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.pue_record_swap_payment(uuid, bigint, text, text, text, uuid) to service_role;
grant execute on function public.pue_complete_swap(uuid, uuid, uuid) to service_role;
grant execute on function public.pue_cancel_swap(uuid, text, uuid) to service_role;
