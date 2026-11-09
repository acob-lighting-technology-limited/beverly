import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { adminClient } from '../db/supabase.js';
import { loadInstallationCredentials } from '../services/oem-installation-credentials.js';
import { fetchSparkMeterTelemetryPage } from '../adapters/sparkmeter-koios-v2.js';

/** Read-only Koios probe. Never persist provider data or expose credentials. */
const telemetryProbe: FastifyPluginAsync = async (app) => {
    app.get('/installations/:installationId/telemetry/probe', { preHandler: app.requireStaff() }, async (req, reply) => {
        reply.header('Cache-Control', 'no-store');
        const actor = req.actor?.type === 'staff' ? z.string().uuid().safeParse(req.actor.userId) : { success: false as const };
        const params = z.object({ installationId: z.string().uuid() }).safeParse(req.params);
        const query = z.object({ site: z.string().uuid() }).safeParse(req.query);
        if (!actor.success || req.actor?.type !== 'staff' || req.actor.role !== 'super-admin') return reply.code(403).send({ error: 'oem_access_denied' });
        if (!params.success || !query.success) return reply.code(400).send({ error: 'invalid_oem_probe_request' });
        const { installationId } = params.data;
        const grant = await adminClient.rpc('get_authorized_oem_inventory_reconciliation', {
            p_auth_user_id: actor.data, p_installation_id: installationId,
        }).abortSignal(AbortSignal.timeout(10_000));
        const grantData = z.object({ authorized: z.boolean() }).safeParse(grant.data);
        if (grant.error || !grantData.success) return reply.code(503).send({ error: 'oem_inventory_unavailable' });
        if (!grantData.data.authorized) return reply.code(404).send({ error: 'oem_installation_not_found' });
        const [installation, meter] = await Promise.all([
            adminClient.from('oem_installations').select('id,tenant_id,status,base_url,approved_hostnames,config_version,oem_manufacturers!inner(slug),oem_config_revisions(revision,configuration)')
                .eq('id', installationId).eq('status', 'active').eq('oem_manufacturers.slug', 'sparkmeter')
                .abortSignal(AbortSignal.timeout(10_000)).maybeSingle(),
            adminClient.from('oem_inventory_meters').select('id').eq('oem_installation_id', installationId)
                .eq('site_id', query.data.site).eq('status', 'active').limit(1).abortSignal(AbortSignal.timeout(10_000)).maybeSingle(),
        ]);
        if (installation.error || meter.error) return reply.code(503).send({ error: 'oem_inventory_unavailable' });
        if (!installation.data || !meter.data) return reply.code(404).send({ error: 'oem_site_not_found' });
        const row = installation.data;
        const revision = (row.oem_config_revisions as Array<{ revision: number; configuration: Record<string, unknown> }> | null)
            ?.find((item) => item.revision === row.config_version);
        const organizationId = z.string().uuid().safeParse(revision?.configuration.organization_id);
        if (!organizationId.success) return reply.code(503).send({ error: 'oem_configuration_unavailable' });
        try {
            const credentials = await loadInstallationCredentials({ id: row.id, tenantId: row.tenant_id, status: row.status });
            if (credentials.authStrategy !== 'api_key_pair') throw new Error('Unsupported credentials');
            const page = await fetchSparkMeterTelemetryPage({ baseUrl: row.base_url, approvedHostnames: row.approved_hostnames,
                organizationId: organizationId.data, apiKey: credentials.apiKey, apiSecret: credentials.apiSecret,
                sites: [query.data.site], mode: 'live', age: '1h' });
            return { readings: page.readings.length, quarantined: page.quarantine.length, hasMore: page.hasMore };
        } catch {
            return reply.code(503).send({ error: 'oem_provider_unavailable' });
        }
    });
};

export default telemetryProbe;
