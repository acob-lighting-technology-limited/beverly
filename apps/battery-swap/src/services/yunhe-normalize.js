/**
 * Reads one raw Yunhe battery record into fields the PUE screens use.
 *
 * UNVERIFIED MAPPING: Yunhe has not given us API documentation yet. The candidate
 * field names below are best guesses from the platform's own screens (columns such as
 * "Battery life (%)", "Loop count") and the old integration code. Every value is read
 * defensively: a missing or non-numeric field becomes null and the screens show a dash.
 * Nothing is ever filled in with a default.
 *
 * The Diagnostics raw view lists each provider field and which one was read for each
 * of our fields (`sources`), so the mapping can be checked against a real response and
 * corrected here in one place.
 */

/** Our field -> provider keys to try, in order. */
export const FIELD_KEYS = {
  batteryNumber: ["id", "battery_id", "batteryId", "battery_number", "batteryNumber"],
  serialNumber: ["sn", "serial", "serial_number", "serialNumber"],
  soc: ["soc", "battery_life", "batteryLife", "electricity"],
  voltageV: ["v", "voltage", "total_voltage", "totalVoltage"],
  currentA: ["i", "current", "total_current"],
  capacityAh: ["capacity", "cap", "capacity_ah"],
  cycleCount: ["loop_sum", "loop_count", "loopCount", "cycle_count", "cycles"],
  cellCount: ["cell_sum", "cell_count", "cellCount", "cells_num"],
  tempC: ["temp", "temperature", "cell_temp", "cellTemp"],
  distanceKm: ["mileage", "distance", "total_distance", "gps_distance"],
  lat: ["lat", "latitude"],
  lng: ["lng", "lon", "longitude"],
  signal: ["signal", "csq", "gsm", "gsm_signal"],
  imsi: ["imsi"],
  state: ["state", "status", "motion"],
  updatedAt: ["last_time", "update_time", "updateTime", "time"],
  online: ["online", "online_status", "onlineStatus", "is_online"],
  chargeFet: ["c_fet", "charge_fet"],
  dischargeFet: ["d_fet", "discharge_fet"],
  cellVoltages: ["cell_voltages", "cellVoltages", "cells", "cell_v", "v_list"]
};

function pick(raw, keys) {
  for (const key of keys) {
    if (raw && Object.prototype.hasOwnProperty.call(raw, key) && raw[key] !== null && raw[key] !== undefined && raw[key] !== "") {
      return { key, value: raw[key] };
    }
  }
  return { key: null, value: null };
}

/** A finite number, or null. Strings like "49.9" count; "abc" and "" do not. */
export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** True/false from 1/0, "1"/"0", true/false, "Online"/"Offline"; otherwise null (unknown). */
export function toOnline(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (text === "1" || text === "true" || text === "online") return true;
  if (text === "0" || text === "false" || text === "offline") return false;
  return null;
}

/** An ISO time string, or null if the value is not a date. */
export function toIso(value) {
  if (value === null || value === undefined || value === "") return null;
  const time = typeof value === "number" ? (value < 1e12 ? value * 1000 : value) : Date.parse(String(value).replace(" ", "T"));
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toCells(value) {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : null;
  if (!list) return null;
  const numbers = list.map(toNumber);
  return numbers.length && numbers.every((n) => n !== null) ? numbers : null;
}

/**
 * @param {Record<string, unknown>} raw one record from Yunhe getBattery
 * @returns normalized fields, plus `sources` (our field -> provider key read, or null)
 *          and `unmapped` (provider keys we did not read)
 */
export function normalizeYunheBattery(raw) {
  const record = raw && typeof raw === "object" ? raw : {};
  const sources = {};
  const read = (field) => {
    const { key, value } = pick(record, FIELD_KEYS[field]);
    sources[field] = key;
    return value;
  };

  let lat = toNumber(read("lat"));
  let lng = toNumber(read("lng"));
  // A coordinate pair that is out of range, or 0,0, is not a real position.
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
    lat = null;
    lng = null;
  }

  const normalized = {
    batteryNumber: read("batteryNumber") === null ? null : String(record[sources.batteryNumber]),
    serialNumber: read("serialNumber") === null ? null : String(record[sources.serialNumber]),
    soc: toNumber(read("soc")),
    voltageV: toNumber(read("voltageV")),
    currentA: toNumber(read("currentA")),
    capacityAh: toNumber(read("capacityAh")),
    cycleCount: toNumber(read("cycleCount")),
    cellCount: toNumber(read("cellCount")),
    tempC: toNumber(read("tempC")),
    distanceKm: toNumber(read("distanceKm")),
    lat,
    lng,
    signal: toNumber(read("signal")),
    imsi: read("imsi") === null ? null : String(record[sources.imsi]),
    state: read("state") === null ? null : String(record[sources.state]),
    updatedAt: toIso(read("updatedAt")),
    online: toOnline(read("online")),
    chargeFet: toOnline(read("chargeFet")),
    dischargeFet: toOnline(read("dischargeFet")),
    cellVoltages: toCells(read("cellVoltages"))
  };

  const used = new Set(Object.values(sources).filter(Boolean));
  return { ...normalized, sources, unmapped: Object.keys(record).filter((key) => !used.has(key)) };
}

/**
 * Operator policy defaults for raising alerts. These are OUR thresholds, not facts
 * from the provider, and are meant to be tuned.
 */
export const ALERT_DEFAULTS = {
  lowSoc: 20,
  criticalSoc: 10,
  cellDeltaV: 0.05,
  tempHighC: 55,
  staleHours: 24
};

/**
 * Alerts for one battery. Only fields that are present can raise an alert:
 * a missing reading never means "healthy" and never means "faulty".
 * @returns {{ code: string, level: 'critical'|'warning'|'info', text: string }[]}
 */
export function assessBattery(n, thresholds = ALERT_DEFAULTS, now = Date.now()) {
  const alerts = [];
  if (!n) return alerts;
  if (n.online === false) alerts.push({ code: "offline", level: "warning", text: "Battery is offline" });
  if (n.updatedAt) {
    const hours = (now - Date.parse(n.updatedAt)) / 3_600_000;
    if (hours >= thresholds.staleHours) alerts.push({ code: "stale", level: "warning", text: `No update for ${Math.floor(hours)} hours` });
  }
  if (n.soc !== null) {
    if (n.soc <= thresholds.criticalSoc) alerts.push({ code: "critical_soc", level: "critical", text: `Charge critically low (${n.soc}%)` });
    else if (n.soc <= thresholds.lowSoc) alerts.push({ code: "low_soc", level: "warning", text: `Charge low (${n.soc}%)` });
  }
  if (n.cellVoltages && n.cellVoltages.length > 1) {
    const delta = Math.max(...n.cellVoltages) - Math.min(...n.cellVoltages);
    if (delta >= thresholds.cellDeltaV) alerts.push({ code: "cell_imbalance", level: "warning", text: `Cell voltages differ by ${delta.toFixed(3)} V` });
  }
  if (n.tempC !== null && n.tempC >= thresholds.tempHighC) alerts.push({ code: "high_temp", level: "critical", text: `Temperature high (${n.tempC}°C)` });
  return alerts;
}

/** Highest alert level, for sorting and badges. */
export function worstLevel(alerts) {
  if (alerts.some((a) => a.level === "critical")) return "critical";
  if (alerts.some((a) => a.level === "warning")) return "warning";
  return "ok";
}

/**
 * Joins registry batteries (ours) with live records (Yunhe's) by battery number, then serial.
 * Every live record appears (unregistered ones are flagged); registry batteries with no live
 * record appear with live = null.
 */
export function joinBatteries(registryBatteries, liveRecords, thresholds = ALERT_DEFAULTS, now = Date.now()) {
  const registry = registryBatteries ?? [];
  const byNumber = new Map(registry.map((b) => [b.battery_number, b]));
  const bySerial = new Map(registry.filter((b) => b.serial_number).map((b) => [b.serial_number, b]));
  const seen = new Set();
  const rows = [];

  for (const raw of liveRecords ?? []) {
    const live = normalizeYunheBattery(raw);
    const match = (live.batteryNumber && byNumber.get(live.batteryNumber)) || (live.serialNumber && bySerial.get(live.serialNumber)) || null;
    if (match) seen.add(match.id);
    const alerts = assessBattery(live, thresholds, now);
    rows.push({ key: match ? match.id : `live:${live.batteryNumber ?? live.serialNumber ?? rows.length}`, registry: match, live, raw, alerts, level: worstLevel(alerts), registered: Boolean(match) });
  }
  for (const battery of registry) {
    if (seen.has(battery.id)) continue;
    rows.push({ key: battery.id, registry: battery, live: null, raw: null, alerts: [], level: "ok", registered: true });
  }
  const order = { critical: 0, warning: 1, ok: 2 };
  return rows.sort((a, b) => order[a.level] - order[b.level] || String(a.registry?.battery_number ?? a.live?.batteryNumber ?? "").localeCompare(String(b.registry?.battery_number ?? b.live?.batteryNumber ?? "")));
}
