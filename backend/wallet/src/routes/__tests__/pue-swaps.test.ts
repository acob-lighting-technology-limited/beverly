import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Op = { op: string; args: unknown[] };
type Call = { table: string; ops: Op[]; terminal: string };
type Result = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number };

const fake = vi.hoisted(() => ({
    handler: ((_call: unknown) => ({ data: null, error: null })) as (call: Call) => Result,
    rpc: ((_name: string, _args: unknown) => ({ data: null, error: null })) as (name: string, args: Record<string, unknown>) => Result,
    calls: [] as Call[],
    rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
}));
const audit = vi.hoisted(() => ({ log: vi.fn(async () => true) }));
const yunhe = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../../services/audit.js', () => ({ logAction: audit.log }));
vi.mock('../../services/yunhe-gateway.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../services/yunhe-gateway.js')>()), yunheQuery: yunhe.query }));
vi.mock('../../services/pue-swap-paystack.js', () => ({
    startPaystackPayment: vi.fn(async () => ({ reference: 'pue-swap-x-1', authorizationUrl: 'https://paystack.test/x', amountMinor: 130000, reused: false })),
    verifyPaystackForSwap: vi.fn(async () => ({ results: [] })),
}));
vi.mock('../../db/supabase.js', () => ({
    adminClient: {
        from: (table: string) => {
            const ops: Op[] = [];
            const finish = (terminal: string) => { const call = { table, ops: [...ops], terminal }; fake.calls.push(call); return { error: null, ...fake.handler(call) }; };
            const chain: any = new Proxy({}, {
                get: (_t, prop) => {
                    if (prop === 'then') return (resolve: (v: Result) => void) => resolve(finish('await'));
                    if (prop === 'single' || prop === 'maybeSingle') return async () => finish(String(prop));
                    return (...args: unknown[]) => { ops.push({ op: String(prop), args }); return chain; };
                },
            });
            return chain;
        },
        rpc: async (name: string, args: Record<string, unknown>) => { fake.rpcCalls.push({ name, args }); return { error: null, ...fake.rpc(name, args) }; },
    },
}));

import pueSwapRoutes from '../pue-swaps.js';
import { YunheGatewayError } from '../../services/yunhe-gateway.js';

const RIDER = '11111111-1111-4111-8111-111111111111';
const STATION = '22222222-2222-4222-8222-222222222222';
const SWAP = '33333333-3333-4333-8333-333333333333';
const BAT_A = '44444444-4444-4444-8444-444444444444';
const BAT_B = '55555555-5555-4555-8555-555555555555';
const KEY = 'idem-key-12345';
const fresh = new Date(Date.now() - 10 * 60_000).toISOString();

const swapRow = (over: Record<string, unknown> = {}) => ({
    id: SWAP, rider_id: RIDER, station_id: STATION, bike_id: 'bike-1', battery_out_id: BAT_A, battery_in_id: null, price_minor: 130000,
    status: 'reserved', reservation_code: 'ABC234', reserved_until: new Date(Date.now() + 20 * 60_000).toISOString(),
    paid_at: null, completed_at: null, cancelled_at: null, cancel_reason: null, created_at: new Date().toISOString(), ...over,
});
const settingsRows = [{ key: 'swap_price_minor', value: 130000 }, { key: 'swap_min_soc', value: 90 }, { key: 'swap_reservation_minutes', value: 30 }, { key: 'swap_max_reading_age_minutes', value: 120 }];

/** Default database answers for a normal reserve. Tests override pieces. */
function standardDb(over: { existingByKey?: unknown; openForRider?: unknown; inBay?: unknown[]; openSwaps?: unknown[] } = {}) {
    fake.handler = (call) => {
        const eq = (col: string) => call.ops.find((o) => o.op === 'eq' && o.args[0] === col)?.args[1];
        if (call.table === 'pue_settings') return { data: settingsRows };
        if (call.table === 'pue_swaps' && eq('idempotency_key')) return { data: over.existingByKey ?? null };
        if (call.table === 'pue_swaps' && eq('rider_id')) return { data: over.openForRider ?? null };
        if (call.table === 'pue_batteries') return { data: over.inBay ?? [{ id: BAT_A, battery_number: 'BT-A', serial_number: null }, { id: BAT_B, battery_number: 'BT-B', serial_number: null }] };
        if (call.table === 'pue_swaps') return { data: over.openSwaps ?? [] };
        return { data: null };
    };
    fake.rpc = (name) => (name === 'pue_reserve_swap' ? { data: swapRow() } : { data: swapRow() });
}

async function app(role: string) {
    const instance = Fastify();
    instance.decorate('requireStaff', () => async (req) => { req.actor = { userId: 'u-1', actorId: 'u-1', email: null, type: 'staff', role, mfaVerified: true, stationIds: ['*'] }; });
    await instance.register(pueSwapRoutes, { prefix: '/api/v1/pue' });
    return instance;
}
const send = (i: Awaited<ReturnType<typeof app>>, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown, key: string | null = KEY) =>
    i.inject({ method, url: `/api/v1/pue${url}`, headers: key ? { 'idempotency-key': key } : {}, ...(payload === undefined ? {} : { payload: payload as object }) });
const actions = () => audit.log.mock.calls.map(([e]) => (e as { action: string }).action);

beforeEach(() => { vi.clearAllMocks(); fake.calls = []; fake.rpcCalls = []; standardDb(); yunhe.query.mockResolvedValue({ code: 200, data: { list: [{ id: 'BT-A', soc: 93, last_time: fresh }, { id: 'BT-B', soc: 99, last_time: fresh }] } }); });

describe('reserving a swap', () => {
    it('picks the most charged live battery, reserves it, and audits', async () => {
        const i = await app('operations-officer');
        try {
            const response = await send(i, 'POST', '/swaps', { riderId: RIDER, stationId: STATION });
            expect(response.statusCode, response.body).toBe(201);
            const reserve = fake.rpcCalls.find((c) => c.name === 'pue_reserve_swap')!;
            expect(reserve.args).toMatchObject({ p_rider_id: RIDER, p_station_id: STATION, p_battery_id: BAT_B, p_idempotency_key: KEY, p_actor: 'u-1' });
            expect(String(reserve.args.p_code)).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
            expect(response.json().swap).toMatchObject({ status: 'reserved', priceMinor: 130000, chargeAtReservation: 99 });
            expect(actions()).toEqual(['pue.swap.reserved']);
        } finally { await i.close(); }
    });

    it('refuses to start without live charge levels, and reserves nothing', async () => {
        yunhe.query.mockRejectedValue(new YunheGatewayError('yunhe_unreachable', 'The battery platform could not be reached.', 502));
        const i = await app('operations-officer');
        try {
            const response = await send(i, 'POST', '/swaps', { riderId: RIDER, stationId: STATION });
            expect(response.statusCode).toBe(503);
            expect(response.json()).toMatchObject({ error: 'readings_unavailable' });
            expect(fake.rpcCalls).toEqual([]);
        } finally { await i.close(); }
    });

    it('refuses when no battery is charged enough, saying why', async () => {
        yunhe.query.mockResolvedValue({ code: 200, data: { list: [{ id: 'BT-A', soc: 50, last_time: fresh }, { id: 'BT-B', soc: 70, last_time: fresh }] } });
        const i = await app('operations-officer');
        try {
            const response = await send(i, 'POST', '/swaps', { riderId: RIDER, stationId: STATION });
            expect(response.statusCode).toBe(409);
            expect(response.json()).toMatchObject({ error: 'no_charged_battery_none_charged' });
            expect(response.json().message).toContain('90%');
            expect(fake.rpcCalls).toEqual([]);
        } finally { await i.close(); }
    });

    it('does not offer a battery already promised to another open swap', async () => {
        standardDb({ openSwaps: [{ battery_out_id: BAT_B }] });
        const i = await app('operations-officer');
        try {
            await send(i, 'POST', '/swaps', { riderId: RIDER, stationId: STATION });
            expect(fake.rpcCalls.find((c) => c.name === 'pue_reserve_swap')!.args.p_battery_id).toBe(BAT_A);
        } finally { await i.close(); }
    });

    it('returns the existing swap for a retried key, without picking again', async () => {
        standardDb({ existingByKey: swapRow() });
        const i = await app('operations-officer');
        try {
            const response = await send(i, 'POST', '/swaps', { riderId: RIDER, stationId: STATION });
            expect(response.statusCode).toBe(201);
            expect(fake.rpcCalls).toEqual([]);
            expect(yunhe.query).not.toHaveBeenCalled();
        } finally { await i.close(); }
    });

    it('points at the open swap when the rider already has one', async () => {
        standardDb({ openForRider: { id: SWAP, status: 'reserved' } });
        const i = await app('operations-officer');
        try {
            const response = await send(i, 'POST', '/swaps', { riderId: RIDER, stationId: STATION });
            expect(response.statusCode).toBe(409);
            expect(response.json()).toMatchObject({ error: 'swap_already_open', swapId: SWAP });
        } finally { await i.close(); }
    });

    it('maps a database rule to a clear message', async () => {
        fake.rpc = () => ({ data: null, error: { code: 'P0002', message: 'no_active_bike' } });
        const i = await app('operations-officer');
        try {
            const response = await send(i, 'POST', '/swaps', { riderId: RIDER, stationId: STATION });
            expect(response.statusCode).toBe(409);
            expect(response.json()).toEqual({ error: 'no_active_bike', message: 'That rider has no active bike sale.' });
        } finally { await i.close(); }
    });

    it('needs an Idempotency-Key and an operations role', async () => {
        const i = await app('operations-officer');
        const viewer = await app('finance-checker');
        try {
            expect((await send(i, 'POST', '/swaps', { riderId: RIDER, stationId: STATION }, null)).json()).toMatchObject({ error: 'idempotency_key_required' });
            expect((await send(i, 'POST', '/swaps', { riderId: RIDER, stationId: STATION }, 'short')).statusCode).toBe(400);
            expect((await send(viewer, 'POST', '/swaps', { riderId: RIDER, stationId: STATION })).statusCode).toBe(403);
            expect(fake.rpcCalls).toEqual([]);
        } finally { await i.close(); await viewer.close(); }
    });
});

describe('recording a payment', () => {
    it('records cash at exactly the price', async () => {
        const i = await app('operations-manager');
        try {
            const response = await send(i, 'POST', `/swaps/${SWAP}/payment`, { method: 'cash', amountMinor: 130000 });
            expect(response.statusCode, response.body).toBe(200);
            expect(fake.rpcCalls[0]).toEqual({ name: 'pue_record_swap_payment', args: { p_swap_id: SWAP, p_amount_minor: 130000, p_method: 'cash', p_reference: null, p_idempotency_key: KEY, p_actor: 'u-1' } });
            expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'pue.swap.payment_recorded', metadata: { method: 'cash', amountMinor: 130000, reference: null } }));
        } finally { await i.close(); }
    });

    it('needs a reference for transfer and POS, and refuses online or unknown methods here', async () => {
        const i = await app('operations-manager');
        try {
            expect((await send(i, 'POST', `/swaps/${SWAP}/payment`, { method: 'transfer', amountMinor: 130000 })).statusCode).not.toBe(200);
            expect((await send(i, 'POST', `/swaps/${SWAP}/payment`, { method: 'paystack', amountMinor: 130000, reference: 'abc123' })).statusCode).not.toBe(200);
            expect((await send(i, 'POST', `/swaps/${SWAP}/payment`, { method: 'cash', amountMinor: 0 })).statusCode).not.toBe(200);
            expect(fake.rpcCalls).toEqual([]);
            expect((await send(i, 'POST', `/swaps/${SWAP}/payment`, { method: 'pos', amountMinor: 130000, reference: 'POS-123' })).statusCode).toBe(200);
        } finally { await i.close(); }
    });

    it.each([
        ['amount_mismatch', 422], ['reservation_expired', 409], ['already_paid', 409], ['swap_not_open', 409],
    ])('maps %s to a safe %i', async (code, status) => {
        fake.rpc = () => ({ data: null, error: { code: 'P0002', message: code } });
        const i = await app('operations-manager');
        try {
            const response = await send(i, 'POST', `/swaps/${SWAP}/payment`, { method: 'cash', amountMinor: 130000 });
            expect(response.statusCode).toBe(status);
            expect(response.json().error).toBe(code);
            expect(audit.log).not.toHaveBeenCalled();
        } finally { await i.close(); }
    });

    it('turns a reused transfer reference into a conflict, never database text', async () => {
        fake.rpc = () => ({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "pue_swap_payments_reference_once"' } });
        const i = await app('operations-manager');
        try {
            const response = await send(i, 'POST', `/swaps/${SWAP}/payment`, { method: 'transfer', amountMinor: 130000, reference: 'TRF-1' });
            expect(response.statusCode).toBe(409);
            expect(JSON.stringify(response.json())).not.toContain('pue_swap_payments_reference_once');
        } finally { await i.close(); }
    });
});

describe('online payment, hand over, cancel', () => {
    it('starts a Paystack checkout and audits it', async () => {
        const i = await app('operations-officer');
        try {
            const response = await send(i, 'POST', `/swaps/${SWAP}/paystack`, {}, null);
            expect(response.statusCode).toBe(200);
            expect(response.json().checkout).toMatchObject({ authorizationUrl: 'https://paystack.test/x', amountMinor: 130000 });
            expect(actions()).toEqual(['pue.swap.paystack_started']);
        } finally { await i.close(); }
    });

    it('hands over with the returned battery and audits both batteries', async () => {
        fake.rpc = () => ({ data: swapRow({ status: 'completed', battery_in_id: BAT_B }) });
        const i = await app('operations-officer');
        try {
            const response = await send(i, 'POST', `/swaps/${SWAP}/complete`, { returnedBatteryId: BAT_B }, null);
            expect(response.statusCode).toBe(200);
            expect(fake.rpcCalls[0]).toEqual({ name: 'pue_complete_swap', args: { p_swap_id: SWAP, p_returned_battery_id: BAT_B, p_actor: 'u-1' } });
            expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'pue.swap.completed', after: { batteryOutId: BAT_A, batteryInId: BAT_B } }));
        } finally { await i.close(); }
    });

    it('refuses to hand over an unpaid swap', async () => {
        fake.rpc = () => ({ data: null, error: { code: 'P0002', message: 'not_paid' } });
        const i = await app('operations-officer');
        try {
            const response = await send(i, 'POST', `/swaps/${SWAP}/complete`, {}, null);
            expect(response.statusCode).toBe(409);
            expect(response.json().error).toBe('not_paid');
            expect(audit.log).not.toHaveBeenCalled();
        } finally { await i.close(); }
    });

    it('cancels with a reason, and requires one', async () => {
        fake.rpc = () => ({ data: swapRow({ status: 'cancelled' }) });
        const i = await app('operations-officer');
        try {
            expect((await send(i, 'POST', `/swaps/${SWAP}/cancel`, { reason: '' }, null)).statusCode).not.toBe(200);
            const response = await send(i, 'POST', `/swaps/${SWAP}/cancel`, { reason: 'No battery available' }, null);
            expect(response.statusCode).toBe(200);
            expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'pue.swap.cancelled', metadata: { reason: 'No battery available' } }));
        } finally { await i.close(); }
    });
});

describe('settings and reads', () => {
    it('only a super admin changes settings, and values are bounded', async () => {
        const officer = await app('operations-manager');
        const admin = await app('super-admin');
        try {
            expect((await send(officer, 'PATCH', '/settings', { priceMinor: 150000 }, null)).statusCode).toBe(403);
            expect((await send(admin, 'PATCH', '/settings', { minSoc: 150 }, null)).statusCode).not.toBe(200);
            expect((await send(admin, 'PATCH', '/settings', { unknown: 1 }, null)).statusCode).not.toBe(200);
            const ok = await send(admin, 'PATCH', '/settings', { priceMinor: 150000 }, null);
            expect(ok.statusCode).toBe(200);
            expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'pue.swap_settings.updated' }));
        } finally { await officer.close(); await admin.close(); }
    });

    it('returns the settings', async () => {
        const i = await app('account');
        try {
            expect((await send(i, 'GET', '/settings', undefined, null)).json().settings).toEqual({ priceMinor: 130000, minSoc: 90, reservationMinutes: 30, maxReadingAgeMinutes: 120 });
        } finally { await i.close(); }
    });

    it('says refund due when a refund was recorded or an online payment needs review', async () => {
        fake.handler = () => ({ data: { ...swapRow({ status: 'cancelled' }), pue_swap_payments: [{ kind: 'payment', amount_minor: 130000, method: 'pos', reference: 'P1', created_at: 'x' }, { kind: 'refund', amount_minor: 130000, method: 'pos', reference: null, created_at: 'y' }], pue_swap_paystack_attempts: [] } });
        const i = await app('account');
        try {
            const response = await send(i, 'GET', `/swaps/${SWAP}`, undefined, null);
            expect(response.json().swap).toMatchObject({ refundDue: true, status: 'cancelled' });
            expect(response.json().swap.payments).toHaveLength(2);
        } finally { await i.close(); }
    });
});
