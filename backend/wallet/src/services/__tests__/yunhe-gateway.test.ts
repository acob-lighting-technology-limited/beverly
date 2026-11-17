import { beforeEach, describe, expect, it, vi } from 'vitest';

const cfg = vi.hoisted(() => ({
    env: { YUNHE_LOGIN_NAME: 'svc-user' as string | undefined, YUNHE_PASSWORD: 'svc-pass' as string | undefined, YUNHE_GPS_BASE_URL: 'https://yunhe.example.test' },
}));
vi.mock('../../config/env.js', () => ({ env: cfg.env }));

import { resetYunheSession, yunheCommand, yunheQuery, YunheGatewayError } from '../yunhe-gateway.js';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const loginOk = () => json({ code: 200, token: 'tok-1', mer_id: 'MER-1' });
const calls = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), body: JSON.parse(String((init as RequestInit).body)) }));

beforeEach(() => {
    resetYunheSession();
    cfg.env.YUNHE_LOGIN_NAME = 'svc-user';
    cfg.env.YUNHE_PASSWORD = 'svc-pass';
});

describe('yunhe gateway: truth rules', () => {
    it('refuses to run, and calls nothing, when credentials are not configured', async () => {
        cfg.env.YUNHE_PASSWORD = undefined;
        const fetchMock = vi.fn();
        await expect(yunheQuery('getBattery', {}, fetchMock as unknown as typeof fetch)).rejects.toMatchObject({ code: 'yunhe_not_configured', statusCode: 503 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns only what the platform answered, using the session merchant id', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(loginOk())
            .mockResolvedValueOnce(json({ code: 200, msg: 'success', data: { list: [{ sn: 'B1', soc: 81 }] } }));
        const result = await yunheQuery('getBattery', { mer_id: 'ATTACKER', page: 1 }, fetchMock as unknown as typeof fetch);
        expect(result.data).toEqual({ list: [{ sn: 'B1', soc: 81 }] });
        const [login, query] = calls(fetchMock);
        expect(login?.url).toBe('https://yunhe.example.test/battery/login');
        expect(login?.body).toEqual({ login_name: 'svc-user', password: 'svc-pass' });
        expect(query?.url).toBe('https://yunhe.example.test/battery/businessGateway');
        expect(query?.body.business).toEqual({ page: 1, mer_id: 'MER-1' });
        expect(JSON.stringify(query?.body)).not.toContain('svc-pass');
    });

    it('fails instead of inventing data when the platform is unreachable', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
        const error = await yunheQuery('getBattery', {}, fetchMock as unknown as typeof fetch).catch((e) => e);
        expect(error).toBeInstanceOf(YunheGatewayError);
        expect(error).toMatchObject({ code: 'yunhe_unreachable', statusCode: 502 });
    });

    it('fails on an HTTP error or an unreadable body', async () => {
        await expect(yunheQuery('getStation', {}, vi.fn().mockResolvedValue(json({}, 500)) as unknown as typeof fetch)).rejects.toMatchObject({ code: 'yunhe_unreachable' });
        resetYunheSession();
        await expect(yunheQuery('getStation', {}, vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })) as unknown as typeof fetch)).rejects.toMatchObject({ code: 'yunhe_bad_response' });
    });

    it('reports a rejected sign-in', async () => {
        const fetchMock = vi.fn().mockResolvedValue(json({ code: 401, msg: 'bad credentials' }));
        await expect(yunheQuery('getBattery', {}, fetchMock as unknown as typeof fetch)).rejects.toMatchObject({ code: 'yunhe_auth_failed' });
    });

    it('reuses the session between calls', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(loginOk())
            .mockImplementation(async () => json({ code: 200, data: {} }));
        await yunheQuery('getBattery', {}, fetchMock as unknown as typeof fetch);
        await yunheQuery('getStation', {}, fetchMock as unknown as typeof fetch);
        expect(calls(fetchMock).filter((c) => c.url.endsWith('/battery/login'))).toHaveLength(1);
    });

    it('signs in again once when the token has expired, for a read', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(loginOk())
            .mockResolvedValueOnce(json({ code: 401, msg: 'token expired' }))
            .mockResolvedValueOnce(json({ code: 200, token: 'tok-2', mer_id: 'MER-1' }))
            .mockResolvedValueOnce(json({ code: 200, data: { list: [] } }));
        const result = await yunheQuery('getBattery', {}, fetchMock as unknown as typeof fetch);
        expect(result.data).toEqual({ list: [] });
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });
});

describe('yunhe gateway: physical commands', () => {
    it('is confirmed only when the platform answers code 200', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(loginOk())
            .mockResolvedValueOnce(json({ code: 200, msg: 'received', data: { status: 'acknowledged' } }));
        const receipt = await yunheCommand('bat_reboot', { battery_id: 'BT1' }, fetchMock as unknown as typeof fetch);
        expect(receipt).toEqual({ confirmed: true, func: 'bat_reboot', providerMessage: 'received', providerData: { status: 'acknowledged' } });
        expect(calls(fetchMock)[1]?.url).toBe('https://yunhe.example.test/battery/commandGateway');
    });

    it('throws, never confirms, when the platform refuses', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(loginOk())
            .mockResolvedValueOnce(json({ code: 500, msg: 'battery offline' }));
        await expect(yunheCommand('bat_control', { battery_id: 'BT1', charge_fet: 1, discharge_fet: 0 }, fetchMock as unknown as typeof fetch))
            .rejects.toMatchObject({ code: 'yunhe_rejected', message: 'battery offline' });
    });

    it('throws when the network fails, and sends the command only once', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(loginOk())
            .mockRejectedValueOnce(new TypeError('socket hang up'));
        await expect(yunheCommand('bat_reboot', { battery_id: 'BT1' }, fetchMock as unknown as typeof fetch)).rejects.toMatchObject({ code: 'yunhe_unreachable' });
        expect(calls(fetchMock).filter((c) => c.url.endsWith('/battery/commandGateway'))).toHaveLength(1);
    });
});
