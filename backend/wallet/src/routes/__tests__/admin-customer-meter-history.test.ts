import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

const customer = '22222222-2222-4222-8222-222222222222';
const data = vi.hoisted(() => ({
    linksUnavailable: false,
    scanFixture: false,
    meters: [
        { id: 'a', customer_id: '22222222-2222-4222-8222-222222222222', meter_id: 'METER-A', station_id: 'SITE-A', oem_installation_id: 'installation-a', status: 'approved' },
        { id: 'b', customer_id: '22222222-2222-4222-8222-222222222222', meter_id: 'METER-B', station_id: 'SITE-B', status: 'approved' },
        { id: 'c', customer_id: '22222222-2222-4222-8222-222222222222', meter_id: 'METER-C', station_id: 'SITE-A', status: 'pending' },
    ],
    purchases: [
        { id: 'purchase-a', meter_id: 'METER-A', station_id: 'SITE-A', oem_installation_id: 'installation-a', actor_type: 'customer', actor_id: '22222222-2222-4222-8222-222222222222', customer_id: 'EXTERNAL-A', status: 'delivered', amount_minor: 100000, created_at: '2026-10-29T10:00:00Z' },
        { id: 'purchase-b', meter_id: 'METER-B', station_id: 'SITE-B', actor_type: 'vendor', actor_id: 'vendor', customer_id: 'EXTERNAL-B', status: 'delivered', amount_minor: 200000, created_at: '2026-10-28T10:00:00Z' },
        { id: 'purchase-c', meter_id: 'METER-C', station_id: 'SITE-A', actor_type: 'vendor', actor_id: 'vendor', customer_id: 'EXTERNAL-C', status: 'delivered', amount_minor: 300000, created_at: '2026-10-27T10:00:00Z' },
        { id: 'wrong-station', meter_id: 'METER-A', station_id: 'SITE-B', actor_type: 'vendor', actor_id: 'vendor', status: 'delivered', amount_minor: 100000, created_at: '2026-10-26T10:00:00Z' },
        { id: 'wrong-installation', meter_id: 'METER-A', station_id: 'SITE-A', oem_installation_id: 'installation-other', actor_type: 'vendor', actor_id: 'vendor', status: 'delivered', amount_minor: 100000, created_at: '2026-10-25T10:00:00Z' },
    ],
}));
vi.mock('../../db/supabase.js', () => ({
    adminClient: { from(table: string) {
        let rows: any[] = table === 'customer_meters' ? [...data.meters] : table === 'purchase_orders' ? [...data.purchases] : table === 'permissions' ? [{ role_key: 'operator', route_hash: 'wallet.customers.view' }, { role_key: 'operator', route_hash: 'wallet.vending.monitor' }] : [];
        if (table === 'purchase_orders' && data.scanFixture) {
            rows = Array.from({ length: 100 }, (_, index) => ({ id: `11111111-1111-4111-8111-${String(102 - index).padStart(12, '0')}`, meter_id: 'METER-A', station_id: 'SITE-B', created_at: '2026-10-29T10:00:00Z' }));
            rows.push({ id: '11111111-1111-4111-8111-000000000002', meter_id: 'METER-A', station_id: 'SITE-A', oem_installation_id: 'installation-a', created_at: '2026-10-29T10:00:00Z' });
        }
        let maxRows = Infinity;
        let rangeStart = 0;
        let rangeEnd = Infinity;
        const query: any = {
            select() { return query; },
            eq(key: string, value: unknown) { rows = rows.filter((row) => row[key] === value); return query; },
            in(key: string, values: unknown[]) { rows = rows.filter((row) => values.includes(row[key])); return query; },
            order() { return query; },
            limit(value: number) { maxRows = value; return query; },
            range(start: number, end: number) { rangeStart = start; rangeEnd = end; return query; },
            or(value: string) { const id = value.match(/id\.lt\.([0-9a-f-]+)/)?.[1]; if (id) rows = rows.filter((row) => row.id < id); return query; },
            lt() { return query; },
            maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
            then(resolve: (value: unknown) => unknown) { return resolve(data.linksUnavailable && table === 'customer_meters' ? { data: null, error: { message: 'Meter storage unavailable' } } : { data: rows.slice(rangeStart, Math.min(rangeEnd + 1, maxRows)), error: null }); },
        };
        return query;
    } },
}));
import adminRoutes from '../admin.js';

async function createApp(role = 'super-admin', stationIds = ['*']) {
    const app = Fastify();
    app.decorate('requireStaff', () => async (req: any) => {
        req.actor = { userId: customer, actorId: customer, type: 'staff', role, stationIds };
    });
    await app.register(adminRoutes);
    return app;
}

describe('customer linked-meter purchase HTTP contract', () => {
    it('returns purchases for approved linked meters, including vendor sales', async () => {
        const app = await createApp();
        try {
            const response = await app.inject(`/customers/${customer}/purchases?scope=linked`);
            expect(response.statusCode).toBe(200);
            expect(response.json().purchases.map((row: any) => row.id)).toEqual(['purchase-a', 'purchase-b']);
            expect(response.json().purchases.map((row: any) => row.match_basis)).toEqual(['meter_station_installation', 'meter_station']);
        } finally { await app.close(); }
    });
    it('limits linked purchases to staff stations', async () => {
        const app = await createApp('operator', ['SITE-A']);
        try {
            const response = await app.inject(`/customers/${customer}/purchases?scope=linked`);
            expect(response.statusCode).toBe(200);
            expect(response.json().purchases.map((row: any) => row.id)).toEqual(['purchase-a']);
        } finally { await app.close(); }
    });
    it('lists meter links within the staff station', async () => {
        const app = await createApp('operator', ['SITE-A']);
        try {
            const response = await app.inject(`/customers/${customer}/meters`);
            expect(response.statusCode).toBe(200);
            expect(response.json().meters.map((row: any) => row.meter_id)).toEqual(['METER-A', 'METER-C']);
        } finally { await app.close(); }
    });
    it('rejects pending and out-of-station meters', async () => {
        const app = await createApp('operator', ['SITE-A']);
        try {
            expect((await app.inject(`/customers/${customer}/purchases?scope=linked&meterId=METER-B`)).statusCode).toBe(404);
            expect((await app.inject(`/customers/${customer}/purchases?scope=linked&meterId=METER-C`)).statusCode).toBe(404);
        } finally { await app.close(); }
    });
    it('returns account purchases using the purchasing actor', async () => {
        const app = await createApp();
        try {
            const response = await app.inject(`/customers/${customer}/purchases`);
            expect(response.statusCode).toBe(200);
            expect(response.json().purchases.map((row: any) => row.id)).toEqual(['purchase-a']);
        } finally { await app.close(); }
    });
    it('continues scanning past unrelated station matches', async () => {
        data.scanFixture = true;
        const app = await createApp();
        try {
            const response = await app.inject(`/customers/${customer}/purchases?scope=linked&limit=2`);
            expect(response.statusCode).toBe(200);
            expect(response.json().purchases.map((row: any) => row.id)).toEqual(['11111111-1111-4111-8111-000000000002']);
            expect(response.json().nextCursor).toBeNull();
        } finally { data.scanFixture = false; await app.close(); }
    });
    it('returns only the selected approved meter', async () => {
        const app = await createApp();
        try {
            const response = await app.inject(`/customers/${customer}/purchases?scope=linked&meterId=METER-B`);
            expect(response.json().purchases.map((row: any) => row.id)).toEqual(['purchase-b']);
        } finally { await app.close(); }
    });
    it('does not report an empty history when links fail', async () => {
        const app = await createApp();
        data.linksUnavailable = true;
        try {
            expect((await app.inject(`/customers/${customer}/purchases?scope=linked`)).statusCode).toBeGreaterThanOrEqual(500);
            expect((await app.inject(`/customers/${customer}/meters`)).statusCode).toBeGreaterThanOrEqual(500);
        } finally { data.linksUnavailable = false; await app.close(); }
    });
});
