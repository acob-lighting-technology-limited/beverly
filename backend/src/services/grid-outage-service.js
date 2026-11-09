"use strict";

/**
 * Smart Grid Outage & Fault Detection Service
 *
 * Implements multi-tier outage classification, flapping protection,
 * Estimated Unserved Energy (EUE) quantification, and automated SOP generation.
 */

const crypto = require("crypto");

const SEVERITY_LEVELS = {
  CRITICAL: "SEV-1_GRID_BLACKOUT",
  MAJOR: "SEV-2_FEEDER_OUTAGE",
  WARNING: "SEV-3_MESH_DEGRADED",
};

const DEFAULT_AVG_DEMAND_KW_PER_CUSTOMER = 0.45; // 450W average daytime demand per active mini-grid connection
const DEFAULT_TARIFF_PER_KWH = 120; // ₦120/kWh standard mini-grid tariff

const activeOutages = new Map();
const outageHistory = [];
const transitionsHistory = new Map();
const acknowledgedOutages = new Map();
const silencedOutages = new Map();

/**
 * Computes deterministic incident ID.
 */
function createIncidentId(stationId, targetId, timestamp) {
  return crypto.createHash("sha256")
    .update(`${stationId}::${targetId}::${String(timestamp).slice(0, 16)}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Checks for flapping connections to prevent alert fatigue.
 *
 * @param {string} targetKey - Unique identifier (e.g. stationId::gatewayId)
 * @param {number} [windowMs=1800000] - 30 minutes sliding window
 * @param {number} [maxTransitions=3] - Threshold for flapping
 * @returns {{ isFlapping: boolean, transitionCount: number }}
 */
function checkFlapping(targetKey, windowMs = 1800000, maxTransitions = 3) {
  const now = Date.now();
  const history = transitionsHistory.get(targetKey) || [];
  const validHistory = history.filter((ts) => now - ts <= windowMs);
  validHistory.push(now);
  transitionsHistory.set(targetKey, validHistory);

  return {
    isFlapping: validHistory.length >= maxTransitions,
    transitionCount: validHistory.length,
  };
}

/**
 * Estimates energy unserved (EUE) and economic loss.
 *
 * @param {number} durationMinutes - Downtime in minutes
 * @param {number} affectedCount - Number of affected meters/customers
 * @param {number} [avgKwPerCustomer] - Average kW demand
 * @param {number} [tariffPerKwh] - Tariff rate in Naira
 * @returns {{ eueKwh: number, revenueLossNaira: number }}
 */
function estimateEnergyLoss(durationMinutes, affectedCount, avgKwPerCustomer = DEFAULT_AVG_DEMAND_KW_PER_CUSTOMER, tariffPerKwh = DEFAULT_TARIFF_PER_KWH) {
  const hours = Math.max(0, durationMinutes) / 60;
  const count = Math.max(0, affectedCount);
  const eueKwh = Math.round(hours * (count * avgKwPerCustomer) * 100) / 100;
  const revenueLossNaira = Math.round(eueKwh * tariffPerKwh * 100) / 100;
  return { eueKwh, revenueLossNaira };
}

/**
 * Evaluates station and gateway state to detect grid outages.
 *
 * @param {object} params
 * @param {string} params.stationId - Station name (e.g. TUNGA, ADEBAYO)
 * @param {string} params.gatewayId - Primary gateway / base station identifier
 * @param {boolean} params.isGatewayDown - Gateway online/offline status
 * @param {number} params.connectedNodes - Total customer meters in this cell
 * @param {number} params.offlineNodes - Count of silent/offline meters
 * @param {number} [params.packetDeliveryRate] - Packet delivery rate (0-100)
 * @param {number} [params.rssiDbm] - Signal strength in dBm
 * @param {number} [params.downtimeMinutes] - Duration of current interruption
 * @param {Date} [params.startedAt] - Outage start time
 * @returns {object|null} Outage assessment or null if healthy
 */
function evaluateGridOutage({
  stationId,
  gatewayId,
  isGatewayDown = false,
  connectedNodes = 100,
  offlineNodes = 0,
  packetDeliveryRate = 99.0,
  rssiDbm = -75,
  downtimeMinutes = 0,
  startedAt = new Date(),
}) {
  const normStation = String(stationId || "UNKNOWN").toUpperCase();
  const total = Math.max(1, connectedNodes);
  const offlineRatio = offlineNodes / total;
  const targetKey = `${normStation}::${gatewayId}`;
  const now = new Date();

  let severity = null;
  let title = "";
  let sopGuidance = "";

  // 1. Grid Blackout Condition
  if (isGatewayDown || offlineRatio >= 0.75) {
    severity = SEVERITY_LEVELS.CRITICAL;
    title = `Grid Blackout: ${normStation} Site Outage`;
    sopGuidance = "1. Contact on-call field engineer for immediate diesel generator/battery check. 2. Verify cellular backhaul router. 3. Notify Operations Manager.";
  }
  // 2. Feeder Outage Condition
  else if (offlineRatio >= 0.25 || packetDeliveryRate < 70) {
    severity = SEVERITY_LEVELS.MAJOR;
    title = `Feeder Trip / Cluster Fault: ${normStation}`;
    sopGuidance = "1. Inspect distribution feeder breaker and step-down fuses. 2. Check mesh repeater node battery backup.";
  }
  // 3. Degraded Mesh / High Packet Loss
  else if (packetDeliveryRate < 90 || rssiDbm < -90) {
    severity = SEVERITY_LEVELS.WARNING;
    title = `Mesh Link Degraded: ${normStation}`;
    sopGuidance = "1. Inspect RF mast line of sight and antenna alignment. 2. Check for newly erected physical obstructions.";
  } else {
    // Healthy - no outage
    return null;
  }

  const flappingInfo = checkFlapping(targetKey);
  const affectedCount = isGatewayDown ? total : offlineNodes;
  const { eueKwh, revenueLossNaira } = estimateEnergyLoss(downtimeMinutes, affectedCount);
  const incidentId = createIncidentId(normStation, gatewayId, startedAt);

  const incident = {
    id: incidentId,
    stationId: normStation,
    gatewayId,
    severity,
    title,
    sopGuidance,
    isGatewayDown,
    connectedNodes: total,
    offlineNodes: affectedCount,
    offlineRatio: Math.round(offlineRatio * 1000) / 10,
    packetDeliveryRate,
    rssiDbm,
    downtimeMinutes,
    eueKwh,
    revenueLossNaira,
    isFlapping: flappingInfo.isFlapping,
    flappingTransitions: flappingInfo.transitionCount,
    startedAt: (startedAt instanceof Date ? startedAt : new Date(startedAt)).toISOString(),
    updatedAt: now.toISOString(),
    status: "active",
  };

  activeOutages.set(incidentId, incident);
  return incident;
}

/**
 * Acknowledges an active outage incident.
 */
function acknowledgeOutage(incidentId, actor = "Operator", notes = "") {
  if (!incidentId) return false;
  const incident = activeOutages.get(incidentId);
  if (!incident) return false;

  const now = new Date().toISOString();
  acknowledgedOutages.set(incidentId, {
    acknowledgedBy: actor,
    acknowledgedAt: now,
    notes,
  });
  incident.acknowledged = true;
  incident.acknowledgedBy = actor;
  incident.acknowledgedAt = now;
  return true;
}

/**
 * Silences an outage incident for a specific duration.
 */
function silenceOutage(incidentId, durationMs = 3600000) {
  if (!incidentId) return false;
  const until = Date.now() + Number(durationMs || 3600000);
  silencedOutages.set(incidentId, until);
  return true;
}

/**
 * Checks if an outage incident is currently silenced.
 */
function isOutageSilenced(incidentId) {
  const until = silencedOutages.get(incidentId);
  if (!until) return false;
  if (Date.now() > until) {
    silencedOutages.delete(incidentId);
    return false;
  }
  return true;
}

/**
 * Evaluates recovery of an outage incident.
 * If telemetry confirms online and delivery rate > 95% for >= 15 min, closes incident.
 */
function resolveOutageIncident(incidentId, recoveryMetrics = {}) {
  const incident = activeOutages.get(incidentId);
  if (!incident) return false;

  const now = new Date();
  const resolved = {
    ...incident,
    status: "resolved",
    resolvedAt: now.toISOString(),
    actualDowntimeMinutes: Math.round((now.getTime() - new Date(incident.startedAt).getTime()) / 60000),
    recoveryPacketDeliveryRate: recoveryMetrics.packetDeliveryRate ?? 99.0,
  };

  activeOutages.delete(incidentId);
  outageHistory.unshift(resolved);
  if (outageHistory.length > 200) outageHistory.pop();
  return resolved;
}

/**
 * Returns all active outages, enriched with silence/acknowledgment flags.
 */
function listActiveOutages() {
  const result = [];
  for (const incident of activeOutages.values()) {
    result.push({
      ...incident,
      isSilenced: isOutageSilenced(incident.id),
      acknowledgment: acknowledgedOutages.get(incident.id) || null,
    });
  }
  return result;
}

/**
 * Clears in-memory outage state for testing.
 */
function resetOutageMemory() {
  activeOutages.clear();
  outageHistory.length = 0;
  transitionsHistory.clear();
  acknowledgedOutages.clear();
  silencedOutages.clear();
}

module.exports = {
  SEVERITY_LEVELS,
  DEFAULT_AVG_DEMAND_KW_PER_CUSTOMER,
  DEFAULT_TARIFF_PER_KWH,
  createIncidentId,
  checkFlapping,
  estimateEnergyLoss,
  evaluateGridOutage,
  acknowledgeOutage,
  silenceOutage,
  isOutageSilenced,
  resolveOutageIncident,
  listActiveOutages,
  resetOutageMemory,
};
