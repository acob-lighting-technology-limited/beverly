import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { adminClient } from '../db/supabase.js';
import { SparkMeterAdapter } from '../adapters/sparkmeter-adapter.js';
import { InstallationCredentialError, loadInstallationCredentials } from '../services/oem-installation-credentials.js';
import { lookupSparkMeterPayment } from '../services/sparkmeter-payment-client.js';
import { roleHasPermission } from '../services/rbac.js';

// ponytail: fail closed above 200 grants; add cursor pagination when needed.
const grantedInstallations = z.array(z.object({
    oem_installations: z.object({
        id: z.string().min(1), tenant_id: z.string().min(1), display_name: z.string(),
        status: z.enum(['draft', 'active', 'suspended', 'retired']),
        environment: z.enum(['sandbox', 'production']),
        tenants: z.object({
            status: z.literal('active'),
            oem_tenant_memberships: z.array(z.object({
                auth_user_id: z.string().uuid(), status: z.literal('active'),
            })).length(1),
        }),
    }),
})).max(200);
const meterInventory = z.object({
    authorized: z.boolean(),
    meters: z.array(z.object({
        id: z.string().uuid(), external_id: z.string().min(1), serial: z.string().min(1),
        site_id: z.string().nullable(), meter_phase: z.string().nullable(), tariff_id: z.string().nullable(),
        status: z.enum(['active', 'stale']), last_seen_at: z.string().datetime({ offset: true }),
    })).max(101),
    next_cursor: z.string().uuid().nullable(),
});
const reconciliationSnapshot = z.object({
    authorized: z.boolean(),
    snapshot: z.object({
        customers: z.number().int().nonnegative(), meters: z.number().int().nonnegative(),
        checksum: z.string().min(1), completed_at: z.string().datetime({ offset: true }),
    }).nullable(),
});
const telemetryReadings = z.object({
    authorized: z.boolean(),
    readings: z.array(z.object({
        id: z.string().uuid(), external_site_id: z.string().min(1), external_meter_id: z.string().min(1),
        reading_at: z.string().datetime({ offset: true }), energy_kwh: z.number().nullable(),
        energy_interpretation: z.literal('provider_total_unknown_semantics'), voltage_avg: z.number().nullable(),
        current_avg: z.number().nullable(), power_factor_avg: z.number().nullable(),
        provider_credit_balance: z.number().nullable(), meter_state: z.enum(['on', 'off', 'fault']),
        reading_type: z.enum(['customer', 'totalizer']), received_at: z.string().datetime({ offset: true }),
    })).max(101),
    next_cursor: z.string().uuid().nullable(),
});

/** Staff authentication and explicit server-managed grants both remain mandatory. */
const oemRoutes: FastifyPluginAsync = async (app) => {
    app.get('/installations/:installationId/payments/:commandId/verification', { preHandler: app.requireStaff() }, async (req, reply) => {
        reply.header('Cache-Control', 'no-store');
        const actor = req.actor?.type === 'staff' ? req.actor : null;
        const params = z.object({ installationId: z.string().uuid(), commandId: z.string().uuid() }).safeParse(req.params);
        if (!actor || !z.string().uuid().safeParse(actor.userId).success) return reply.code(403).send({ error: 'oem_access_denied' });
        if (!params.success) return reply.code(400).send({ error: 'invalid_oem_payment_request' });
        try {
            if (!await roleHasPermission(actor.role, 'wallet.vending.monitor')) return reply.code(403).send({ error: 'oem_access_denied' });
            const { installationId, commandId } = params.data;
            const grant = await adminClient.rpc('get_authorized_oem_inventory_reconciliation', {
                p_auth_user_id: actor.userId, p_installation_id: installationId,
            }).abortSignal(AbortSignal.timeout(10_000));
            const authorized = reconciliationSnapshot.safeParse(grant.data);
            if (grant.error || !authorized.success) return reply.code(503).send({ error: 'oem_verification_unavailable' });
            if (!authorized.data.authorized) return reply.code(404).send({ error: 'oem_payment_not_found' });
            const command = await adminClient.from('oem_commands')
                .select('id,canonical_request').eq('id', commandId).eq('oem_installation_id', installationId)
                .eq('operation_key', 'vending.payment').abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
            if (command.error) return reply.code(503).send({ error: 'oem_verification_unavailable' });
            const request = z.object({ commandId: z.string().uuid(), customerId: z.string().uuid(),
                amountMinor: z.number().int().positive().safe(), currency: z.literal('NGN') }).safeParse(command.data?.canonical_request);
            if (!command.data || !request.success) return reply.code(404).send({ error: 'oem_payment_not_found' });
            let orders = adminClient.from('purchase_orders').select('id').eq('id', request.data.commandId);
            if (actor.role !== 'super-admin') {
                const stations = [...new Set([...(actor.stationIds ?? []), ...(actor.stationId ? [actor.stationId] : [])])];
                if (!stations.length) return reply.code(404).send({ error: 'oem_payment_not_found' });
                orders = orders.in('station_id', stations);
            }
            const order = await orders.abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
            if (order.error) return reply.code(503).send({ error: 'oem_verification_unavailable' });
            if (!order.data) return reply.code(404).send({ error: 'oem_payment_not_found' });
            const installation = await adminClient.from('oem_installations')
                .select('id,tenant_id,status,base_url,approved_hostnames,oem_manufacturers!inner(slug)')
                .eq('id', installationId).eq('status', 'active').eq('oem_manufacturers.slug', 'sparkmeter')
                .abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
            if (installation.error || !installation.data) return reply.code(503).send({ error: 'oem_verification_unavailable' });
            const row = installation.data;
            const credentials = await loadInstallationCredentials({ id: row.id, tenantId: row.tenant_id, status: row.status });
            if (credentials.authStrategy !== 'api_key_pair') throw new Error('Unsupported credentials');
            const outcome = await lookupSparkMeterPayment({ commandId, baseUrl: row.base_url,
                approvedHostnames: row.approved_hostnames, apiKey: credentials.apiKey, apiSecret: credentials.apiSecret,
                externalCustomerId: request.data.customerId, amountMinor: request.data.amountMinor,
                currency: request.data.currency, settlementCurrency: request.data.currency });
            return { status: outcome.status === 'confirmed_success' ? 'confirmed_success' : 'unknown' };
        } catch {
            return reply.code(503).send({ error: 'oem_verification_unavailable' });
        }
    });
    app.post('/installations/:installationId/test-connection', { preHandler: app.requireStaff() }, async (req, reply) => {
        reply.header('Cache-Control', 'no-store');
        const actor = req.actor?.type === 'staff' ? z.string().uuid().safeParse(req.actor.userId) : { success: false as const };
        const params = z.object({ installationId: z.string().uuid() }).safeParse(req.params);
        if (!actor.success) return reply.code(403).send({ error: 'oem_access_denied' });
        if (!params.success) return reply.code(400).send({ error: 'invalid_oem_installation_request' });
        const { installationId } = params.data;
        const grant = await adminClient.rpc('get_authorized_oem_inventory_reconciliation', {
            p_auth_user_id: actor.data, p_installation_id: installationId,
        }).abortSignal(AbortSignal.timeout(10_000));
        const authorized = reconciliationSnapshot.safeParse(grant.data);
        if (grant.error || !authorized.success) return reply.code(503).send({ error: 'oem_inventory_unavailable' });
        if (!authorized.data.authorized) return reply.code(404).send({ error: 'oem_installation_not_found' });
        const installation = await adminClient.from('oem_installations')
            .select('id,tenant_id,status,base_url,approved_hostnames,oem_manufacturers!inner(slug)')
            .eq('id', installationId).eq('status', 'active').eq('oem_manufacturers.slug', 'sparkmeter')
            .abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
        if (installation.error) return reply.code(503).send({ error: 'oem_inventory_unavailable' });
        if (!installation.data) return reply.code(501).send({ error: 'oem_connection_probe_unavailable' });
        const row = installation.data;
        try {
            const credentials = await loadInstallationCredentials({ id: row.id, tenantId: row.tenant_id, status: row.status });
            if (credentials.authStrategy !== 'api_key_pair') throw new Error('Unsupported credentials');
            const adapter = new SparkMeterAdapter({ installationId, baseUrl: row.base_url, approvedHostnames: row.approved_hostnames,
                apiKey: credentials.apiKey, apiSecret: credentials.apiSecret });
            const result = await adapter.testConnection();
            return { ok: result.ok };
        } catch (error) {
            const reason = error instanceof InstallationCredentialError ? error.code : 'OEM_PROVIDER_UNAVAILABLE';
            return reply.code(503).send({ error: 'oem_provider_unavailable', message: reason });
        }
    });

    app.get('/installations/:installationId/customers/:customerId/live', { preHandler: app.requireStaff() }, async (req, reply) => {
        reply.header('Cache-Control', 'no-store');
        const actor = req.actor?.type === 'staff' ? z.string().uuid().safeParse(req.actor.userId) : { success: false as const };
        const params = z.object({ installationId: z.string().uuid(), customerId: z.string().uuid() }).safeParse(req.params);
        if (!actor.success) return reply.code(403).send({ error: 'oem_access_denied' });
        if (!params.success) return reply.code(400).send({ error: 'invalid_oem_customer_request' });
        const { installationId, customerId } = params.data;
        const grant = await adminClient.rpc('get_authorized_oem_inventory_reconciliation', {
            p_auth_user_id: actor.data, p_installation_id: installationId,
        }).abortSignal(AbortSignal.timeout(10_000));
        const authorized = reconciliationSnapshot.safeParse(grant.data);
        if (grant.error || !authorized.success) return reply.code(503).send({ error: 'oem_inventory_unavailable' });
        if (!authorized.data.authorized) return reply.code(404).send({ error: 'oem_installation_not_found' });
        const [customer, meters, installation] = await Promise.all([
            adminClient.from('oem_inventory_customers').select('external_id,site_id').eq('oem_installation_id', installationId)
                .eq('external_id', customerId).eq('status', 'active').abortSignal(AbortSignal.timeout(10_000)).maybeSingle(),
            adminClient.from('oem_inventory_meters').select('external_id,serial').eq('oem_installation_id', installationId)
                .eq('customer_external_id', customerId).eq('status', 'active').limit(101).abortSignal(AbortSignal.timeout(10_000)),
            adminClient.from('oem_installations').select('id,tenant_id,status,base_url,approved_hostnames,oem_manufacturers!inner(slug)')
                .eq('id', installationId).eq('status', 'active').eq('oem_manufacturers.slug', 'sparkmeter')
                .abortSignal(AbortSignal.timeout(10_000)).maybeSingle(),
        ]);
        if (customer.error || meters.error || installation.error || !Array.isArray(meters.data) || meters.data.length > 100) {
            return reply.code(503).send({ error: 'oem_inventory_unavailable' });
        }
        if (!customer.data || !installation.data || meters.data.length === 0) return reply.code(404).send({ error: 'oem_customer_not_found' });
        const row = installation.data;
        try {
            const credentials = await loadInstallationCredentials({ id: row.id, tenantId: row.tenant_id, status: row.status });
            if (credentials.authStrategy !== 'api_key_pair') throw new Error('Unsupported credentials');
            const adapter = new SparkMeterAdapter({ installationId, baseUrl: row.base_url, approvedHostnames: row.approved_hostnames,
                apiKey: credentials.apiKey, apiSecret: credentials.apiSecret });
            const live = await adapter.readCustomer({ installationId, customerId });
            if (!customer.data.site_id || live.siteId !== customer.data.site_id) return reply.code(409).send({ error: 'oem_inventory_outdated' });
            const approved = live.meters.filter((meter) => meters.data.some((stored: { external_id: string; serial: string }) => stored.external_id === meter.id && stored.serial === meter.serial));
            return { customer: { ...live, meters: approved }, inventoryMismatch: approved.length !== live.meters.length || approved.length !== meters.data.length };
        } catch {
            return reply.code(503).send({ error: 'oem_provider_unavailable' });
        }
    });

    app.get('/installations/:installationId/telemetry', { preHandler: app.requireStaff() }, async (req, reply) => {
        reply.header('Cache-Control', 'no-store');
        const actorId = req.actor?.type === 'staff' ? z.string().uuid().safeParse(req.actor.userId) : { success: false as const };
        const params = z.object({ installationId: z.string().uuid() }).safeParse(req.params);
        const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), after: z.string().uuid().optional() }).safeParse(req.query);
        if (!actorId.success) return reply.code(403).send({ error: 'oem_access_denied' });
        if (!params.success || !query.success) return reply.code(400).send({ error: 'invalid_oem_telemetry_request' });
        const { data, error } = await adminClient.rpc('list_authorized_oem_telemetry', {
            p_auth_user_id: actorId.data, p_installation_id: params.data.installationId,
            p_after: query.data.after ?? null, p_limit: query.data.limit,
        }).abortSignal(AbortSignal.timeout(10_000));
        const parsed = telemetryReadings.safeParse(data);
        if (error || !parsed.success) return reply.code(503).send({ error: 'oem_telemetry_unavailable' });
        if (!parsed.data.authorized) return reply.code(404).send({ error: 'oem_installation_not_found' });
        return { readings: parsed.data.readings.map((row) => ({
            id: row.id, externalSiteId: row.external_site_id, externalMeterId: row.external_meter_id,
            readingAt: row.reading_at, energyKwh: row.energy_kwh, energyInterpretation: row.energy_interpretation,
            voltageAvg: row.voltage_avg, currentAvg: row.current_avg, powerFactorAvg: row.power_factor_avg,
            providerCreditBalance: row.provider_credit_balance, meterState: row.meter_state,
            readingType: row.reading_type, receivedAt: row.received_at,
        })), nextCursor: parsed.data.next_cursor };
    });
    app.get('/installations/:installationId/reconciliation', { preHandler: app.requireStaff() }, async (req, reply) => {
        reply.header('Cache-Control', 'no-store');
        const actorId = req.actor?.type === 'staff' ? z.string().uuid().safeParse(req.actor.userId) : { success: false as const };
        const params = z.object({ installationId: z.string().uuid() }).safeParse(req.params);
        if (!actorId.success) return reply.code(403).send({ error: 'oem_access_denied' });
        if (!params.success) return reply.code(400).send({ error: 'invalid_oem_inventory_request' });
        const { data, error } = await adminClient.rpc('get_authorized_oem_inventory_reconciliation', {
            p_auth_user_id: actorId.data, p_installation_id: params.data.installationId,
        }).abortSignal(AbortSignal.timeout(10_000));
        const parsed = reconciliationSnapshot.safeParse(data);
        if (error || !parsed.success) return reply.code(503).send({ error: 'oem_inventory_unavailable' });
        if (!parsed.data.authorized) return reply.code(404).send({ error: 'oem_installation_not_found' });
        return { snapshot: parsed.data.snapshot && {
            customers: parsed.data.snapshot.customers, meters: parsed.data.snapshot.meters,
            checksum: parsed.data.snapshot.checksum, completedAt: parsed.data.snapshot.completed_at,
        } };
    });
    app.get('/installations/:installationId/meters', { preHandler: app.requireStaff() }, async (req, reply) => {
        reply.header('Cache-Control', 'no-store');
        const actorId = req.actor?.type === 'staff' ? z.string().uuid().safeParse(req.actor.userId) : { success: false as const };
        const params = z.object({ installationId: z.string().uuid() }).safeParse(req.params);
        const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), after: z.string().uuid().optional() }).safeParse(req.query);
        if (!actorId.success) return reply.code(403).send({ error: 'oem_access_denied' });
        if (!params.success || !query.success) return reply.code(400).send({ error: 'invalid_oem_inventory_request' });
        const { data, error } = await adminClient.rpc('list_authorized_oem_inventory_meters', {
            p_auth_user_id: actorId.data, p_installation_id: params.data.installationId,
            p_after: query.data.after ?? null, p_limit: query.data.limit,
        }).abortSignal(AbortSignal.timeout(10_000));
        const parsed = meterInventory.safeParse(data);
        if (error || !parsed.success) return reply.code(503).send({ error: 'oem_inventory_unavailable' });
        if (!parsed.data.authorized) return reply.code(404).send({ error: 'oem_installation_not_found' });
        return {
            meters: parsed.data.meters.map((row) => ({
                id: row.id, externalId: row.external_id, serial: row.serial, siteId: row.site_id,
                meterPhase: row.meter_phase, tariffId: row.tariff_id, status: row.status, lastSeenAt: row.last_seen_at,
            })),
            nextCursor: parsed.data.next_cursor,
        };
    });
    app.get('/installations', { preHandler: app.requireStaff() }, async (req, reply) => {
        reply.header('Cache-Control', 'no-store');
        if (!req.actor || req.actor.type !== 'staff' || !z.string().uuid().safeParse(req.actor.userId).success) {
            return reply.code(403).send({ error: 'oem_access_denied' });
        }
        const { data, error } = await adminClient.from('oem_actor_installation_access')
            .select('oem_installations!inner(id, tenant_id, display_name, status, environment, tenants!inner(status, oem_tenant_memberships!inner(auth_user_id, status)))')
            .eq('auth_user_id', req.actor.userId)
            .eq('status', 'active')
            .eq('oem_installations.tenants.status', 'active')
            .eq('oem_installations.tenants.oem_tenant_memberships.auth_user_id', req.actor.userId)
            .eq('oem_installations.tenants.oem_tenant_memberships.status', 'active')
            .order('oem_installation_id')
            .limit(201)
            .abortSignal(AbortSignal.timeout(10_000));
        const parsed = grantedInstallations.safeParse(data);
        if (error || !parsed.success) {
            return reply.code(503).send({ error: 'oem_inventory_unavailable' });
        }
        if (parsed.data.some(({ oem_installations: row }) => (
            row.tenants.oem_tenant_memberships[0]?.auth_user_id !== req.actor?.userId
        ))) return reply.code(503).send({ error: 'oem_inventory_unavailable' });
        return { installations: parsed.data.map(({ oem_installations: row }) => ({
            id: row.id, tenantId: row.tenant_id, displayName: row.display_name,
            status: row.status, environment: row.environment,
        })) };
    });
};

export default oemRoutes;
