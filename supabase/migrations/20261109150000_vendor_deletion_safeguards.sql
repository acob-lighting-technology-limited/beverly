-- Keep vendor funds and unfinished work intact before closing access.
create or replace function public.admin_vendor_deletion_check(p_vendor_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_wallet public.wallets%rowtype;
  v_ledger bigint := 0;
  v_blockers text[] := '{}'::text[];
begin
  if not exists (select 1 from public.vendor_organizations where id = p_vendor_id and deleted_at is null) then
    raise exception 'vendor not found' using errcode = 'P0002';
  end if;

  select * into v_wallet from public.wallets where owner_type = 'vendor' and owner_id = p_vendor_id;
  if found then
    select coalesce(sum(case when direction = 'credit' then amount_minor else -amount_minor end), 0)::bigint
    into v_ledger from public.wallet_ledger_entries where wallet_id = v_wallet.id;
    if v_wallet.balance_minor <> v_ledger then
      v_blockers := array_append(v_blockers, 'Wallet balance needs reconciliation.');
    end if;
    if v_wallet.balance_minor <> 0 or v_ledger <> 0 then
      v_blockers := array_append(v_blockers, 'Settle the vendor wallet balance first.');
    end if;
    if exists (select 1 from public.wallet_holds where wallet_id = v_wallet.id and status = 'active') then
      v_blockers := array_append(v_blockers, 'Resolve active wallet holds first.');
    end if;
    if exists (select 1 from public.purchase_orders where wallet_id = v_wallet.id
      and status in ('created', 'hold_active', 'dispatching', 'delivery_pending_review')) then
      v_blockers := array_append(v_blockers, 'Resolve unfinished token purchases first.');
    end if;
  end if;
  if exists (select 1 from public.funding_requests where vendor_organization_id = p_vendor_id
    and status in ('initiated', 'proof_uploaded', 'under_review')) then
    v_blockers := array_append(v_blockers, 'Resolve open funding requests first.');
  end if;
  if exists (select 1 from public.meter_purchase_orders where vendor_organization_id = p_vendor_id
    and status::text not in ('installed', 'cancelled', 'rejected')) then
    v_blockers := array_append(v_blockers, 'Resolve open meter orders first.');
  end if;
  if exists (select 1 from public.wallet_purchase_orders where organization_id = p_vendor_id
    and status in ('created', 'hold_active', 'dispatching', 'delivery_pending_review')) then
    v_blockers := array_append(v_blockers, 'Resolve unfinished legacy purchases first.');
  end if;

  return jsonb_build_object('canDelete', cardinality(v_blockers) = 0, 'blockers', to_jsonb(v_blockers));
end;
$$;

create or replace function public.admin_soft_delete_vendor(
  p_vendor_id uuid, p_deleted_by uuid, p_reason text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor public.vendor_organizations%rowtype;
  v_wallet public.wallets%rowtype;
  v_check jsonb;
  v_auth_user_ids uuid[];
  v_removable_auth_ids uuid[];
  v_vendor_user_ids uuid[];
begin
  if p_deleted_by is null then raise exception 'deleted_by is required'; end if;
  select * into v_vendor from public.vendor_organizations where id = p_vendor_id for update;
  if not found or v_vendor.deleted_at is not null then
    raise exception 'vendor not found' using errcode = 'P0002';
  end if;
  select * into v_wallet from public.wallets where owner_type = 'vendor' and owner_id = p_vendor_id for update;
  v_check := public.admin_vendor_deletion_check(p_vendor_id);
  if not (v_check->>'canDelete')::boolean then
    raise exception 'vendor deletion blocked: %', v_check->'blockers' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]),
         coalesce(array_agg(distinct auth_user_id) filter (where auth_user_id is not null), '{}'::uuid[])
  into v_vendor_user_ids, v_auth_user_ids
  from public.vendor_users where vendor_organization_id = p_vendor_id;

  select coalesce(array_agg(distinct vu.auth_user_id), '{}'::uuid[])
  into v_removable_auth_ids
  from public.vendor_users vu
  where vu.vendor_organization_id = p_vendor_id and vu.auth_user_id is not null
    and not exists (select 1 from public.vendor_users other where other.auth_user_id = vu.auth_user_id and other.vendor_organization_id <> p_vendor_id)
    and not exists (select 1 from public.customers c where c.auth_user_id = vu.auth_user_id)
    and not exists (select 1 from public.users u where u.auth_user_id = vu.auth_user_id or u.user_id = vu.auth_user_id::text)
    and not exists (select 1 from public.oem_actor_installation_access o where o.auth_user_id = vu.auth_user_id)
    and not exists (select 1 from public.oem_tenant_memberships o where o.auth_user_id = vu.auth_user_id);

  delete from public.vendor_mfa_sessions where vendor_user_id = any(v_vendor_user_ids);
  delete from public.vendor_mfa_recovery_codes where vendor_user_id = any(v_vendor_user_ids);
  delete from public.vendor_mfa_factors where vendor_user_id = any(v_vendor_user_ids);
  delete from public.vendor_password_change_attempts where auth_user_id = any(v_auth_user_ids);
  delete from public.push_subscriptions where actor_type = 'vendor' and actor_id = p_vendor_id;
  delete from public.vendor_push_subscriptions where vendor_organization_id = p_vendor_id;
  update public.portal_sessions set revoked_at = now() where actor_type = 'vendor' and auth_user_id = any(v_auth_user_ids) and revoked_at is null;

  update public.vendor_users set status = 'disabled', mfa_enrolled = false,
    password_reset_required = false, password_session_id = null,
    vend_credential_hash = null, vend_credential_salt = null, vend_credential_set_at = null,
    updated_at = now() where vendor_organization_id = p_vendor_id;
  update public.wallets set status = 'closed', updated_at = now() where owner_type = 'vendor' and owner_id = p_vendor_id;
  update public.vendor_wallets set status = 'closed', updated_at = now() where organization_id = p_vendor_id;
  update public.vendor_organizations set status = 'closed', deleted_at = now(),
    deleted_by = p_deleted_by, deletion_reason = nullif(trim(p_reason), ''), updated_at = now()
    where id = p_vendor_id;

  return jsonb_build_object('id', p_vendor_id, 'authUserIds', to_jsonb(v_removable_auth_ids),
    'sharedAuthUsers', cardinality(v_auth_user_ids) - cardinality(v_removable_auth_ids),
    'vendorUserCount', cardinality(v_vendor_user_ids));
end;
$$;

revoke all on function public.admin_vendor_deletion_check(uuid) from public, anon, authenticated;
grant execute on function public.admin_vendor_deletion_check(uuid) to service_role;
revoke all on function public.admin_soft_delete_vendor(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_soft_delete_vendor(uuid, uuid, text) to service_role;
notify pgrst, 'reload schema';
