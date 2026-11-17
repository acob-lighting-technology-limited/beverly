import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number };
const db = vi.hoisted(() => ({
    result: { data: null, error: null } as { data?: unknown; error?: { code?: string; message?: string } | null; count?: number },
    calls: [] as { table?: string; op: string; arg?: unknown }[],
}));
const audit = vi.hoisted(() => ({ log: vi.fn(async () => true) }));

vi.mock('../../services/audit.js', () => ({ logAction: audit.log }));
vi.mock('../../db/supabase.js', () => ({
    adminClient: {
        from: (table: string) => {
            const chain: any = new Proxy({}, {
                get: (_t, prop) => {
                    if (prop === 'then') return (resolve: (v: Result) => void) => resolve({ error: null, ...db.result });
                    if (prop === 'single' || prop === 'maybeSingle') return async () => ({ error: null, ...db.result });
                    return (arg?: unknown) => { db.calls.push({ table, op: String(prop), arg }); return chain; };
                },
            });
            return chain;
        },
        rpc: async (name: string, arg: unknown) => { db.calls.push({ op: `rpc:${name}`, arg }); return { error: null, ...db.result }; },
    },
}));

import pueRegistryRoutes from '../pue-registry.js';
import { normalizePhone, toRow } from '../../services/pue-registry.js';

const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';

async function app(role: string) {
    const instance = Fastify();
    instance.decorate('requireStaff', () => async (req) => {
        req.actor = { userId: 'u-1', actorId: 'u-1', email: null, type: 'staff', role, mfaVerified: true, stationIds: ['*'] };
    });
    await instance.register(pueRegistryRoutes, { prefix: '/api/v1/pue' });
    return instance;
}
const send = (instance: Awaited<ReturnType<typeof app>>, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown) =>
    instance.inject({ method, url: `/api/v1/pue${url}`, ...(payload === undefined ? {} : { payload: payload as object }) });
const auditActions = () => audit.log.mock.calls.map(([e]) => (e as { action: string }).action);

beforeEach(() => { vi.clearAllMocks(); db.result = { data: null, error: null }; db.calls = []; });

describe('pure helpers', () => {
    it('normalizes Nigerian phone numbers', () => {
        expect(normalizePhone('0803 290-2825')).toBe('+2348032902825');
        expect(normalizePhone('2348032902825')).toBe('+2348032902825');
        expect(normalizePhone('+2348032902825')).toBe('+2348032902825');
    });
    it('maps camelCase input to snake_case columns and drops undefined', () => {
        expect(toRow({ serialNumber: 'X1', siteId: ID, model: undefined })).toEqual({ serial_number: 'X1', site_id: ID });
    });
});

describe('registry reads', () => {
    it('lists a registry with a total', async () => {
        db.result = { data: [{ id: ID, name: 'Musha' }], count: 1 };
        const instance = await app('account');
        try {
            const response = await send(instance, 'GET', '/registry/sites?limit=10&q=mus');
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ ok: true, items: [{ id: ID, name: 'Musha' }], total: 1 });
            expect(db.calls.find((c) => c.op === 'or')?.arg).toContain('name.ilike.%mus%');
        } finally { await instance.close(); }
    });
    it('404s an unknown registry', async () => {
        const instance = await app('account');
        try { expect((await send(instance, 'GET', '/registry/secrets')).statusCode).toBe(404); } finally { await instance.close(); }
    });
    it('strips filter-breaking characters from the search text', async () => {
        db.result = { data: [], count: 0 };
        const instance = await app('account');
        try {
            await send(instance, 'GET', `/registry/riders?q=${encodeURIComponent('a),name.eq.(b')}`);
            expect(String(db.calls.find((c) => c.op === 'or')?.arg)).not.toMatch(/[(),]\w+\.eq/);
        } finally { await instance.close(); }
    });
});

describe('registry writes', () => {
    it('lets an operator create a rider with a normalized phone, and audits it', async () => {
        db.result = { data: { id: ID, full_name: 'Ada' } };
        const instance = await app('operations-officer');
        try {
            const response = await send(instance, 'POST', '/registry/riders', { fullName: 'Ada Bello', phone: '0803 290 2825' });
            expect(response.statusCode).toBe(201);
            const insert = db.calls.find((c) => c.op === 'insert')?.arg as Record<string, unknown>;
            expect(insert).toMatchObject({ full_name: 'Ada Bello', phone: '+2348032902825', created_by: 'u-1' });
            expect(insert).not.toHaveProperty('beverly_customer_id');
            expect(auditActions()).toEqual(['pue.riders.created']);
        } finally { await instance.close(); }
    });
    it('forbids a role that cannot change the registry, with no write and no audit', async () => {
        const instance = await app('finance-checker');
        try {
            const response = await send(instance, 'POST', '/registry/bikes', { serialNumber: 'BIKE-001' });
            expect(response.statusCode).toBe(403);
            expect(db.calls).toEqual([]);
            expect(audit.log).not.toHaveBeenCalled();
        } finally { await instance.close(); }
    });
    it('rejects unknown fields, so a caller cannot set created_by or ids', async () => {
        const instance = await app('super-admin');
        try {
            const response = await send(instance, 'POST', '/registry/bikes', { serialNumber: 'BIKE-001', createdBy: 'x', id: ID });
            expect(response.statusCode).not.toBe(201);
            expect(db.calls.some((c) => c.op === 'insert')).toBe(false);
        } finally { await instance.close(); }
    });
    it('answers a duplicate with a safe 409, never database text', async () => {
        db.result = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "pue_bikes_serial_number_key"' } };
        const instance = await app('super-admin');
        try {
            const response = await send(instance, 'POST', '/registry/bikes', { serialNumber: 'BIKE-001' });
            expect(response.statusCode).toBe(409);
            expect(JSON.stringify(response.json())).not.toContain('pue_bikes_serial_number_key');
            expect(audit.log).not.toHaveBeenCalled();
        } finally { await instance.close(); }
    });
    it('says the registry is not set up when the tables are missing', async () => {
        db.result = { data: null, error: { code: '42P01', message: 'relation "public.pue_sites" does not exist' } };
        const instance = await app('account');
        try {
            const response = await send(instance, 'GET', '/registry/sites');
            expect(response.statusCode).toBe(503);
            expect(response.json()).toMatchObject({ error: 'registry_unavailable' });
        } finally { await instance.close(); }
    });
    it('requires at least one field to update, and 404s a missing record', async () => {
        const instance = await app('super-admin');
        try {
            expect((await send(instance, 'PATCH', `/registry/bikes/${ID}`, {})).statusCode).not.toBe(200);
            db.result = { data: null };
            expect((await send(instance, 'PATCH', `/registry/bikes/${ID}`, { model: 'X' })).statusCode).toBe(404);
        } finally { await instance.close(); }
    });
    it('keeps a battery cell count unset unless one is given', async () => {
        db.result = { data: { id: ID } };
        const instance = await app('super-admin');
        try {
            await send(instance, 'POST', '/registry/batteries', { batteryNumber: 'BT104802512EST0250911001' });
            expect(db.calls.find((c) => c.op === 'insert')?.arg).not.toHaveProperty('cell_count');
        } finally { await instance.close(); }
    });
});

describe('bike sales', () => {
    const sale = { riderId: ID, bikeId: ID2, saleType: 'instalment', totalMinor: 90_000_000, depositMinor: 10_000_000 };

    it('sells a bike through the atomic database function and audits it', async () => {
        db.result = { data: { id: ID, status: 'active' } };
        const instance = await app('operations-manager');
        try {
            const response = await send(instance, 'POST', '/assignments', sale);
            expect(response.statusCode).toBe(201);
            expect(db.calls.find((c) => c.op === 'rpc:pue_assign_bike')?.arg).toEqual({
                p_rider_id: ID, p_bike_id: ID2, p_sale_type: 'instalment', p_total_minor: 90_000_000, p_deposit_minor: 10_000_000, p_actor: 'u-1',
            });
            expect(auditActions()).toEqual(['pue.bike_assignment.created']);
        } finally { await instance.close(); }
    });
    it('refuses a deposit larger than the price', async () => {
        const instance = await app('super-admin');
        try {
            expect((await send(instance, 'POST', '/assignments', { ...sale, depositMinor: 90_000_001 })).statusCode).not.toBe(201);
            expect(db.calls).toEqual([]);
        } finally { await instance.close(); }
    });
    it('maps a bike that is already sold to a clear 409', async () => {
        db.result = { data: null, error: { code: 'P0002', message: 'bike_not_available' } };
        const instance = await app('super-admin');
        try {
            const response = await send(instance, 'POST', '/assignments', sale);
            expect(response.statusCode).toBe(409);
            expect(response.json()).toMatchObject({ error: 'bike_not_available' });
        } finally { await instance.close(); }
    });
    it('ends a sale with an outcome and a reason, and audits the reason', async () => {
        db.result = { data: { id: ID, status: 'repossessed' } };
        const instance = await app('super-admin');
        try {
            const response = await send(instance, 'POST', `/assignments/${ID}/end`, { outcome: 'repossessed', reason: 'Defaulted 60 days' });
            expect(response.statusCode).toBe(200);
            expect(db.calls.find((c) => c.op === 'rpc:pue_end_assignment')?.arg).toEqual({ p_id: ID, p_outcome: 'repossessed' });
            expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'pue.bike_assignment.ended', metadata: { reason: 'Defaulted 60 days' } }));
        } finally { await instance.close(); }
    });
    it('needs a reason to end a sale', async () => {
        const instance = await app('super-admin');
        try {
            expect((await send(instance, 'POST', `/assignments/${ID}/end`, { outcome: 'cancelled', reason: '' })).statusCode).not.toBe(200);
            expect(db.calls).toEqual([]);
        } finally { await instance.close(); }
    });
});
