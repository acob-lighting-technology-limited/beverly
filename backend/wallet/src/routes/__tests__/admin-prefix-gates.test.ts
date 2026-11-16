import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

/**
 * Regression: station scoping and the developer-console gate compared the
 * registered route to bare paths such as '/customers/:id' and '/dev/'. Fastify
 * reports routes WITH the /api/v1/admin prefix, so neither check ever matched:
 *   - a station-scoped staff member could open any customer, vendor or purchase
 *     by id (enforceResourceStation returned true when no query was built);
 *   - /dev/* skipped the break-glass, MFA re-auth and audit gate.
 * The existing admin route tests register the plugin without a prefix, which hid
 * both. These register it under the production prefix.
 */

const breakGlassToken = 'test-break-glass-token-0000000000000000';
vi.hoisted(() => {
    process.env.DEV_CONSOLE_ENABLED = 'true';
    process.env.DEV_CONSOLE_BREAK_GLASS_TOKEN = 'test-break-glass-token-0000000000000000';
});

const grants = vi.hoisted(() => ['wallet.customers.view', 'wallet.vendors.review', 'wallet.vending.monitor']);
const queried = vi.hoisted(() => ({ tables: [] as string[], calls: [] as string[] }));

vi.mock('../../services/audit.js', () => ({
    logAction: vi.fn(async () => true),
    auditFromRequest: () => ({ ip: '127.0.0.1', userAgent: 'test', correlationId: 'test' }),
}));

vi.mock('../../db/supabase.js', () => ({
    adminClient: {
        from: (table: string) => {
            queried.tables.push(table);
            // Permissions are awaited directly; every other lookup ends in maybeSingle() and finds nothing.
            const chain: any = new Proxy({}, {
                get: (_target, prop) => {
                    if (prop === 'then') return table === 'permissions'
                        ? (resolve: (value: unknown) => void) => resolve({ data: grants.map((route_hash) => ({ route_hash })), error: null })
                        : undefined;
                    if (prop === 'maybeSingle') return async () => ({ data: null, error: null });
                    return (...args: unknown[]) => { queried.calls.push(`${table}.${String(prop)}(${String(args[0])})`); return chain; };
                },
            });
            return chain;
        },
    },
}));

import adminRoutes from '../admin.js';

async function adminApp(actor: { role: string; stationIds: string[]; mfaVerified?: boolean }) {
    const app = Fastify();
    app.decorate('requireStaff', () => async (req) => {
        req.actor = {
            userId: '11111111-1111-4111-8111-111111111111',
            actorId: '11111111-1111-4111-8111-111111111111',
            email: null, type: 'staff', role: actor.role, mfaVerified: actor.mfaVerified ?? true,
            stationId: actor.stationIds[0], stationIds: actor.stationIds,
        };
    });
    await app.register(adminRoutes, { prefix: '/api/v1/admin' });
    return app;
}

describe('station scoping under the production /api/v1/admin prefix', () => {
    it.each([
        // The station filter itself, so a handler's own not-found cannot mask a missing check.
        ['/customers/c-other', 'customer_meters.in(station_id)'],
        ['/vendors/v-other', 'vendor_organizations.overlaps(operating_stations)'],
        ['/purchases/p-other', 'purchase_orders.in(station_id)'],
    ])('hides %s from a staff member whose stations do not own it', async (path, stationFilter) => {
        queried.tables.length = 0;
        queried.calls.length = 0;
        const app = await adminApp({ role: 'operations-manager', stationIds: ['TUNGA'] });
        try {
            const response = await app.inject({ method: 'GET', url: `/api/v1/admin${path}` });
            expect(response.statusCode, response.body).toBe(404);
            expect(response.json()).toMatchObject({ error: 'not_found' });
            expect(queried.calls).toContain(stationFilter);
        } finally { await app.close(); }
    });

    it('requires a station for a scoped staff member with none', async () => {
        const app = await adminApp({ role: 'operations-manager', stationIds: [] });
        try {
            const response = await app.inject({ method: 'GET', url: '/api/v1/admin/customers/c-1' });
            expect(response.statusCode).toBe(403);
            expect(response.json()).toMatchObject({ error: 'station_required' });
        } finally { await app.close(); }
    });
});

describe('developer console gate under the production /api/v1/admin prefix', () => {
    it('demands the break-glass token', async () => {
        const app = await adminApp({ role: 'super-admin', stationIds: ['*'] });
        try {
            const denied = await app.inject({ method: 'GET', url: '/api/v1/admin/dev/oem' });
            expect(denied.statusCode).toBe(403);
            expect(denied.json()).toMatchObject({ error: 'break_glass_required' });
            const allowed = await app.inject({ method: 'GET', url: '/api/v1/admin/dev/oem', headers: { 'x-break-glass-token': breakGlassToken } });
            expect(allowed.statusCode, allowed.body).toBe(200);
        } finally { await app.close(); }
    });

    it('demands a re-verified second factor', async () => {
        const app = await adminApp({ role: 'super-admin', stationIds: ['*'], mfaVerified: false });
        try {
            const response = await app.inject({ method: 'GET', url: '/api/v1/admin/dev/oem', headers: { 'x-break-glass-token': breakGlassToken } });
            expect(response.statusCode).toBe(403);
            expect(response.json()).toMatchObject({ error: 'reauth_required' });
        } finally { await app.close(); }
    });
});
