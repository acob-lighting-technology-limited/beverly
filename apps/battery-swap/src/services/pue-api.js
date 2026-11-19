/**
 * Beverly PUE registry API client.
 *
 * Talks to /api/v1/pue/* with the staff token and the PUE portal header. Every
 * failure throws PueApiError with a message that is safe to show. Nothing here
 * returns sample data: if the server cannot answer, the caller gets an error.
 */

const BASE = "/api/v1/pue";
const TIMEOUT_MS = 20000;
const TOKEN_KEY = "beverly.battery_swap.access_token";
import { SESSION_EXPIRED_EVENT, refreshSession } from "../lib/session.js";

// The session-expired event and the renewal logic live in lib/session.js; re-exported for App.vue.
export { SESSION_EXPIRED_EVENT };

/** Raised for every failed registry call. `code` mirrors the server's error code. */
export class PueApiError extends Error {
  constructor(message, code = "request_failed", status = 0, details = null) {
    super(message);
    this.name = "PueApiError";
    this.code = code;
    this.status = status;
    // Extra fields the server sent with the error, e.g. { swapId } when a rider already has an open swap.
    this.details = details;
  }
}

function authToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function send(method, path, body, options, token) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Beverly-Portal": "pue",
      // A caller that must be able to retry safely passes its own stable key; otherwise each write gets a fresh one.
      ...(method === "GET" ? {} : { "Idempotency-Key": options.idempotencyKey ?? crypto.randomUUID() })
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
}

async function request(method, path, body, options = {}) {
  let token = authToken();
  if (!token) throw new PueApiError("Sign in to Beverly PUE to continue.", "not_signed_in", 401);
  let response;
  try {
    response = await send(method, path, body, options, token);
    if (response.status === 401) {
      // The access token may simply have run out. Renew it once and retry before giving up on the session.
      // The retry reuses the same idempotency key, so a write can never be applied twice.
      const outcome = await refreshSession();
      if (outcome === "ok") {
        token = authToken();
        response = await send(method, path, body, { ...options, idempotencyKey: options.idempotencyKey ?? crypto.randomUUID() }, token);
      } else if (outcome === "transient") {
        throw new PueApiError("Could not renew your session just now. Check your connection and try again.", "session_refresh_failed", 503);
      }
    }
  } catch (error) {
    if (error instanceof PueApiError) throw error;
    throw new PueApiError("Could not reach Beverly. Check your connection and try again.", "network");
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    // The session really is over. Tell the app shell, which signs out and returns to the login page.
    globalThis.dispatchEvent?.(new CustomEvent(SESSION_EXPIRED_EVENT));
    throw new PueApiError("Your session expired. Sign in again.", "session_expired", 401, data);
  }
  if (!response.ok && !data.message && response.status >= 500) {
    // A bare server error with no body usually means the API is not running (for example the local wallet backend on port 4000).
    throw new PueApiError("Beverly's server did not answer. If you are running this locally, start the wallet backend (port 4000).", "server_unreachable", response.status);
  }
  if (!response.ok) {
    throw new PueApiError(data.message || `Request failed (${response.status}).`, data.error || "request_failed", response.status, data);
  }
  return data;
}

function query(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** Registry resources live under /registry; appliance-types and appliance-units live under /appliances. */
function resourcePath(resource) {
  return resource.startsWith("appliance-") ? `/appliances/${resource.slice("appliance-".length)}` : `/registry/${resource}`;
}

export const pueApi = {
  /** resource: sites | swap-stations | bikes | batteries | riders | appliance-types | appliance-units. Resolves { items, total }. */
  async list(resource, params) {
    const data = await request("GET", `${resourcePath(resource)}${query(params)}`);
    return { items: data.items ?? [], total: data.total ?? 0 };
  },
  async create(resource, body) {
    return (await request("POST", resourcePath(resource), body)).item;
  },
  async update(resource, id, body) {
    return (await request("PATCH", `${resourcePath(resource)}/${id}`, body)).item;
  },

  // ── analytics (read only) ──
  async getSwapAnalytics(days) {
    return (await request("GET", `/analytics/swaps${query({ days })}`)).analytics;
  },
  async getApplianceAnalytics(days) {
    return (await request("GET", `/analytics/appliances${query({ days })}`)).analytics;
  },

  // ── appliances ──
  /** Beverly CRM customers matching a name, phone, email or meter number. */
  async searchCustomers(q) {
    return (await request("GET", `/appliance-customers${query({ q })}`)).items ?? [];
  },
  async listApplianceSales(params) {
    const data = await request("GET", `/appliance-sales${query(params)}`);
    return { items: data.items ?? [], total: data.total ?? 0 };
  },
  async getApplianceSale(id) {
    return (await request("GET", `/appliance-sales/${id}`)).sale;
  },
  async sellAppliance(body) {
    return (await request("POST", "/appliance-sales", body)).sale;
  },
  /** Pass the same idempotencyKey on every retry of one payment. */
  async recordAppliancePayment(id, body, idempotencyKey) {
    return (await request("POST", `/appliance-sales/${id}/payment`, body, { idempotencyKey })).sale;
  },
  async endApplianceSale(id, body) {
    return (await request("POST", `/appliance-sales/${id}/end`, body)).sale;
  },
  async listApplianceFaults(params) {
    const data = await request("GET", `/appliance-faults${query(params)}`);
    return { items: data.items ?? [], total: data.total ?? 0 };
  },
  async reportApplianceFault(body) {
    return (await request("POST", "/appliance-faults", body)).fault;
  },
  async updateApplianceFault(id, body) {
    return (await request("PATCH", `/appliance-faults/${id}`, body)).fault;
  },
  async listSales(params) {
    const data = await request("GET", `/assignments${query(params)}`);
    return { items: data.items ?? [], total: data.total ?? 0 };
  },
  async sell(body) {
    return (await request("POST", "/assignments", body)).assignment;
  },
  async endSale(id, body) {
    return (await request("POST", `/assignments/${id}/end`, body)).assignment;
  },

  // ── swaps ──
  async listSwaps(params) {
    const data = await request("GET", `/swaps${query(params)}`);
    return { items: data.items ?? [], total: data.total ?? 0 };
  },
  async getSwap(id) {
    return (await request("GET", `/swaps/${id}`)).swap;
  },
  async getSwapSettings() {
    return (await request("GET", "/settings")).settings;
  },
  async updateSwapSettings(body) {
    return (await request("PATCH", "/settings", body)).settings;
  },
  /** Reserve a charged battery. Pass the same idempotencyKey on every retry of one attempt. */
  async reserveSwap(body, idempotencyKey) {
    return (await request("POST", "/swaps", body, { idempotencyKey })).swap;
  },
  async recordSwapPayment(id, body, idempotencyKey) {
    return (await request("POST", `/swaps/${id}/payment`, body, { idempotencyKey })).swap;
  },
  async startSwapPaystack(id) {
    return (await request("POST", `/swaps/${id}/paystack`, {})).checkout;
  },
  async verifySwapPaystack(id) {
    return request("POST", `/swaps/${id}/paystack/verify`, {});
  },
  async completeSwap(id, body) {
    return (await request("POST", `/swaps/${id}/complete`, body)).swap;
  },
  async cancelSwap(id, body) {
    return (await request("POST", `/swaps/${id}/cancel`, body)).swap;
  }
};

/** Naira text for a minor-unit amount (kobo). Missing values show a dash, never zero. */
export function nairaFromMinor(minor) {
  if (minor === null || minor === undefined || Number.isNaN(Number(minor))) return "—";
  return `₦${(Number(minor) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Naira typed by a person (e.g. "900,000" or "900000.50") to an integer number of kobo, or null if invalid. */
export function minorFromNaira(text) {
  const cleaned = String(text ?? "").replace(/[₦,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
