import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import telemetryProbe from '../oem-telemetry-probe.js';
import * as credentials from '../../services/oem-installation-credentials.js';
import * as telemetry from '../../adapters/sparkmeter-koios-v2.js';

const installationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const siteId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function app(role: 'super-admin' | 'operations-manager' = 'super-admin') {
    const server = Fastify();
    server.decorate('requireStaff', () => async (req) => {
        req.actor = { type: 'staff', userId: '11111111-1111-4111-8111-111111111111',
            actorId: '11111111-1111-4111-8111-111111111111', email: null, role, mfaVerified: true };
    });
    await server.register(telemetryProbe);
    return server;
}

describe('read-only telemetry probe', () => {
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
    it('denies station-scoped staff before requesting inventory', async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
        const server = await app('operations-manager');
        try {
            const response = await server.inject(`/installations/${installationId}/telemetry/probe?site=${siteId}`);
            expect(response.statusCode).toBe(403);
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally { await server.close(); }
    });
    it('probes an authorized inventory site without returning provider payloads', async () => {
        vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
            const url = new URL(input instanceof Request ? input.url : String(input));
            if (url.pathname.endsWith('/rpc/get_authorized_oem_inventory_reconciliation')) return Response.json({ authorized: true });
            if (url.pathname.endsWith('/oem_inventory_meters')) return Response.json({ id: 'meter' });
            if (url.pathname.endsWith('/oem_installations')) return Response.json({ id: installationId, tenant_id: 'tenant',
                status: 'active', base_url: 'https://www.sparkmeter.cloud', approved_hostnames: ['www.sparkmeter.cloud'],
                config_version: 1, oem_config_revisions: [{ revision: 1, configuration: { organization_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } }] });
            return new Response('{}', { status: 404 });
        });
        vi.spyOn(credentials, 'loadInstallationCredentials').mockResolvedValue({ authStrategy: 'api_key_pair', apiKey: 'key', apiSecret: 'secret' } as any);
        const probe = vi.spyOn(telemetry, 'fetchSparkMeterTelemetryPage').mockResolvedValue({ readings: [], quarantine: [], hasMore: false, nextCursor: null });
        const server = await app();
        try {
            const response = await server.inject(`/installations/${installationId}/telemetry/probe?site=${siteId}`);
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ readings: 0, quarantined: 0, hasMore: false });
            expect(response.headers['cache-control']).toBe('no-store');
            expect(probe).toHaveBeenCalledWith(expect.objectContaining({ mode: 'live', sites: [siteId], age: '1h' }));
        } finally { await server.close(); }
    });
    it('rejects missing installation grants before contacting the provider', async () => {
        vi.stubGlobal('fetch', async () => Response.json({ authorized: false }));
        const probe = vi.spyOn(telemetry, 'fetchSparkMeterTelemetryPage');
        const server = await app();
        try {
            const response = await server.inject(`/installations/${installationId}/telemetry/probe?site=${siteId}`);
            expect(response.statusCode).toBe(404);
            expect(probe).not.toHaveBeenCalled();
        } finally { await server.close(); }
    });
    it('rejects a site outside installation inventory', async () => {
        vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
            const url = new URL(input instanceof Request ? input.url : String(input));
            if (url.pathname.endsWith('/rpc/get_authorized_oem_inventory_reconciliation')) return Response.json({ authorized: true });
            if (url.pathname.endsWith('/oem_inventory_meters')) return Response.json(null);
            if (url.pathname.endsWith('/oem_installations')) return Response.json({ id: installationId });
            return new Response('{}', { status: 404 });
        });
        const probe = vi.spyOn(telemetry, 'fetchSparkMeterTelemetryPage');
        const server = await app();
        try {
            const response = await server.inject(`/installations/${installationId}/telemetry/probe?site=${siteId}`);
            expect(response.statusCode).toBe(404);
            expect(probe).not.toHaveBeenCalled();
        } finally { await server.close(); }
    });
});
