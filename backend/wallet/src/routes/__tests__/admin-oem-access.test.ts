import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

const breakGlassToken = 'test-break-glass-token-0000000000000000';
vi.hoisted(() => {
    process.env.DEV_CONSOLE_ENABLED = 'true';
    process.env.DEV_CONSOLE_BREAK_GLASS_TOKEN = 'test-break-glass-token-0000000000000000';
});

vi.mock('../../services/audit.js', () => ({
    logAction: vi.fn(async () => true),
    auditFromRequest: () => ({ ip: '127.0.0.1', userAgent: 'test', correlationId: 'test' }),
}));

vi.mock('../../db/supabase.js', () => ({
    adminClient: {
        from: (table: string) => {
            if (table !== 'permissions') throw new Error(`Unexpected table: ${table}`);
            return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
        },
    },
}));

import adminRoutes from '../admin.js';

async function adminApp(role: string) {
    const app = Fastify();
    app.decorate('requireStaff', () => async (req) => {
        req.actor = {
            userId: '11111111-1111-4111-8111-111111111111',
            actorId: '11111111-1111-4111-8111-111111111111',
            email: null, type: 'staff', role, mfaVerified: true,
            stationIds: ['*'],
        };
    });
    await app.register(adminRoutes);
    return app;
}

describe('admin OEM HTTP authorization', () => {
    it('lets a super-admin read the OEM registry through the admin plugin', async () => {
        const app = await adminApp('super-admin');
        try {
            const response = await app.inject({ url: '/dev/oem', headers: { 'x-break-glass-token': breakGlassToken } });
            expect(response.statusCode).toBe(200);
            expect(response.json().oems).toContainEqual(expect.objectContaining({ slug: 'sparkmeter', status: 'draft' }));
        } finally { await app.close(); }
    });

    it('denies an actor without dev.console through the admin plugin', async () => {
        const app = await adminApp('operations-manager');
        try {
            const response = await app.inject({ url: '/dev/oem', headers: { 'x-break-glass-token': breakGlassToken } });
            expect(response.statusCode).toBe(403);
            expect(response.json().error).toBe('permission_denied');
        } finally { await app.close(); }
    });
});
