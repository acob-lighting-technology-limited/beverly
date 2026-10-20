const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const admin = read('backend/wallet/src/routes/admin.ts');
const purchases = read('apps/admin/src/views/Purchases.vue');
const wallets = read('apps/admin/src/views/Wallets.vue');
const vendor = read('apps/admin/src/views/VendorDetail.vue');
const wizard = read('packages/tokens/WalletExportWizard.vue');
const exportTools = read('packages/tokens/wallet-export.js');

assert.match(admin, /fastify\.get\('\/purchases\/actors'/, 'purchase actor catalogue must not depend on visible rows');
assert.match(purchases, /loadPurchaseActorOptions/, 'purchase export must load the actor catalogue');
assert.match(wizard, /Search vendors or customers/, 'actor scope needs text search');
assert.match(wizard, /daily-zip/, 'wizard must offer daily archive delivery');
assert.match(exportTools, /exportCsvByDayZip/, 'daily archive must generate a zip download');
assert.match(vendor, /allow-daily-csv-archive/, 'vendor transactions must expose daily archives');
assert.match(admin, /vendors\/:id\/reconciliation/, 'vendor money view needs a ledger reconciliation route');
assert.match(admin, /ledgerDifference/, 'reconciliation must compare ledger net to live balance');
assert.match(wallets, /dailyCapMinor: dailyCapMinor\.value/, 'empty caps must be persisted as null');
assert.match(admin, /Monthly cap cannot be lower/, 'backend must reject inconsistent cap pairs');

console.log('financial integrity and export contract passed');
