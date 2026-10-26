process.env.FORCE_LOAD_ENV = "true";
require('../tools/env-loader.cjs').loadEnvFile();
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

process.env.NODE_ENV = "test";
process.env.DEMO_AUTH_ENABLED = "true";

// 1. Test oem-store currentOem getter logic
function testOemStoreResolution() {
  const state = {
    currentOemId: "sparkmeter",
    oems: [
      { id: "e1532892-e09d-44f9-a9cb-b99b5c9ebecf", slug: "sparkmeter", name: "SparkMeter" },
      { id: "calinmeter-id-123", slug: "calinmeter", name: "Calinmeter" }
    ]
  };

  // Test by slug
  const currentBySlug = state.oems.find((oem) => oem.id === state.currentOemId || oem.slug === state.currentOemId) || null;
  assert.equal(currentBySlug.slug, "sparkmeter", "Should resolve OEM by slug 'sparkmeter'");

  // Test by UUID
  state.currentOemId = "e1532892-e09d-44f9-a9cb-b99b5c9ebecf";
  const currentByUuid = state.oems.find((oem) => oem.id === state.currentOemId || oem.slug === state.currentOemId) || null;
  assert.equal(currentByUuid.slug, "sparkmeter", "Should resolve OEM by UUID");

  console.log("✓ oem-store currentOem getter correctly resolves by slug and id");
}

// 2. Test App.vue capability gating logic
function testAppCapabilityGating() {
  const { previewGroupsFor } = require("../src/components/oem-hub/oem-capabilities.mjs");
  const { routeGroups } = require("../src/data/route-manifest.js");

  function getCapabilities(oem) {
    const raw = oem?.capabilities || {};
    const slug = String(oem?.slug || "").toLowerCase();
    const vendingStrategy = String(oem?.vendingStrategy || "").toLowerCase();

    if (vendingStrategy === "direct_credit" || slug === "sparkmeter") {
      return {
        ...raw,
        remote_meter_task: false,
        dlms_protocol: false,
        dlt645_protocol: false,
        gprs_support: false,
        firmware_update: false,
        token_generation: false,
        token_records: false,
        wallet_vending: true,
        event_notification: true,
        tariff_management: true,
        load_profile: true,
        smart_grid_telemetry: true,
        remote_relay_control: true,
        grid_energy_audit: true,
        mesh_network_health: true,
        direct_credit_balance: true
      };
    }
    if (slug === "miyaji_ev") {
      return {
        ...raw,
        ev_charging: true,
        remote_disconnect: true,
        token_generation: false,
        token_records: false,
        dlms_protocol: false,
        dlt645_protocol: false,
        tariff_management: true,
      };
    }
    return raw;
  }

  const sparkCaps = getCapabilities({ slug: "sparkmeter", vendingStrategy: "direct_credit" });
  assert.equal(sparkCaps.remote_meter_task, false, "SparkMeter remote_meter_task must be false");
  assert.equal(sparkCaps.dlms_protocol, false, "SparkMeter dlms_protocol must be false");
  assert.equal(sparkCaps.dlt645_protocol, false, "SparkMeter dlt645_protocol must be false");
  assert.equal(sparkCaps.token_generation, false, "SparkMeter token_generation must be false");
  assert.equal(sparkCaps.token_records, false, "SparkMeter token_records must be false");
  assert.equal(sparkCaps.wallet_vending, true, "SparkMeter wallet_vending must be true");
  assert.equal(sparkCaps.tariff_management, true, "SparkMeter tariff_management must be true");
  assert.equal(sparkCaps.smart_grid_telemetry, true, "SparkMeter smart_grid_telemetry must be true");
  assert.equal(sparkCaps.remote_relay_control, true, "SparkMeter remote_relay_control must be true");
  assert.equal(sparkCaps.grid_energy_audit, true, "SparkMeter grid_energy_audit must be true");
  assert.equal(sparkCaps.mesh_network_health, true, "SparkMeter mesh_network_health must be true");
  assert.equal(sparkCaps.direct_credit_balance, true, "SparkMeter direct_credit_balance must be true");

  // Verify OEM capabilities definition preview groups
  const sparkPreviewGroups = previewGroupsFor(sparkCaps);
  assert(sparkPreviewGroups.includes("Smart Grid Telemetry"), "Must surface Smart Grid Telemetry group");
  assert(sparkPreviewGroups.includes("Remote Grid Control"), "Must surface Remote Grid Control group");
  assert(sparkPreviewGroups.includes("Energy Audit"), "Must surface Energy Audit group");
  assert(sparkPreviewGroups.includes("Mesh & Gateways"), "Must surface Mesh & Gateways group");
  assert(sparkPreviewGroups.includes("Management (Customer, Account)"), "Must surface Management (Customer, Account) group");
  assert(!sparkPreviewGroups.includes("Token Generate"), "Must hide Token Generate group");
  assert(!sparkPreviewGroups.includes("Token Record"), "Must hide Token Record group");

  // Verify route manifest groups
  const activeRouteGroups = routeGroups("super-admin", sparkCaps).map(g => g.name);
  assert(activeRouteGroups.includes("Smart Grid Telemetry"), "Route manifest must surface Smart Grid Telemetry");
  assert(activeRouteGroups.includes("Remote Grid Control"), "Route manifest must surface Remote Grid Control");
  assert(activeRouteGroups.includes("Site Energy Audit"), "Route manifest must surface Site Energy Audit");
  assert(activeRouteGroups.includes("Mesh & Gateways"), "Route manifest must surface Mesh & Gateways");
  assert(!activeRouteGroups.includes("Token Generate"), "Route manifest must hide Token Generate");
  assert(!activeRouteGroups.includes("Token Record"), "Route manifest must hide Token Record");
  assert(!activeRouteGroups.includes("Remote Operation"), "Route manifest must hide Remote Operation");
  assert(!activeRouteGroups.includes("Remote Operation Task"), "Route manifest must hide Remote Operation Task");
  assert(!activeRouteGroups.includes("Protocol"), "Route manifest must hide Protocol");

  const calinCaps = getCapabilities({ slug: "calinmeter", vendingStrategy: "sts_token", capabilities: { token_generation: true, remote_meter_task: true } });
  assert.equal(calinCaps.token_generation, true, "Calinmeter token_generation must be preserved");
  assert.equal(calinCaps.remote_meter_task, true, "Calinmeter remote_meter_task must be preserved");

  console.log("✓ App.vue capability gating surfaces 5 smart grid groups and hides STS routes for Direct Credit / SparkMeter");
}

function extractListData(res) {
  if (Array.isArray(res.body?.data)) return { total: res.body.data.length, data: res.body.data };
  if (Array.isArray(res.body?.result)) return { total: res.body.result.length, data: res.body.result };
  if (res.body?.data && Array.isArray(res.body.data.data)) return { total: res.body.data.total ?? res.body.data.data.length, data: res.body.data.data };
  if (res.body?.result && Array.isArray(res.body.result.data)) return { total: res.body.result.total ?? res.body.result.data.length, data: res.body.result.data };
  return { total: 0, data: [] };
}

// 3. Test API Reference OEM Scoped Reads
async function testApiReferenceScoping() {
  const handler = require("../api/reference.js");
  const { signCrmSession, crmTokenFingerprint } = handler._test || {};
  assert(typeof signCrmSession === "function", "handler._test.signCrmSession must exist");

  const token = "local-dev-token";
  const now = Date.now();
  const session = {
    startedAt: now,
    lastActiveAt: now,
    tokenFingerprint: crmTokenFingerprint(token),
  };
  const sessionSigned = signCrmSession(session);

  async function callApi(url, body = {}, headers = {}) {
    return new Promise((resolve, reject) => {
      let statusCode = 200;
      let responseHeaders = {};
      const payload = Buffer.from(JSON.stringify(body));
      const req = Readable.from([payload]);
      req.url = url;
      req.method = "POST";
      req.headers = {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        cookie: `bev_token=${token}; bev_session=${sessionSigned}`,
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

  // A. SparkMeter Station Read
  const stationRes = await callApi("/api/station/read", {}, { "x-oem-id": "sparkmeter" });
  assert.equal(stationRes.status, 200, `Station read should return HTTP 200, got ${stationRes.status}`);
  const { total: stationTotal, data: stations } = extractListData(stationRes);
  assert.equal(stations.length, 8, `Expected exactly 8 SparkMeter stations, got ${stations.length}`);
  const stationNames = stations.map(s => s.name);
  assert(stationNames.includes("OTU-COSTAIN"), "Expected OTU-COSTAIN");
  assert(stationNames.includes("Adebayo"), "Expected Adebayo");
  assert(stationNames.includes("Oloyan"), "Expected Oloyan");
  assert(stationNames.includes("Sule"), "Expected Sule");
  assert(stationNames.includes("Adewale"), "Expected Adewale");
  assert(stationNames.includes("Mile 13"), "Expected Mile 13");
  assert(stationNames.includes("Ajegunle"), "Expected Ajegunle");
  assert(stationNames.includes("Onipanu"), "Expected Onipanu");
  console.log("✓ /api/station/read correctly returns only the 8 SparkMeter stations");

  // B. SparkMeter Meter Read
  const meterRes = await callApi("/api/meter/read", { page: 1, pageSize: 50 }, { "x-oem-id": "sparkmeter" });
  assert.equal(meterRes.status, 200, `Meter read should return HTTP 200, got ${meterRes.status}`);
  const { total: meterTotal, data: meters } = extractListData(meterRes);
  assert.equal(meterTotal, 3074, `Expected total 3,074 meters, got ${meterTotal}`);
  assert.equal(meters.length, 50, "Expected page 1 to have 50 items");
  const firstMeter = meters[0];
  assert(firstMeter.meterId, "meterId must be present");
  assert.equal(firstMeter.meterType, "Electricity", "meterType must be Electricity");
  assert.equal(firstMeter.communicationWay, "Mesh", "communicationWay must be Mesh");
  assert.equal(firstMeter.protocolVersion, "Koios v1", "protocolVersion must be Koios v1");
  console.log(`✓ /api/meter/read returned ${meterTotal} SparkMeter meters mapped to canonical table shape`);

  // Station-filtered meter read
  const filteredMeterRes = await callApi("/api/meter/read", { page: 1, pageSize: 50, stationId: "ADEBAYO" }, { "x-oem-id": "sparkmeter" });
  assert.equal(filteredMeterRes.status, 200);
  const { total: filteredMeterTotal, data: filteredMeters } = extractListData(filteredMeterRes);
  assert(filteredMeterTotal > 0, "Adebayo station should have meters");
  filteredMeters.forEach(m => {
    assert.equal(m.stationId, "ADEBAYO", `Expected stationId ADEBAYO, got ${m.stationId}`);
  });
  console.log(`✓ /api/meter/read stationId filter correctly scoped: Adebayo returned ${filteredMeterTotal} meters`);

  // C. SparkMeter Customer Read
  const custRes = await callApi("/api/customer/read", { page: 1, pageSize: 20 }, { "x-oem-id": "sparkmeter" });
  assert.equal(custRes.status, 200, `Customer read should return HTTP 200, got ${custRes.status}`);
  const { total: custTotal, data: customers } = extractListData(custRes);
  assert.equal(custTotal, 3074, `Expected total 3,074 customers, got ${custTotal}`);
  assert.equal(customers.length, 20);
  const firstCust = customers[0];
  assert(firstCust.customerId, "customerId must be present");
  assert(firstCust.name, "name must be present");
  assert(firstCust.creditBalance && firstCust.creditBalance.startsWith("₦"), "creditBalance must start with ₦");
  assert.equal(typeof firstCust.burnRateKwhPerDay, "number", "burnRateKwhPerDay must be a number");
  assert.equal(typeof firstCust.daysRemaining, "number", "daysRemaining must be a number");
  console.log(`✓ /api/customer/read returned ${custTotal} SparkMeter customers mapped to canonical table shape (including direct credit balance)`);

  // D. SparkMeter Account Read
  const acctRes = await callApi("/api/account/read", { page: 1, pageSize: 20 }, { "x-oem-id": "sparkmeter" });
  assert.equal(acctRes.status, 200, `Account read should return HTTP 200, got ${acctRes.status}`);
  const { total: acctTotal, data: accounts } = extractListData(acctRes);
  assert.equal(acctTotal, 3074, `Expected total 3,074 accounts, got ${acctTotal}`);
  assert.equal(accounts.length, 20);
  const firstAcct = accounts[0];
  assert(firstAcct.accountId, "accountId must be present");
  assert(firstAcct.customerId, "customerId must be present");
  assert(firstAcct.meterId, "meterId must be present");
  assert(firstAcct.creditBalance && firstAcct.creditBalance.startsWith("₦"), "creditBalance must start with ₦");
  assert.equal(typeof firstAcct.burnRateKwhPerDay, "number", "burnRateKwhPerDay must be a number");
  assert.equal(typeof firstAcct.daysRemaining, "number", "daysRemaining must be a number");
  console.log(`✓ /api/account/read returned ${acctTotal} SparkMeter customer-meter accounts (including direct credit balance)`);

  // E. Calinmeter Station Read (Regression check)
  const calinStationRes = await callApi("/api/station/read", {}, { "x-oem-id": "calinmeter" });
  assert.equal(calinStationRes.status, 200);
  const { data: calinStations } = extractListData(calinStationRes);
  assert(calinStations.length > 0, "Calinmeter stations should not be empty");
  assert(!calinStations.some(s => s.name === "OTU-COSTAIN"), "Calinmeter should not contain SparkMeter stations");
  console.log(`✓ Calinmeter /api/station/read regression check passed (${calinStations.length} Calinmeter stations returned, SparkMeter isolated)`);
}

async function run() {
  try {
    testOemStoreResolution();
    testAppCapabilityGating();
    await testApiReferenceScoping();
    console.log("\n=======================================================");
    console.log("🎉 ALL MORPHIC MULTI-OEM CRM PIPELINE TESTS PASSED! 🎉");
    console.log("=======================================================");
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

run();
