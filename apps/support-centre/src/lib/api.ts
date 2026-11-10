/**
 * Beverly Support Centre API client
 * Mirrors the admin portal api.ts pattern — uses staff access token from localStorage.
 * Base URL auto-resolves from VITE_API_BASE or falls back to same-origin.
 */

function normalizeBaseUrl(rawBase: unknown): string {
  const base = String(rawBase ?? '').trim().replace(/\/+$/, '');
  if (!base) return '';
  if (typeof window === 'undefined') return base;
  try {
    const apiUrl = new URL(base, window.location.origin);
    const pageUrl = new URL(window.location.origin);
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    if (localHosts.has(apiUrl.hostname) && localHosts.has(pageUrl.hostname) && apiUrl.origin !== pageUrl.origin) return '';
  } catch { return base; }
  return base;
}

const BASE = normalizeBaseUrl(import.meta.env.VITE_API_BASE);
const STAFF_ACCESS_TOKEN_KEY = 'beverly.staff.access_token';
const REQUEST_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message); this.name = 'ApiError';
  }
}

function getToken(): string | null {
  try { return localStorage.getItem(STAFF_ACCESS_TOKEN_KEY); } catch { return null; }
}

function parseJson(text: string): any {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function unwrapEnvelope<T>(json: any): T {
  if (json && typeof json === 'object' && ('data' in json || 'result' in json) && ('code' in json || 'msg' in json)) {
    return (json.data ?? json.result) as T;
  }
  return json as T;
}

async function request<T>(method: string, path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const hasBody = body !== undefined;
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> ?? {}),
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      ...init,
    });
    clearTimeout(timeout);
    const text = await res.text();
    const json = parseJson(text);
    if (!res.ok) {
      const code = json?.code ?? json?.error ?? 'unknown';
      const msg = json?.message ?? json?.msg ?? res.statusText;
      throw new ApiError(res.status, code, msg, json);
    }
    return unwrapEnvelope<T>(json);
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'network_error', (err as Error).message ?? 'Network error');
  }
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>('GET', path, undefined, init),
  post: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>('POST', path, body, init),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>('PATCH', path, body, init),
  put: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>('PUT', path, body, init),
  del: <T>(path: string, init?: RequestInit) => request<T>('DELETE', path, undefined, init),
};
