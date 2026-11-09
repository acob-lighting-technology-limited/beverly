"use strict";

const assert = require("node:assert/strict");
const {
  SEVERITY_LEVELS,
  estimateEnergyLoss,
  evaluateGridOutage,
  acknowledgeOutage,
  silenceOutage,
  isOutageSilenced,
  resolveOutageIncident,
  listActiveOutages,
  resetOutageMemory,
} = require("../backend/src/services/grid-outage-service");

console.log("Testing Smart Grid Outage & Fault Detection Service...");

resetOutageMemory();

// 1. Energy loss estimation
const loss = estimateEnergyLoss(120, 200, 0.5, 100);
// 2 hours * (200 * 0.5 kW = 100 kW) = 200 kWh. 200 kWh * ₦100 = ₦20,000
assert.equal(loss.eueKwh, 200);
assert.equal(loss.revenueLossNaira, 20000);

// 2. Grid Blackout Detection (SEV-1)
const blackout = evaluateGridOutage({
  stationId: "TUNGA",
  gatewayId: "GW-TNG-01",
  isGatewayDown: true,
  connectedNodes: 350,
  offlineNodes: 350,
  downtimeMinutes: 45,
});
assert.notEqual(blackout, null);
assert.equal(blackout.severity, SEVERITY_LEVELS.CRITICAL);
assert.equal(blackout.stationId, "TUNGA");
assert.equal(blackout.isGatewayDown, true);
assert.equal(blackout.offlineNodes, 350);

// 3. Feeder Trip Detection (SEV-2)
const feederTrip = evaluateGridOutage({
  stationId: "UMAISHA",
  gatewayId: "GW-UMS-01",
  isGatewayDown: false,
  connectedNodes: 400,
  offlineNodes: 120, // 30% offline
  packetDeliveryRate: 65,
  downtimeMinutes: 30,
});
assert.notEqual(feederTrip, null);
assert.equal(feederTrip.severity, SEVERITY_LEVELS.MAJOR);
assert.equal(feederTrip.offlineNodes, 120);

// 4. Healthy Grid Check
const healthy = evaluateGridOutage({
  stationId: "KYAKALE",
  gatewayId: "GW-KYK-01",
  isGatewayDown: false,
  connectedNodes: 200,
  offlineNodes: 5,
  packetDeliveryRate: 99.2,
  rssiDbm: -72,
});
assert.equal(healthy, null);

// 5. Active outage list
const active = listActiveOutages();
assert.equal(active.length, 2);

// 6. Acknowledgment
const ackOk = acknowledgeOutage(blackout.id, "Operations Engineer Danmusa", "Dispatched field diesel maintenance");
assert.equal(ackOk, true);
assert.equal(blackout.acknowledged, true);
assert.equal(blackout.acknowledgedBy, "Operations Engineer Danmusa");

// 7. Silencing
assert.equal(isOutageSilenced(blackout.id), false);
silenceOutage(blackout.id, 60000); // 1 minute
assert.equal(isOutageSilenced(blackout.id), true);

// 8. Outage Resolution
const resolved = resolveOutageIncident(blackout.id, { packetDeliveryRate: 99.8 });
assert.notEqual(resolved, false);
assert.equal(resolved.status, "resolved");
assert.equal(listActiveOutages().length, 1); // Only feederTrip remains

console.log("✓ Smart Grid Outage & Fault Detection Service tests passed successfully.");
