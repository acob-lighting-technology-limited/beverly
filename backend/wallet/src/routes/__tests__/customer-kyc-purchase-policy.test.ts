import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import customerRoutes from '../customer.js';

describe('customer purchase KYC policy', () => {
    it.each([['/purchase', true], ['/purchase/preview', true], ['/meter-orders', true]])(
        'enforces enabled verification for %s', async (url, enabled) => {
            const app = Fastify();
            app.decorate('requireCustomer', () => async (req: any) => { req.actor = { customerId: 'customer-1', userId: 'user-1', role: 'customer' }; });
            app.decorate('requireKycTier', (minimum: number) => async (req: any, reply: any) => {
                req.actor = { customerId: 'customer-1', userId: 'user-1', role: 'customer' };
                if (enabled && minimum > 0) return reply.code(403).send({ error: 'kyc_tier_required' });
            });
            await app.register(customerRoutes);
            const response = await app.inject({ method: 'POST', url, payload: {} });
            expect(response.statusCode).toBe(403);
            expect(response.json().error).toBe('kyc_tier_required');
            await app.close();
        },
    );
});
