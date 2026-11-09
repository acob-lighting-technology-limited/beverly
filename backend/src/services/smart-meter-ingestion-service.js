"use strict";

/**
 * Smart Meter Ingestion Service
 * 
 * Provides unified, hardened ingestion and sanitization for multi-OEM meter data
 * (Calinmeter STS daily registers, SparkMeter NOVA telemetry intervals, and future OEMs).
 *
 * Capabilities:
 * - Dynamic register rollover vs. reverse current / tampering differentiation.
 * - Anti-spurious reading filter (quarantining impossible consumption spikes, clock drifts, future dates).
 * - Multi-flag tamper event tagging (cover open, magnetic interference, reverse flow, low battery).
 * - Bounded idempotent batch processing with throughput metrics and audit metadata.
 */

const MAX_DAILY_KWH_SINGLE_PHASE = 250; // Max reasonable daily consumption for standard mini-grid customer
const MAX_DAILY_KWH_THREE_PHASE = 1500; // Max reasonable daily consumption for commercial 3-phase customer
const REGISTER_ROLLOVER_THRESHOLD = 999999; // Standard 6-digit register rollover point

/**
 * Evaluates whether a drop in cumulative reading represents a genuine register rollover
 * or an illegal rollback/tamper event.
 *
 * @param {number} prevTotal - Previous cumulative active energy
 * @param {number} currentTotal - Current cumulative active energy
 * @param {number} maxCapacity - Rollover limit (default 999999 kWh)
 * @returns {{ isRollover: boolean, delta: number }}
 */
function evaluateRegisterTransition(prevTotal, currentTotal, maxCapacity = REGISTER_ROLLOVER_THRESHOLD) {
  if (prevTotal == null || currentTotal == null) {
    return { isRollover: false, delta: 0 };
  }
  const prev = Number(prevTotal);
  const curr = Number(currentTotal);
  if (!Number.isFinite(prev) || !Number.isFinite(curr)) {
    return { isRollover: false, delta: 0 };
  }

  // Normal positive increment
  if (curr >= prev) {
    return { isRollover: false, delta: Math.round((curr - prev) * 1000) / 1000 };
  }

  // Current is less than previous: could be rollover or tampering
  // A genuine rollover occurs when the counter wraps around near its capacity
  const rolloverDelta = (maxCapacity - prev) + curr;
  if (rolloverDelta >= 0 && rolloverDelta <= MAX_DAILY_KWH_THREE_PHASE) {
    return { isRollover: true, delta: Math.round(rolloverDelta * 1000) / 1000 };
  }

  // Negative delta exceeding plausible rollover is a reverse flow or tamper
  return { isRollover: false, delta: Math.round((curr - prev) * 1000) / 1000 };
}

/**
 * Validates and sanitizes a single meter reading record.
 *
 * @param {object} record - Raw reading record
 * @param {object} [previousRecord] - Prior historical reading for delta calculation
 * @param {object} [options] - Configuration options
 * @returns {object} Validation result
 */
function validateReadingRecord(record = {}, previousRecord = null, options = {}) {
  const stationId = String(record.stationId || record.station_id || "").trim().toUpperCase();
  const meterId = String(record.meterId || record.meter_id || "").trim();
  const rawDate = String(record.readingDate || record.reading_date || record.currentDate || record.current_date || "").slice(0, 10);

  if (!stationId || stationId === "ADMIN") {
    return { valid: false, quarantineReason: "INVALID_STATION_IDENTIFIER", record };
  }
  if (!meterId) {
    return { valid: false, quarantineReason: "MISSING_METER_IDENTIFIER", record };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return { valid: false, quarantineReason: "INVALID_READING_DATE_FORMAT", record };
  }

  const todayStr = (options.now instanceof Date ? options.now : new Date()).toISOString().slice(0, 10);
  if (rawDate > todayStr) {
    return { valid: false, quarantineReason: "FUTURE_READING_DATE_REJECTED", record };
  }

  const total = record.total1 != null ? Number(record.total1) : null;
  const remain = record.remain1 != null ? Number(record.remain1) : null;

  if (total !== null && (!Number.isFinite(total) || total < 0)) {
    return { valid: false, quarantineReason: "CORRUPTED_TOTAL_REGISTER", record };
  }
  if (remain !== null && (!Number.isFinite(remain) || remain < 0)) {
    return { valid: false, quarantineReason: "CORRUPTED_REMAIN_REGISTER", record };
  }

  // Delta calculation and anomaly detection
  let computedUsage = record.usage1 != null ? Number(record.usage1) : null;
  let isRollover = false;
  let isReverseFlow = false;

  if (previousRecord && total !== null) {
    const prevTotal = previousRecord.total1 != null ? Number(previousRecord.total1) : null;
    if (prevTotal !== null) {
      const evaluation = evaluateRegisterTransition(prevTotal, total, options.rolloverCapacity || REGISTER_ROLLOVER_THRESHOLD);
      if (evaluation.isRollover) {
        isRollover = true;
        computedUsage = evaluation.delta;
      } else if (evaluation.delta < 0) {
        isReverseFlow = true;
      } else if (computedUsage === null || Math.abs(computedUsage - evaluation.delta) > 1.0) {
        computedUsage = evaluation.delta;
      }
    }
  }

  // Tamper detection
  const tamperFlags = {
    currentReverse: Boolean(Number(record.current_reverse ?? record.currentReverse ?? 0) > 0 || isReverseFlow),
    terminalCoverOpen: Boolean(Number(record.terminal_cover_open ?? record.terminalCoverOpen ?? 0) > 0),
    coverOpen: Boolean(Number(record.cover_open ?? record.coverOpen ?? 0) > 0),
    magneticInterference: Boolean(Number(record.magnetic_interference ?? record.magneticInterference ?? 0) > 0),
    batteryLow: Boolean(Number(record.battery_low ?? record.batteryLow ?? 0) > 0),
  };
  const tamperDetected = Object.values(tamperFlags).some(Boolean);

  // Check consumption bounds
  const maxAllowedKwh = options.isThreePhase ? MAX_DAILY_KWH_THREE_PHASE : MAX_DAILY_KWH_SINGLE_PHASE;
  if (computedUsage !== null && computedUsage > maxAllowedKwh) {
    return {
      valid: false,
      quarantineReason: "ABNORMAL_CONSUMPTION_SPIKE",
      computedUsage,
      maxAllowedKwh,
      record,
    };
  }

  if (isReverseFlow && !tamperFlags.currentReverse) {
    return {
      valid: false,
      quarantineReason: "NEGATIVE_CONSUMPTION_REGISTER_REGRESSION",
      record,
    };
  }

  // Clean, sanitized record
  const sanitized = {
    station_id: stationId,
    meter_id: meterId,
    reading_date: rawDate,
    total1: total !== null ? Math.round(total * 1000) / 1000 : null,
    remain1: remain !== null ? Math.round(remain * 1000) / 1000 : null,
    usage1: computedUsage !== null ? Math.round(computedUsage * 1000) / 1000 : 0,
    is_rollover: isRollover,
    tamper_detected: tamperDetected,
    tamper_flags: tamperFlags,
    source_oem: record.sourceOem || record.source_oem || "calinmeter",
    ingested_at: (options.now instanceof Date ? options.now : new Date()).toISOString(),
  };

  return {
    valid: true,
    sanitizedRecord: sanitized,
    quarantineReason: null,
    tamperDetected,
    isRollover,
  };
}

/**
 * Sanitizes, validates, and prepares an ingestion batch.
 *
 * @param {Array<object>} rawRecords - Raw records received from OEM API or stream
 * @param {object} [options] - Options including previous reading lookup and timestamps
 * @returns {object} Ingestion batch result
 */
function sanitizeAndIngestBatch(rawRecords = [], options = {}) {
  const startTime = Date.now();
  const validRecords = [];
  const quarantinedRecords = [];
  const seenKeys = new Set();
  let duplicatesCount = 0;

  for (const raw of rawRecords) {
    const stationId = String(raw.stationId || raw.station_id || "").trim().toUpperCase();
    const meterId = String(raw.meterId || raw.meter_id || "").trim();
    const readingDate = String(raw.readingDate || raw.reading_date || raw.currentDate || raw.current_date || "").slice(0, 10);
    const key = `${stationId}::${meterId}::${readingDate}`;

    if (seenKeys.has(key)) {
      duplicatesCount += 1;
      continue;
    }
    seenKeys.add(key);

    const prevLookup = options.previousReadings?.get?.(`${stationId}::${meterId}`) || null;
    const validation = validateReadingRecord(raw, prevLookup, options);

    if (validation.valid && validation.sanitizedRecord) {
      validRecords.push(validation.sanitizedRecord);
    } else {
      quarantinedRecords.push({
        stationId,
        meterId,
        readingDate,
        reason: validation.quarantineReason || "VALIDATION_FAILED",
        rawRecord: raw,
        quarantinedAt: new Date().toISOString(),
      });
    }
  }

  const durationMs = Math.max(1, Date.now() - startTime);
  const throughputRowsPerSec = Math.round((rawRecords.length / (durationMs / 1000)) * 10) / 10;

  return {
    totalReceived: rawRecords.length,
    validCount: validRecords.length,
    quarantinedCount: quarantinedRecords.length,
    duplicatesCount,
    throughputRowsPerSec,
    durationMs,
    validRecords,
    quarantinedRecords,
  };
}

module.exports = {
  MAX_DAILY_KWH_SINGLE_PHASE,
  MAX_DAILY_KWH_THREE_PHASE,
  REGISTER_ROLLOVER_THRESHOLD,
  evaluateRegisterTransition,
  validateReadingRecord,
  sanitizeAndIngestBatch,
};
