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
  tokenFingerprint: crmTokenFingerprint(token),
};
const sessionSigned = signCrmSession(session);

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
        } catch (_) {}
        resolve({ status: statusCode, headers: responseHeaders, body: parsed });
      },
    };

    try {
      handler(req, res).catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function runGridControlTests() {
  console.log("=== Testing Universal Remote Relay & Capacity Load Limiter API ===");

  // 1. Test Grid Control List
  console.log("\n1. Testing /api/oem/grid-control/list...");
  const listRes = await callApi("/api/oem/grid-control/list?pageNumber=1&pageSize=20");
  assert.equal(listRes.status, 200, `Expected 200, got ${listRes.status}`);
  assert.equal(listRes.body?.ok, true, "Body ok should be true");
  const totalMeters = listRes.body?.result?.total ?? listRes.body?.data?.total;
  assert.equal(totalMeters, 3074, `Expected 3,074 SparkMeter meters, got ${totalMeters}`);
  const items = listRes.body?.result?.data ?? listRes.body?.data?.data;
  assert.equal(items.length, 20, `Expected page of 20 items, got ${items.length}`);

  const sampleMeter = items[0];
  assert.ok(sampleMeter.meterId, "meterId should be present");
  assert.ok(sampleMeter.customerName, "customerName should be present");
  assert.ok(sampleMeter.stationId, "stationId should be present");
  assert.ok(["Connected", "Disconnected", "Fault"].includes(sampleMeter.relayState), `Invalid relayState: ${sampleMeter.relayState}`);
  assert.ok(sampleMeter.powerLimit, "powerLimit should be present");
  assert.ok(sampleMeter.lastRelayEvent, "lastRelayEvent should be present");
  console.log(`✓ Grid control list returned ${totalMeters} meters with valid status attributes`);

  // Test Summary counts
  const summary = listRes.body?.result?.summary ?? listRes.body?.data?.summary;
  assert.ok(summary, "summary must be present");
  assert.equal(summary.total, 3074, "summary total must be 3,074");
  assert.equal(summary.connected + summary.disconnected + summary.fault, 3074, "summary sum must equal 3,074");
  console.log(`✓ Grid summary: Total=${summary.total}, Connected=${summary.connected}, Disconnected=${summary.disconnected}, Fault=${summary.fault}`);

  // Test station filtering
  const adebayoRes = await callApi("/api/oem/grid-control/list?stationId=ADEBAYO&pageSize=50");
  const adebayoTotal = adebayoRes.body?.result?.total;
  assert.equal(adebayoTotal, 307, `Expected Adebayo station to have 307 meters, got ${adebayoTotal}`);
  console.log(`✓ Station filtering correctly returned 307 meters for Adebayo`);

  // 2. Test Relay Switch Validations
  console.log("\n2. Testing /api/oem/grid-control/relay-switch validations...");
  const missingMeterRes = await callApi("/api/oem/grid-control/relay-switch", "POST", { targetState: "off", reason: "Safety hazard", operatorId: "admin" });
  assert.equal(missingMeterRes.status, 400, "Missing meterId should return 400");

  const invalidStateRes = await callApi("/api/oem/grid-control/relay-switch", "POST", { meterId: sampleMeter.meterId, targetState: "maybe", reason: "Safety hazard", operatorId: "admin" });
  assert.equal(invalidStateRes.status, 400, "Invalid targetState should return 400");

  const missingReasonRes = await callApi("/api/oem/grid-control/relay-switch", "POST", { meterId: sampleMeter.meterId, targetState: "off", reason: "", operatorId: "admin" });
  assert.equal(missingReasonRes.status, 400, "Missing reason should return 400");

  const notFoundRes = await callApi("/api/oem/grid-control/relay-switch", "POST", { meterId: "NON-EXISTENT-9999", targetState: "off", reason: "Safety hazard", operatorId: "admin" });
  assert.equal(notFoundRes.status, 404, "Non-existent meter should return 404");
  console.log("✓ Relay switch validations passed (meter, state, reason, 404)");

  // 3. Test Remote Disconnect Execution
  console.log("\n3. Testing remote disconnect execution...");
  const targetMeterId = sampleMeter.meterId;
  const disconnectRes = await callApi("/api/oem/grid-control/relay-switch", "POST", {
    meterId: targetMeterId,
    targetState: "off",
    reason: "Emergency isolation",
    operatorId: "admin",
    authorizerId: "SUPERVISOR-OPS-402",
    notes: "Feeder phase unbalance isolation"
  });
  assert.equal(disconnectRes.status, 200, `Expected 200, got ${disconnectRes.status}`);
  assert.equal(disconnectRes.body?.ok, true, "Body ok should be true");
  assert.equal(disconnectRes.body?.state, "off", "state should be off");
  assert.equal(disconnectRes.body?.relayState, "Disconnected", "relayState should be Disconnected");
  assert.ok(disconnectRes.body?.commandId, "commandId should be generated");
  assert.ok(disconnectRes.body?.executedAt, "executedAt timestamp should be returned");
  console.log(`✓ Disconnected meter ${targetMeterId} with command lease ${disconnectRes.body.commandId}`);

  // Verify list immediately reflects Disconnected state
  const verifyListRes = await callApi(`/api/oem/grid-control/list?searchTerm=${encodeURIComponent(targetMeterId)}`);
  const updatedMeter = verifyListRes.body?.result?.data?.[0];
  assert.ok(updatedMeter, "Meter should be found in list");
  assert.equal(updatedMeter.relayState, "Disconnected", "Relay state in list should be Disconnected");
  assert.equal(updatedMeter.lastReason, "Emergency isolation", "Reason should be stored");
  assert.equal(updatedMeter.lastAuthorizerId, "SUPERVISOR-OPS-402", "Authorizer should be stored");
  console.log("✓ Meter list query immediately verified updated Disconnected relay status");

  // 4. Test Remote Reconnect Execution
  console.log("\n4. Testing remote connect (re-energization)...");
  const connectRes = await callApi("/api/oem/grid-control/relay-switch", "POST", {
    meterId: targetMeterId,
    targetState: "on",
    reason: "Customer requested maintenance",
    operatorId: "admin",
    authorizerId: "SUPERVISOR-OPS-402"
  });
  assert.equal(connectRes.status, 200, `Expected 200, got ${connectRes.status}`);
  assert.equal(connectRes.body?.state, "on", "state should be on");
  assert.equal(connectRes.body?.relayState, "Connected", "relayState should be Connected");
  console.log(`✓ Re-energized meter ${targetMeterId} successfully`);

  // 5. Test Power Limit / Capacity Load Limiting
  console.log("\n5. Testing /api/oem/grid-control/power-limit...");
  const limitMissingAmps = await callApi("/api/oem/grid-control/power-limit", "POST", {
    meterId: targetMeterId,
    reason: "Grid peak shaving",
    operatorId: "admin"
  });
  assert.equal(limitMissingAmps.status, 400, "Missing powerLimitAmps should return 400");

  const limitSetRes = await callApi("/api/oem/grid-control/power-limit", "POST", {
    meterId: targetMeterId,
    powerLimitAmps: "1A (Lifeline 220W)",
    reason: "Grid peak shaving",
    operatorId: "admin",
    authorizerId: "SUPERVISOR-OPS-402"
  });
  assert.equal(limitSetRes.status, 200, `Expected 200, got ${limitSetRes.status}`);
  assert.equal(limitSetRes.body?.ok, true);
  assert.equal(limitSetRes.body?.powerLimitAmps, "1A (Lifeline 220W)");
  assert.ok(limitSetRes.body?.executedAt);

  // Verify list immediately reflects new Power Limit
  const verifyLimitList = await callApi(`/api/oem/grid-control/list?searchTerm=${encodeURIComponent(targetMeterId)}`);
  const limitedMeter = verifyLimitList.body?.result?.data?.[0];
  assert.equal(limitedMeter.powerLimit, "1A (Lifeline 220W)", "Power limit should reflect 1A Lifeline");
  console.log(`✓ Power limit successfully throttled to '1A (Lifeline 220W)' and verified in list`);

  // Restore to Unlimited
  const resetLimitRes = await callApi("/api/oem/grid-control/power-limit", "POST", {
    meterId: targetMeterId,
    powerLimitAmps: "Unlimited",
    reason: "Normal operations restored",
    operatorId: "admin"
  });
  assert.equal(resetLimitRes.status, 200);
  assert.equal(resetLimitRes.body?.powerLimitAmps, "Unlimited (60A)");
  console.log("✓ Power limit successfully reset to Unlimited");

  console.log("\n=======================================================");
  console.log("🎉 ALL GRID CONTROL REMOTE RELAY API TESTS PASSED! 🎉");
  console.log("=======================================================\n");
}

runGridControlTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
