// Beverly PUE swaps screen: the client-side rules that keep money and hardware safe.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { PueApiError, pueApi } from "../apps/battery-swap/src/services/pue-api.js";
import { usePueSwapsStore } from "../apps/battery-swap/src/stores/pue-swaps-store.js";

function fakeBrowser(fetchImpl) {
  const calls = [];
  globalThis.localStorage = { getItem: () => "staff-token", setItem() {}, removeItem() {} };
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return fetchImpl(url, init); };
  return calls;
}
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

test("a retried reservation or payment sends the SAME idempotency key", async () => {
  const calls = fakeBrowser(async () => json({ ok: true, swap: { id: "s1" } }));
  await pueApi.reserveSwap({ riderId: "r", stationId: "t" }, "key-for-this-attempt-1");
  await pueApi.reserveSwap({ riderId: "r", stationId: "t" }, "key-for-this-attempt-1");
  await pueApi.recordSwapPayment("s1", { method: "cash", amountMinor: 130000 }, "pay-key-for-s1-0001");
  await pueApi.recordSwapPayment("s1", { method: "cash", amountMinor: 130000 }, "pay-key-for-s1-0001");
  assert.deepEqual(calls.map((c) => c.init.headers["Idempotency-Key"]), ["key-for-this-attempt-1", "key-for-this-attempt-1", "pay-key-for-s1-0001", "pay-key-for-s1-0001"]);
});

test("other writes without a stable key still get a fresh one each time", async () => {
  const calls = fakeBrowser(async () => json({ ok: true, swap: {} }));
  await pueApi.cancelSwap("s1", { reason: "no battery" });
  await pueApi.cancelSwap("s1", { reason: "no battery" });
  assert.notEqual(calls[0].init.headers["Idempotency-Key"], calls[1].init.headers["Idempotency-Key"]);
  assert.ok(calls.every((c) => c.init.headers["X-Beverly-Portal"] === "pue" && c.init.headers.Authorization === "Bearer staff-token"));
});

test("swap endpoints use the right routes and bodies", async () => {
  const calls = fakeBrowser(async () => json({ ok: true, swap: {}, checkout: { authorizationUrl: "u" }, settings: {}, items: [], total: 0 }));
  await pueApi.completeSwap("s1", { returnedBatteryId: "b1" });
  await pueApi.startSwapPaystack("s1");
  await pueApi.verifySwapPaystack("s1");
  await pueApi.listSwaps({ limit: 25, offset: 0, status: "paid" });
  await pueApi.updateSwapSettings({ priceMinor: 150000 });
  assert.deepEqual(calls.map((c) => `${c.init.method} ${c.url}`), [
    "POST /api/v1/pue/swaps/s1/complete", "POST /api/v1/pue/swaps/s1/paystack", "POST /api/v1/pue/swaps/s1/paystack/verify",
    "GET /api/v1/pue/swaps?limit=25&offset=0&status=paid", "PATCH /api/v1/pue/settings",
  ]);
  assert.deepEqual(JSON.parse(calls[0].init.body), { returnedBatteryId: "b1" });
});

test("a server refusal keeps its reason and its details (e.g. the open swap id)", async () => {
  fakeBrowser(async () => json({ error: "swap_already_open", message: "This rider already has an open swap.", swapId: "open-1" }, 409));
  await assert.rejects(pueApi.reserveSwap({}, "key-for-this-attempt-2"), (error) =>
    error instanceof PueApiError && error.code === "swap_already_open" && error.status === 409 && error.details.swapId === "open-1" && /open swap/.test(error.message));
});

test("store: a failed load leaves no swaps and says why; money actions pass errors straight through", async () => {
  setActivePinia(createPinia());
  fakeBrowser(async () => json({ error: "swaps_unavailable", message: "Swaps are not set up in this database yet." }, 503));
  const store = usePueSwapsStore();
  await store.load();
  assert.deepEqual(store.swaps, { items: [], total: 0 });
  assert.match(store.error, /not set up/);
  await store.loadSettings();
  assert.equal(store.settings, null);
  assert.match(store.settingsError, /not set up/);
  await assert.rejects(store.recordPayment("s1", { method: "cash", amountMinor: 1 }, "pay-key-for-s1-0002"), /not set up/);
});

test("store: loads swaps and settings from the server only", async () => {
  setActivePinia(createPinia());
  fakeBrowser(async (url) => (String(url).includes("/settings") ? json({ ok: true, settings: { priceMinor: 130000, minSoc: 90 } }) : json({ ok: true, items: [{ id: "s1" }], total: 1 })));
  const store = usePueSwapsStore();
  await store.load({ page: 2, status: "paid" });
  await store.loadSettings();
  assert.equal(store.swaps.total, 1);
  assert.equal(store.settings.priceMinor, 130000);
});
