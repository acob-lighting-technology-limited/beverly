-- Rolls back 20261118120000_pue_appliances.sql. Destroys appliance sales, payments and faults: export first.
drop function if exists public.pue_end_appliance_sale(uuid, text);
drop function if exists public.pue_record_appliance_payment(uuid, bigint, text, text, text, uuid);
drop function if exists public.pue_sell_appliance(uuid, uuid, text, text, bigint, bigint, text, uuid);
drop table if exists public.pue_appliance_faults;
drop table if exists public.pue_appliance_payments;
drop function if exists public.pue_appliance_payments_immutable();
drop table if exists public.pue_appliance_sales;
drop table if exists public.pue_appliances;
drop table if exists public.pue_appliance_types;
