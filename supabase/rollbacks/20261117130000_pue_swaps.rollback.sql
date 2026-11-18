begin;

-- Drops the PUE swap flow. Refuses to run if any swap, payment, or custody record exists,
-- so payment history is never destroyed by accident.
do $$
begin
  if exists (select 1 from public.pue_swaps)
     or exists (select 1 from public.pue_swap_payments)
     or exists (select 1 from public.pue_battery_custody)
     or exists (select 1 from public.pue_swap_paystack_attempts) then
    raise exception 'pue swaps have data; export it before rolling back';
  end if;
end $$;

drop function if exists public.pue_cancel_swap(uuid, text, uuid);
drop function if exists public.pue_complete_swap(uuid, uuid, uuid);
drop function if exists public.pue_record_swap_payment(uuid, bigint, text, text, text, uuid);
drop function if exists public.pue_reserve_swap(uuid, uuid, uuid, text, text, uuid);
drop function if exists public.pue_setting_int(text);
drop table if exists public.pue_swap_paystack_attempts;
drop table if exists public.pue_battery_custody;
drop table if exists public.pue_swap_payments;
drop table if exists public.pue_swaps;
drop table if exists public.pue_settings;
drop function if exists public.pue_block_mutation();

commit;
