/**
 * Keeps a Beverly PUE staff session alive.
 *
 * Sign-in returns a short-lived access token (about an hour) and a refresh token. PUE used to keep only the
 * access token, so every session ended at the one-hour mark, and a tab left in the background (where timers
 * are slowed) often ended sooner. Now the refresh token is kept, the access token is renewed shortly before it
 * expires, and a 401 from the API is retried once after a renewal.
 *
 * A renewal has three outcomes, and only one signs the person out:
 *   "ok"        a new access token is stored.
 *   "terminal"  the server says the session is over (refresh rejected, access removed): sign out.
 *   "transient" the server or network could not be reached: keep the session and try again soon.
 * Several tabs share one refresh token, so renewals run under a Web Lock and a tab that finds a fresh token
 * already stored simply uses it.
 */
export const SESSION_EXPIRED_EVENT = "pue:session-expired";
export const SESSION_REFRESHED_EVENT = "pue:session-refreshed";

const KEYS = {
  token: "beverly.battery_swap.access_token",
  user: "beverly.battery_swap.user",
  refresh: "beverly.battery_swap.refresh_token",
  expires: "beverly.battery_swap.expires_at"
};
const REFRESH_URL = "/api/v1/admin/auth/password-refresh";
/** Renew this long before expiry. */
const LEAD_MS = 5 * 60 * 1000;
const RETRY_MS = 30 * 1000;
const FALLBACK_MS = 40 * 60 * 1000;

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { if (value === null || value === undefined) localStorage.removeItem(key); else localStorage.setItem(key, String(value)); } catch {} };

/** Expiry of a JWT in ms since epoch, or null when it cannot be read. */
export function tokenExpiryMs(token) {
  try {
    const payload = JSON.parse(atob(String(token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Saves the refresh token and expiry that came with a sign-in or a renewal. */
export function storeRefresh({ refreshToken, expiresAt }) {
  write(KEYS.refresh, refreshToken ?? null);
  write(KEYS.expires, typeof expiresAt === "number" ? expiresAt : null);
}
export function clearRefresh() {
  write(KEYS.refresh, null);
  write(KEYS.expires, null);
}
export const hasRefreshToken = () => Boolean(read(KEYS.refresh));

/** When the current access token ends, in ms since epoch. */
function currentExpiryMs() {
  const stored = Number(read(KEYS.expires));
  if (Number.isFinite(stored) && stored > 0) return stored * 1000;
  return tokenExpiryMs(read(KEYS.token));
}

async function withLock(task) {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  return locks?.request ? locks.request("beverly-pue-refresh", task) : task();
}

let inflight = null;

/** Renews the access token. Resolves "ok", "terminal", "transient" or "none" (no refresh token was ever stored). */
export function refreshSession() {
  if (!hasRefreshToken()) return Promise.resolve("none");
  if (!inflight) {
    inflight = withLock(async () => {
      // Another tab may have renewed while this one waited for the lock: if a newer token is stored, use it.
      const stored = read(KEYS.token);
      const expiry = currentExpiryMs();
      if (stored && stored !== sessionStartedWith && expiry && expiry - Date.now() > 2 * 60 * 1000) {
        sessionStartedWith = stored;
        let user = null;
        try { user = JSON.parse(read(KEYS.user) || "null"); } catch {}
        globalThis.dispatchEvent?.(new CustomEvent(SESSION_REFRESHED_EVENT, { detail: { accessToken: stored, user } }));
        return "ok";
      }
      const refreshToken = read(KEYS.refresh);
      if (!refreshToken) return "none";
      let response;
      try {
        response = await fetch(REFRESH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Beverly-Portal": "pue" },
          body: JSON.stringify({ refresh_token: refreshToken, portal: "pue" }),
          signal: AbortSignal.timeout(20000)
        });
      } catch {
        return "transient";
      }
      const data = await response.json().catch(() => ({}));
      if (response.status >= 500 || response.status === 429 || (!response.ok && response.status !== 401 && response.status !== 403)) return "transient";
      if (!response.ok || !data.access_token) return "terminal";
      write(KEYS.token, data.access_token);
      storeRefresh({ refreshToken: data.refresh_token ?? refreshToken, expiresAt: data.expires_at });
      if (data.user) write(KEYS.user, JSON.stringify({ ...JSON.parse(read(KEYS.user) || "{}"), ...data.user }));
      sessionStartedWith = data.access_token;
      globalThis.dispatchEvent?.(new CustomEvent(SESSION_REFRESHED_EVENT, { detail: { accessToken: data.access_token, user: data.user ?? null } }));
      return "ok";
    }).finally(() => { inflight = null; });
  }
  return inflight;
}
let sessionStartedWith = null;

/* ── The keeper: renews ahead of expiry, and again whenever a hidden tab comes back ── */
let timer = 0;
let running = false;

function schedule(delayMs) {
  clearTimeout(timer);
  timer = setTimeout(tick, Math.max(1000, delayMs));
}

async function tick() {
  if (!running) return;
  const outcome = await refreshSession();
  if (!running) return;
  if (outcome === "terminal") {
    globalThis.dispatchEvent?.(new CustomEvent(SESSION_EXPIRED_EVENT));
    return;
  }
  if (outcome === "transient") return schedule(RETRY_MS);
  const expiry = currentExpiryMs();
  schedule(expiry ? expiry - Date.now() - LEAD_MS : FALLBACK_MS);
}

function onVisible() {
  if (typeof document === "undefined" || document.visibilityState !== "visible" || !running) return;
  const expiry = currentExpiryMs();
  // Timers run slowly in hidden tabs, so check on return instead of trusting the timer.
  if (!expiry || expiry - Date.now() < LEAD_MS * 2) void tick();
}

export function startSessionKeeper() {
  if (running) return;
  running = true;
  sessionStartedWith = read(KEYS.token);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onVisible);
  const expiry = currentExpiryMs();
  schedule(expiry ? expiry - Date.now() - LEAD_MS : FALLBACK_MS);
  if (!expiry || expiry - Date.now() < LEAD_MS) void tick();
}

export function stopSessionKeeper() {
  running = false;
  clearTimeout(timer);
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
  if (typeof window !== "undefined") window.removeEventListener("online", onVisible);
}
