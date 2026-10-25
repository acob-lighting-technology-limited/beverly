"use strict";
const assert = require("node:assert/strict");
process.env.SESSION_STORE_MODE = "supabase";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
process.env.LIVE_API_BASE_URL = "https://source.test";
process.env.DATABASE_QUOTA_MB = "8000";
process.env.CONSUMPTION_SYNC_RETRIES = "1";
const supabase = require("../backend/src/services/supabase-service");
const original = { fetch: global.fetch, rest: supabase.restRequest, read: supabase.restRequestWithResponse };
const states = new Map(), writes = [], calls = [];
let pages = [], businessCode = 0, aggregateFailure = false, writeFailure = false, lostLease = false, quotaBytes = 409783443;
const empty = { response: { status: 200, headers: { get: () => "0-0/0" } }, body: [] };
function reset() { states.clear(); writes.length = 0; calls.length = 0; pages = []; businessCode = 0; aggregateFailure = false; writeFailure = false; lostLease = false; quotaBytes = 409783443; }
function row(meterId, day, stationId = "TUNGA") { return { stationId, meterId, currentDate: day, total1: 100 }; }
supabase.restRequest = async (pathname, options = {}) => {
  writes.push({ pathname, body: options.body });
  const body = options.body;
  if (writeFailure && pathname.startsWith("/daily_meter_readings?")) throw new Error("Storage write failed");
  if (pathname === "/rpc/consumption_database_usage") return { bytes: quotaBytes };
  if (pathname === "/rpc/claim_consumption_sync_station") return "TUNGA";
  if (pathname === "/rpc/acquire_consumption_sync_station") {
    const state = states.get(body.p_station_id) || {};
    if (state.busy) return { acquired: false };
    state.busy = true; state.owner = body.p_owner;
    states.set(body.p_station_id, state);
    return { acquired: true, state: { ...state } };
  }
  if (pathname === "/rpc/checkpoint_consumption_sync_station") {
    const state = states.get(body.p_station_id);
    if (!state || state.owner !== body.p_owner || (lostLease && body.p_outcome)) return false;
    state.scan_progress = body.p_progress;
    if (body.p_outcome) { Object.assign(state, body.p_outcome); state.busy = false; }
    return true;
  }
  return [];
};
supabase.restRequestWithResponse = async (pathname) => {
  if (pathname.includes("refresh_meter_reading_aggregates")) {
    if (aggregateFailure) throw new Error("Aggregate failed");
    return empty;
  }
  if (pathname.includes("order=reading_date.desc")) return { ...empty, body: [{ reading_date: "2026-10-24" }] };
  return empty;
};
global.fetch = async (url, init) => {
  const payload = JSON.parse(init.body); calls.push({ url, ...payload });
  if (url.endsWith("/api/station/read")) return { ok: true, json: async () => ({ code: 0, result: { data: ["ADMIN", "TUNGA", "UMAISHA", "OGUFA", "KYAKALE", "MUSHA", "OFEMILI"].map(stationId => ({ stationId })) } }) };
  const data = (pages[payload.pageNumber - 1] || []).map(r => ({ ...r, stationId: r.stationId === "AUTO" ? payload.stationId : r.stationId }));
  return { ok: true, status: 200, json: async () => ({ code: businessCode, reason: businessCode ? "Source rejected request" : "success", result: { data, total: pages.flat().length } }) };
};
(async () => {
  const { runConsumptionSync, runScheduledConsumptionSync, syncWindow, databaseQuotaState } = require("../backend/src/services/consumption-sync-service");
  const input = { stations: "TUNGA", from: "2026-10-21", to: "2026-10-24", pageSize: 2, maxPages: 10, stationAttempts: 1, retries: 1 };
  assert.equal(syncWindow("incremental", { latestReadingDate: "2026-10-24" }, { to: "2026-10-25" }).from, "2026-10-17");
  assert.equal(syncWindow("incremental", { latestReadingDate: "2026-10-24" }, { from: "2026-10-21", to: "2026-10-25" }).from, "2026-10-21");
  assert.equal(syncWindow("backfill", {}, { from: "2020-01-01", to: "2026-10-25" }).from, "2026-08-26");

  reset();
  pages = [[row("OLD", "2015-01-01"), row("OLDER", "2014-01-01")], [row("M1", "2026-10-23")]];
  const unordered = await runConsumptionSync(input);
  assert.equal(unordered.ok, true);
  assert.equal(unordered.storedRows, 1, "old dates must not stop later eligible pages");
  assert.equal(unordered.stations[0].verification, "observed_only");
  assert.equal(unordered.stations[0].verifiedCompleteThrough, null);
  assert.equal(states.get("TUNGA").observed_through, "2026-10-24");
  assert(calls.some(c => c.pageNumber === 2));
  assert.deepEqual(calls.find(c => c.pageNumber === 1).currentDateRange, ["2026-10-21", "2026-10-24"]);

  reset();
  pages = Array.from({ length: 12 }, (_, i) => [row(`M${i}A`, "2026-10-22"), row(`M${i}B`, "2026-10-23")]);
  const partial = await runConsumptionSync({ ...input, maxPages: 10 });
  assert.equal(partial.ok, false);
  assert.equal(partial.stations[0].pagesFetched, 10, "no hidden eight-page limit");
  assert.equal(states.get("TUNGA").scan_progress.nextPage, 11);
  calls.length = 0;
  const resumed = await runConsumptionSync({ ...input, maxPages: 10 });
  assert.equal(calls[0].pageNumber, 10, "replay committed boundary, never restart at page one");
  assert.equal(resumed.ok, true);
  assert.equal(states.get("TUNGA").scan_progress, null);

  reset();
  businessCode = 500;
  const businessFailure = await runConsumptionSync(input);
  assert.equal(businessFailure.failedStations, 1);
  assert.equal(states.get("TUNGA").last_status, "failed");
  assert(!writes.some(w => w.pathname.startsWith("/daily_meter_readings?")));

  reset();
  pages = [[row("M1", "2026-10-22")]]; aggregateFailure = true;
  const failedAggregate = await runConsumptionSync(input);
  assert.equal(failedAggregate.ok, false);
  assert.equal(states.get("TUNGA").last_status, "failed");
  assert.match(states.get("TUNGA").last_error, /Aggregate/);

  reset();
  pages = [[row("DUP", "2026-10-22"), row("DUP", "2026-10-22")]];
  const duplicate = await runConsumptionSync(input);
  assert.equal(duplicate.storedRows, 1);
  assert.equal(writes.find(w => w.pathname.startsWith("/daily_meter_readings?")).body.length, 1);

  reset();
  pages = [[row("M1", "2026-10-22")]]; writeFailure = true;
  const failedWrite = await runConsumptionSync(input);
  assert.equal(failedWrite.failedStations, 1);
  assert.equal(states.get("TUNGA").scan_progress, null);
  assert.equal(states.get("TUNGA").observed_through, null);

  reset(); lostLease = true;
  await assert.rejects(runConsumptionSync(input), /lease lost/);
  assert(!writes.some(w => w.pathname.startsWith("/consumption_sync_runs?id=") && w.body.status === "succeeded"));

  reset();
  states.set("TUNGA", { busy: true });
  const leased = await runConsumptionSync(input);
  assert.equal(leased.failedStations, 1);
  assert(!calls.some(c => c.url.endsWith("/api/DailyDataMeter/read")));

  reset();
  const scheduled = await runScheduledConsumptionSync({ from: "2026-10-21", to: "2026-10-24", maxPages: 2 });
  assert.equal(scheduled.visitedStations, 6);
  assert.equal(scheduled.runs, 6);
  assert.equal(new Set(calls.filter(c => c.url.endsWith("/api/DailyDataMeter/read")).map(c => c.stationId)).size, 6);
  assert(!states.has("ADMIN"));

  reset();
  quotaBytes = 6500000000;
  const paused = await runConsumptionSync(input);
  assert.equal(paused.quotaPaused, true);
  assert(!calls.some(c => c.url.endsWith("/api/DailyDataMeter/read")));
  const quota = await databaseQuotaState({ databaseQuotaMb: 8000 }, "incremental");
  assert.equal(quota.quotaPaused, true);
  console.log("consumption sync recovery regressions passed");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = original.fetch; supabase.restRequest = original.rest; supabase.restRequestWithResponse = original.read;
});
