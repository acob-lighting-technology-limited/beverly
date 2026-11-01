import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

const observed = vi.hoisted(() => ({ createTicket: vi.fn(async () => ({ id: 'ticket', reference: 'TKT-1' })), createChat: vi.fn(async () => ({ id: 'chat', created: true })) }));
vi.mock('../../db/supabase.js', () => ({ adminClient: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { full_name: 'Example' } }) }) }) }) } }));
vi.mock('../../services/support-meters.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../services/support-meters.js')>()),
    customerSupportMeters: vi.fn(async () => [{ meter_id: 'OWN-1', station_id: 'TUNGA' }]),
    vendorSupportMeters: vi.fn(async () => [{ meter_id: 'SOLD-1', station_id: 'TUNGA' }, { meter_id: 'ASSIGNED-1', station_id: 'TUNGA' }]),
}));
vi.mock('../../services/support.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../services/support.js')>()),
    createTicket: observed.createTicket,
    getOrCreateChatSession: observed.createChat,
}));
vi.mock('../../queue/index.js', () => ({ exportsQueue: { add: vi.fn() }, notificationsQueue: { add: vi.fn() } }));

import customerRoutes from '../customer.js';
import vendorRoutes from '../vendor.js';

async function createApp() {
    const app = Fastify();
    app.decorate('requireCustomer', () => async (req: any) => { req.actor = { userId: 'user', customerId: 'customer', role: 'customer' }; });
    app.decorate('requireKycTier', () => async (req: any) => { req.actor = { userId: 'user', customerId: 'customer', role: 'customer' }; });
    await app.register(customerRoutes);
    return app;
}

describe('support meter selection', () => {
    const payload = { subject: 'Need help', description: 'Please investigate my issue.' };

    it('requires an explicit selection', async () => {
        const app = await createApp();
        const res = await app.inject({ method: 'POST', url: '/support/tickets', payload });
        expect(res.statusCode).toBe(400);
        await app.close();
    });

    it('allows a non-meter issue', async () => {
        const app = await createApp();
        const res = await app.inject({ method: 'POST', url: '/support/tickets', payload: { ...payload, meter_context: [] } });
        expect(res.statusCode).toBe(200);
        expect(observed.createTicket).toHaveBeenLastCalledWith(expect.objectContaining({ meterContext: [] }));
        await app.close();
    });

    it('rejects another customer meter', async () => {
        const app = await createApp();
        const res = await app.inject({ method: 'POST', url: '/support/tickets', payload: { ...payload, meter_context: [{ meter_id: 'OTHER', station_id: 'TUNGA' }] } });
        expect(res.statusCode).toBe(403);
        await app.close();
    });

    it('passes approved meter context to chat', async () => {
        const app = await createApp();
        const meter_context = [{ meter_id: 'OWN-1', station_id: 'TUNGA' }];
        const res = await app.inject({ method: 'POST', url: '/support/chat/session', payload: { meter_context } });
        expect(res.statusCode).toBe(200);
        expect(observed.createChat).toHaveBeenLastCalledWith(expect.objectContaining({ meterContext: meter_context }));
        await app.close();
    });

    it('rejects another customer meter in chat', async () => {
        const app = await createApp();
        const res = await app.inject({ method: 'POST', url: '/support/chat/session', payload: { meter_context: [{ meter_id: 'OTHER', station_id: 'TUNGA' }] } });
        expect(res.statusCode).toBe(403);
        await app.close();
    });
});

describe('vendor support meter selection', () => {
    async function vendorApp() {
        const app = Fastify();
        const actor = { userId: 'user', actorId: 'vendor-user', vendorOrganizationId: 'vendor-org', stationId: 'TUNGA', type: 'vendor_user', role: 'vendor' };
        app.decorate('requireVendor', () => async (req: any) => { req.actor = actor; });
        app.decorate('requireAuth', () => async (req: any) => { req.actor = actor; });
        await app.register(vendorRoutes);
        return app;
    }

    it('accepts sold and assigned meters together', async () => {
        const app = await vendorApp();
        const meter_context = [{ meter_id: 'SOLD-1', station_id: 'TUNGA' }, { meter_id: 'ASSIGNED-1', station_id: 'TUNGA' }];
        const res = await app.inject({ method: 'POST', url: '/support/tickets', payload: { subject: 'Need help', description: 'Please investigate my issue.', meter_context } });
        expect(res.statusCode).toBe(200);
        expect(observed.createTicket).toHaveBeenLastCalledWith(expect.objectContaining({ meterContext: meter_context }));
        await app.close();
    });

    it('rejects unassociated meters', async () => {
        const app = await vendorApp();
        const res = await app.inject({ method: 'POST', url: '/support/chat/session', payload: { meter_context: [{ meter_id: 'OTHER', station_id: 'TUNGA' }] } });
        expect(res.statusCode).toBe(403);
        await app.close();
    });
});
