const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const customerRoutePath = path.join(root, 'backend/wallet/src/routes/customer.ts');
const routePolicyPath = path.join(root, 'backend/wallet/src/contracts/route-policy.ts');
const customerRouterPath = path.join(root, 'apps/customer/src/router/index.ts');
const usageViewPath = path.join(root, 'apps/customer/src/views/Usage.vue');
const metersViewPath = path.join(root, 'apps/customer/src/views/Meters.vue');

const routeCode = fs.readFileSync(customerRoutePath, 'utf8');
const routePolicyCode = fs.readFileSync(routePolicyPath, 'utf8');
const routerCode = fs.readFileSync(customerRouterPath, 'utf8');

console.log('Testing Customer Usage Pipeline Seams...');

// 1. Backend route registration
assert.ok(
    routeCode.includes("fastify.get('/usage', { preHandler: fastify.requireCustomer() }"),
    'GET /usage endpoint missing in customer.ts'
);
assert.ok(
    routeCode.includes("fastify.get('/usage/telemetry', { preHandler: fastify.requireCustomer() }"),
    'GET /usage/telemetry endpoint missing in customer.ts'
);
assert.ok(
    routeCode.includes("fastify.post('/usage/remote-read', { preHandler: fastify.requireCustomer() }"),
    'POST /usage/remote-read endpoint missing in customer.ts'
);
assert.ok(
    routePolicyCode.includes("post('/api/v1/customer/usage/remote-read')"),
    'POST /api/v1/customer/usage/remote-read missing from mutationRoutePolicies in route-policy.ts'
);

// 2. OEM capability gating in backend
assert.ok(
    routeCode.includes('resolveMeterOemInfo'),
    'resolveMeterOemInfo missing in customer.ts'
);
assert.ok(
    routeCode.includes('supported_data_items') || routeCode.includes('supportedDataItems'),
    'OEM supported_data_items gating missing in customer.ts'
);
assert.ok(
    routeCode.includes('oem_feature_unsupported'),
    'oem_feature_unsupported error code missing for unsupported live operations'
);
assert.ok(
    routeCode.includes('forbidden_meter'),
    'forbidden_meter verification missing for unauthorized meters'
);

// 3. Frontend Router
assert.ok(
    routerCode.includes("path: '/usage'") && routerCode.includes("name: 'usage'"),
    '/usage route missing in apps/customer/src/router/index.ts'
);

// 4. Frontend Usage view
assert.ok(fs.existsSync(usageViewPath), 'Usage.vue does not exist in apps/customer/src/views/');
const usageViewCode = fs.readFileSync(usageViewPath, 'utf8');
assert.ok(usageViewCode.includes('Your usage'), 'Usage view missing "Your usage" title');
assert.ok(usageViewCode.includes('Live power') || usageViewCode.includes('Credit balance'), 'Usage view missing hero data items');
assert.ok(
    usageViewCode.includes('Credit balance') &&
    usageViewCode.includes('Total Consumption') &&
    usageViewCode.includes('Power') &&
    usageViewCode.includes('Relay Status'),
    'Usage view missing standard data items'
);
assert.ok(
    usageViewCode.includes('Hourly') &&
    usageViewCode.includes('Daily') &&
    usageViewCode.includes('Live'),
    'Usage view missing timeframe selectors'
);

// OEM capability gating in template
assert.ok(
    usageViewCode.includes('oemSupportsLive') && usageViewCode.includes('v-if="oemSupportsLive"'),
    'Live tab and remote actions must be conditionally hidden when OEM does not support live tasks'
);
assert.ok(
    usageViewCode.includes('availableDataItems') && usageViewCode.includes('oemSupportsItem'),
    'Data items must be filtered according to OEM supportedDataItems'
);

// Animated SVG Chart
assert.ok(usageViewCode.includes('<svg') && usageViewCode.includes('class="usage-chart-line"'), 'Usage view missing animated SVG chart');
assert.ok(usageViewCode.includes('@keyframes drawUsageLine'), 'Usage view missing CSS animation for SVG chart curve');
assert.ok(usageViewCode.includes('chart-ping-ring') || usageViewCode.includes('ping-dot'), 'Usage view missing live pulsing indicator');

// Bottom KPI Cards
assert.ok(usageViewCode.includes('Wallet') && usageViewCode.includes('Today'), 'Usage view missing Wallet and Today KPI cards');

// Search & Contract Preservation
assert.ok(usageViewCode.includes('placeholder="Enter meter number"'), 'meter input placeholder missing');
assert.ok(usageViewCode.includes("params.set('meter_id', selectedMeter.value)"), 'meter filter missing');
assert.ok(usageViewCode.includes('@submit.prevent="searchMeter"'), 'meter search submission missing');

// 5. Meters view link
const metersViewCode = fs.readFileSync(metersViewPath, 'utf8');
assert.ok(metersViewCode.includes('to="/usage"'), 'Meters.vue should link to /usage');
assert.ok(metersViewCode.includes('Usage'), 'Meters.vue button text should be Usage');

console.log('All usage pipeline assertions passed successfully!');
