import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as flow from '../src/services/interval-data-flow.mjs';

// Exercise the real component methods with deferred transport responses.
const source = fs.readFileSync(new URL('../src/components/DailyDataMeterPage.vue', import.meta.url), 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*;\r?$/gm, '').replace('export default', 'return');
assert(!/^import /m.test(script), 'All component dependencies must be explicitly supplied');
const requests = [];
const bindings = {
  BaseButton: {}, BaseIconButton: {}, BaseInput: {}, BaseSelect: {}, ExportRangeMenu: {},
  getApi: async () => ({}),
  postApi: (path, payload) => new Promise((resolve, reject) => requests.push({ path, payload, resolve, reject })),
  ...flow,
  fetchStationOptions: async () => [{ stationId: 'OFEMILI' }],
  normalizeIntervalTableStatus: value => value,
};
const component = new Function(...Object.keys(bindings), script)(...Object.values(bindings));
function instance() {
  const vm = component.data();
  for (const [name, method] of Object.entries(component.methods)) vm[name] = method.bind(vm);
  Object.defineProperty(vm, 'totalPages', { get: () => Math.max(1, Math.ceil(vm.totalRecords / vm.pageSize)) });
  return vm;
}
const response = station => ({ result: { data: [{ meterId: station + '-meter', stationId: station, currentDate: '2026-10-24' }], total: 1 } });

const vm = instance();
const initial = vm.reload();
vm.searchTerm = 'OFEMILI';
const filtered = vm.reload();
await Promise.resolve();
await Promise.resolve();
assert.equal(requests.length, 2);
assert.equal(requests[1].payload.stationId, 'OFEMILI');
requests[1].resolve(response('OFEMILI'));
await filtered;
requests[0].resolve(response('TUNGA'));
await initial;
assert.equal(vm.rows[0].stationId, 'OFEMILI', 'An older response cannot replace filtered readings');
assert.equal(requests.length, 2, 'An obsolete initial response cannot start an estate-wide fallback scan');
assert.equal(vm.loading, false);

const obsoleteLookup = vm.reload();
const latest = vm.reload();
await Promise.resolve();
await Promise.resolve();
// The superseded directory lookup must not dispatch another meter request.
assert.equal(requests.length, 3);
requests[2].resolve(response('OFEMILI'));
await Promise.all([obsoleteLookup, latest]);
assert.equal(vm.rows[0].stationId, 'OFEMILI');

const scanning = instance();
const scan = scanning.fetchAllSearchMatches({}, 'missing', scanning.requestId);
scanning.requestId += 1;
requests.at(-1).resolve({ result: { data: [response('TUNGA').result.data[0]], total: 733524 } });
assert.deepEqual(await scan, []);
assert.equal(requests.length, 4, 'Cancelled searches cannot request subsequent pages');
assert.equal(scanning.searchCache.query, '');

const unmounted = instance();
const before = unmounted.requestId;
component.beforeUnmount.call(unmounted);
assert.equal(unmounted.requestId, before + 1);
console.log('interval report request ordering passed');
