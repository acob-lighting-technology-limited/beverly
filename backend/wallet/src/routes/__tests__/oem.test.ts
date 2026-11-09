import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import oemRoutes from '../oem.js';
import { SparkMeterAdapter } from '../../adapters/sparkmeter-adapter.js';
import * as installationCredentials from '../../services/oem-installation-credentials.js';
import * as paymentClient from '../../services/sparkmeter-payment-client.js';
import * as rbac from '../../services/rbac.js';

/** Authentication is a boundary fixture; storage remains the real HTTP client. */
async function inventoryApp(authenticated = true): Promise<FastifyInstance> {
    const app = Fastify();
    app.decorate('requireStaff', () => async (req) => {
        if (authenticated) req.actor = {
            userId: '11111111-1111-4111-8111-111111111111',
            actorId: '11111111-1111-4111-8111-111111111111',
            email: null, type: 'staff', role: 'operations-manager', mfaVerified: true,
        };
    });
    await app.register(oemRoutes);
    return app;
}

describe('OEM installation inventory HTTP boundary', () => {
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
    it('verifies only a granted station payment, without modifying it', async () => {
        vi.spyOn(rbac, 'roleHasPermission').mockResolvedValue(true);
        vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
            expect(['GET', 'POST']).toContain(init?.method ?? 'GET');
            const url = new URL(input instanceof Request ? input.url : String(input));
            if (url.pathname.endsWith('/rpc/get_authorized_oem_inventory_reconciliation')) return Response.json({ authorized: true, snapshot: null });
            if (url.pathname.endsWith('/oem_commands')) return Response.json({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', canonical_request: {
                commandId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', customerId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', amountMinor: 5000, currency: 'NGN',
            } });
            if (url.pathname.endsWith('/purchase_orders')) {
                expect(url.searchParams.get('station_id')).toContain('station-1');
                return Response.json({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });
            }
            if (url.pathname.endsWith('/oem_installations')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenant_id: 'tenant', status: 'active', base_url: 'https://www.sparkmeter.cloud', approved_hostnames: ['www.sparkmeter.cloud'] });
            return new Response('{}', { status: 404 });
        });
        vi.spyOn(installationCredentials, 'loadInstallationCredentials').mockResolvedValue({ authStrategy: 'api_key_pair', apiKey: 'key', apiSecret: 'secret' } as any);
        const lookup = vi.spyOn(paymentClient, 'lookupSparkMeterPayment').mockResolvedValue({ status: 'confirmed_success', providerReference: 'private' });
        const app = Fastify();
        app.decorate('requireStaff', () => async (req) => { req.actor = { userId: '11111111-1111-4111-8111-111111111111', actorId: '11111111-1111-4111-8111-111111111111', email: null, type: 'staff', role: 'operations-manager', mfaVerified: true, stationIds: ['station-1'] }; });
        await app.register(oemRoutes);
        try {
            const response = await app.inject('/installations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/payments/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/verification');
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ status: 'confirmed_success' });
            expect(response.headers['cache-control']).toBe('no-store');
            expect(lookup).toHaveBeenCalledWith(expect.objectContaining({ commandId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', amountMinor: 5000 }));
        } finally { await app.close(); }
    });
    it('denies payment verification without vending permission', async () => {
        vi.spyOn(rbac, 'roleHasPermission').mockResolvedValue(false);
        const lookup = vi.spyOn(paymentClient, 'lookupSparkMeterPayment');
        const app = await inventoryApp();
        try {
            const response = await app.inject('/installations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/payments/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/verification');
            expect(response.statusCode).toBe(403);
            expect(lookup).not.toHaveBeenCalled();
        } finally { await app.close(); }
    });
    it('does not look up payments without an installation grant', async () => {
        vi.spyOn(rbac, 'roleHasPermission').mockResolvedValue(true);
        vi.stubGlobal('fetch', async () => Response.json({ authorized: false, snapshot: null }));
        const lookup = vi.spyOn(paymentClient, 'lookupSparkMeterPayment');
        const app = await inventoryApp();
        try {
            const response = await app.inject('/installations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/payments/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/verification');
            expect(response.statusCode).toBe(404);
            expect(lookup).not.toHaveBeenCalled();
        } finally { await app.close(); }
    });
    it('does not look up payments from another station', async () => {
        vi.spyOn(rbac, 'roleHasPermission').mockResolvedValue(true);
        vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
            const url = new URL(input instanceof Request ? input.url : String(input));
            if (url.pathname.endsWith('/rpc/get_authorized_oem_inventory_reconciliation')) return Response.json({ authorized: true, snapshot: null });
            if (url.pathname.endsWith('/oem_commands')) return Response.json({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', canonical_request: {
                commandId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', customerId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', amountMinor: 5000, currency: 'NGN',
            } });
            if (url.pathname.endsWith('/purchase_orders')) return new Response(null, { status: 406 });
            return new Response('{}', { status: 404 });
        });
        const lookup = vi.spyOn(paymentClient, 'lookupSparkMeterPayment');
        const app = Fastify();
        app.decorate('requireStaff', () => async (req) => { req.actor = { userId: '11111111-1111-4111-8111-111111111111', actorId: '11111111-1111-4111-8111-111111111111', email: null, type: 'staff', role: 'operations-manager', mfaVerified: true, stationIds: ['station-1'] }; });
        await app.register(oemRoutes);
        try {
            const response = await app.inject('/installations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/payments/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/verification');
            expect([404, 503]).toContain(response.statusCode);
            expect(lookup).not.toHaveBeenCalled();
        } finally { await app.close(); }
    });
    it('only probes a granted active SparkMeter installation', async () => {
        vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
            const url = new URL(input instanceof Request ? input.url : String(input));
            if (url.pathname.endsWith('/rpc/get_authorized_oem_inventory_reconciliation')) return Response.json({ authorized: true, snapshot: null });
            if (url.pathname.endsWith('/oem_installations')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenant_id: 'tenant', status: 'active', base_url: 'https://www.sparkmeter.cloud', approved_hostnames: ['www.sparkmeter.cloud'] });
            return new Response('{}', { status: 404 });
        });
        vi.spyOn(installationCredentials, 'loadInstallationCredentials').mockResolvedValue({ authStrategy: 'api_key_pair', apiKey: 'key', apiSecret: 'secret' } as any);
        const probe = vi.spyOn(SparkMeterAdapter.prototype, 'testConnection').mockResolvedValue({ ok: true });
        const app = await inventoryApp();
        try {
            const response = await app.inject({ method: 'POST', url: '/installations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/test-connection' });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ ok: true });
            expect(probe).toHaveBeenCalledOnce();
        } finally { await app.close(); }
    });
    it('does not probe an ungranted installation', async () => {
        vi.stubGlobal('fetch', async () => Response.json({ authorized: false, snapshot: null }));
        const probe = vi.spyOn(SparkMeterAdapter.prototype, 'testConnection');
        const app = await inventoryApp();
        try {
            const response = await app.inject({ method: 'POST', url: '/installations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/test-connection' });
            expect(response.statusCode).toBe(404);
            expect(probe).not.toHaveBeenCalled();
        } finally { await app.close(); }
    });
    it('reports provider probe failures without leaking details', async () => {
        vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
            const url = new URL(input instanceof Request ? input.url : String(input));
            if (url.pathname.endsWith('/rpc/get_authorized_oem_inventory_reconciliation')) return Response.json({ authorized: true, snapshot: null });
            if (url.pathname.endsWith('/oem_installations')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenant_id: 'tenant', status: 'active', base_url: 'https://www.sparkmeter.cloud', approved_hostnames: ['www.sparkmeter.cloud'] });
            return new Response('{}', { status: 404 });
        });
        vi.spyOn(installationCredentials, 'loadInstallationCredentials').mockResolvedValue({ authStrategy: 'api_key_pair', apiKey: 'key', apiSecret: 'secret' } as any);
        vi.spyOn(SparkMeterAdapter.prototype, 'testConnection').mockResolvedValue({ ok: false, reason: 'sensitive provider detail' });
        const app = await inventoryApp();
        try {
            const response = await app.inject({ method: 'POST', url: '/installations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/test-connection' });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ ok: false });
            expect(response.headers['cache-control']).toBe('no-store');
        } finally { await app.close(); }
    });
    it('classifies credential failures without exposing their details', async () => {
        vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
            const url = new URL(input instanceof Request ? input.url : String(input));
            if (url.pathname.endsWith('/rpc/get_authorized_oem_inventory_reconciliation')) return Response.json({ authorized: true, snapshot: null });
            if (url.pathname.endsWith('/oem_installations')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenant_id: 'tenant', status: 'active', base_url: 'https://www.sparkmeter.cloud', approved_hostnames: ['www.sparkmeter.cloud'] });
            return new Response('{}', { status: 404 });
        });
        vi.spyOn(installationCredentials, 'loadInstallationCredentials').mockRejectedValue(new installationCredentials.InstallationCredentialError('OEM_CREDENTIALS_INVALID', 'private detail'));
        const app = await inventoryApp();
        try {
            const response = await app.inject({ method: 'POST', url: '/installations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/test-connection' });
            expect(response.statusCode).toBe(503);
            expect(response.json()).toEqual({ error: 'oem_provider_unavailable', message: 'OEM_CREDENTIALS_INVALID' });
            expect(response.body).not.toContain('private detail');
        } finally { await app.close(); }
    });
    it('returns installation-scoped meters without customer PII', async () => {
        vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
            const url = new URL(input instanceof Request ? input.url : String(input));
            if (!url.pathname.endsWith('/rpc/list_authorized_oem_inventory_meters')) return new Response('{}', { status: 404 });
            return Response.json({ authorized: true, meters: [{
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', external_id: 'meter-1', serial: 'SERIAL-1',
                site_id: 'site-1', meter_phase: 'single_phase', tariff_id: 'tariff-1', status: 'active',
                last_seen_at: '2026-09-28T10:00:00.000Z', customer_external_id: 'private-customer-id',
            }], next_cursor: null });
        });
        const app = await inventoryApp();
        try {
            const response = await app.inject('/installations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/meters?limit=1');
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ meters: [{
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', externalId: 'meter-1', serial: 'SERIAL-1',
                siteId: 'site-1', meterPhase: 'single_phase', tariffId: 'tariff-1', status: 'active',
                lastSeenAt: '2026-09-28T10:00:00.000Z',
            }], nextCursor: null });
        } finally { await app.close(); }
    });
    it('returns live provider details only for an authorized owned customer', async () => {
        vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
            const url = new URL(input instanceof Request ? input.url : String(input));
            if (url.pathname.endsWith('/rpc/get_authorized_oem_inventory_reconciliation')) return Response.json({ authorized: true, snapshot: null });
            if (url.pathname.endsWith('/oem_inventory_customers')) return Response.json({ external_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', site_id: 'site-1' });
            if (url.pathname.endsWith('/oem_inventory_meters')) return Response.json([{ external_id: 'meter-1', serial: 'SM-1' }]);
            if (url.pathname.endsWith('/oem_installations')) return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenant_id: 'tenant', status: 'active', base_url: 'https://www.sparkmeter.cloud', approved_hostnames: ['www.sparkmeter.cloud'] });
            return new Response('{}', { status: 404 });
        });
        vi.spyOn(installationCredentials, 'loadInstallationCredentials').mockResolvedValue({ authStrategy: 'api_key_pair', apiKey: 'key', apiSecret: 'secret' } as any);
        vi.spyOn(SparkMeterAdapter.prototype, 'readCustomer').mockResolvedValue({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Customer', siteId: 'site-1', credit: null,
            meters: [{ id: 'meter-1', serial: 'SM-1', tariffId: null, latestReading: null }, { id: 'foreign', serial: 'SM-X', tariffId: null, latestReading: null }] });
        const app = await inventoryApp();
        try {
            const response = await app.inject('/installations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/customers/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/live');
            expect(response.statusCode).toBe(200);
            expect(response.json().customer.meters).toEqual([{ id: 'meter-1', serial: 'SM-1', tariffId: null, latestReading: null }]);
            expect(response.json().inventoryMismatch).toBe(true);
            expect(response.headers['cache-control']).toBe('no-store');
        } finally { await app.close(); }
    });

    it('does not read provider customer data without an installation grant', async () => {
        vi.stubGlobal('fetch', async () => Response.json({ authorized: false, snapshot: null }));
        const read = vi.spyOn(SparkMeterAdapter.prototype, 'readCustomer');
        const app = await inventoryApp();
        try {
            const response = await app.inject('/installations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/customers/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/live');
            expect(response.statusCode).toBe(404);
            expect(read).not.toHaveBeenCalled();
        } finally { await app.close(); }
    });

    it('returns authorized telemetry without provider payloads', async () => {
        vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
            const url = new URL(input instanceof Request ? input.url : String(input));
            if (!url.pathname.endsWith('/rpc/list_authorized_oem_telemetry')) return new Response('{}', { status: 404 });
            return Response.json({ authorized: true, readings: [{
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', external_site_id: 'site-1',
                external_meter_id: 'meter-1', reading_at: '2026-10-01T10:00:00.000Z',
                energy_kwh: 12.5, energy_interpretation: 'provider_total_unknown_semantics',
                voltage_avg: 230, current_avg: 2, power_factor_avg: 0.9,
                provider_credit_balance: 100, meter_state: 'on', reading_type: 'customer',
                received_at: '2026-10-01T10:01:00.000Z', provider_payload: { secret: true },
            }], next_cursor: null });
        });
        const app = await inventoryApp();
        try {
            const response = await app.inject('/installations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/telemetry?limit=1');
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ readings: [{
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', externalSiteId: 'site-1',
                externalMeterId: 'meter-1', readingAt: '2026-10-01T10:00:00.000Z',
                energyKwh: 12.5, energyInterpretation: 'provider_total_unknown_semantics',
                voltageAvg: 230, currentAvg: 2, powerFactorAvg: 0.9,
                providerCreditBalance: 100, meterState: 'on', readingType: 'customer',
                receivedAt: '2026-10-01T10:01:00.000Z',
            }], nextCursor: null });
        } finally { await app.close(); }
    });
    it('hides unauthorized installation meters', async () => {
        vi.stubGlobal('fetch', async () => Response.json({ authorized: false, meters: [], next_cursor: null }));
        const app = await inventoryApp();
        try {
            const response = await app.inject('/installations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/meters');
            expect(response.statusCode).toBe(404);
            expect(response.json()).toEqual({ error: 'oem_installation_not_found' });
        } finally { await app.close(); }
    });
    it('returns the last atomic inventory reconciliation', async () => {
        vi.stubGlobal('fetch', async () => Response.json({ authorized: true, snapshot: {
            customers: 3073, meters: 3073, checksum: 'abc123', completed_at: '2026-09-28T10:00:00.000Z',
        } }));
        const app = await inventoryApp();
        try {
            const response = await app.inject('/installations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/reconciliation');
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ snapshot: {
                customers: 3073, meters: 3073, checksum: 'abc123', completedAt: '2026-09-28T10:00:00.000Z',
            } });
        } finally { await app.close(); }
    });
    it('hides installation grants lacking active tenant membership', async () => {
        vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
            const url = new URL(input instanceof Request ? input.url : String(input));
            const scoped = url.searchParams.get('oem_installations.tenants.oem_tenant_memberships.auth_user_id')
                === 'eq.11111111-1111-4111-8111-111111111111'
                && url.searchParams.get('oem_installations.tenants.oem_tenant_memberships.status') === 'eq.active';
            return Response.json(scoped ? [] : [{ oem_installations: {
                id: 'installation-a', tenant_id: 'tenant-a', display_name: 'Forbidden',
                status: 'active', environment: 'production', tenants: { status: 'active' },
            } }]);
        });
        const app = await inventoryApp();
        try {
            const response = await app.inject('/installations');
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ installations: [] });
        } finally { await app.close(); }
    });
    it('returns no installations without explicit grants, ignoring caller scope', async () => {
        vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
            const url = new URL(input instanceof Request ? input.url : String(input));
            return url.searchParams.get('auth_user_id') === 'eq.11111111-1111-4111-8111-111111111111'
                ? Response.json([]) : Response.json([{ secret: 'foreign-installation' }]);
        });
        const app = await inventoryApp();
        try {
            const response = await app.inject('/installations?auth_user_id=another-user&tenant_id=another-tenant');
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ installations: [] });
            expect(response.headers['cache-control']).toBe('no-store');
        } finally { await app.close(); }
    });
    it('denies missing staff authentication', async () => {
        vi.stubGlobal('fetch', async () => Response.json([]));
        const app = await inventoryApp(false);
        try {
            const response = await app.inject('/installations');
            expect(response.statusCode).toBe(403);
            expect(response.json()).toEqual({ error: 'oem_access_denied' });
        } finally { await app.close(); }
    });
    it.each([
        [],
        [{ auth_user_id: '11111111-1111-4111-8111-111111111111', status: 'revoked' }],
        [{ auth_user_id: '22222222-2222-4222-8222-222222222222', status: 'active' }],
    ])('rejects invalid membership evidence %j', async (memberships) => {
        vi.stubGlobal('fetch', async () => Response.json([{ oem_installations: {
            id: 'installation-a', tenant_id: 'tenant-a', display_name: 'Hidden',
            status: 'active', environment: 'production',
            tenants: { status: 'active', oem_tenant_memberships: memberships },
        } }]));
        const app = await inventoryApp();
        try {
            const response = await app.inject('/installations');
            expect(response.statusCode).toBe(503);
            expect(response.json()).toEqual({ error: 'oem_inventory_unavailable' });
        } finally { await app.close(); }
    });
    it.each([
        { label: 'storage failure', body: { message: 'sensitive-database-detail' }, status: 500 },
        { label: 'malformed joins', body: [{ oem_installations: null }], status: 200 },
        { label: 'inactive tenants', body: [{ oem_installations: {
            id: 'installation-b', tenant_id: 'tenant-b', display_name: 'Hidden',
            status: 'active', environment: 'production', tenants: { status: 'retired' },
        } }], status: 200 },
        { label: 'inventory overflow', body: Array.from({ length: 201 }, () => ({ oem_installations: {
            id: 'installation-a', tenant_id: 'tenant-a', display_name: 'Authorized',
            status: 'active', environment: 'production', tenants: { status: 'active' },
        } })), status: 200 },
    ])('fails closed for $label', async ({ body, status }) => {
        vi.stubGlobal('fetch', async () => Response.json(body, { status }));
        const app = await inventoryApp();
        try {
            const response = await app.inject('/installations');
            expect(response.statusCode).toBe(503);
            expect(response.json()).toEqual({ error: 'oem_inventory_unavailable' });
            expect(response.headers['cache-control']).toBe('no-store');
        } finally { await app.close(); }
    });
    it('rejects malformed actor identities before storage access', async () => {
        const app = Fastify();
        app.decorate('requireStaff', () => async (req) => {
            req.actor = { userId: '', actorId: 'staff', email: null, type: 'staff', role: 'operations-manager', mfaVerified: true };
        });
        vi.stubGlobal('fetch', async () => Response.json([]));
        await app.register(oemRoutes);
        try {
            const response = await app.inject('/installations');
            expect(response.statusCode).toBe(403);
            expect(response.json()).toEqual({ error: 'oem_access_denied' });
        } finally { await app.close(); }
    });
    it('returns only explicitly granted active tenant installations', async () => {
        const userId = '11111111-1111-4111-8111-111111111111';
        vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
            const url = new URL(input instanceof Request ? input.url : String(input));
            if (url.searchParams.get('auth_user_id') !== `eq.${userId}`
                || url.searchParams.get('status') !== 'eq.active'
                || url.searchParams.get('oem_installations.tenants.status') !== 'eq.active') {
                return new Response('{}', { status: 403 });
            }
            return Response.json([{ oem_installations: {
                id: 'installation-a', tenant_id: 'tenant-a', display_name: 'Authorized installation',
                status: 'draft', environment: 'sandbox', tenants: { status: 'active', oem_tenant_memberships: [
                    { auth_user_id: userId, status: 'active' },
                ] },
            } }]);
        });
        const app = Fastify();
        app.decorate('requireStaff', () => async (req) => {
            req.actor = { userId, actorId: userId, email: null, type: 'staff', role: 'operations-manager', mfaVerified: true };
        });
        await app.register(oemRoutes);
        const response = await app.inject('/installations');
        await app.close();
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ installations: [{
            id: 'installation-a', tenantId: 'tenant-a', displayName: 'Authorized installation',
            status: 'draft', environment: 'sandbox',
        }] });
    });
});
