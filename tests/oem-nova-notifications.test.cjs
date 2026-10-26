"use strict";

process.env.FORCE_LOAD_ENV = "true";
require("../tools/env-loader.cjs").loadEnvFile();
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

process.env.NODE_ENV = "test";
process.env.DEMO_AUTH_ENABLED = "true";

const handler = require("../api/reference.js");
const { getSparkMeterNovaAlerts } = require("../backend/src/services/mesh-gateway-service");
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
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({ status: statusCode, headers: responseHeaders, body: parsed });
      },
    };

    handler(req, res).catch(reject);
  });
}

async function runTests() {
  console.log("=== Testing SparkMeter NOVA Notification System ===");

  // 1. Unit check: getSparkMeterNovaAlerts returns structured alerts
  const novaData = getSparkMeterNovaAlerts();
  assert(Array.isArray(novaData.alerts), "NOVA alerts must be an array");
  assert(novaData.alerts.length >= 2, "Expected at least 2 NOVA alerts (degraded base station + orphaned node)");
  assert.equal(novaData.systemName, "SparkMeter NOVA");
  assert.equal(novaData.oem, "sparkmeter");

  const hasDegraded = novaData.alerts.some(a => a.kind === "degraded");
  const hasDownOrphan = novaData.alerts.some(a => a.kind === "down");
  const hasRecovered = novaData.alerts.some(a => a.kind === "recovered");
  assert(hasDegraded, "Expected at least 1 degraded NOVA base station alert");
  assert(hasDownOrphan, "Expected at least 1 critical orphaned mesh meter alert");
  assert(hasRecovered, "Expected at least 1 recovered NOVA component");
  console.log("✓ getSparkMeterNovaAlerts unit test passed");

  // 2. HTTP GET /api/notifications/gateway-health with SparkMeter OEM header
  const sparkRes = await callApi("/api/notifications/gateway-health", "GET", null, {
    "x-oem-id": "sparkmeter"
  });
  assert.equal(sparkRes.status, 200, "Expected status 200 for SparkMeter NOVA notifications");
  const sparkBody = sparkRes.body;
  assert.equal(sparkBody.meta?.oem, "sparkmeter");
  assert.equal(sparkBody.meta?.systemName, "SparkMeter NOVA");
  assert(Array.isArray(sparkBody.data?.data), "Alerts array present in data.data");
  assert(sparkBody.data.data.some(a => a.system === "NOVA"), "Expected NOVA system tags on alerts");
  console.log("✓ HTTP /api/notifications/gateway-health correctly routes to SparkMeter NOVA status when X-Oem-Id is sparkmeter");

  // 3. HTTP POST /api/notifications/gateway-health/diagnose for SparkMeter Base Station
  const diagRes = await callApi("/api/notifications/gateway-health/diagnose", "POST", {
    gatewayId: "GW-SUL-BS01"
  }, {
    "x-oem-id": "sparkmeter"
  });
  assert.equal(diagRes.status, 200, "Expected status 200 for SparkMeter Base Station ping");
  const diagBody = diagRes.body;
  assert.equal(diagBody.ok, true);
  assert.equal(diagBody.result?.status, "NOVA Uplink Online");
  assert(typeof diagBody.result?.pingLatencyMs === "number", "Expected numeric ping latency");
  console.log("✓ HTTP /api/notifications/gateway-health/diagnose successfully pings NOVA Base Station GW-SUL-BS01");

  console.log("\n=======================================================");
  console.log("🎉 ALL SPARKMETER NOVA NOTIFICATION TESTS PASSED! 🎉");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
