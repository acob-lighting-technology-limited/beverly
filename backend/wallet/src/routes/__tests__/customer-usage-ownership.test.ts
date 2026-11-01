import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ readingError: false, station: 'TUNGA' as string | null, readings: [] as any[] }));
vi.mock('../../db/supabase.js', () => ({
    adminClient: {
        from: (table: string) => {
            const rows: Record<string, unknown[]> = {
                customer_meters: [{ meter_id: 'LINKED-1', station_id: state.station, oem_installation_id: null }],
                daily_meter_readings: state.readings,
                oem_telemetry_readings: [],
            };
            const query: any = new Proxy({}, {
                get: (_target, key) => key === 'then'
                    ? (resolve: (value: unknown) => void) => resolve({ data: rows[table] ?? [], error: state.readingError && table === 'daily_meter_readings' ? new Error('unavailable') : null })
                    : () => query,
            });
            return query;
        },
    },
}));
vi.mock('../../services/wallets.js', () => ({ findWalletByOwner: vi.fn(async () => null) }));
vi.mock('../../services/notifications.js', () => ({ notifyTokenPurchased: vi.fn() }));
vi.mock('../../queue/index.js', () => ({ exportsQueue: { add: vi.fn() }, notificationsQueue: { add: vi.fn() } }));

import customerRoutes from '../customer.js';

async function appForCustomer() {
    const app = Fastify();
    app.decorate('requireCustomer', () => async (req: any) => { req.actor = { userId: 'u1', customerId: 'c1', role: 'customer' }; });
    app.decorate('requireKycTier', () => async (req: any) => { req.actor = { userId: 'u1', customerId: 'c1', role: 'customer' }; });
    await app.register(customerRoutes);
    return app;
}

describe('customer usage authorization', () => {
    it('rejects meters outside approved links', async () => {
        const app = await appForCustomer();
        const response = await app.inject({ method: 'GET', url: '/usage/telemetry?meter_id=UNLINKED-1' });
        expect(response.statusCode).toBe(403);
        await app.close();
    });

    it('rejects remote reads outside approved links', async () => {
        const app = await appForCustomer();
        const response = await app.inject({ method: 'POST', url: '/usage/remote-read', payload: { meter_id: 'UNLINKED-1' } });
        expect(response.statusCode).toBe(403);
        await app.close();
    });

    it('reports missing readings without inventing values', async () => {
        const app = await appForCustomer();
        const response = await app.inject({ method: 'GET', url: '/usage/telemetry?meter_id=LINKED-1' });
        expect(response.statusCode).toBe(200);
        expect(response.json().current).toMatchObject({ power: null, total_consumption: null, captured_at: null });
        expect(response.json().series).toEqual([]);
        await app.close();
    });

    it('does not conceal a readings storage failure', async () => {
        const app = await appForCustomer();
        state.readingError = true;
        try {
            const response = await app.inject({ method: 'GET', url: '/usage/telemetry?meter_id=LINKED-1' });
            expect(response.statusCode).toBe(500);
        } finally {
            state.readingError = false;
            await app.close();
        }
    });

    it('rejects readings when a linked meter lacks station context', async () => {
        const app = await appForCustomer();
        state.station = null;
        try {
            const response = await app.inject({ method: 'GET', url: '/usage/telemetry?meter_id=LINKED-1' });
            expect(response.statusCode).toBe(409);
        } finally {
            state.station = 'TUNGA';
            await app.close();
        }
    });

    it('returns recorded daily consumption', async () => {
        const app = await appForCustomer();
        state.readings = [{ reading_date: '2026-10-30', total1: 123.45, remain1: 8, power: 2, captured_at: '2026-10-30T10:00:00Z' }];
        try {
            const response = await app.inject({ method: 'GET', url: '/usage/telemetry?meter_id=LINKED-1&timeframe=daily&data_item=total_consumption' });
            expect(response.statusCode).toBe(200);
            expect(response.json().current.total_consumption).toBe(123.45);
            expect(response.json().series[0].value).toBe(123.45);
        } finally {
            state.readings = [];
            await app.close();
        }
    });
});
