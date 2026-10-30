import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ unavailable: false, paged: false }));
const disputeId = '11111111-1111-4111-8111-111111111111';

vi.mock('../../db/supabase.js', () => ({
    adminClient: {
        from(table: string) {
            let selection = '';
            let pageSize = 200;
            let cursorId = '';
            const query: any = {
                select(value: string) { selection = value; return query; },
                eq() { return query; }, order() { return query; }, limit(value: number) { pageSize = value; return query; },
                or(value: string) { cursorId = value.match(/id\.lt\.([0-9a-f-]+)/)?.[1] ?? ''; return query; },
                lt() { return query; },
                maybeSingle: async () => fixture.unavailable
                    ? { data: null, error: { message: 'Dispute records unavailable' } }
                    : { data: table === 'disputes' ? { id: disputeId, reference: 'DISP-2026-00006', subject: 'Meter issue', status: 'open', created_at: '2026-10-29T00:00:00Z', dispute_messages: [] } : null, error: null },
                then(resolve: (value: unknown) => unknown) {
                    if (fixture.unavailable || selection.includes('customers(users(')) {
                        return resolve({ data: null, error: { message: 'Dispute records unavailable' } });
                    }
                    if (fixture.paged && table === 'disputes') {
                        const rows = [3, 2, 1].map((number) => ({ id: `11111111-1111-4111-8111-${String(number).padStart(12, '0')}`, reference: `DISP-${number}`, subject: 'Case', status: 'open', created_at: '2026-10-29T00:00:00Z' }));
                        return resolve({ data: rows.filter((row) => !cursorId || row.id < cursorId).slice(0, pageSize), error: null });
                    }
                    return resolve({ data: table === 'disputes' ? [{ id: disputeId, reference: 'DISP-2026-00006', subject: 'Meter issue', status: 'open', created_at: '2026-10-29T00:00:00Z', customers: { full_name: 'Customer A' } }] : [], error: null });
                },
            };
            return query;
        },
    },
}));

import adminRoutes from '../admin.js';

async function createApp() {
    const app = Fastify();
    app.decorate('requireStaff', () => async (req: any) => {
        req.actor = { userId: disputeId, actorId: disputeId, type: 'staff', role: 'super-admin', stationIds: ['*'] };
    });
    await app.register(adminRoutes);
    return app;
}

describe('admin disputes HTTP contract', () => {
    it('returns existing disputes with customer names', async () => {
        const app = await createApp();
        try {
            const response = await app.inject('/disputes');
            expect(response.statusCode).toBe(200);
            expect(response.json().disputes).toEqual([expect.objectContaining({ reference: 'DISP-2026-00006', customers: { full_name: 'Customer A' } })]);
        } finally { await app.close(); }
    });
    it('reports a storage failure rather than an empty list', async () => {
        fixture.unavailable = true;
        const app = await createApp();
        try {
            const response = await app.inject('/disputes');
            expect(response.statusCode).toBeGreaterThanOrEqual(500);
        } finally { fixture.unavailable = false; await app.close(); }
    });
    it('retrieves the referenced dispute directly', async () => {
        const app = await createApp();
        try {
            const response = await app.inject(`/disputes/${disputeId}`);
            expect(response.statusCode).toBe(200);
            expect(response.json().reference).toBe('DISP-2026-00006');
        } finally { await app.close(); }
    });
    it('pages disputes without dropping equal timestamps', async () => {
        fixture.paged = true;
        const app = await createApp();
        try {
            const first = (await app.inject('/disputes?limit=2')).json();
            expect(first.disputes.map((row: any) => row.reference)).toEqual(['DISP-3', 'DISP-2']);
            expect(first.nextCursor).toBeTruthy();
            const second = (await app.inject(`/disputes?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`)).json();
            expect(second.disputes.map((row: any) => row.reference)).toEqual(['DISP-1']);
        } finally { fixture.paged = false; await app.close(); }
    });
});
