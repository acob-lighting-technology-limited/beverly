begin;

-- Drop per-staff portal access. Logins fall back to the legacy role-based
-- gates in staff-portal-access.ts and supabase-service.js when the column is
-- missing. Choices made in Wallet Admin since the migration are lost.
alter table public.users drop constraint if exists users_portal_access_known;
alter table public.users drop column if exists portal_access;

commit;
