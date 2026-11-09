"use strict";

const assert = require("node:assert/strict");
const {
  generateDateRange,
  auditStationReadingGaps,
  compareSourceVsStoredRegisters,
  calculateTechnicalLoss,
} = require("../backend/src/services/consumption-reconciliation-engine");

console.log("Testing Consumption Reconciliation & Technical Loss Engine...");

// 1. generateDateRange
const dates = generateDateRange("2026-10-21", "2026-10-24");
assert.deepEqual(dates, ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"]);

// 2. auditStationReadingGaps
const activeMeters = ["MTR-001", "MTR-002", "MTR-003"];
const storedReadings = [
  { meter_id: "MTR-001", reading_date: "2026-10-21" },
  { meter_id: "MTR-001", reading_date: "2026-10-22" },
  { meter_id: "MTR-001", reading_date: "2026-10-23" },
  { meter_id: "MTR-001", reading_date: "2026-10-24" }, // 4/4
  { meter_id: "MTR-002", reading_date: "2026-10-21" },
  { meter_id: "MTR-002", reading_date: "2026-10-22" }, // 2/4 (missing 23, 24)
  // MTR-003 is completely dark: 0/4
];

const gapAudit = auditStationReadingGaps("TUNGA", activeMeters, storedReadings, "2026-10-21", "2026-10-24");
assert.equal(gapAudit.expectedMeterDays, 12);
assert.equal(gapAudit.actualMeterDays, 6);
assert.equal(gapAudit.missingMeterDays, 6);
assert.equal(gapAudit.completenessPercent, 50);
assert.equal(gapAudit.darkMeterCount, 1);
assert.equal(gapAudit.hasGaps, true);
assert.equal(gapAudit.meterCoverage["MTR-003"].isCompletelyDark, true);

// 3. compareSourceVsStoredRegisters
const source = [
  { station_id: "TUNGA", meter_id: "M1", reading_date: "2026-10-21", total1: 150.5, remain1: 20 },
  { station_id: "TUNGA", meter_id: "M2", reading_date: "2026-10-21", total1: 200.0, remain1: 15 },
];
const stored = [
  { station_id: "TUNGA", meter_id: "M1", reading_date: "2026-10-21", total1: 150.5, remain1: 20 },
  { station_id: "TUNGA", meter_id: "M2", reading_date: "2026-10-21", total1: 198.2, remain1: 15 }, // drift of 1.8
];

const comparison = compareSourceVsStoredRegisters(source, stored);
assert.equal(comparison.isConsistent, false);
assert.equal(comparison.mismatchedTotal, 1);
assert.equal(comparison.maxVariance, 1.8);
assert.equal(comparison.missingInStored, 0);

// Identical comparison
assert.equal(compareSourceVsStoredRegisters(source, source).isConsistent, true);

// 4. calculateTechnicalLoss
// Normal loss (<10%)
const normalLoss = calculateTechnicalLoss({
  feederEnergyKwh: 1000,
  customerEnergyKwh: 940,
  tariffPerKwh: 120,
  stationId: "TUNGA",
});
assert.equal(normalLoss.lossKwh, 60);
assert.equal(normalLoss.lossPercent, 6.0);
assert.equal(normalLoss.severity, "NORMAL");
assert.equal(normalLoss.financialLossNaira, 7200);

// Critical theft risk (>20%)
const criticalLoss = calculateTechnicalLoss({
  feederEnergyKwh: 1000,
  customerEnergyKwh: 750,
  tariffPerKwh: 120,
  stationId: "OGUFA",
});
assert.equal(criticalLoss.lossKwh, 250);
assert.equal(criticalLoss.lossPercent, 25.0);
assert.equal(criticalLoss.severity, "CRITICAL_THEFT_RISK");
assert.equal(criticalLoss.financialLossNaira, 30000);

console.log("✓ Consumption Reconciliation & Technical Loss Engine tests passed successfully.");
