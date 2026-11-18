/**
 * Beverly PUE swaps API.
 *
 *   GET   /api/v1/pue/settings                       price, minimum charge, hold time
 *   PATCH /api/v1/pue/settings                       super admin only
 *   GET   /api/v1/pue/swaps[/:id]                    list and detail (names, payments, refund due)
 *   POST  /api/v1/pue/swaps                          reserve a charged battery (Idempotency-Key)
 *   POST  /api/v1/pue/swaps/:id/payment              record cash / transfer / POS (Idempotency-Key)
 *   POST  /api/v1/pue/swaps/:id/paystack             start an online payment
 *   POST  /api/v1/pue/swaps/:id/paystack/verify      check Paystack now (webhook late)
 *   POST  /api/v1/pue/swaps/:id/complete             hand over the battery, take back the old one
 *   POST  /api/v1/pue/swaps/:id/cancel               cancel; a paid swap records a refund
 *   GET   /api/v1/pue/batteries/:id/custody          where a battery has been
 *
 * Staff only (PUE portal). Writes need an operations role and are audited.
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logAction } from '../services/audit.js';
import { PUE_OPERATOR_ROLES } from '../services/pue-access.js';
import {
    batteryCustody, cancelSwap, completeSwap, getSettings, getSwap, listSwaps, PueSwapError, recordPayment,
    requireIdempotencyKey, reserveSwap, updateSettings,
} from '../services/pue-swaps.js';
import { startPaystackPayment, verifyPaystackForSwap } from '../services/pue-swap-paystack.js';

const paging = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    status: z.enum(['reserved', 'paid', 'completed', 'cancelled', 'expired']).optional(),
});

const route: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preHandler', fastify.requireStaff());

    const fail = (reply: FastifyReply, error: unknown) => {
        if (error instanceof PueSwapError) {
            const extra = (error as PueSwapError & { swapId?: string }).swapId;
            return reply.code(error.statusCode).send({ error: error.code, message: error.message, ...(extra ? { swapId: extra } : {}) });
        }
        throw error;
    };
    const operatorOnly = (role: string, reply: FastifyReply) => {
        if (PUE_OPERATOR_ROLES.has(role)) return true;
        reply.code(403).send({ error: 'forbidden', message: 'Your role cannot run swaps.' });
        return false;
    };

    fastify.get('/settings', async (_req, reply) => { try { return { ok: true, settings: await getSettings() }; } catch (error) { return fail(reply, error); } });

    fastify.patch('/settings', async (req, reply) => {
        const actor = req.actor!;
        if (actor.role !== 'super-admin') return reply.code(403).send({ error: 'forbidden', message: 'Only a super admin can change swap settings.' });
        try {
            const settings = await updateSettings(req.body, actor.userId);
            await logAction({ actorUserId: actor.userId, actorType: 'staff', actorRole: actor.role, ip: req.ip, action: 'pue.swap_settings.updated', targetType: 'pue_settings', targetId: 'swap', after: settings as unknown as Record<string, unknown> });
            return { ok: true, settings };
        } catch (error) { return fail(reply, error); }
    });

    fastify.get('/swaps', async (req, reply) => { try { return { ok: true, ...(await listSwaps(paging.parse(req.query))) }; } catch (error) { return fail(reply, error); } });
    fastify.get('/swaps/:id', async (req, reply) => { try { return { ok: true, swap: await getSwap((req.params as { id: string }).id) }; } catch (error) { return fail(reply, error); } });

    fastify.post('/swaps', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        try {
            const swap = await reserveSwap(req.body, requireIdempotencyKey(req.headers['idempotency-key']), actor.userId);
            await logAction({ actorUserId: actor.userId, actorType: 'staff', actorRole: actor.role, ip: req.ip, action: 'pue.swap.reserved', targetType: 'pue_swap', targetId: swap.id, after: { batteryOutId: swap.batteryOutId, priceMinor: swap.priceMinor } });
            return reply.code(201).send({ ok: true, swap });
        } catch (error) { return fail(reply, error); }
    });

    fastify.post('/swaps/:id/payment', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        const { id } = req.params as { id: string };
        try {
            const swap = await recordPayment(id, req.body, requireIdempotencyKey(req.headers['idempotency-key']), actor.userId);
            const body = req.body as { method: string; amountMinor: number; reference?: string };
            await logAction({ actorUserId: actor.userId, actorType: 'staff', actorRole: actor.role, ip: req.ip, action: 'pue.swap.payment_recorded', targetType: 'pue_swap', targetId: id, metadata: { method: body.method, amountMinor: body.amountMinor, reference: body.reference ?? null } });
            return { ok: true, swap };
        } catch (error) { return fail(reply, error); }
    });

    fastify.post('/swaps/:id/paystack', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        const { id } = req.params as { id: string };
        try {
            const checkout = await startPaystackPayment(id, actor.userId);
            await logAction({ actorUserId: actor.userId, actorType: 'staff', actorRole: actor.role, ip: req.ip, action: 'pue.swap.paystack_started', targetType: 'pue_swap', targetId: id, metadata: { reference: checkout.reference, reused: checkout.reused } });
            return { ok: true, checkout };
        } catch (error) { return fail(reply, error); }
    });

    fastify.post('/swaps/:id/paystack/verify', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        const { id } = req.params as { id: string };
        try {
            z.string().uuid().parse(id);
            const outcome = await verifyPaystackForSwap(id);
            return { ok: true, ...outcome, swap: await getSwap(id) };
        } catch (error) { return fail(reply, error); }
    });

    fastify.post('/swaps/:id/complete', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        const { id } = req.params as { id: string };
        try {
            const swap = await completeSwap(id, req.body, actor.userId);
            await logAction({ actorUserId: actor.userId, actorType: 'staff', actorRole: actor.role, ip: req.ip, action: 'pue.swap.completed', targetType: 'pue_swap', targetId: id, after: { batteryOutId: swap.batteryOutId, batteryInId: swap.batteryInId } });
            return { ok: true, swap };
        } catch (error) { return fail(reply, error); }
    });

    fastify.post('/swaps/:id/cancel', async (req, reply) => {
        const actor = req.actor!;
        if (!operatorOnly(actor.role, reply)) return undefined;
        const { id } = req.params as { id: string };
        try {
            const result = await cancelSwap(id, req.body, actor.userId);
            await logAction({ actorUserId: actor.userId, actorType: 'staff', actorRole: actor.role, ip: req.ip, action: 'pue.swap.cancelled', targetType: 'pue_swap', targetId: id, metadata: { reason: result.reason } });
            return { ok: true, swap: result.swap };
        } catch (error) { return fail(reply, error); }
    });

    fastify.get('/batteries/:id/custody', async (req, reply) => {
        try { return { ok: true, events: await batteryCustody((req.params as { id: string }).id) }; } catch (error) { return fail(reply, error); }
    });
};

export default route;
