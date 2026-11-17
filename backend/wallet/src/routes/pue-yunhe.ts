/**
 * Beverly PUE gateway to the Yunhe battery platform.
 *
 *   POST /api/v1/pue/yunhe/query    read-only lookups (batteries, stations, mileage)
 *   POST /api/v1/pue/yunhe/command  physical battery commands (cutoff, DTU reboot)
 *
 * Staff only. The shared staff gate also requires the `pue` portal for the
 * X-Beverly-Portal: pue header. Commands additionally need an operations role,
 * are audited before and after, and answer success only on a Yunhe receipt.
 */
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { logAction } from '../services/audit.js';
import {
    yunheCommand, yunheQuery, YunheGatewayError,
    YUNHE_QUERY_FUNCS,
} from '../services/yunhe-gateway.js';

/** Roles allowed to act on physical batteries. Reads need only PUE portal access. */
export const YUNHE_COMMAND_ROLES: ReadonlySet<string> = new Set(['super-admin', 'operations-manager', 'operations-officer']);

const querySchema = z.object({
    func: z.enum(YUNHE_QUERY_FUNCS),
    business: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).default({}),
});

const batteryId = z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/, 'Battery id has invalid characters.');
const commandSchema = z.discriminatedUnion('func', [
    z.object({ func: z.literal('bat_control'), batteryId, allowCharge: z.boolean().default(true), allowDischarge: z.boolean(), reason: z.string().trim().min(3).max(200) }),
    z.object({ func: z.literal('bat_reboot'), batteryId, reason: z.string().trim().min(3).max(200) }),
]);

const route: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preHandler', fastify.requireStaff());

    fastify.post('/yunhe/query', async (req, reply) => {
        const body = querySchema.parse(req.body);
        try {
            return { ok: true, ...(await yunheQuery(body.func, body.business)) };
        } catch (error) {
            if (error instanceof YunheGatewayError) return reply.code(error.statusCode).send({ error: error.code, message: error.message });
            throw error;
        }
    });

    fastify.post('/yunhe/command', async (req, reply) => {
        const actor = req.actor!;
        if (!YUNHE_COMMAND_ROLES.has(actor.role)) {
            return reply.code(403).send({ error: 'forbidden', message: 'Your role cannot send commands to batteries.' });
        }
        const body = commandSchema.parse(req.body);
        const target = { targetType: 'battery', targetId: body.batteryId } as const;
        const intent = { func: body.func, reason: body.reason, ...(body.func === 'bat_control' ? { allowCharge: body.allowCharge, allowDischarge: body.allowDischarge } : {}) };
        const who = { actorUserId: actor.userId, actorType: 'staff', actorRole: actor.role, ip: req.ip } as const;

        // Record intent first: if the platform call hangs or the process dies, the attempt is still on file.
        await logAction({ ...who, ...target, action: 'pue.battery_command.requested', metadata: intent });
        try {
            const receipt = body.func === 'bat_control'
                ? await yunheCommand('bat_control', { battery_id: body.batteryId, charge_fet: body.allowCharge ? 1 : 0, discharge_fet: body.allowDischarge ? 1 : 0 })
                : await yunheCommand('bat_reboot', { battery_id: body.batteryId });
            await logAction({ ...who, ...target, action: 'pue.battery_command.confirmed', metadata: { ...intent, providerMessage: receipt.providerMessage } });
            return { ok: true, confirmed: true, receipt };
        } catch (error) {
            const message = error instanceof YunheGatewayError ? error.message : 'The command could not be completed.';
            await logAction({ ...who, ...target, action: 'pue.battery_command.failed', metadata: { ...intent, error: error instanceof YunheGatewayError ? error.code : 'unexpected' } });
            if (error instanceof YunheGatewayError) return reply.code(error.statusCode).send({ error: error.code, confirmed: false, message });
            throw error;
        }
    });
};

export default route;
