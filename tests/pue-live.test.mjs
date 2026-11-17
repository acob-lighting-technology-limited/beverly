// Beverly PUE live data: Yunhe field mapping, alert rules, and joining with the registry.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ALERT_DEFAULTS, assessBattery, joinBatteries, normalizeYunheBattery, toIso, toNumber, toOnline, worstLevel } from "../apps/battery-swap/src/services/yunhe-normalize.js";

const NOW = Date.parse("2026-11-17T12:00:00Z");

test("normalize: reads the fields it recognises and records which provider key it used", () => {
  const n = normalizeYunheBattery({ id: "BT1", sn: "S1", soc: "81", v: 76.2, i: -0.56, temp: 29.5, lat: 7.345, lng: 5.178, online: 1, last_time: "2026-11-17 11:00:00", extra_field: 1 });
  assert.equal(n.batteryNumber, "BT1");
  assert.equal(n.soc, 81);
  assert.equal(n.voltageV, 76.2);
  assert.equal(n.currentA, -0.56);
  assert.equal(n.online, true);
  assert.equal(n.sources.soc, "soc");
  assert.equal(n.sources.voltageV, "v");
  assert.deepEqual(n.unmapped, ["extra_field"]);
  assert.ok(n.updatedAt.startsWith("2026-11-17"));
});

test("normalize: a missing field is null, never a default", () => {
  const n = normalizeYunheBattery({ id: "BT1" });
  for (const field of ["soc", "voltageV", "tempC", "cycleCount", "lat", "lng", "online", "cellVoltages", "updatedAt"]) {
    assert.equal(n[field], null, `${field} must be null when the provider sent nothing`);
  }
  assert.equal(n.sources.soc, null);
});

test("normalize: junk values become null instead of NaN or zero", () => {
  const n = normalizeYunheBattery({ id: "BT1", soc: "abc", v: "", i: null, temp: undefined, last_time: "not a date" });
  assert.equal(n.soc, null);
  assert.equal(n.voltageV, null);
  assert.equal(n.currentA, null);
  assert.equal(n.tempC, null);
  assert.equal(n.updatedAt, null);
});

test("normalize: an out-of-range or 0,0 position is not a position", () => {
  assert.deepEqual([normalizeYunheBattery({ lat: 0, lng: 0 }).lat, normalizeYunheBattery({ lat: 0, lng: 0 }).lng], [null, null]);
  assert.equal(normalizeYunheBattery({ lat: 91, lng: 5 }).lat, null);
  assert.equal(normalizeYunheBattery({ lat: 7.3, lng: 181 }).lng, null);
  assert.equal(normalizeYunheBattery({ lat: 7.3 }).lng, null);
  assert.equal(normalizeYunheBattery({ latitude: 7.3, longitude: 5.1 }).lat, 7.3);
});

test("normalize: online accepts the common encodings and leaves anything else unknown", () => {
  assert.equal(toOnline(1), true);
  assert.equal(toOnline("Online"), true);
  assert.equal(toOnline(0), false);
  assert.equal(toOnline("Offline"), false);
  assert.equal(toOnline("maybe"), null);
  assert.equal(toOnline(null), null);
});

test("normalize: cell voltages must be a full numeric list", () => {
  assert.deepEqual(normalizeYunheBattery({ cell_voltages: [3.3, "3.31", 3.29] }).cellVoltages, [3.3, 3.31, 3.29]);
  assert.deepEqual(normalizeYunheBattery({ cells: "3.3,3.31" }).cellVoltages, [3.3, 3.31]);
  assert.equal(normalizeYunheBattery({ cell_voltages: [3.3, "x"] }).cellVoltages, null);
  assert.equal(normalizeYunheBattery({ cell_voltages: [] }).cellVoltages, null);
});

test("helpers: numbers and times", () => {
  assert.equal(toNumber("49.9"), 49.9);
  assert.equal(toNumber(""), null);
  assert.equal(toNumber("abc"), null);
  assert.equal(toIso(1763380000), new Date(1763380000 * 1000).toISOString());
  assert.equal(toIso("garbage"), null);
});

test("alerts: low and critical charge, offline, stale, imbalance, heat", () => {
  const codes = (n) => assessBattery(normalizeYunheBattery(n), ALERT_DEFAULTS, NOW).map((a) => a.code);
  assert.deepEqual(codes({ id: "B", soc: 15 }), ["low_soc"]);
  assert.deepEqual(codes({ id: "B", soc: 10 }), ["critical_soc"]);
  assert.deepEqual(codes({ id: "B", soc: 80 }), []);
  assert.deepEqual(codes({ id: "B", online: 0 }), ["offline"]);
  assert.deepEqual(codes({ id: "B", last_time: "2026-11-15T12:00:00Z" }), ["stale"]);
  assert.deepEqual(codes({ id: "B", cell_voltages: [3.3, 3.3, 3.4] }), ["cell_imbalance"]);
  assert.deepEqual(codes({ id: "B", cell_voltages: [3.3, 3.31, 3.32] }), []);
  assert.deepEqual(codes({ id: "B", temp: 60 }), ["high_temp"]);
});

test("alerts: a missing reading raises nothing and never reads as healthy or faulty", () => {
  assert.deepEqual(assessBattery(normalizeYunheBattery({ id: "B" }), ALERT_DEFAULTS, NOW), []);
  assert.deepEqual(assessBattery(null), []);
  assert.equal(worstLevel([]), "ok");
  assert.equal(worstLevel([{ level: "warning" }, { level: "critical" }]), "critical");
});

test("join: matches by battery number, then serial, and flags unregistered live batteries", () => {
  const registry = [
    { id: "r1", battery_number: "BT1", serial_number: "S1" },
    { id: "r2", battery_number: "BT2", serial_number: "S2" },
    { id: "r3", battery_number: "BT3", serial_number: null }
  ];
  const live = [{ id: "BT1", soc: 90 }, { sn: "S2", soc: 5 }, { id: "BT-UNKNOWN", soc: 50 }];
  const rows = joinBatteries(registry, live, ALERT_DEFAULTS, NOW);
  assert.equal(rows.length, 4);
  const by = (key) => rows.find((r) => r.key === key);
  assert.equal(by("r1").live.soc, 90);
  assert.equal(by("r2").live.soc, 5, "serial match");
  assert.equal(by("r3").live, null, "registered but no live reading");
  const unknown = rows.find((r) => !r.registered);
  assert.equal(unknown.live.batteryNumber, "BT-UNKNOWN");
});

test("join: worst batteries sort first, and an empty provider response leaves only registry rows", () => {
  const rows = joinBatteries([{ id: "r1", battery_number: "A" }, { id: "r2", battery_number: "B" }], [{ id: "A", soc: 90 }, { id: "B", soc: 3 }], ALERT_DEFAULTS, NOW);
  assert.deepEqual(rows.map((r) => r.registry.battery_number), ["B", "A"]);
  const none = joinBatteries([{ id: "r1", battery_number: "A" }], [], ALERT_DEFAULTS, NOW);
  assert.equal(none.length, 1);
  assert.equal(none[0].live, null);
  assert.deepEqual(joinBatteries([], [], ALERT_DEFAULTS, NOW), []);
});
