// Beverly PUE appliances: client rules that keep money, customers and hardware honest.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { PueApiError, pueApi } from "../apps/battery-swap/src/services/pue-api.js";
import { RESOURCES, formToBody, initialForm, recordLabel, validateForm } from "../apps/battery-swap/src/services/registry-config.js";
import { usePueAppliancesStore } from "../apps/battery-swap/src/stores/pue-appliances-store.js";

function fakeBrowser(fetchImpl) {
  const calls = [];
  globalThis.localStorage = { getItem: () => "staff-token", setItem() {}, removeItem() {} };
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return fetchImpl(url, init); };
  return calls;
}
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

test("appliance catalogue and units use the appliance routes, registry resources keep theirs", async () => {
  const calls = fakeBrowser(async () => json({ ok: true, items: [], total: 0, item: {} }));
  await pueApi.list("appliance-types", { limit: 25, offset: 0 });
  await pueApi.list("appliance-units", { limit: 1, status: "in_stock" });
  await pueApi.create("appliance-units", { typeId: "t", serialNumber: "FR-1000" });
  await pueApi.update("appliance-types", "t1", { active: false });
  await pueApi.list("riders", { limit: 5 });
  assert.deepEqual(calls.map((c) => `${c.init.method} ${c.url}`), [
    "GET /api/v1/pue/appliances/types?limit=25&offset=0",
    "GET /api/v1/pue/appliances/units?limit=1&status=in_stock",
    "POST /api/v1/pue/appliances/units",
    "PATCH /api/v1/pue/appliances/types/t1",
    "GET /api/v1/pue/registry/riders?limit=5"
  ]);
});

test("sale, payment, end and fault endpoints use the right routes", async () => {
  const calls = fakeBrowser(async () => json({ ok: true, sale: {}, items: [], total: 0, fault: {} }));
  await pueApi.searchCustomers("ada");
  await pueApi.listApplianceSales({ limit: 25, offset: 0, status: "active" });
  await pueApi.sellAppliance({ applianceId: "a", customerId: "c" });
  await pueApi.recordAppliancePayment("s1", { amountMinor: 100 }, "pay-key-0001");
  await pueApi.endApplianceSale("s1", { outcome: "cancelled", reason: "returned" });
  await pueApi.reportApplianceFault({ applianceId: "a", summary: "no cooling" });
  await pueApi.updateApplianceFault("f1", { status: "resolved", resolution: "fixed" });
  assert.deepEqual(calls.map((c) => `${c.init.method} ${c.url}`), [
    "GET /api/v1/pue/appliance-customers?q=ada",
    "GET /api/v1/pue/appliance-sales?limit=25&offset=0&status=active",
    "POST /api/v1/pue/appliance-sales",
    "POST /api/v1/pue/appliance-sales/s1/payment",
    "POST /api/v1/pue/appliance-sales/s1/end",
    "POST /api/v1/pue/appliance-faults",
    "PATCH /api/v1/pue/appliance-faults/f1"
  ]);
});

test("a retried payment sends the SAME idempotency key", async () => {
  const calls = fakeBrowser(async () => json({ ok: true, sale: {} }));
  await pueApi.recordAppliancePayment("s1", { amountMinor: 500, method: "cash" }, "pay-key-for-s1-0001");
  await pueApi.recordAppliancePayment("s1", { amountMinor: 500, method: "cash" }, "pay-key-for-s1-0001");
  assert.deepEqual(calls.map((c) => c.init.headers["Idempotency-Key"]), ["pay-key-for-s1-0001", "pay-key-for-s1-0001"]);
  assert.ok(calls.every((c) => c.init.headers["X-Beverly-Portal"] === "pue" && c.init.headers.Authorization === "Bearer staff-token"));
});

test("a server refusal keeps its reason", async () => {
  fakeBrowser(async () => json({ error: "overpayment", message: "That is more than the balance still owed." }, 409));
  await assert.rejects(pueApi.recordAppliancePayment("s1", {}, "pay-key-0000002"), (e) => e instanceof PueApiError && e.code === "overpayment" && /balance/.test(e.message));
});

test("catalogue price is typed in naira and sent as kobo", () => {
  const config = RESOURCES["appliance-types"];
  const body = formToBody(config, { name: "Chest freezer", category: "freezer", defaultPriceMinor: "900,000", notes: "" }, { editing: false });
  assert.equal(body.defaultPriceMinor, 90000000);
  assert.deepEqual(validateForm(config, { name: "Chest freezer", defaultPriceMinor: "nine hundred" }).length, 1);
  assert.equal(initialForm(config, { name: "x", default_price_minor: 90000000 }).defaultPriceMinor, "900000");
  assert.equal(initialForm(config, null).defaultPriceMinor, "");
});

test("unit form cannot set Sold by hand and needs a type and serial", () => {
  const config = RESOURCES["appliance-units"];
  const status = config.fields.find((f) => f.key === "status");
  assert.ok(!status.options.some(([value]) => value === "sold"));
  assert.equal(validateForm(config, { typeId: "", serialNumber: "" }).length, 2);
  assert.equal(recordLabel("appliance-units", { serial_number: "FR-1000", pue_appliance_types: { name: "Freezer" } }), "FR-1000 · Freezer");
});

test("store: a failed sales load empties the list and says why", async () => {
  setActivePinia(createPinia());
  fakeBrowser(async () => json({ error: "appliances_unavailable", message: "Appliances are not set up in this database yet." }, 503));
  const store = usePueAppliancesStore();
  await store.loadSales();
  assert.deepEqual(store.sales, { items: [], total: 0 });
  assert.match(store.salesError, /not set up/);
  assert.equal(store.salesLoading, false);
});

test("store: overview counts are real totals, and the owed total is withheld when not every sale was read", async () => {
  setActivePinia(createPinia());
  fakeBrowser(async (url) => {
    if (url.includes("/appliances/units")) return json({ ok: true, items: [], total: url.includes("in_stock") ? 4 : url.includes("sold") ? 2 : url.includes("faulty") ? 1 : 7 });
    if (url.includes("/appliance-sales")) return json({ ok: true, items: [{ balanceMinor: 100 }, { balanceMinor: 250 }], total: 2 });
    return json({ ok: true, items: [], total: 3 });
  });
  const store = usePueAppliancesStore();
  await store.loadOverview();
  assert.deepEqual(store.overview, { units: 7, inStock: 4, sold: 2, faulty: 1, activeSales: 2, openFaults: 3, outstandingMinor: 350, outstandingComplete: true });

  fakeBrowser(async (url) => {
    if (url.includes("/appliance-sales")) return json({ ok: true, items: [{ balanceMinor: 100 }], total: 500 });
    return json({ ok: true, items: [], total: 1 });
  });
  await store.loadOverview();
  assert.equal(store.overview.outstandingMinor, null);
});

test("store: a failed overview shows dashes, never zeros", async () => {
  setActivePinia(createPinia());
  fakeBrowser(async () => json({ error: "appliances_failed", message: "The appliance request could not be completed." }, 503));
  const store = usePueAppliancesStore();
  await store.loadOverview();
  assert.equal(store.overview.inStock, null);
  assert.equal(store.overview.openFaults, null);
  assert.match(store.overviewError, /could not be completed/);
});

test("store: short customer searches never call the server", async () => {
  setActivePinia(createPinia());
  const calls = fakeBrowser(async () => json({ ok: true, items: [{ id: "c1" }] }));
  const store = usePueAppliancesStore();
  await store.searchCustomers("a");
  assert.equal(calls.length, 0);
  await store.searchCustomers("ada");
  assert.equal(calls.length, 1);
  assert.deepEqual(store.customers, [{ id: "c1" }]);
});

test("the appliance screens never claim remote control and keep no data in the browser", () => {
  const root = new URL("../apps/battery-swap/src/", import.meta.url);
  for (const file of ["views/AppliancesOverviewPage.vue", "views/ApplianceSalesPage.vue", "views/ApplianceFaultsPage.vue", "stores/pue-appliances-store.js"]) {
    const text = fs.readFileSync(new URL(file, root), "utf8");
    assert.ok(!/localStorage|sessionStorage/.test(text), `${file} must not cache data in the browser`);
  }
  const overview = fs.readFileSync(new URL("views/AppliancesOverviewPage.vue", root), "utf8");
  assert.match(overview, /Not connected/);
  assert.ok(!/switchOn|switchOff|toggleAppliance|turn on/i.test(overview));
});

test("an expired session (401) tells the shell to sign out and says so plainly", async () => {
  fakeBrowser(async () => json({ error: "unauthorized", message: "Invalid or expired session." }, 401));
  const events = [];
  globalThis.dispatchEvent = (event) => events.push(event.type);
  await assert.rejects(pueApi.list("riders", {}), (e) => e instanceof PueApiError && e.code === "session_expired" && /Sign in again/.test(e.message));
  assert.deepEqual(events, ["pue:session-expired"]);
  delete globalThis.dispatchEvent;
});

test("a bare 500 with no body says the server did not answer, a 500 with a reason keeps the reason", async () => {
  fakeBrowser(async () => ({ ok: false, status: 500, json: async () => { throw new Error("no body"); } }));
  await assert.rejects(pueApi.list("riders", {}), (e) => e.code === "server_unreachable" && /wallet backend/.test(e.message));
  fakeBrowser(async () => json({ error: "appliances_unavailable", message: "Appliances are not set up in this database yet." }, 503));
  await assert.rejects(pueApi.list("appliance-types", {}), (e) => e.code === "appliances_unavailable" && /not set up/.test(e.message));
});

test("a saved token past its own expiry is recognised before it is sent", async () => {
  const { tokenExpired } = await import("../apps/battery-swap/src/stores/auth.ts");
  const token = (exp) => `x.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.y`;
  const now = Date.parse("2026-11-19T12:00:00Z");
  assert.equal(tokenExpired(token(Date.parse("2026-11-18T11:55:25Z") / 1000), now), true);
  assert.equal(tokenExpired(token(Date.parse("2026-11-19T13:00:00Z") / 1000), now), false);
  assert.equal(tokenExpired("not-a-jwt", now), false);
});

// ── Session renewal (why PUE signed people out after an hour) ──────────────────────────────────────
function storageBrowser(initial, fetchImpl) {
  const store = new Map(Object.entries(initial));
  const calls = [];
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return fetchImpl(url, init, calls); };
  const events = [];
  globalThis.dispatchEvent = (event) => events.push(event.type);
  return { store, calls, events };
}
const TOKEN = "beverly.battery_swap.access_token";
const REFRESH = "beverly.battery_swap.refresh_token";

test("a 401 renews the session once and retries the same request with the new token", async () => {
  const { store, calls, events } = storageBrowser({ [TOKEN]: "old-access", [REFRESH]: "refresh-token-1" }, async (url, init) => {
    if (url.includes("password-refresh")) return json({ access_token: "new-access", refresh_token: "refresh-token-2", expires_at: 4102444800, user: { role: "super-admin" } });
    return init.headers.Authorization === "Bearer new-access" ? json({ ok: true, items: [], total: 0 }) : json({ message: "Invalid or expired session." }, 401);
  });
  const { refreshSession } = await import("../apps/battery-swap/src/lib/session.js");
  const result = await pueApi.list("riders", {});
  assert.deepEqual(result, { items: [], total: 0 });
  assert.equal(store.get(TOKEN), "new-access");
  assert.equal(store.get(REFRESH), "refresh-token-2");
  assert.ok(calls.some((c) => c.url.includes("password-refresh")));
  assert.ok(events.includes("pue:session-refreshed"));
  assert.ok(!events.includes("pue:session-expired"));
  assert.equal(typeof refreshSession, "function");
  delete globalThis.dispatchEvent;
});

test("a retried write after renewal keeps its idempotency key, so money is never recorded twice", async () => {
  const { calls } = storageBrowser({ [TOKEN]: "old-access", [REFRESH]: "refresh-token-1" }, async (url, init) => {
    if (url.includes("password-refresh")) return json({ access_token: "new-access", refresh_token: "r2", expires_at: 4102444800 });
    return init.headers.Authorization === "Bearer new-access" ? json({ ok: true, sale: {} }) : json({}, 401);
  });
  await pueApi.recordAppliancePayment("s1", { amountMinor: 100, method: "cash" }, "stable-key-0001");
  const writes = calls.filter((c) => c.url.includes("/appliance-sales/s1/payment"));
  assert.equal(writes.length, 2);
  assert.deepEqual(writes.map((c) => c.init.headers["Idempotency-Key"]), ["stable-key-0001", "stable-key-0001"]);
  delete globalThis.dispatchEvent;
});

test("when the server rejects the refresh token the session ends, and the person is told", async () => {
  const { events } = storageBrowser({ [TOKEN]: "old-access", [REFRESH]: "dead-refresh" }, async (url) =>
    url.includes("password-refresh") ? json({ error: "refresh_rejected" }, 401) : json({}, 401));
  await assert.rejects(pueApi.list("riders", {}), (e) => e.code === "session_expired");
  assert.ok(events.includes("pue:session-expired"));
  delete globalThis.dispatchEvent;
});

test("a network or server problem during renewal does NOT sign the person out", async () => {
  const { events, store } = storageBrowser({ [TOKEN]: "old-access", [REFRESH]: "good-refresh" }, async (url) =>
    url.includes("password-refresh") ? json({ error: "auth_upstream_unreachable" }, 503) : json({}, 401));
  await assert.rejects(pueApi.list("riders", {}), (e) => e.code === "session_refresh_failed");
  assert.ok(!events.includes("pue:session-expired"));
  assert.equal(store.get(REFRESH), "good-refresh");
  delete globalThis.dispatchEvent;
});

test("without a refresh token a 401 behaves as before: the session is over", async () => {
  const { events } = storageBrowser({ [TOKEN]: "old-access" }, async () => json({}, 401));
  await assert.rejects(pueApi.list("riders", {}), (e) => e.code === "session_expired");
  assert.ok(events.includes("pue:session-expired"));
  delete globalThis.dispatchEvent;
});

// ── Dashboards, analytics and insights ──────────────────────────────────────────────────────────────
import { applianceInsights, swapInsights } from "../apps/battery-swap/src/services/pue-insights.js";
import { usePueAnalyticsStore } from "../apps/battery-swap/src/stores/pue-analytics-store.js";

const emptyHours = Array.from({ length: 24 }, (_, hour) => ({ hour, completed: 0 }));
const swapData = (over = {}) => ({
  days: 30,
  totals: { swaps: 20, completed: 12, cancelled: 5, expired: 3, open: 0, completionRate: 0.6, revenueMinor: 1_560_000, refundsMinor: 130_000, netRevenueMinor: 1_430_000, avgRevenuePerSwapMinor: 130_000, medianMinutesToHandover: 25, activeRiders: 8, repeatRiderShare: 0.5 },
  byHour: emptyHours.map((h) => (h.hour === 17 ? { ...h, completed: 6 } : h)),
  byStation: [{ stationId: "s1", name: "Musha hub", completed: 10, revenueMinor: 1_300_000 }, { stationId: "s2", name: "Bako hub", completed: 2, revenueMinor: 260_000 }],
  byMethod: [{ method: "cash", count: 10, amountMinor: 1_300_000 }, { method: "transfer", count: 2, amountMinor: 260_000 }],
  ...over
});
const titles = (list) => list.map((i) => i.key);

test("swap insights say what they saw, with the numbers behind it", () => {
  const list = swapInsights(swapData(), { status: "unavailable", counts: {}, error: "x" });
  assert.ok(titles(list).includes("completion-low"));
  assert.ok(titles(list).includes("expired"));
  assert.ok(titles(list).includes("peak"));
  assert.ok(titles(list).includes("cash"));
  assert.ok(titles(list).includes("refunds"));
  assert.match(list.find((i) => i.key === "peak").title, /17:00/);
  assert.match(list.find((i) => i.key === "refunds").title, /1,300/);
});

test("with no swaps there is one honest line, and no rate is claimed from thin data", () => {
  const none = swapInsights(swapData({ totals: { ...swapData().totals, swaps: 0, completed: 0, cancelled: 0, expired: 0, completionRate: null } }), null);
  assert.deepEqual(titles(none), ["none"]);
  const thin = swapInsights(swapData({ totals: { ...swapData().totals, completed: 2, cancelled: 3, expired: 0, completionRate: 0.4, swaps: 5 } }), null);
  assert.ok(!titles(thin).includes("completion-low"));
});

test("live battery insights appear only when Yunhe answers, and say so when it does not", () => {
  const off = swapInsights(swapData(), { status: "unavailable", counts: { total: 0, online: 0, offline: 0, lowCharge: 0 } });
  assert.ok(titles(off).includes("fleet-off"));
  assert.ok(!titles(off).includes("low-charge"));
  const on = swapInsights(swapData(), { status: "ok", counts: { total: 12, online: 9, offline: 3, lowCharge: 2 } });
  assert.ok(titles(on).includes("low-charge") && titles(on).includes("offline"));
  assert.ok(!titles(on).includes("fleet-off"));
  assert.deepEqual(swapInsights(null, null), []);
});

test("appliance insights flag money owed, open high faults and an empty shelf", () => {
  const data = {
    totals: { unitsTotal: 8, soldInWindow: 3, collectedMinor: 100, activeSales: 2, outstandingMinor: 900_000, paidShare: 0.25, openFaults: 2, faultsReportedInWindow: 2, medianHoursToResolve: 96 },
    unitsByStatus: { in_stock: 0, sold: 6, faulty: 2, retired: 0 }, openFaultsBySeverity: { high: 1, medium: 1, low: 0 }
  };
  const keys = titles(applianceInsights(data));
  assert.ok(keys.includes("owed-low-paid") && keys.includes("sold-out") && keys.includes("faults-high") && keys.includes("fix-time") && keys.includes("faulty-share"));
  assert.deepEqual(titles(applianceInsights({ totals: { unitsTotal: 0 } })), ["no-units"]);
});

test("analytics requests go to the read-only routes and a failure leaves nothing on screen", async () => {
  setActivePinia(createPinia());
  const calls = fakeBrowser(async () => json({ ok: true, analytics: { days: 7, totals: {}, daily: [] } }));
  const store = usePueAnalyticsStore();
  await store.loadSwaps(7);
  await store.loadAppliances(90);
  assert.deepEqual(calls.map((c) => `${c.init.method} ${c.url}`), ["GET /api/v1/pue/analytics/swaps?days=7", "GET /api/v1/pue/analytics/appliances?days=90"]);
  fakeBrowser(async () => json({ error: "analytics_unavailable", message: "Analytics could not be read right now." }, 503));
  await store.loadSwaps(30);
  assert.equal(store.swaps, null);
  assert.match(store.swapsError, /could not be read/);
});

test("the dashboards never cache figures in the browser", () => {
  const root = new URL("../apps/battery-swap/src/", import.meta.url);
  for (const file of ["views/BatteryDashboardPage.vue", "views/BatteryAnalyticsPage.vue", "views/ApplianceAnalyticsPage.vue", "views/AppliancesOverviewPage.vue", "stores/pue-analytics-store.js", "services/pue-insights.js"]) {
    assert.ok(!/localStorage|sessionStorage/.test(fs.readFileSync(new URL(file, root), "utf8")), `${file} must not cache data in the browser`);
  }
});
