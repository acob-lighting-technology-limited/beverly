/**
 * Beverly PUE registry API (own CRM for battery swap).
 *
 *   GET   /api/v1/pue/registry/:resource           sites | swap-stations | bikes | batteries | riders
 *   POST  /api/v1/pue/registry/:resource           create (operators)
 *   PATCH /api/v1/pue/registry/:resource/:id       update (operators)
 *   GET   /api/v1/pue/assignments                  bike sales
 *   POST  /api/v1/pue/assignments                  sell a bike to a rider (operators)
 *   POST  /api/v1/pue/assignments/:id/end          complete, repossess or cancel (operators)
 *
 * Staff only; the shared gate requires the pue portal for X-Beverly-Portal: pue.
 * Every write is audited. Errors are safe messages, never raw database text.
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logAction } from '../services/audit.js';
import { PUE_OPERATOR_ROLES } from '../services/pue-access.js';
import {
    assignBike, createRegistry, endAssignment, isRegistryResource, listAssignments, listRegistry,
    PueRegistryError, updateRegistry,
} from '../services/pue-registry.js';

const paging = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    q: z.string().max(80).optional(),
    status: z.string().max(30).optional(),
});

const route: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preHandler', fastify.requireStaff());

    const fail = (reply: FastifyReply, error: unknown) => {
        if (error instanceof PueRegistryError) return reply.code(error.statusCode).send({ error: error.code, message: error.message });
        throw error;
    };
    const operatorOnly = (role: string, reply: FastifyReply) => {
        if (PUE_OPERATOR_ROLES.has(role)) return true;
        reply.code(403).send({ error: 'forbidden', message: 'Your role cannot change the PUE registry.' });
        return false;
    };

    fastify.get('/registry/:resource', async (req, reply) => {
        const { resource } = req.params as { resource: string };
        if (!isRegistryResource(resource)) return reply.code(404).send({ error: 'not_found', message: 'Unknown registry.' });
        try { return { ok: true, ...(await listRegistry(resource, paging.parse(req.query))) }; } catch (error) { return fail(reply, error); }
    });

    fastify.post('/registry/:resource', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        const { resource } = req.params as { resource: string };
        if (!isRegistryResource(resource)) return reply.code(404).send({ error: 'not_found', message: 'Unknown registry.' });
        try {
            const created = await createRegistry(resource, req.body, actor.userId) as { id: string };
            await logAction({ actorUserId: actor.userId, actorType: 'staff', actorRole: actor.role, ip: req.ip, action: `pue.${resource}.created`, targetType: `pue_${resource}`, targetId: created.id });
            return reply.code(201).send({ ok: true, item: created });
        } catch (error) { return fail(reply, error); }
    });

    fastify.patch('/registry/:resource/:id', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        const { resource, id } = req.params as { resource: string; id: string };
        if (!isRegistryResource(resource)) return reply.code(404).send({ error: 'not_found', message: 'Unknown registry.' });
        try {
            const updated = await updateRegistry(resource, id, req.body);
            await logAction({ actorUserId: actor.userId, actorType: 'staff', actorRole: actor.role, ip: req.ip, action: `pue.${resource}.updated`, targetType: `pue_${resource}`, targetId: id, after: { fields: Object.keys(req.body as object) } });
            return { ok: true, item: updated };
        } catch (error) { return fail(reply, error); }
    });

    fastify.get('/assignments', async (req, reply) => {
        try { return { ok: true, ...(await listAssignments(paging.parse(req.query))) }; } catch (error) { return fail(reply, error); }
    });

    fastify.post('/assignments', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        try {
            const assignment = await assignBike(req.body, actor.userId) as { id: string };
            await logAction({ actorUserId: actor.userId, actorType: 'staff', actorRole: actor.role, ip: req.ip, action: 'pue.bike_assignment.created', targetType: 'pue_bike_assignment', targetId: assignment.id, after: assignment as unknown as Record<string, unknown> });
            return reply.code(201).send({ ok: true, assignment });
        } catch (error) { return fail(reply, error); }
    });

    fastify.post('/assignments/:id/end', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        const { id } = req.params as { id: string };
        try {
            const result = await endAssignment(id, req.body);
            await logAction({ actorUserId: actor.userId, actorType: 'staff', actorRole: actor.role, ip: req.ip, action: 'pue.bike_assignment.ended', targetType: 'pue_bike_assignment', targetId: id, metadata: { reason: result.reason }, after: result.assignment as unknown as Record<string, unknown> });
            return { ok: true, assignment: result.assignment };
        } catch (error) { return fail(reply, error); }
    });
};

export default route;
