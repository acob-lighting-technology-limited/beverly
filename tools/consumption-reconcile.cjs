"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadEnvFile } = require("./env-loader.cjs");
const { runConsumptionSync } = require("../backend/src/services/consumption-sync-service");
const { dailyMeterArchiveRecord } = require("../backend/src/services/consumption-store");
const supabase = require("../backend/src/services/supabase-service");

function compareReadings(source, stored) {
  const key = (row) => JSON.stringify([row.station_id, row.meter_id, row.reading_date]);
  const expected = new Map(source.map(row => [key(row), row]));
  const actual = new Map(stored.map(row => [key(row), row]));
  let missing = 0, mismatched = 0;
  for (const [id, row] of expected) {
    if (!actual.has(id)) { missing += 1; continue; }
    const saved = actual.get(id);
    if (["total1", "remain1"].some(column => {
      if (row[column] == null || saved[column] == null) return row[column] !== saved[column];
      return Math.abs(Number(row[column]) - Number(saved[column])) > 0.000001;
    })) mismatched += 1;
  }
  return { sourceKeys: expected.size, storedKeys: actual.size, missing, mismatched,
    localOnly: [...actual.keys()].filter(id => !expected.has(id)).length,
    verification: "observed_only" };
}

async function main() {
  loadEnvFile();
  for (const [key, value] of Object.entries(require("../vercel.json").env)) {
    if (!(key in process.env)) process.env[key] = value;
  }
  process.env.SUPABASE_CONSUMPTION_STORE_ENABLED = "true";
  const arg = (key) => process.argv[process.argv.indexOf(key) + 1];
  const from = process.argv.includes("--from") ? arg("--from") : "";
  const to = process.argv.includes("--to") ? arg("--to") : "";
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!day.test(from) || !day.test(to) || from > to) throw new Error("Supply valid --from and --to dates");
  const stations = process.argv.includes("--stations") ? arg("--stations").split(",")
    : ["TUNGA", "UMAISHA", "OGUFA", "KYAKALE", "MUSHA", "OFEMILI"];
  const apply = process.argv.includes("--apply");
  const report = { at: new Date().toISOString(), from, to, apply, stations: [] };
  for (const station of stations.map(s => s.trim().toUpperCase()).filter(Boolean)) {
    const runs = [];
    if (apply) {
      for (let batch = 0; batch < 40; batch++) {
        const result = await runConsumptionSync({ stations: [station], mode: "backfill", from, to,
          maxPages: 20, stationAttempts: 1, retries: 2, timeoutMs: 15000 });
        if (result.quotaPaused || result.failedStations) throw new Error(`${station}: recovery paused or failed`);
        runs.push({ storedRows: result.storedRows, complete: result.ok });
        if (result.ok) break;
        if (batch === 39) throw new Error(`${station}: continuation budget exhausted`);
      }
    }
    const source = [], stored = [];
    const base = String(process.env.LIVE_API_BASE_URL || process.env.UPSTREAM_API_URL).replace(/\/+$/, "");
    let exhausted = false;
    for (let pageNumber = 1; pageNumber <= 1000; pageNumber++) {
      const response = await fetch(`${base}/api/DailyDataMeter/read`, {
        method: "POST", signal: AbortSignal.timeout(20000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LIVE_API_BEARER_TOKEN || process.env.UPSTREAM_BEARER_TOKEN}` },
        body: JSON.stringify({ lang: "en", stationId: station, currentDateRange: [from, to],
          orderBy: "currentDate desc, meterId asc", pageNumber, pageSize: 500 }),
      });
      const payload = await response.json();
      if (!response.ok || ![0, 200].includes(Number(payload.code)) || !Array.isArray(payload.result?.data)) throw new Error("Source reconciliation failed");
      const rows = payload.result.data;
      for (const row of rows) {
        const record = dailyMeterArchiveRecord(row, station);
        if (record && record.station_id === station && record.reading_date >= from && record.reading_date <= to) source.push(record);
      }
      if (rows.length < 500) { exhausted = true; break; }
    }
    if (!exhausted) throw new Error("Source verification budget exhausted");
    for (let offset = 0; ; offset += 1000) {
      const rows = await supabase.restRequest(`/daily_meter_readings?select=station_id,meter_id,reading_date,total1,remain1&station_id=eq.${encodeURIComponent(station)}&reading_date=gte.${from}&reading_date=lte.${to}&order=reading_date.asc,meter_id.asc&limit=1000&offset=${offset}`);
      if (!Array.isArray(rows)) throw new Error("Invalid stored readings response");
      stored.push(...rows);
      if (rows.length < 1000) break;
    }
    const compared = compareReadings(source, stored);
    report.stations.push({ station, ...compared, runs });
    console.log(JSON.stringify({ station, ...compared }));
  }
  const output = path.resolve("tmp", "meter-recovery", `reconciliation-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  if (report.stations.some(s => s.missing || s.mismatched)) process.exitCode = 2;
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { compareReadings };
