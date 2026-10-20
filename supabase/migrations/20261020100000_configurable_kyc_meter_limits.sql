-- Meter allowances are part of the same canonical KYC tier policy as debit caps.
-- They limit future meter links only; existing customer links are never removed.
alter table public.kyc_tier_settings
  add column if not exists tier0_meter_limit integer not null default 3 check (tier0_meter_limit > 0),
  add column if not exists tier1_meter_limit integer not null default 5 check (tier1_meter_limit > 0),
  add column if not exists tier2_meter_limit integer not null default 10 check (tier2_meter_limit > 0);

alter table public.kyc_tier_settings
  drop constraint if exists kyc_tier_settings_meter_limits_ascending,
  add constraint kyc_tier_settings_meter_limits_ascending
    check (tier1_meter_limit >= tier0_meter_limit and tier2_meter_limit >= tier1_meter_limit);

create or replace function public.fn_record_kyc_tier_policy_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.kyc_tier_policy_history (
    settings_version, actor_user_id, reason, before_json, after_json
  ) values (
    new.version, new.updated_by, new.change_reason,
    jsonb_build_object(
      'tier0DailyLimitMinor', old.tier0_daily_limit_minor,
      'tier1DailyLimitMinor', old.tier1_daily_limit_minor,
      'tier2DailyLimitMinor', old.tier2_daily_limit_minor,
      'tier0MeterLimit', old.tier0_meter_limit,
      'tier1MeterLimit', old.tier1_meter_limit,
      'tier2MeterLimit', old.tier2_meter_limit,
      'version', old.version,
      'updatedAt', old.updated_at
    ),
    jsonb_build_object(
      'tier0DailyLimitMinor', new.tier0_daily_limit_minor,
      'tier1DailyLimitMinor', new.tier1_daily_limit_minor,
      'tier2DailyLimitMinor', new.tier2_daily_limit_minor,
      'tier0MeterLimit', new.tier0_meter_limit,
      'tier1MeterLimit', new.tier1_meter_limit,
      'tier2MeterLimit', new.tier2_meter_limit,
      'version', new.version,
      'updatedAt', new.updated_at
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_record_kyc_tier_policy_history on public.kyc_tier_settings;
create trigger trg_record_kyc_tier_policy_history
after update of tier0_daily_limit_minor, tier1_daily_limit_minor, tier2_daily_limit_minor,
  tier0_meter_limit, tier1_meter_limit, tier2_meter_limit
on public.kyc_tier_settings
for each row execute function public.fn_record_kyc_tier_policy_history();

notify pgrst, 'reload schema';
