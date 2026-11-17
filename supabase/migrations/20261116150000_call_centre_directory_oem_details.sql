-- Directory: add the meter address and the OEM's own tariff name and rate (SparkMeter keeps them in the meter payload, not in tariff_rate_history).
-- Only these three fields are extracted from the payload; the payload itself is not exposed. New columns are appended so the view can be replaced in place.
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
       c.created_at,
       nullif(btrim(m.raw_payload->>'address'), '') as meter_address,
       nullif(btrim(m.raw_payload->'tariff'->>'name'), '') as tariff_name,
       case when (m.raw_payload->'tariff'->'rate_amount'->>'value') ~ '^[0-9.]+$' then (m.raw_payload->'tariff'->'rate_amount'->>'value')::numeric end as tariff_rate_ngn
from public.customers c
left join public.oem_inventory_customers oc on oc.external_id = c.upstream_id
left join public.meters m on m.customer_id = c.id
left join public.accounts a on a.id = m.account_id
left join lateral (
  select b.station_id, b.tariff_id from public.account_bindings b
  where b.meter_id = m.meter_sn order by (b.status = 'active') desc, b.updated_at desc nulls last limit 1
) ab on true;

grant select on call_centre_read.directory to beverly_call_api;
notify pgrst, 'reload schema';
