begin;

-- Drops the PUE registry. Refuses to run if any rider, bike, battery, or assignment exists,
-- so real registry data is never destroyed by accident.
do $$
begin
  if exists (select 1 from public.pue_bike_assignments)
     or exists (select 1 from public.pue_riders)
     or exists (select 1 from public.pue_bikes)
     or exists (select 1 from public.pue_batteries) then
    raise exception 'pue registry has data; export and clear it before rolling back';
  end if;
end $$;

drop function if exists public.pue_end_assignment(uuid, text);
drop function if exists public.pue_assign_bike(uuid, uuid, text, bigint, bigint, uuid);
drop table if exists public.pue_bike_assignments;
drop table if exists public.pue_batteries;
drop table if exists public.pue_riders;
drop table if exists public.pue_bikes;
drop table if exists public.pue_swap_stations;
drop table if exists public.pue_sites;

commit;
