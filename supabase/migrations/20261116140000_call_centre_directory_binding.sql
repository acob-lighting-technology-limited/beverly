-- Customer directory across every station, and phone-number binding.
--
-- 1. call_centre_read.directory: one row per customer and meter, joining Beverly's CRM tables (customers, accounts, meters,
--    account_bindings, oem_inventory_customers) so a customer appears in Beverly Call as soon as Beverly knows a phone for them,
--    whatever the station. Identity and contact only: no PIN hashes, KYC data or raw payloads.
-- 2. call_centre.phone_bindings: requests to bind a calling number to a customer's meter, with verification checks and a
--    maker-checker decision. 3. call_centre.apply_phone_binding(): the ONLY write into Beverly's CRM, and it only ever fills an
--    empty customers.phone. The API role gets no other write right on `public`.

create or replace view call_centre_read.directory as
select c.id as customer_id,
       coalesce(nullif(btrim(c.full_name), ''), nullif(btrim(c.name), ''), nullif(btrim(c.customer_name), '')) as full_name,
       coalesce(nullif(btrim(c.phone), ''), nullif(btrim(oc.phone), '')) as phone,
       right(regexp_replace(coalesce(nullif(btrim(c.phone), ''), nullif(btrim(oc.phone), ''), ''), '\D', '', 'g'), 10) as phone_tail,
       c.email, c.status, c.address,
       coalesce(nullif(c.account_no, ''), a.account_no) as account_no, a.account_type,
       m.meter_sn, m.meter_type, m.status as meter_status,
       upper(coalesce(nullif(ab.station_id, ''), nullif(m.site_code, ''), nullif(c.site_code, ''))) as station_id,
       coalesce(nullif(ab.tariff_id, ''), nullif(m.tariff_id, '')) as tariff_id,
       c.created_at
from public.customers c
left join public.oem_inventory_customers oc on oc.external_id = c.upstream_id
left join public.meters m on m.customer_id = c.id
left join public.accounts a on a.id = m.account_id
left join lateral (
  select b.station_id, b.tariff_id from public.account_bindings b
  where b.meter_id = m.meter_sn order by (b.status = 'active') desc, b.updated_at desc nulls last limit 1
) ab on true;

create table if not exists call_centre.phone_bindings (
  id                 uuid primary key default gen_random_uuid(),
  phone              text not null,
  phone_tail         text not null check (phone_tail ~ '^[0-9]{10}$'),
  customer_id        uuid not null,
  meter_sn           text not null,
  status             text not null default 'pending' check (status in ('pending','approved','rejected','applied')),
  checks             jsonb not null default '{}'::jsonb,
  call_id            uuid,
  label              text,
  requested_by       text not null,
  requested_by_name  text not null,
  decided_by         text,
  decided_at         timestamptz,
  decision_note      text,
  applied_at         timestamptz,
  crm_result         text,
  created_at         timestamptz not null default now()
);
create unique index if not exists phone_bindings_open_uq on call_centre.phone_bindings (phone_tail, meter_sn) where status in ('pending','approved','applied');
create index if not exists phone_bindings_tail_ix on call_centre.phone_bindings (phone_tail) where status = 'applied';
create index if not exists phone_bindings_status_ix on call_centre.phone_bindings (status, created_at desc);

alter table call_centre.phone_bindings enable row level security;
drop policy if exists cc_phone_bindings_api on call_centre.phone_bindings;
create policy cc_phone_bindings_api on call_centre.phone_bindings for all to beverly_call_api using (true) with check (true);
grant select, insert, update on call_centre.phone_bindings to beverly_call_api;

-- Every number that identifies a customer: the CRM phone (or the OEM's) plus numbers bound through Beverly Call.
create or replace view call_centre_read.directory_phones as
select distinct customer_id, phone_tail, 'crm'::text as source from call_centre_read.directory where length(phone_tail) = 10
union
select customer_id, phone_tail, 'binding'::text from call_centre.phone_bindings where status = 'applied';

create or replace function call_centre.apply_phone_binding(p_binding uuid, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = public, call_centre, pg_temp
as $fn$
declare b call_centre.phone_bindings; current_phone text; result text;
begin
  select * into b from call_centre.phone_bindings where id = p_binding for update;
  if not found then raise exception 'binding not found'; end if;
  if b.status <> 'approved' then raise exception 'binding is %, not approved', b.status; end if;
  select nullif(btrim(phone), '') into current_phone from public.customers where id = b.customer_id for update;
  if not found then raise exception 'customer not found'; end if;
  if current_phone is null then
    update public.customers set phone = '0' || b.phone_tail, updated_at = now() where id = b.customer_id;
    result := 'primary';
  else
    result := 'additional';   -- the CRM already has a primary number; this one is recorded as an extra identity
  end if;
  update call_centre.phone_bindings set status = 'applied', applied_at = now(), crm_result = result where id = b.id;
  return jsonb_build_object('result', result, 'customerId', b.customer_id, 'meter', b.meter_sn);
end
$fn$;
revoke all on function call_centre.apply_phone_binding(uuid, text) from public, anon, authenticated;
grant execute on function call_centre.apply_phone_binding(uuid, text) to beverly_call_api;

revoke all on call_centre_read.directory, call_centre_read.directory_phones from public, anon, authenticated;
grant select on call_centre_read.directory, call_centre_read.directory_phones to beverly_call_api;
notify pgrst, 'reload schema';
