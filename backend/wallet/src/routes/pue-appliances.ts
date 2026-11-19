/**
 * Beverly PUE appliances API.
 *
 *   GET   /api/v1/pue/appliances/:resource          types | units
 *   POST  /api/v1/pue/appliances/:resource          create (operators)
 *   PATCH /api/v1/pue/appliances/:resource/:id      update (operators)
 *   GET   /api/v1/pue/appliance-customers?q=        search Beverly CRM customers (name, phone, email, meter)
 *   GET   /api/v1/pue/appliance-sales[/:id]         sales with paid and balance
 *   POST  /api/v1/pue/appliance-sales               sell a unit; a deposit is recorded (operators)
 *   POST  /api/v1/pue/appliance-sales/:id/payment   record cash / transfer / POS (Idempotency-Key)
 *   POST  /api/v1/pue/appliance-sales/:id/end       repossess or cancel (operators)
 *   GET|POST /api/v1/pue/appliance-faults           list / report a fault
 *   PATCH /api/v1/pue/appliance-faults/:id          move a fault along or resolve it
 *
 * Staff only (PUE portal). Writes need an operations role and are audited. No hardware is switched here.
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logAction } from '../services/audit.js';
import { PUE_OPERATOR_ROLES } from '../services/pue-access.js';
import {
    createApplianceResource, createFault, endApplianceSale, getApplianceSale, isApplianceResource, listApplianceResource,
    listApplianceSales, listFaults, PueApplianceError, recordAppliancePayment, requireIdempotencyKey, searchCustomers,
    sellAppliance, updateApplianceResource, updateFault,
} from '../services/pue-appliances.js';

const paging = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    q: z.string().max(80).optional(),
    status: z.string().max(30).optional(),
});

const route: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preHandler', fastify.requireStaff());

    const fail = (reply: FastifyReply, error: unknown) => {
        if (error instanceof PueApplianceError) return reply.code(error.statusCode).send({ error: error.code, message: error.message });
        throw error;
    };
    const operatorOnly = (role: string, reply: FastifyReply) => {
        if (PUE_OPERATOR_ROLES.has(role)) return true;
        reply.code(403).send({ error: 'forbidden', message: 'Your role cannot change appliances.' });
        return false;
    };
    const audit = (req: { actor?: { userId: string; role: string }; ip: string }, action: string, targetType: string, targetId: string, after?: Record<string, unknown>) =>
        logAction({ actorUserId: req.actor!.userId, actorType: 'staff', actorRole: req.actor!.role, ip: req.ip, action, targetType, targetId, ...(after ? { after } : {}) });

    fastify.get('/appliances/:resource', async (req, reply) => {
        const { resource } = req.params as { resource: string };
        if (!isApplianceResource(resource)) return reply.code(404).send({ error: 'not_found', message: 'Unknown appliance list.' });
        try { return { ok: true, ...(await listApplianceResource(resource, paging.parse(req.query))) }; } catch (error) { return fail(reply, error); }
    });

    fastify.post('/appliances/:resource', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        const { resource } = req.params as { resource: string };
        if (!isApplianceResource(resource)) return reply.code(404).send({ error: 'not_found', message: 'Unknown appliance list.' });
        try {
            const created = await createApplianceResource(resource, req.body, actor.userId) as { id: string };
            await audit(req, `pue.appliance_${resource}.created`, `pue_appliance_${resource}`, created.id);
            return reply.code(201).send({ ok: true, item: created });
        } catch (error) { return fail(reply, error); }
    });

    fastify.patch('/appliances/:resource/:id', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        const { resource, id } = req.params as { resource: string; id: string };
        if (!isApplianceResource(resource)) return reply.code(404).send({ error: 'not_found', message: 'Unknown appliance list.' });
        try {
            const updated = await updateApplianceResource(resource, id, req.body);
            await audit(req, `pue.appliance_${resource}.updated`, `pue_appliance_${resource}`, id, { fields: Object.keys(req.body as object) });
            return { ok: true, item: updated };
        } catch (error) { return fail(reply, error); }
    });

    fastify.get('/appliance-customers', async (req, reply) => {
        try {
            const { q } = z.object({ q: z.string().max(80) }).parse(req.query);
            return { ok: true, items: await searchCustomers(q) };
        } catch (error) { return fail(reply, error); }
    });

    fastify.get('/appliance-sales', async (req, reply) => { try { return { ok: true, ...(await listApplianceSales(paging.parse(req.query))) }; } catch (error) { return fail(reply, error); } });
    fastify.get('/appliance-sales/:id', async (req, reply) => { try { return { ok: true, sale: await getApplianceSale((req.params as { id: string }).id) }; } catch (error) { return fail(reply, error); } });

    fastify.post('/appliance-sales', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        try {
            const sale = await sellAppliance(req.body, actor.userId) as { id: string; total_minor: number; deposit_minor: number };
            await audit(req, 'pue.appliance_sale.created', 'pue_appliance_sale', sale.id, { totalMinor: sale.total_minor, depositMinor: sale.deposit_minor });
            return reply.code(201).send({ ok: true, sale });
        } catch (error) { return fail(reply, error); }
    });

    fastify.post('/appliance-sales/:id/payment', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        const { id } = req.params as { id: string };
        try {
            const key = requireIdempotencyKey(req.headers['idempotency-key']);
            await recordAppliancePayment(id, req.body, key, actor.userId);
            const body = req.body as { amountMinor?: number; method?: string };
            await audit(req, 'pue.appliance_payment.recorded', 'pue_appliance_sale', id, { amountMinor: body.amountMinor, method: body.method });
            return reply.code(201).send({ ok: true, sale: await getApplianceSale(id) });
        } catch (error) { return fail(reply, error); }
    });

    fastify.post('/appliance-sales/:id/end', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        const { id } = req.params as { id: string };
        try {
            const { sale, reason } = await endApplianceSale(id, req.body);
            await audit(req, 'pue.appliance_sale.ended', 'pue_appliance_sale', id, { reason });
            return { ok: true, sale };
        } catch (error) { return fail(reply, error); }
    });

    fastify.get('/appliance-faults', async (req, reply) => { try { return { ok: true, ...(await listFaults(paging.parse(req.query))) }; } catch (error) { return fail(reply, error); } });

    fastify.post('/appliance-faults', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        try {
            const fault = await createFault(req.body, actor.userId) as { id: string };
            await audit(req, 'pue.appliance_fault.reported', 'pue_appliance_fault', fault.id);
            return reply.code(201).send({ ok: true, fault });
        } catch (error) { return fail(reply, error); }
    });

    fastify.patch('/appliance-faults/:id', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        const { id } = req.params as { id: string };
        try {
            const fault = await updateFault(id, req.body);
            await audit(req, 'pue.appliance_fault.updated', 'pue_appliance_fault', id, { status: (req.body as { status?: string }).status });
            return { ok: true, fault };
        } catch (error) { return fail(reply, error); }
    });
};

export default route;
