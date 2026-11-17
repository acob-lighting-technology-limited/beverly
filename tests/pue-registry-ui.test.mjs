// Beverly PUE registry screens: API client, form config, and Pinia store.
// Runs with plain node. Browser globals (fetch, localStorage) are faked per test.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { PueApiError, minorFromNaira, nairaFromMinor, pueApi } from "../apps/battery-swap/src/services/pue-api.js";
import { RESOURCES, formToBody, initialForm, recordLabel, validateForm } from "../apps/battery-swap/src/services/registry-config.js";
import { usePueRegistryStore } from "../apps/battery-swap/src/stores/pue-registry-store.js";

const TOKEN_KEY = "beverly.battery_swap.access_token";

function fakeBrowser({ token = "staff-token", fetchImpl } = {}) {
  const calls = [];
  globalThis.localStorage = { getItem: (key) => (key === TOKEN_KEY ? token : null), setItem() {}, removeItem() {} };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return fetchImpl(url, init);
  };
  return calls;
}
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

test("api: sends the staff token and PUE portal header, with an idempotency key on writes", async () => {
  const calls = fakeBrowser({ fetchImpl: async () => json({ ok: true, item: { id: "1" } }) });
  await pueApi.create("riders", { fullName: "Ada" });
  const { url, init } = calls[0];
  assert.equal(url, "/api/v1/pue/registry/riders");
  assert.equal(init.method, "POST");
  assert.equal(init.headers.Authorization, "Bearer staff-token");
  assert.equal(init.headers["X-Beverly-Portal"], "pue");
  assert.ok(init.headers["Idempotency-Key"], "writes carry an idempotency key");
  assert.deepEqual(JSON.parse(init.body), { fullName: "Ada" });
});

test("api: lists with paging and search, and sends no idempotency key on reads", async () => {
  const calls = fakeBrowser({ fetchImpl: async () => json({ ok: true, items: [{ id: "1" }], total: 7 }) });
  const result = await pueApi.list("sites", { limit: 25, offset: 50, q: "mus", empty: "" });
  assert.deepEqual(result, { items: [{ id: "1" }], total: 7 });
  assert.equal(calls[0].url, "/api/v1/pue/registry/sites?limit=25&offset=50&q=mus");
  assert.equal(calls[0].init.headers["Idempotency-Key"], undefined);
});

test("api: shows the server's reason on failure", async () => {
  fakeBrowser({ fetchImpl: async () => json({ error: "duplicate", message: "A record with that unique value already exists." }, 409) });
  await assert.rejects(pueApi.create("bikes", {}), (error) => error instanceof PueApiError && error.code === "duplicate" && error.status === 409 && /already exists/.test(error.message));
});

test("api: fails clearly when signed out or offline, and never invents data", async () => {
  fakeBrowser({ token: null, fetchImpl: async () => json({}) });
  await assert.rejects(pueApi.list("sites"), (error) => error.code === "not_signed_in");
  fakeBrowser({ fetchImpl: async () => { throw new TypeError("fetch failed"); } });
  await assert.rejects(pueApi.list("sites"), (error) => error.code === "network");
});

test("money: kobo and naira convert without float drift, and missing is a dash", () => {
  assert.equal(minorFromNaira("900,000"), 90000000);
  assert.equal(minorFromNaira("₦1,300.50"), 130050);
  assert.equal(minorFromNaira("0.1"), 10);
  assert.equal(minorFromNaira("abc"), null);
  assert.equal(minorFromNaira("12.345"), null);
  assert.equal(nairaFromMinor(130000), "₦1,300.00");
  assert.equal(nairaFromMinor(null), "—");
  assert.equal(nairaFromMinor(undefined), "—");
});

test("config: every registry has columns, fields, and a first required field", () => {
  for (const [key, config] of Object.entries(RESOURCES)) {
    assert.ok(config.columns.length && config.fields.length, `${key} needs columns and fields`);
    assert.ok(config.fields.some((field) => field.required), `${key} needs a required field`);
    for (const field of config.fields) assert.ok(field.row, `${key}.${field.key} needs a row key for editing`);
  }
});

test("config: validates, trims, and builds API bodies", () => {
  const riders = RESOURCES.riders;
  const form = initialForm(riders, null);
  assert.deepEqual(validateForm(riders, form), ["Full name is required.", "Phone is required."]);
  Object.assign(form, { fullName: "  Ada Bello ", phone: "0803 290 2825", email: "" });
  assert.deepEqual(validateForm(riders, form), []);
  const create = formToBody(riders, form, { editing: false });
  assert.equal(create.fullName, "Ada Bello");
  assert.ok(!("email" in create), "empty optional fields are left out when creating");
  assert.equal(create.status, "active");
  const edit = formToBody(riders, form, { editing: true });
  assert.equal(edit.email, null, "clearing an optional field sends null when editing");
});

test("config: numbers must be whole and never negative", () => {
  const stations = RESOURCES["swap-stations"];
  const form = initialForm(stations, null);
  Object.assign(form, { siteId: "s1", name: "Musha hub", bayCount: "2.5" });
  assert.deepEqual(validateForm(stations, form), ["Number of bays must be a whole number."]);
  form.bayCount = "12";
  assert.equal(formToBody(stations, form, { editing: false }).bayCount, 12);
});

test("config: prefills an edit from the stored row", () => {
  const form = initialForm(RESOURCES.bikes, { serial_number: "BK-1", model: null, status: "sold", site_id: "s1" });
  assert.deepEqual(form, { serialNumber: "BK-1", model: "", status: "sold", siteId: "s1" });
});

test("config: record labels show names, not ids", () => {
  assert.equal(recordLabel("sites", { name: "Musha", community: "Musha", state: "Nasarawa" }), "Musha (Musha, Nasarawa)");
  assert.equal(recordLabel("riders", { full_name: "Ada", phone: "+2348032902825" }), "Ada (+2348032902825)");
  assert.equal(recordLabel("bikes", null), "—");
});

test("store: loads server rows and nothing else", async () => {
  setActivePinia(createPinia());
  fakeBrowser({ fetchImpl: async () => json({ ok: true, items: [{ id: "a", name: "Musha" }], total: 1 }) });
  const store = usePueRegistryStore();
  await store.load("sites");
  assert.deepEqual(store.list("sites"), { items: [{ id: "a", name: "Musha" }], total: 1 });
  assert.equal(store.errors.sites, null);
});

test("store: a failed load leaves the list empty and says why, with no sample rows", async () => {
  setActivePinia(createPinia());
  fakeBrowser({ fetchImpl: async () => json({ error: "registry_unavailable", message: "The PUE registry is not set up in this database yet." }, 503) });
  const store = usePueRegistryStore();
  await store.load("riders");
  assert.deepEqual(store.list("riders"), { items: [], total: 0 });
  assert.match(store.errors.riders, /not set up/);
  assert.equal(store.loading.riders, false);
});

test("store: lookups give names, a dash for unknown ids, and fill dropdowns", async () => {
  setActivePinia(createPinia());
  fakeBrowser({ fetchImpl: async () => json({ ok: true, items: [{ id: "s1", name: "Musha", state: "Nasarawa", community: null }], total: 1 }) });
  const store = usePueRegistryStore();
  await store.loadOptions("sites");
  assert.equal(store.labelFor("sites", "s1"), "Musha (Nasarawa)");
  assert.equal(store.labelFor("sites", "missing"), "—");
  assert.equal(store.labelFor("sites", null), "—");
  assert.deepEqual(store.optionList("sites"), [{ id: "s1", label: "Musha (Nasarawa)" }]);
});

test("store: save creates or updates, and surfaces the server's refusal", async () => {
  setActivePinia(createPinia());
  const calls = fakeBrowser({ fetchImpl: async () => json({ ok: true, item: { id: "x" } }) });
  const store = usePueRegistryStore();
  await store.save("bikes", { serialNumber: "BK-1" });
  await store.save("bikes", { model: "M" }, "11111111-1111-4111-8111-111111111111");
  assert.deepEqual(calls.map((call) => call.init.method), ["POST", "PATCH"]);
  fakeBrowser({ fetchImpl: async () => json({ error: "duplicate", message: "A record with that unique value already exists." }, 409) });
  await assert.rejects(store.save("bikes", { serialNumber: "BK-1" }), /already exists/);
});

test("store: sales load and a failure empties them", async () => {
  setActivePinia(createPinia());
  fakeBrowser({ fetchImpl: async () => json({ ok: true, items: [{ id: "1", total_minor: 100 }], total: 1 }) });
  const store = usePueRegistryStore();
  await store.loadSales();
  assert.equal(store.sales.total, 1);
  fakeBrowser({ fetchImpl: async () => { throw new TypeError("offline"); } });
  await store.loadSales();
  assert.deepEqual(store.sales, { items: [], total: 0 });
  assert.match(store.salesError, /Could not reach Beverly/);
});
