process.env.FORCE_LOAD_ENV = "true";
require("../tools/env-loader.cjs").loadEnvFile();
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

process.env.NODE_ENV = "test";
process.env.DEMO_AUTH_ENABLED = "true";

const handler = require("../api/reference.js");
const { signCrmSession, crmTokenFingerprint } = handler._test || {};

const token = "local-dev-token";
const now = Date.now();
const session = {
  startedAt: now,
  lastActiveAt: now,
  tokenFingerprint: crmTokenFingerprint ? crmTokenFingerprint(token) : "test",
};
const sessionSigned = signCrmSession ? signCrmSession(session) : "test";

async function callApi(url, method = "GET", body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    let responseHeaders = {};
    const chunks = [];
    if (body !== null && body !== undefined) {
      chunks.push(Buffer.from(typeof body === "string" ? body : JSON.stringify(body)));
    }
    const req = Readable.from(chunks);
    req.url = url;
    req.method = method;
    req.headers = {
      authorization: `Bearer ${token}`,
      cookie: `bev_token=${token}; bev_session=${sessionSigned}`,
      "x-oem-id": "sparkmeter",
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    };

    const res = {
      statusCode: 200,
      status(code) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      setHeader(name, val) {
        responseHeaders[name] = val;
      },
      json(data) {
        resolve({ status: statusCode, headers: responseHeaders, body: data });
      },
      send(data) {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({ status: statusCode, headers: responseHeaders, body: parsed });
      },
      end(data) {
        if (data) this.send(data);
        else resolve({ status: statusCode, headers: responseHeaders, body: null });
      },
    };

    try {
      handler(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

async function runTests() {
  console.log("Running Smart Grid Telemetry & Power Quality TDD tests...");

  // Test 1: Power Quality
  const resPq = await callApi("/api/oem/telemetry/power-quality?station=ALL");
  assert.equal(resPq.status, 200, "Expected status 200 for power-quality");
  const pqBody = resPq.body;
  assert.ok(pqBody && pqBody.code === 200, "Expected code 200 in response");
  const pqData = pqBody.data;
  assert.ok(pqData.kpis, "kpis object must be returned");
  assert.ok(typeof pqData.kpis.meanGridVoltage === "number", "meanGridVoltage must be number");
  assert.ok(pqData.kpis.meanGridVoltage >= 200 && pqData.kpis.meanGridVoltage <= 250, "voltage in nominal range");
  assert.ok(typeof pqData.kpis.frequency === "number", "frequency must be number");
  assert.ok(pqData.kpis.frequency >= 49.5 && pqData.kpis.frequency <= 50.5, "frequency centered at 50Hz");
  assert.ok(typeof pqData.kpis.avgPowerFactor === "number", "avgPowerFactor must be number");
  assert.ok(Array.isArray(pqData.feeders), "feeders must be array");
  assert.ok(Array.isArray(pqData.timeSeries), "timeSeries must be array");
  console.log("✓ /api/oem/telemetry/power-quality passed contract validation");

  // Test 2: Demand Curves
  const resDc = await callApi("/api/oem/telemetry/load-curves?station=ADEBAYO&range=24h");
  assert.equal(resDc.status, 200, "Expected status 200 for load-curves");
  const dcBody = resDc.body;
  assert.ok(dcBody && dcBody.code === 200, "Expected code 200 in load-curves");
  const dcData = dcBody.data;
  assert.ok(dcData.kpis, "kpis object must be returned in load-curves");
  assert.ok(typeof dcData.kpis.peakDemandKw === "number", "peakDemandKw must be number");
  assert.ok(typeof dcData.kpis.baseloadKw === "number", "baseloadKw must be number");
  assert.ok(typeof dcData.kpis.baseloadDemandKw === "number", "baseloadDemandKw alias must be number");
  assert.equal(dcData.kpis.baseloadDemandKw, dcData.kpis.baseloadKw, "baseloadDemandKw must equal baseloadKw");
  assert.ok(typeof dcData.kpis.avgDemandKw === "number", "avgDemandKw must be number");
  assert.ok(typeof dcData.kpis.meanDemandKw === "number", "meanDemandKw alias must be number");
  assert.equal(dcData.kpis.meanDemandKw, dcData.kpis.avgDemandKw, "meanDemandKw must equal avgDemandKw");
  assert.ok(typeof dcData.kpis.totalEnergyKwh === "number" && dcData.kpis.totalEnergyKwh > 0, "totalEnergyKwh must be positive number");
  assert.ok(typeof dcData.kpis.loadFactor === "number" && dcData.kpis.loadFactor > 0 && dcData.kpis.loadFactor <= 100, "loadFactor must be between 0 and 100");
  
  // Verify baseToPeakRatio formula eliminates NaN%
  const calculatedBaseToPeak = Math.round((dcData.kpis.baseloadDemandKw / dcData.kpis.peakDemandKw) * 100);
  assert.ok(!isNaN(calculatedBaseToPeak), "base-to-peak ratio must not be NaN");
  assert.ok(calculatedBaseToPeak > 0 && calculatedBaseToPeak < 100, "base-to-peak ratio in valid percentage range");

  assert.ok(Array.isArray(dcData.points), "points must be array");
  assert.equal(dcData.points.length, 96, "points must contain exactly 96 15-minute intervals for 24h");
  assert.ok(dcData.points[0].timestamp, "first point must have timestamp for CSV/Excel export");
  assert.ok(!isNaN(Date.parse(dcData.points[0].timestamp)), "timestamp must be valid date");
  assert.ok(typeof dcData.points[0].peakDemandKw === "number", "points must include peakDemandKw reference");
  assert.ok(Array.isArray(dcData.stationComparison), "stationComparison must be array");
  assert.ok(dcData.stationComparison.length >= 8, "stationComparison must contain all mini-grid sites");
  console.log("✓ /api/oem/telemetry/load-curves passed contract validation (all KPIs, dual aliases & intervals verified)");

  console.log("\n=======================================================");
  console.log("🎉 ALL SMART GRID TELEMETRY TDD TESTS PASSED! 🎉");
  console.log("=======================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
