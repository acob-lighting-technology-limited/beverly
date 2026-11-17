/**
 * Yunhe battery client for Beverly PUE.
 *
 * Talks ONLY to the Beverly backend gateway (/api/v1/pue/yunhe/*). The Yunhe
 * credentials live on the server; this file holds none and never contacts Yunhe.
 *
 * Truth rules (AGENTS.md section 4):
 *   - If the platform cannot be reached, these functions THROW. They never
 *     return sample batteries or pretend a command worked.
 *   - A command function resolves only with a provider receipt
 *     ({ confirmed: true }). Callers must change hardware state in the UI only
 *     after it resolves.
 *
 * Copied identically to src/services/ (CRM root) until the CRM copy is retired.
 */

const GATEWAY = "/api/v1/pue/yunhe";
const TIMEOUT_MS = 20000;
const TOKEN_KEY = "beverly.battery_swap.access_token";

/** Raised whenever live battery data or a hardware command is not available. */
export class YunheUnavailableError extends Error {
  constructor(message, code = "yunhe_unavailable") {
    super(message);
    this.name = "YunheUnavailableError";
    this.code = code;
  }
}

function authToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function gatewayPost(path, body) {
  const token = authToken();
  if (!token) {
    throw new YunheUnavailableError("Sign in to Beverly PUE to use live battery data.", "not_signed_in");
  }
  let response;
  try {
    response = await fetch(`${GATEWAY}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Beverly-Portal": "pue"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch {
    throw new YunheUnavailableError("Could not reach Beverly. Check your connection and try again.", "network");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new YunheUnavailableError(data.message || `Request failed (${response.status}).`, data.error || "request_failed");
  }
  return data;
}

async function query(func, business = {}) {
  const result = await gatewayPost("query", { func, business });
  return result.data;
}

/** Live battery list from Yunhe. Throws if unavailable; [] only when Yunhe returns an empty list. */
export async function fetchYunheBatteries(params = {}) {
  const data = await query("getBattery", params);
  if (!data || !Array.isArray(data.list)) {
    throw new YunheUnavailableError("The battery platform returned an unexpected response.", "bad_response");
  }
  return data.list;
}

/** Live station list from Yunhe. Throws if unavailable. */
export async function fetchYunheStations(params = {}) {
  const data = await query("getStation", params);
  if (!data || !Array.isArray(data.list)) {
    throw new YunheUnavailableError("The battery platform returned an unexpected response.", "bad_response");
  }
  return data.list;
}

/** Battery mileage and trip history. Throws if unavailable. */
export async function fetchBatteryMileage(batteryId, startTime, endTime) {
  return query("getBatteryMileageHistory", { battery_id: batteryId, start_time: startTime, end_time: endTime });
}

/**
 * Set the charge and discharge switches (FETs) on a battery.
 * Resolves only with a Yunhe receipt; throws otherwise.
 */
export async function setBatteryFets(batteryId, { allowCharge = true, allowDischarge, reason }) {
  const result = await gatewayPost("command", { func: "bat_control", batteryId, allowCharge, allowDischarge, reason });
  if (result.confirmed !== true) {
    throw new YunheUnavailableError("The battery platform did not confirm the command.", "not_confirmed");
  }
  return result.receipt;
}

/** Remote reboot of the battery communication unit (DTU). Resolves only with a Yunhe receipt. */
export async function rebootBatteryDTU(batteryId, reason) {
  const result = await gatewayPost("command", { func: "bat_reboot", batteryId, reason });
  if (result.confirmed !== true) {
    throw new YunheUnavailableError("The battery platform did not confirm the command.", "not_confirmed");
  }
  return result.receipt;
}
