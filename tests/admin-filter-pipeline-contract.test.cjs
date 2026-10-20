const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const routes = read('backend/wallet/src/routes/admin.ts');
const vendors = read('apps/admin/src/views/Vendors.vue');
const fundingHistory = read('apps/admin/src/views/FundingHistory.vue');
const customerDetail = read('apps/admin/src/views/CustomerDetail.vue');

assert.match(vendors, /Search vendors/, 'Vendor search control must remain available');
assert.match(routes, /trading_name\.ilike/, 'Vendor search must include trading names');
assert.match(routes, /contact_email\.ilike/, 'Vendor search must include email');
assert.match(fundingHistory, /funding-history-search/, 'Funding history needs a search control');
assert.match(fundingHistory, /params\.set\('q', searchQuery\.value\.trim\(\)\)/, 'Funding search must reach the API');
assert.match(routes, /ownerFilters/, 'Funding API must search owners and references');
assert.match(routes, /Customer funding history combines gateway payments and bank proofs/, 'Customer funding must include bank transfers');
assert.match(routes, /bank_transfer/, 'Customer funding route must retrieve bank transfers');
assert.match(customerDetail, /filteredWalletEntries/, 'Wallet table needs filters');
assert.match(customerDetail, /filteredPurchases/, 'Purchase table needs filters');
assert.match(customerDetail, /filteredFunding/, 'Funding table needs filters');
assert.match(customerDetail, /normalizedFundingChannel/, 'Funding channel rendering must support bank transfers');

console.log('admin filter pipeline contract passed');
