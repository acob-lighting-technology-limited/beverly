-- Beverly Call frontline agent role.
--
-- Beverly Call (the standalone call centre portal) reads Beverly CRM through the admin API
-- (/api/v1/admin/*) using each agent's OWN staff bearer token, so Beverly CRM's role
-- permissions decide what an agent may see. Frontline agents are strictly READ-ONLY on
-- customers, vending and wallets; anything that moves money is escalated to Tier 2 staff.
--
-- This role grants exactly what Beverly Call needs:
--   wallet.customers.view   GET /customers, /customers/:id, /customers/:id/meters, /customers/:id/wallet
--   wallet.vending.monitor  GET /customers/:id/purchases, /purchases/:id (masked by Beverly Call;
--                           the raw STS token is only released after caller verification + audit)
--   wallet.support.manage   Wallet Admin support tickets routed into Beverly Call: list/read tickets,
--                           reply, change status, take/release. NOTE: this key also covers FAQ editing
--                           and live chat; a narrower ticket-only permission would need a code change
--                           to ADMIN_ROUTE_PERMISSIONS. Beverly Call itself only calls the ticket routes.
-- No vending, wallet, refund or funding permission is granted. The `custom-` prefix makes the CRM treat holders as staff
-- (plugins/auth.ts) without a code change.
--
-- Assign agents in Wallet Admin → Users: role `custom-call-centre-agent`, a station assignment
-- (station-scoped routes refuse staff with an empty station list), and portal access `call`.

insert into public.roles (role_key, role_name, label, description)
values (
  'custom-call-centre-agent',
  'Call Centre Agent',
  'Call Centre Agent',
  'Beverly Call frontline agent: read-only customer, meter and vending lookups; works support tickets. Escalates all money movements to Tier 2.'
)
on conflict (role_key) do update
set role_name = excluded.role_name,
    label = excluded.label,
    description = excluded.description,
    updated_at = now();

insert into public.permissions (role_key, route_hash)
values
  ('custom-call-centre-agent', 'wallet.customers.view'),
  ('custom-call-centre-agent', 'wallet.vending.monitor'),
  ('custom-call-centre-agent', 'wallet.support.manage')
on conflict (role_key, route_hash) do nothing;

notify pgrst, 'reload schema';
