begin;

alter table public.consumption_sync_station_state
  add column if not exists lease_owner uuid,
  add column if not exists lease_until timestamptz,
  add column if not exists scan_progress jsonb,
  add column if not exists observed_through date;

-- Only the server role can acquire and checkpoint ingestion work.
create or replace function public.acquire_consumption_sync_station(p_station_id text, p_owner uuid)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare current_state public.consumption_sync_station_state;
begin
  insert into public.consumption_sync_station_state(station_id)
    values(upper(btrim(p_station_id))) on conflict(station_id) do nothing;
  update public.consumption_sync_station_state
    set lease_owner=p_owner, lease_until=clock_timestamp()+interval '2 minutes'
    where station_id=upper(btrim(p_station_id))
      and (lease_until is null or lease_until<clock_timestamp() or lease_owner=p_owner)
    returning * into current_state;
  if not found then return jsonb_build_object('acquired',false); end if;
  return jsonb_build_object('acquired',true,'state',to_jsonb(current_state));
end;
$$;

create or replace function public.checkpoint_consumption_sync_station(
  p_station_id text, p_owner uuid, p_progress jsonb, p_outcome jsonb default null
) returns boolean language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  update public.consumption_sync_station_state set
    scan_progress=p_progress,
    lease_until=case when p_outcome is null then clock_timestamp()+interval '2 minutes' else null end,
    lease_owner=case when p_outcome is null then p_owner else null end,
    last_mode=coalesce(p_outcome->>'last_mode',last_mode),
    last_status=coalesce(p_outcome->>'last_status',last_status),
    last_started_at=coalesce((p_outcome->>'last_started_at')::timestamptz,last_started_at),
    last_finished_at=coalesce((p_outcome->>'last_finished_at')::timestamptz,last_finished_at),
    last_success_at=case when p_outcome->>'last_status'='succeeded'
      then (p_outcome->>'last_finished_at')::timestamptz else last_success_at end,
    cursor_date=coalesce((p_outcome->>'cursor_date')::date,cursor_date),
    source_latest_date=coalesce((p_outcome->>'source_latest_date')::date,source_latest_date),
    observed_through=coalesce((p_outcome->>'observed_through')::date,observed_through),
    last_fetched_rows=coalesce((p_outcome->>'last_fetched_rows')::integer,last_fetched_rows),
    last_stored_rows=coalesce((p_outcome->>'last_stored_rows')::integer,last_stored_rows),
    last_error=case when p_outcome is not null then p_outcome->>'last_error' else last_error end,
    updated_at=clock_timestamp()
  where station_id=upper(btrim(p_station_id)) and lease_owner=p_owner
    and lease_until>clock_timestamp();
  return found;
end;
$$;

revoke all on function public.acquire_consumption_sync_station(text,uuid) from public,anon,authenticated;
revoke all on function public.checkpoint_consumption_sync_station(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.acquire_consumption_sync_station(text,uuid) to service_role;
grant execute on function public.checkpoint_consumption_sync_station(text,uuid,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
