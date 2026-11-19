/**
 * Beverly PUE analytics API (read only).
 *
 *   GET /api/v1/pue/analytics/swaps?days=30         swap volume, revenue, stations, payment methods, peak hours
 *   GET /api/v1/pue/analytics/appliances?days=30    sales, collections, what is owed, stock, faults
 *
 * Staff only (PUE portal). Worked out from Beverly's own records; live battery readings come from the
 * Yunhe gateway and are joined in the browser.
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { applianceAnalytics, PueAnalyticsError, swapAnalytics } from '../services/pue-analytics.js';

const query = z.object({ days: z.coerce.number().int().refine((n) => [7, 14, 30, 90, 180, 365].includes(n), 'Choose 7, 14, 30, 90, 180 or 365 days.').default(30) });

const route: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preHandler', fastify.requireStaff());

    const fail = (reply: FastifyReply, error: unknown) => {
        if (error instanceof PueAnalyticsError) return reply.code(error.statusCode).send({ error: error.code, message: error.message });
        throw error;
    };

    fastify.get('/analytics/swaps', async (req, reply) => {
        try {
            const { days } = query.parse(req.query);
            return { ok: true, analytics: await swapAnalytics(days) };
        } catch (error) { return fail(reply, error); }
    });

    fastify.get('/analytics/appliances', async (req, reply) => {
        try {
            const { days } = query.parse(req.query);
            return { ok: true, analytics: await applianceAnalytics(days) };
        } catch (error) { return fail(reply, error); }
    });
};

export default route;
