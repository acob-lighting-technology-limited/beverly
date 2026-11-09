"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

console.log("Running Smart Metering Engine API & Integration Test...");

// 1. Verify route policies for new mutation endpoints
const { resolveMutationRoutePolicy } = require("../backend/wallet/dist/contracts/route-policy.js");

const reconcilePolicy = resolveMutationRoutePolicy("POST", "/api/v1/admin/consumption/reconcile-audit");
assert.notEqual(reconcilePolicy, null, "POST /api/v1/admin/consumption/reconcile-audit must be declared in route-policy.ts");
assert.equal(reconcilePolicy.mutation, true);

const acknowledgePolicy = resolveMutationRoutePolicy("POST", "/api/v1/admin/grid/outages/inc-12345/acknowledge");
assert.notEqual(acknowledgePolicy, null, "POST /api/v1/admin/grid/outages/:id/acknowledge must be declared in route-policy.ts");
assert.equal(acknowledgePolicy.mutation, true);

// 2. Ingestion service end-to-end integration check
const {
  validateReadingRecord,
  sanitizeAndIngestBatch,
} = require("../backend/src/services/smart-meter-ingestion-service");

const testBatch = [
  {
    stationId: "TUNGA",
    meterId: "01012026001",
    readingDate: "2026-10-25",
    total1: 1540.2,
    remain1: 34.0,
    sourceOem: "calinmeter",
  },
  {
    stationId: "ADEBAYO",
    meterId: "SMRSD-04-000823F5",
    readingDate: "2026-10-25",
    total1: 820.6,
    remain1: 120.5,
    sourceOem: "sparkmeter",
  },
];

const batchSummary = sanitizeAndIngestBatch(testBatch);
assert.equal(batchSummary.validCount, 2);
assert.equal(batchSummary.quarantinedCount, 0);
assert.equal(batchSummary.duplicatesCount, 0);

// 3. Grid Outage & Technical Loss Integration Check
const { evaluateGridOutage, listActiveOutages, acknowledgeOutage, resetOutageMemory } = require("../backend/src/services/grid-outage-service");
const { calculateTechnicalLoss } = require("../backend/src/services/consumption-reconciliation-engine");

resetOutageMemory();

const outage = evaluateGridOutage({
  stationId: "TUNGA",
  gatewayId: "GW-TNG-BS01",
  isGatewayDown: true,
  connectedNodes: 320,
  offlineNodes: 320,
  downtimeMinutes: 60,
});
assert.notEqual(outage, null);
assert.equal(outage.severity, "SEV-1_GRID_BLACKOUT");
assert.equal(outage.eueKwh > 0, true);
assert.equal(outage.revenueLossNaira > 0, true);

const ackResult = acknowledgeOutage(outage.id, "Lead Engineer", "Generator fuel restocked");
assert.equal(ackResult, true);
assert.equal(listActiveOutages()[0].acknowledged, true);

// Technical loss assessment
const lossReport = calculateTechnicalLoss({
  stationId: "TUNGA",
  feederEnergyKwh: 5000,
  customerEnergyKwh: 4600,
  tariffPerKwh: 120,
});
assert.equal(lossReport.lossPercent, 8.0);
assert.equal(lossReport.severity, "NORMAL");

console.log("✓ Smart Metering Engine API & Integration Test passed successfully.");
