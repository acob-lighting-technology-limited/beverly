"use strict";

const assert = require("node:assert/strict");
const {
  evaluateRegisterTransition,
  validateReadingRecord,
  sanitizeAndIngestBatch,
  MAX_DAILY_KWH_SINGLE_PHASE,
} = require("../backend/src/services/smart-meter-ingestion-service");

console.log("Testing Smart Meter Ingestion Engine...");

// 1. Register transition & rollover tests
const normalIncrement = evaluateRegisterTransition(100, 108.5);
assert.equal(normalIncrement.isRollover, false);
assert.equal(normalIncrement.delta, 8.5);

// Genuine 6-digit register rollover (e.g. 999995 -> 12 kWh = 17 kWh delta)
const genuineRollover = evaluateRegisterTransition(999995, 12, 999999);
assert.equal(genuineRollover.isRollover, true);
assert.equal(genuineRollover.delta, 16);

// Illegal rollback / meter tampering (e.g. 500 -> 350)
const illegalRollback = evaluateRegisterTransition(500, 350);
assert.equal(illegalRollback.isRollover, false);
assert.equal(illegalRollback.delta, -150);

// 2. validateReadingRecord tests
// Rejects ADMIN station
const adminCheck = validateReadingRecord({ stationId: "ADMIN", meterId: "M100", readingDate: "2026-10-20", total1: 10 });
assert.equal(adminCheck.valid, false);
assert.equal(adminCheck.quarantineReason, "INVALID_STATION_IDENTIFIER");

// Rejects future dates
const futureCheck = validateReadingRecord(
  { stationId: "TUNGA", meterId: "M100", readingDate: "2026-11-20", total1: 10 },
  null,
  { now: new Date("2026-10-25T00:00:00Z") }
);
assert.equal(futureCheck.valid, false);
assert.equal(futureCheck.quarantineReason, "FUTURE_READING_DATE_REJECTED");

// Rejects extreme abnormal spike
const spikeCheck = validateReadingRecord(
  { stationId: "TUNGA", meterId: "M100", readingDate: "2026-10-22", total1: 600, usage1: 500 },
  { total1: 100 },
  { now: new Date("2026-10-25T00:00:00Z") }
);
assert.equal(spikeCheck.valid, false);
assert.equal(spikeCheck.quarantineReason, "ABNORMAL_CONSUMPTION_SPIKE");

// Flags tamper events (e.g. cover open)
const tamperRecord = validateReadingRecord(
  { stationId: "TUNGA", meterId: "M100", readingDate: "2026-10-22", total1: 110, cover_open: 1 },
  { total1: 100 },
  { now: new Date("2026-10-25T00:00:00Z") }
);
assert.equal(tamperRecord.valid, true);
assert.equal(tamperRecord.tamperDetected, true);
assert.equal(tamperRecord.sanitizedRecord.tamper_flags.coverOpen, true);

// 3. Batch ingestion & deduplication
const rawBatch = [
  { stationId: "TUNGA", meterId: "M1", readingDate: "2026-10-22", total1: 105, remain1: 50 },
  { stationId: "TUNGA", meterId: "M1", readingDate: "2026-10-22", total1: 105, remain1: 50 }, // duplicate
  { stationId: "TUNGA", meterId: "M2", readingDate: "2026-10-22", total1: -10 }, // corrupted
  { stationId: "UMAISHA", meterId: "M3", readingDate: "2026-10-22", total1: 210, remain1: 80 },
];

const batchResult = sanitizeAndIngestBatch(rawBatch, {
  now: new Date("2026-10-25T00:00:00Z"),
});

assert.equal(batchResult.totalReceived, 4);
assert.equal(batchResult.validCount, 2);
assert.equal(batchResult.duplicatesCount, 1);
assert.equal(batchResult.quarantinedCount, 1);
assert.equal(batchResult.quarantinedRecords[0].reason, "CORRUPTED_TOTAL_REGISTER");

console.log("✓ Smart Meter Ingestion Engine tests passed successfully.");
