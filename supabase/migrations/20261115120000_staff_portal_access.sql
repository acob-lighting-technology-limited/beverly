-- Per-staff portal access: which Beverly staff portals an account may sign in to.
-- Keys: crm (Beverly CRM), staff_wallet (Beverly Staff Wallet),
--       call (Beverly Call), pue (Beverly PUE).
--
-- Backfill reproduces the old hard-coded gates exactly, so no existing staff
-- member gains or loses access when this ships:
--   crm          CRM roles (super-admin, operations-manager, operations-officer, account)
--   staff_wallet wallet staff roles and custom-* roles
--   call         every staff directory row (Beverly Call had no role gate)
--   pue          same as staff_wallet (PUE used the Staff Wallet login)
-- Keep in sync with legacyPortalAccess() in
-- backend/wallet/src/services/staff-portal-access.ts.
--
-- RLS: no policy change. public.users is readable by self or access managers
-- and writable only by super admins ("Users managed by super admins"), so staff
-- cannot grant themselves portals. Wallet Admin writes via the service role.

alter table public.users add column if not exists portal_access text[];

update public.users
set portal_access = array_remove(array[
  case when lower(coalesce(role_key, '')) in (
    'super-admin', 'super_admin', 'operations-manager', 'operations_manager',
    'operations-officer', 'operations_officer', 'account', 'account-officer', 'account_officer'
  ) then 'crm' end,
  case when lower(coalesce(role_key, '')) in (
    'super-admin', 'developer', 'account', 'finance-checker', 'operations-manager', 'operations-officer'
  ) or lower(coalesce(role_key, '')) like 'custom-%' then 'staff_wallet' end,
  'call',
  case when lower(coalesce(role_key, '')) in (
    'super-admin', 'developer', 'account', 'finance-checker', 'operations-manager', 'operations-officer'
  ) or lower(coalesce(role_key, '')) like 'custom-%' then 'pue' end
], null)
where portal_access is null;

-- New rows get no portal until a super admin picks one.
alter table public.users alter column portal_access set default '{}'::text[];
alter table public.users alter column portal_access set not null;

alter table public.users drop constraint if exists users_portal_access_known;
alter table public.users add constraint users_portal_access_known
  check (portal_access <@ array['crm', 'staff_wallet', 'call', 'pue']::text[]);

comment on column public.users.portal_access is
  'Beverly staff portals this account may sign in to: crm, staff_wallet, call, pue. Super admins always reach all portals.';
