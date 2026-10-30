import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ unavailable: false, paged: false, notify: vi.fn() }));
const disputeId = '11111111-1111-4111-8111-111111111111';

vi.mock('../../services/notifications.js', async (original) => ({ ...(await original() as any), notifyDisputeUpdate: fixture.notify }));
vi.mock('../../db/supabase.js', () => ({
    adminClient: {
        storage: { from() { return { createSignedUrl: async () => ({ data: { signedUrl: 'https://storage.test/evidence' }, error: null }) }; } },
        from(table: string) {
            let selection = '';
            let pageSize = 200;
            let cursorId = '';
            const query: any = {
                select(value: string) { selection = value; return query; },
                insert() { return query; }, update() { return query; },
                single: async () => ({ data: { id: 'message-1' }, error: null }),
                eq() { return query; }, order() { return query; }, limit(value: number) { pageSize = value; return query; },
                or(value: string) { cursorId = value.match(/id\.lt\.([0-9a-f-]+)/)?.[1] ?? ''; return query; },
                lt() { return query; }, not() { return query; },
                maybeSingle: async () => fixture.unavailable
                    ? { data: null, error: { message: 'Dispute records unavailable' } }
                    : { data: table === 'disputes' ? { id: disputeId, customer_id: 'customer-1', reference: 'DISP-2026-00006', subject: 'Meter issue', status: 'open', created_at: '2026-10-29T00:00:00Z', evidence_paths: ['customer/a/case/proof.pdf'], dispute_messages: [] } : null, error: null },
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
    it('notifies the customer after a staff reply', async () => {
        fixture.notify.mockReset().mockResolvedValue(undefined);
        const app = await createApp();
        try {
            const response = await app.inject({ method: 'PATCH', url: `/disputes/${disputeId}`, payload: { message: 'We are investigating.' } });
            expect(response.statusCode).toBe(200);
            expect(fixture.notify).toHaveBeenCalledWith('customer-1', expect.objectContaining({ disputeId, messageId: 'message-1' }));
        } finally { await app.close(); }
    });
    it('rejects a combined status change and reply', async () => {
        const app = await createApp();
        try {
            const response = await app.inject({ method: 'PATCH', url: `/disputes/${disputeId}`, payload: { status: 'under_review', message: 'Investigating.' } });
            expect(response.statusCode).toBe(400);
        } finally { await app.close(); }
    });
    it('does not mark an uncredited dispute as refunded', async () => {
        const app = await createApp();
        try {
            const response = await app.inject({ method: 'PATCH', url: `/disputes/${disputeId}`, payload: { status: 'refund_issued' } });
            expect(response.statusCode).toBe(409);
        } finally { await app.close(); }
    });
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
            expect(response.json().evidence[0].url).toBe('https://storage.test/evidence');
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
