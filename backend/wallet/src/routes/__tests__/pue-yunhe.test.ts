import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ query: vi.fn(), command: vi.fn() }));
const audit = vi.hoisted(() => ({ log: vi.fn(async () => true) }));

vi.mock('../../services/audit.js', () => ({ logAction: audit.log }));
vi.mock('../../services/yunhe-gateway.js', async (importOriginal) => {
    const real = await importOriginal<typeof import('../../services/yunhe-gateway.js')>();
    return { ...real, yunheQuery: svc.query, yunheCommand: svc.command };
});

import { YunheGatewayError } from '../../services/yunhe-gateway.js';
import pueYunheRoutes from '../pue-yunhe.js';

async function app(role: string) {
    const instance = Fastify();
    instance.decorate('requireStaff', () => async (req) => {
        req.actor = { userId: 'u-1', actorId: 'u-1', email: null, type: 'staff', role, mfaVerified: true, stationIds: ['*'] };
    });
    await instance.register(pueYunheRoutes, { prefix: '/api/v1/pue' });
    return instance;
}

const post = (instance: Awaited<ReturnType<typeof app>>, path: string, payload: unknown) =>
    instance.inject({ method: 'POST', url: `/api/v1/pue/yunhe/${path}`, payload: payload as object });
const actions = () => audit.log.mock.calls.map(([entry]) => (entry as { action: string }).action);

beforeEach(() => { vi.clearAllMocks(); });

describe('POST /api/v1/pue/yunhe/query', () => {
    it('returns the platform data', async () => {
        svc.query.mockResolvedValue({ code: 200, data: { list: [{ sn: 'B1' }] } });
        const instance = await app('account');
        try {
            const response = await post(instance, 'query', { func: 'getBattery', business: { page: 1 } });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toMatchObject({ ok: true, data: { list: [{ sn: 'B1' }] } });
        } finally { await instance.close(); }
    });

    it('reports an outage as an error, with no data', async () => {
        svc.query.mockRejectedValue(new YunheGatewayError('yunhe_unreachable', 'The battery platform could not be reached.', 502));
        const instance = await app('account');
        try {
            const response = await post(instance, 'query', { func: 'getBattery' });
            expect(response.statusCode).toBe(502);
            expect(response.json()).toEqual({ error: 'yunhe_unreachable', message: 'The battery platform could not be reached.' });
        } finally { await instance.close(); }
    });

    it('rejects a function that is not on the allowlist', async () => {
        const instance = await app('account');
        try {
            const response = await post(instance, 'query', { func: 'bat_control' });
            expect(response.statusCode).not.toBe(200);
            expect(svc.query).not.toHaveBeenCalled();
        } finally { await instance.close(); }
    });
});

describe('POST /api/v1/pue/yunhe/command', () => {
    const cutoff = { func: 'bat_control', batteryId: 'BT107204512', allowDischarge: false, reason: 'Lease overdue 30 days' };

    it('forbids roles that cannot act on hardware, and sends nothing', async () => {
        const instance = await app('finance-checker');
        try {
            const response = await post(instance, 'command', cutoff);
            expect(response.statusCode).toBe(403);
            expect(svc.command).not.toHaveBeenCalled();
            expect(audit.log).not.toHaveBeenCalled();
        } finally { await instance.close(); }
    });

    it('confirms only with a provider receipt, and audits request then confirmation', async () => {
        svc.command.mockResolvedValue({ confirmed: true, func: 'bat_control', providerMessage: 'ok', providerData: null });
        const instance = await app('operations-officer');
        try {
            const response = await post(instance, 'command', cutoff);
            expect(response.statusCode).toBe(200);
            expect(response.json()).toMatchObject({ ok: true, confirmed: true, receipt: { confirmed: true } });
            expect(svc.command).toHaveBeenCalledWith('bat_control', { battery_id: 'BT107204512', charge_fet: 1, discharge_fet: 0 });
            expect(actions()).toEqual(['pue.battery_command.requested', 'pue.battery_command.confirmed']);
        } finally { await instance.close(); }
    });

    it('says not confirmed when the platform refuses, and audits the failure', async () => {
        svc.command.mockRejectedValue(new YunheGatewayError('yunhe_rejected', 'battery offline', 502));
        const instance = await app('super-admin');
        try {
            const response = await post(instance, 'command', { func: 'bat_reboot', batteryId: 'BT107204512', reason: 'No heartbeat' });
            expect(response.statusCode).toBe(502);
            expect(response.json()).toMatchObject({ confirmed: false, error: 'yunhe_rejected', message: 'battery offline' });
            expect(actions()).toEqual(['pue.battery_command.requested', 'pue.battery_command.failed']);
        } finally { await instance.close(); }
    });

    it('maps charge and discharge switches independently', async () => {
        svc.command.mockResolvedValue({ confirmed: true, func: 'bat_control', providerMessage: 'ok', providerData: null });
        const instance = await app('super-admin');
        try {
            await post(instance, 'command', { ...cutoff, allowCharge: false, allowDischarge: false });
            expect(svc.command).toHaveBeenLastCalledWith('bat_control', { battery_id: 'BT107204512', charge_fet: 0, discharge_fet: 0 });
            await post(instance, 'command', { ...cutoff, allowDischarge: true });
            expect(svc.command).toHaveBeenLastCalledWith('bat_control', { battery_id: 'BT107204512', charge_fet: 1, discharge_fet: 1 });
        } finally { await instance.close(); }
    });

    it('requires a reason and a safe battery id before anything is sent', async () => {
        const instance = await app('super-admin');
        try {
            expect((await post(instance, 'command', { ...cutoff, reason: '' })).statusCode).not.toBe(200);
            expect((await post(instance, 'command', { ...cutoff, batteryId: 'x/../y' })).statusCode).not.toBe(200);
            expect(svc.command).not.toHaveBeenCalled();
        } finally { await instance.close(); }
    });
});
