const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'backend/wallet/src/routes/admin.ts'), 'utf8');
const deletionRoute = fs.readFileSync(path.join(root, 'backend/wallet/src/routes/admin-vendor-deletion.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'apps/admin/src/views/Vendors.vue'), 'utf8');
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261109150000_vendor_deletion_safeguards.sql'),
  'utf8',
);

assert.match(route, /adminVendorDeletionRoutes/);
assert.match(route, /GET \/vendors\/:id\/deletion-check/);
assert.match(deletionRoute, /admin_vendor_deletion_check/);
assert.match(deletionRoute, /admin_soft_delete_vendor/);
assert.match(deletionRoute, /auth\.admin\.signOut\(authUserId, 'global'\)/);
assert.match(deletionRoute, /auth\.admin\.deleteUser\(authUserId/);
assert.match(deletionRoute, /vendor\.deleted/);
assert.match(deletionRoute, /confirmation/i);

assert.match(page, /deleteConfirmation/);
assert.match(page, /Type the vendor name/i);
assert.match(page, /disable-confirm/);
assert.match(page, /deleteCheck\.value\?\.canDelete/);
assert.match(page, /loadDeleteCheck/);

assert.match(migration, /create or replace function public\.admin_soft_delete_vendor/i);
assert.match(migration, /create or replace function public\.admin_vendor_deletion_check/i);
for (const guard of ['balance_minor', 'wallet_ledger_entries', 'wallet_holds', 'purchase_orders', 'funding_requests', 'meter_purchase_orders']) {
  assert.ok(migration.includes(guard), `deletion must check ${guard}`);
}
assert.match(migration, /not exists \(select 1 from public\.users u/i);
assert.match(migration, /delete from public\.push_subscriptions/i);
assert.match(migration, /update public\.portal_sessions set revoked_at/i);
assert.match(migration, /update public\.vendor_users[\s\S]*status = 'disabled'/i);
assert.match(migration, /update public\.wallets[\s\S]*status = 'closed'/i);
assert.match(migration, /delete from public\.vendor_mfa_sessions/i);
assert.match(migration, /delete from public\.vendor_mfa_recovery_codes/i);
assert.match(migration, /revoke all on function public\.admin_soft_delete_vendor/i);
assert.match(migration, /grant execute on function public\.admin_soft_delete_vendor[\s\S]*to service_role/i);

console.log('vendor deletion pipeline contract passed');
