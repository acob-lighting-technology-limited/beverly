/**
 * Yunhe battery IoT gateway (Beverly PUE).
 *
 * Server-side only. Credentials come from env (YUNHE_LOGIN_NAME / YUNHE_PASSWORD)
 * and never reach the browser. Truth rules (AGENTS.md section 4):
 *   - Never invent telemetry. A failure is an error, not sample data.
 *   - A physical command (battery cutoff, DTU reboot) is "confirmed" only when
 *     Yunhe itself answers code 200. Anything else is a failure the caller must show.
 *   - Commands are never retried automatically: a retry could act twice on hardware.
 *
 * Used by: routes/pue-yunhe.ts. Consumed by: apps/battery-swap (through that route).
 */
import { env } from '../config/env.js';

/** Read-only lookups the PUE app may request. */
export const YUNHE_QUERY_FUNCS = ['getBattery', 'getStation', 'getBatteryMileageHistory'] as const;
/** Commands that act on physical batteries. */
export const YUNHE_COMMAND_FUNCS = ['bat_control', 'bat_reboot'] as const;

export type YunheQueryFunc = (typeof YUNHE_QUERY_FUNCS)[number];
export type YunheCommandFunc = (typeof YUNHE_COMMAND_FUNCS)[number];

export class YunheGatewayError extends Error {
    constructor(public code: 'yunhe_not_configured' | 'yunhe_unreachable' | 'yunhe_auth_failed' | 'yunhe_rejected' | 'yunhe_bad_response', message: string, public statusCode: number) {
        super(message);
        this.name = 'YunheGatewayError';
    }
}

type FetchLike = typeof fetch;
interface Session { token: string; merId: string; expiresAt: number }
type YunheEnvelope = { code?: number | string; msg?: string; token?: string; mer_id?: string; data?: Record<string, unknown> | null };

/** Yunhe tokens last about two hours; renew a little early. */
const SESSION_MS = 100 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

let cached: Session | null = null;

/** Test hook: forget the cached session. */
export function resetYunheSession(): void { cached = null; }

const isOk = (value: unknown): boolean => value === 200 || value === '200';

async function post(fetchImpl: FetchLike, path: string, body: unknown): Promise<YunheEnvelope> {
    let response: Response;
    try {
        response = await fetchImpl(`${env.YUNHE_GPS_BASE_URL.replace(/\/+$/, '')}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    } catch {
        throw new YunheGatewayError('yunhe_unreachable', 'The battery platform could not be reached.', 502);
    }
    if (!response.ok) throw new YunheGatewayError('yunhe_unreachable', `The battery platform answered HTTP ${response.status}.`, 502);
    try {
        return await response.json() as YunheEnvelope;
    } catch {
        throw new YunheGatewayError('yunhe_bad_response', 'The battery platform returned an unreadable response.', 502);
    }
}

async function login(fetchImpl: FetchLike): Promise<Session> {
    if (!env.YUNHE_LOGIN_NAME || !env.YUNHE_PASSWORD) {
        throw new YunheGatewayError('yunhe_not_configured', 'The battery platform is not configured for this deployment.', 503);
    }
    const result = await post(fetchImpl, '/battery/login', { login_name: env.YUNHE_LOGIN_NAME, password: env.YUNHE_PASSWORD });
    const token = result.token ?? (result.data?.token as string | undefined);
    const merId = result.mer_id ?? (result.data?.mer_id as string | undefined);
    if (!isOk(result.code) && !token) throw new YunheGatewayError('yunhe_auth_failed', 'The battery platform rejected the sign-in.', 502);
    if (!token || !merId) throw new YunheGatewayError('yunhe_auth_failed', 'The battery platform sign-in did not return a session.', 502);
    return { token, merId, expiresAt: Date.now() + SESSION_MS };
}

async function session(fetchImpl: FetchLike): Promise<Session> {
    if (cached && cached.expiresAt > Date.now()) return cached;
    cached = await login(fetchImpl);
    return cached;
}

async function gateway(path: '/battery/businessGateway' | '/battery/commandGateway', func: string, business: Record<string, unknown>, fetchImpl: FetchLike, retryAuth: boolean): Promise<YunheEnvelope> {
    const current = await session(fetchImpl);
    // The merchant id always comes from the authenticated session, never from the caller.
    const result = await post(fetchImpl, path, { func, token: current.token, business: { ...business, mer_id: current.merId } });
    const expired = /token|login|auth/i.test(String(result.msg ?? '')) && !isOk(result.code);
    if (expired && retryAuth) {
        // Re-authenticating is safe for reads. For commands the request was refused, not run.
        cached = null;
        return gateway(path, func, business, fetchImpl, false);
    }
    return result;
}

/** Read-only lookup. Returns Yunhe's own data, or throws. */
export async function yunheQuery(func: YunheQueryFunc, business: Record<string, unknown> = {}, fetchImpl: FetchLike = fetch): Promise<{ code: number | string | undefined; data: Record<string, unknown> | null }> {
    const result = await gateway('/battery/businessGateway', func, business, fetchImpl, true);
    if (!isOk(result.code)) throw new YunheGatewayError('yunhe_rejected', result.msg || 'The battery platform rejected the request.', 502);
    return { code: result.code, data: result.data ?? null };
}

export interface YunheCommandReceipt { confirmed: true; func: YunheCommandFunc; providerMessage: string; providerData: Record<string, unknown> | null }

/**
 * Sends a physical command once. Resolves only when Yunhe confirms with code 200;
 * throws YunheGatewayError otherwise. The caller must not mark hardware state
 * changed unless this resolves.
 */
export async function yunheCommand(func: YunheCommandFunc, business: Record<string, unknown>, fetchImpl: FetchLike = fetch): Promise<YunheCommandReceipt> {
    const result = await gateway('/battery/commandGateway', func, business, fetchImpl, true);
    if (!isOk(result.code)) throw new YunheGatewayError('yunhe_rejected', result.msg || 'The battery platform did not confirm the command.', 502);
    return { confirmed: true, func, providerMessage: String(result.msg ?? ''), providerData: result.data ?? null };
}
