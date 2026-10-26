"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");

process.env.SUPABASE_AUTH_ENABLED = "false";

const root = path.resolve(__dirname, "..");
const handler = require("../api/reference.js");
const { SPARKMETER_SITES, classifyLossRate } = require("../backend/src/services/energy-audit-service.js");
const { BASE_STATIONS, ORPHANED_METERS } = require("../backend/src/services/mesh-gateway-service.js");

function mockRequest({ url, method = "GET", headers = {}, body = {} }) {
  const payload = Buffer.from(JSON.stringify(body));
  const req = Readable.from([payload]);
  req.url = url;
  req.method = method;
  req.headers = {
    "content-type": "application/json",
    ...headers
  };
  return req;
}

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this.headers[key.toLowerCase()] = val;
      return this;
    },
    send(content) {
      this.body = typeof content === "string" ? JSON.parse(content) : content;
      return this;
    },
    json(content) {
      this.body = content;
      return this;
    },
    end(content) {
      if (content && !this.body) {
        try {
          this.body = JSON.parse(content);
        } catch {
          this.body = content;
        }
      }
      return this;
    }
  };
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}:`, err);
    process.exitCode = 1;
    throw err;
  }
}

async function main() {
  console.log("Starting Energy Audit & Mesh Gateway Architecture Verification...");

  // 1. Verify component files exist
  await runTest("EnergyAuditPage.vue exists and contains required Beverly tokens & ECharts", () => {
    const filePath = path.join(root, "src/components/analytics/EnergyAuditPage.vue");
    assert.ok(fs.existsSync(filePath), "EnergyAuditPage.vue must exist in src/components/analytics/");
    const content = fs.readFileSync(filePath, "utf8");
    assert.ok(content.includes("loadECharts"), "Must import loadECharts for dynamic rendering");
    assert.ok(content.includes("Totalizer Dispatch Energy"), "Must display Totalizer Dispatch Energy");
    assert.ok(content.includes("Billed / Customer Consumed"), "Must display Customer Consumed Energy");
    assert.ok(content.includes("Real-Time Line Loss Rate"), "Must display Real-Time Line Loss Rate");
    assert.ok(content.includes("Optimal Technical Loss"), "Must display Optimal Technical Loss badge");
    assert.ok(content.includes("Elevated Loss / Line Warning"), "Must display Elevated Loss / Line Warning badge");
    assert.ok(content.includes("Commercial Theft Alert / Illegal Bypass"), "Must display Commercial Theft Alert badge");
    assert.ok(content.includes("Feeder Audit & Loss Register"), "Must contain Feeder Audit Table");
    assert.ok(content.includes("badge-pulse") || content.includes("rating-badge--pulse"), "Must include pulsing animation badge for theft alerts");
  });

  await runTest("GatewayHealthPage.vue exists and contains Sub-GHz radio mesh & Base Station monitor", () => {
    const filePath = path.join(root, "src/components/mesh/GatewayHealthPage.vue");
    assert.ok(fs.existsSync(filePath), "GatewayHealthPage.vue must exist in src/components/mesh/");
    const content = fs.readFileSync(filePath, "utf8");
    assert.ok(content.includes("Sub-GHz"), "Must monitor Sub-GHz RF mesh");
    assert.ok(content.includes("Active Base Stations"), "Must display Base Station status");
    assert.ok(content.includes("Mesh Hop Distribution"), "Must display Mesh Hop Distribution");
    assert.ok(content.includes("RF Signal Quality"), "Must display RF Signal Quality Spectrum");
    assert.ok(content.includes("Orphaned Meters Surveillance"), "Must display Orphaned Meters section");
    assert.ok(content.includes("Backhaul Latency"), "Must track backhaul latency");
  });

  // 2. Verify Loss Rating Classifier
  await runTest("classifyLossRate classifies 0-5% as Optimal, 5-10% as Warning, >10% as Theft Alert", () => {
    const r1 = classifyLossRate(3.2);
    assert.equal(r1.code, "OPTIMAL");
    assert.equal(r1.label, "Optimal Technical Loss");
    assert.equal(r1.isTheftAlert, false);

    const r2 = classifyLossRate(5.0);
    assert.equal(r2.code, "OPTIMAL");

    const r3 = classifyLossRate(6.5);
    assert.equal(r3.code, "ELEVATED");
    assert.equal(r3.label, "Elevated Loss / Line Warning");
    assert.equal(r3.isTheftAlert, false);

    const r4 = classifyLossRate(10.0);
    assert.equal(r4.code, "ELEVATED");

    const r5 = classifyLossRate(10.1);
    assert.equal(r5.code, "THEFT_ALERT");
    assert.equal(r5.label, "Commercial Theft Alert / Illegal Bypass");
    assert.equal(r5.isTheftAlert, true);

    const r6 = classifyLossRate(15.65);
    assert.equal(r6.code, "THEFT_ALERT");
    assert.equal(r6.isTheftAlert, true);
  });

  // 3. Verify /api/oem/analytics/energy-audit HTTP endpoint
  await runTest("HTTP /api/oem/analytics/energy-audit aggregates the 8 SparkMeter mini-grids", async () => {
    const req = mockRequest({ url: "/api/oem/analytics/energy-audit", method: "GET" });
    const res = mockResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200, "Should return HTTP 200");
    assert.equal(res.body.code, 200, "Body code should be 200");

    const data = res.body.data;
    assert.ok(data.summary, "Data must include summary");
    assert.ok(data.summary.totalDispatchedKwh > 0, "Dispatched energy must be > 0");
    assert.ok(data.summary.totalConsumedKwh > 0, "Consumed energy must be > 0");
    assert.ok(data.summary.totalLossKwh > 0, "Total loss energy must be > 0");
    assert.ok(data.summary.networkLossRatePercent > 0, "Network loss rate % must be > 0");

    // Line loss formula assert: ((Dispatched - Consumed) / Dispatched) * 100
    const expectedLoss = data.summary.totalDispatchedKwh - data.summary.totalConsumedKwh;
    assert.equal(Math.round(data.summary.totalLossKwh), Math.round(expectedLoss), "Loss must equal Dispatched - Consumed");

    // Assert 8 sites
    assert.equal(data.sites.length, 8, "Must return all 8 SparkMeter sites");
    const requiredSites = ["OTU-COSTAIN", "ADEBAYO", "OLOYAN", "SULE", "ADEWALE", "MILE 13", "AJEGUNLE", "ONIPANU"];
    const returnedCodes = data.sites.map((s) => s.siteCode);
    for (const site of requiredSites) {
      assert.ok(returnedCodes.includes(site), `Expected site ${site} in energy audit`);
    }

    // Assert individual site structure
    for (const s of data.sites) {
      assert.ok(s.totalizerMeterId, "Site must have totalizerMeterId");
      assert.ok(s.customerCount > 0, "Site must have customer count > 0");
      assert.ok(s.dispatchedKwh > 0, "Site must have dispatched kWh > 0");
      assert.ok(s.consumedKwh > 0, "Site must have consumed kWh > 0");
      assert.ok(s.rating, "Site must have rating classification");
      assert.ok(["OPTIMAL", "ELEVATED", "THEFT_ALERT"].includes(s.rating.code), "Rating code must match standard enum");
    }

    // Verify ECharts flow balance structure
    assert.ok(data.flowBalance, "Must return flowBalance object for ECharts");
    assert.ok(Array.isArray(data.flowBalance.nodes), "Flow balance must have nodes");
    assert.ok(Array.isArray(data.flowBalance.links), "Flow balance must have links");
    assert.ok(data.flowBalance.breakdown, "Flow balance must include breakdown");
  });

  // 4. Verify /api/oem/mesh/gateway-status HTTP endpoint
  await runTest("HTTP /api/oem/mesh/gateway-status returns Base Station health for 8 sites", async () => {
    const req = mockRequest({ url: "/api/oem/mesh/gateway-status", method: "GET" });
    const res = mockResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200, "Should return HTTP 200");
    assert.equal(res.body.code, 200, "Body code should be 200");

    const data = res.body.data;
    assert.ok(data.summary, "Data must include summary");
    assert.equal(data.summary.totalGateways, 8, "Total gateways must be 8");
    assert.equal(data.summary.onlineGateways, 8, "Online gateways must be 8");
    assert.ok(data.summary.avgLatencyMs > 0, "Avg latency ms must be > 0");
    assert.ok(data.summary.avgPacketDeliveryRate >= 90, "Packet delivery rate must be >= 90%");
    assert.ok(data.summary.avgRssiDbm < 0, "Avg RSSI dBm must be negative");

    // 8 Base stations
    assert.equal(data.gateways.length, 8, "Must return 8 gateways");
    for (const gw of data.gateways) {
      assert.ok(gw.gatewayId, "Gateway must have gatewayId");
      assert.equal(gw.status, "online", "Gateway status must be online");
      assert.ok(gw.ipAddress, "Gateway must have ipAddress");
      assert.ok(gw.host, "Gateway must have host");
      assert.ok(["Cellular", "Satellite"].includes(gw.backhaulType), "Backhaul type must be Cellular or Satellite");
      assert.ok(gw.pingLatencyMs > 0, "Ping latency must be > 0");
      assert.ok(gw.packetDeliverySuccessRate > 0, "Packet success rate must be > 0");
      assert.ok(["Excellent", "Fair", "Weak"].includes(gw.signalQuality), "Signal quality must be Excellent, Fair, or Weak");
      assert.ok(gw.hopDistribution.direct0Hops, "Hop distribution must include 0 hops");
      assert.ok(gw.hopDistribution.repeater1Hop, "Hop distribution must include 1 hop");
      assert.ok(gw.hopDistribution.multi2PlusHops, "Hop distribution must include 2+ hops");
    }

    // Hop distribution network aggregates
    assert.ok(data.networkHopDistribution, "Must return networkHopDistribution");
    assert.ok(data.networkHopDistribution.direct0Hops.count > 0, "0-hop count must be > 0");
    assert.ok(data.networkHopDistribution.repeater1Hop.count > 0, "1-hop count must be > 0");
    assert.ok(data.networkHopDistribution.multi2PlusHops.count > 0, "2+ hops count must be > 0");

    // Orphaned meters list
    assert.ok(Array.isArray(data.orphanedMeters), "Must return orphanedMeters array");
    assert.ok(data.orphanedMeters.length > 0, "Must have orphaned meters flagged");
    for (const m of data.orphanedMeters) {
      assert.ok(m.meterSerial, "Orphan must have meterSerial");
      assert.ok(m.siteCode, "Orphan must have siteCode");
      assert.ok(m.customerName, "Orphan must have customerName");
      assert.ok(m.inactiveMinutes >= 60, "Orphan must be inactive for >= 60 minutes");
      assert.ok(m.failureReason, "Orphan must have failureReason");
      assert.ok(m.recommendedAction, "Orphan must have recommendedAction");
    }
  });

  // 5. Test Site Filter Parameter
  await runTest("Energy Audit endpoint handles siteId filter properly", async () => {
    const req = mockRequest({ url: "/api/oem/analytics/energy-audit?siteId=OTU-COSTAIN", method: "GET" });
    const res = mockResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.sites.length, 1);
    assert.equal(res.body.data.sites[0].siteCode, "OTU-COSTAIN");
    assert.equal(res.body.data.sites[0].rating.code, "THEFT_ALERT");
  });

  console.log("All Energy Audit & Mesh Gateway tests passed successfully!");
}

main().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
