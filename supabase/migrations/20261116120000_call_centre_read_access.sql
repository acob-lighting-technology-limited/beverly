-- Beverly Call read access to Beverly's own data (customers, meters, staff, roles, wallets, purchases).
--
-- Beverly Call connects as `beverly_call_api`, which has no rights on `public`. Rather than granting SELECT on the base
-- tables (which would also expose vend PIN hashes, KYC documents, raw upstream payloads and session ids), this exposes
-- READ-ONLY VIEWS with an explicit column list in a dedicated schema. Views run with their owner's rights, so they work
-- even though the base tables force row level security; the role can read nothing else in `public`.
--
-- The raw STS token is not in any view. `call_centre_read.reveal_purchase_token(id)` returns one token at a time and is
-- the only path to it, so the API can audit each reveal first and a bulk export is not possible.

create schema if not exists call_centre_read;
revoke all on schema call_centre_read from public, anon, authenticated;
grant usage on schema call_centre_read to beverly_call_api;

-- ── Customers: identity and contact only (no PIN hash, KYC data, raw payload or session ids) ──
create or replace view call_centre_read.customers as
select
  c.id,
  coalesce(nullif(btrim(c.full_name), ''), nullif(btrim(c.name), ''), nullif(btrim(c.customer_name), '')) as full_name,
  c.phone, c.email, c.status, c.kyc_tier, c.kyc_status, c.site_id, c.account_no, c.created_at
from public.customers c;

-- ── Meters linked to customers ───────────────────────────────────────────────────────────────
create or replace view call_centre_read.customer_meters as
select m.id, m.customer_id, m.meter_id, m.meter_type, m.station_id, m.tariff_id,
       m.nickname, m.alias, m.meter_name, m.status, m.created_at
from public.customer_meters m;

-- ── Staff (the `users` table): who they are, their role, stations and portals. No session or password fields ──
create or replace view call_centre_read.staff as
select u.id, u.auth_user_id, u.user_name, u.email, u.role_key, u.station_id, u.station_ids,
       u.portal_access, u.created_at, u.updated_at
from public.users u;

-- ── Roles and what each role may do ──────────────────────────────────────────────────────────
create or replace view call_centre_read.roles as
select r.role_key, coalesce(r.role_name, r.name::text) as role_name, r.label, r.description
from public.roles r;

create or replace view call_centre_read.role_permissions as
select p.role_key, p.route_hash from public.permissions p;

-- ── Wallets with live balances (from Beverly's own balance view) ─────────────────────────────
create or replace view call_centre_read.wallets as
select w.id, w.owner_type, w.owner_id, w.currency, w.status,
       b.ledger_balance_minor, b.active_holds_minor, b.available_balance_minor
from public.wallets w
left join public.v_wallet_balances b on b.wallet_id = w.id;

-- ── Purchases: everything except the token itself and idempotency keys ───────────────────────
create or replace view call_centre_read.purchases as
select o.id, o.actor_type, o.actor_id, o.wallet_id, o.customer_id, o.customer_name, o.meter_id, o.station_id,
       o.tariff_id, o.amount_minor, o.units_kwh, o.purchase_mode, o.status, o.delivery_state, o.failure_reason,
       o.created_at, o.updated_at,
       o.token is not null as has_token,
       right(regexp_replace(coalesce(o.token, ''), '\D', '', 'g'), 4) as token_last4
from public.purchase_orders o;

-- ── The only path to a raw token: one purchase at a time ─────────────────────────────────────
create or replace function call_centre_read.reveal_purchase_token(p_purchase_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select o.token from public.purchase_orders o where o.id = p_purchase_id $$;

revoke all on function call_centre_read.reveal_purchase_token(uuid) from public, anon, authenticated;
grant execute on function call_centre_read.reveal_purchase_token(uuid) to beverly_call_api;

-- ── Read-only grants on the views, nothing else ──────────────────────────────────────────────
revoke all on all tables in schema call_centre_read from public, anon, authenticated;
grant select on all tables in schema call_centre_read to beverly_call_api;

notify pgrst, 'reload schema';
