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

/** Raised for every failed registry call. `code` mirrors the server's error code. */
export class PueApiError extends Error {
  constructor(message, code = "request_failed", status = 0) {
    super(message);
    this.name = "PueApiError";
    this.code = code;
    this.status = status;
  }
}

function authToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function request(method, path, body) {
  const token = authToken();
  if (!token) throw new PueApiError("Sign in to Beverly PUE to continue.", "not_signed_in", 401);
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Beverly-Portal": "pue",
        ...(method === "GET" ? {} : { "Idempotency-Key": crypto.randomUUID() })
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch {
    throw new PueApiError("Could not reach Beverly. Check your connection and try again.", "network");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new PueApiError(data.message || `Request failed (${response.status}).`, data.error || "request_failed", response.status);
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

export const pueApi = {
  /** resource: sites | swap-stations | bikes | batteries | riders. Resolves { items, total }. */
  async list(resource, params) {
    const data = await request("GET", `/registry/${resource}${query(params)}`);
    return { items: data.items ?? [], total: data.total ?? 0 };
  },
  async create(resource, body) {
    return (await request("POST", `/registry/${resource}`, body)).item;
  },
  async update(resource, id, body) {
    return (await request("PATCH", `/registry/${resource}/${id}`, body)).item;
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
