"use strict";

/**
 * Consumption Reconciliation & Technical Loss Engine
 *
 * Implements automated audit, gap discovery, and mass-balance technical loss
 * analytics for smart metering across all mini-grid stations.
 */

const DEFAULT_TARIFF_NAIRA_PER_KWH = 120; // Default mini-grid tariff baseline

/**
 * Generate a complete array of YYYY-MM-DD dates between from and to (inclusive).
 *
 * @param {string} from - Start date (YYYY-MM-DD)
 * @param {string} to - End date (YYYY-MM-DD)
 * @returns {string[]} Array of date strings
 */
function generateDateRange(from, to) {
  const dates = [];
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

  const curr = new Date(start);
  while (curr <= end) {
    dates.push(curr.toISOString().slice(0, 10));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Audits a station for reading gaps across a specified date range.
 *
 * @param {string} stationId
 * @param {Array<string>} activeMeterIds - List of active meter IDs registered to this station
 * @param {Array<object>} storedReadings - Readings stored in local database
 * @param {string} from - Range start (YYYY-MM-DD)
 * @param {string} to - Range end (YYYY-MM-DD)
 * @returns {object} Gap audit summary
 */
function auditStationReadingGaps(stationId, activeMeterIds = [], storedReadings = [], from, to) {
  const dates = generateDateRange(from, to);
  const expectedMeterDays = activeMeterIds.length * dates.length;
  const storedKeySet = new Set(
    storedReadings.map((r) => `${String(r.meter_id || r.meterId).trim()}::${String(r.reading_date || r.current_date).slice(0, 10)}`)
  );

  const missingKeys = [];
  const meterCoverage = {};

  for (const meterId of activeMeterIds) {
    let presentCount = 0;
    const missingDates = [];
    for (const d of dates) {
      const key = `${meterId}::${d}`;
      if (storedKeySet.has(key)) {
        presentCount += 1;
      } else {
        missingDates.push(d);
        missingKeys.push({ stationId, meterId, date: d });
      }
    }
    meterCoverage[meterId] = {
      presentDays: presentCount,
      missingDays: missingDates.length,
      coveragePercent: dates.length > 0 ? Math.round((presentCount / dates.length) * 1000) / 10 : 0,
      missingDates,
      isCompletelyDark: presentCount === 0,
    };
  }

  const actualMeterDays = expectedMeterDays - missingKeys.length;
  const completenessPercent = expectedMeterDays > 0 ? Math.round((actualMeterDays / expectedMeterDays) * 1000) / 10 : 100;
  const darkMeterCount = Object.values(meterCoverage).filter((m) => m.isCompletelyDark).length;

  return {
    stationId,
    dateRange: { from, to, daysCount: dates.length },
    activeMeterCount: activeMeterIds.length,
    expectedMeterDays,
    actualMeterDays,
    missingMeterDays: missingKeys.length,
    completenessPercent,
    darkMeterCount,
    missingKeys: missingKeys.slice(0, 100), // First 100 missing keys for diagnostics
    hasGaps: missingKeys.length > 0,
    meterCoverage,
  };
}

/**
 * Compares upstream source readings with stored local readings for register drift.
 *
 * @param {Array<object>} sourceReadings
 * @param {Array<object>} storedReadings
 * @returns {object} Discrepancy analysis
 */
function compareSourceVsStoredRegisters(sourceReadings = [], storedReadings = []) {
  const keyFn = (r) => `${String(r.station_id || r.stationId).trim().toUpperCase()}::${String(r.meter_id || r.meterId).trim()}::${String(r.reading_date || r.current_date).slice(0, 10)}`;

  const sourceMap = new Map(sourceReadings.map((r) => [keyFn(r), r]));
  const storedMap = new Map(storedReadings.map((r) => [keyFn(r), r]));

  let missingInStored = 0;
  let mismatchedTotal = 0;
  let mismatchedRemain = 0;
  let maxVariance = 0;
  const discrepancies = [];

  for (const [key, source] of sourceMap) {
    if (!storedMap.has(key)) {
      missingInStored += 1;
      continue;
    }
    const stored = storedMap.get(key);
    const sourceTotal = Number(source.total1 ?? 0);
    const storedTotal = Number(stored.total1 ?? 0);
    const sourceRemain = Number(source.remain1 ?? 0);
    const storedRemain = Number(stored.remain1 ?? 0);

    const totalDiff = Math.abs(sourceTotal - storedTotal);
    const remainDiff = Math.abs(sourceRemain - storedRemain);

    if (totalDiff > 0.001) {
      mismatchedTotal += 1;
      if (totalDiff > maxVariance) maxVariance = totalDiff;
      discrepancies.push({
        key,
        field: "total1",
        sourceValue: sourceTotal,
        storedValue: storedTotal,
        difference: Math.round(totalDiff * 1000) / 1000,
      });
    }

    if (remainDiff > 0.001) {
      mismatchedRemain += 1;
    }
  }

  const localOnlyCount = [...storedMap.keys()].filter((k) => !sourceMap.has(k)).length;
  const isConsistent = missingInStored === 0 && mismatchedTotal === 0 && mismatchedRemain === 0;

  return {
    sourceRecordsCount: sourceMap.size,
    storedRecordsCount: storedMap.size,
    missingInStored,
    mismatchedTotal,
    mismatchedRemain,
    localOnlyCount,
    maxVariance: Math.round(maxVariance * 1000) / 1000,
    isConsistent,
    discrepancies: discrepancies.slice(0, 50),
    verificationType: "authoritative_source_comparison",
  };
}

/**
 * Calculates mass balance technical and commercial loss for a mini-grid station.
 *
 * @param {object} params
 * @param {number} params.feederEnergyKwh - Total generation / feeder input energy
 * @param {number} params.customerEnergyKwh - Sum of metered customer consumption
 * @param {number} [params.tariffPerKwh] - Tariff rate in Naira
 * @param {string} [params.stationId] - Station identifier
 * @returns {object} Technical loss assessment
 */
function calculateTechnicalLoss({ feederEnergyKwh = 0, customerEnergyKwh = 0, tariffPerKwh = DEFAULT_TARIFF_NAIRA_PER_KWH, stationId = "UNKNOWN" }) {
  const feeder = Math.max(0, Number(feederEnergyKwh) || 0);
  const customer = Math.max(0, Number(customerEnergyKwh) || 0);
  const tariff = Number(tariffPerKwh) || DEFAULT_TARIFF_NAIRA_PER_KWH;

  const lossKwh = Math.round((feeder - customer) * 100) / 100;
  const lossPercent = feeder > 0 ? Math.round(((feeder - customer) / feeder) * 1000) / 10 : 0;
  const financialLossNaira = lossKwh > 0 ? Math.round(lossKwh * tariff * 100) / 100 : 0;

  let severity = "NORMAL";
  let diagnosis = "Energy balance is within expected technical distribution loss limits (<10%).";
  let recommendedAction = "Continue routine monitoring.";

  if (lossPercent < 0) {
    severity = "ANOMALY_NEGATIVE_LOSS";
    diagnosis = "Customer metered energy exceeds feeder generation. Possible feeder meter malfunction or untracked generation.";
    recommendedAction = "Recalibrate station feeder meter and verify solar inverter / generator tie-in.";
  } else if (lossPercent > 20) {
    severity = "CRITICAL_THEFT_RISK";
    diagnosis = `High loss ratio of ${lossPercent}%. Indicates commercial theft, line taps, or unmetered loads.`;
    recommendedAction = "Deploy field inspection team to audit distribution feeder lines and inspect customer seals.";
  } else if (lossPercent > 10) {
    severity = "ELEVATED_LOSS";
    diagnosis = `Elevated loss ratio of ${lossPercent}%. Above standard 10% benchmark.`;
    recommendedAction = "Inspect transformer step-down efficiency and check for high-resistance joints.";
  }

  return {
    stationId,
    feederEnergyKwh: feeder,
    customerEnergyKwh: customer,
    lossKwh,
    lossPercent,
    financialLossNaira,
    severity,
    diagnosis,
    recommendedAction,
    assessedAt: new Date().toISOString(),
  };
}

module.exports = {
  DEFAULT_TARIFF_NAIRA_PER_KWH,
  generateDateRange,
  auditStationReadingGaps,
  compareSourceVsStoredRegisters,
  calculateTechnicalLoss,
};
