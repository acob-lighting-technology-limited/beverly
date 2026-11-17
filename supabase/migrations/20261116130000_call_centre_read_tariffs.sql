-- Beverly Call read access to tariffs: the latest known rate per station scope and tariff, so a customer's meter can show its tariff name and price.
-- Read-only view over Beverly's own tariff_rate_history; no write rights are granted.
create or replace view call_centre_read.tariffs as
select distinct on (h.station_scope, h.tariff_id)
       h.station_scope, h.tariff_id, h.tariff_name, h.unit_price_ngn, h.tax_pct, h.effective_price_ngn, h.is_valid, h.effective_from
from public.tariff_rate_history h
order by h.station_scope, h.tariff_id, h.effective_from desc;

revoke all on call_centre_read.tariffs from public, anon, authenticated;
grant select on call_centre_read.tariffs to beverly_call_api;

notify pgrst, 'reload schema';
