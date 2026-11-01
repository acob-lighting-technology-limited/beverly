import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

const current = vi.hoisted(() => ({ required: false, tier: 0 }));
vi.mock('../../services/kyc-policy.js', () => ({ isKycRequiredForSubject: vi.fn(async () => current.required) }));
vi.mock('../../db/supabase.js', () => ({
    adminClient: {
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-1', email: 'test@example.com', user_metadata: {} } }, error: null })) },
        from: (table: string) => ({ select() { return this; }, eq() { return this; }, or() { return this; }, maybeSingle: async () => ({ data: table === 'customers' ? { id: 'customer-1', status: 'active', kyc_tier: current.tier, auth_provider: 'email_password', email_verified_at: '2026-01-01T00:00:00Z' } : null, error: null }) }),
    },
}));
vi.mock('../../services/vendor-mfa.js', () => ({ vendorMfaSessionVerified: vi.fn() }));
vi.mock('../../services/vendor-password-change.js', () => ({ tokenAllowedAfterPasswordChange: () => true }));
vi.mock('../../services/staff-mfa.js', () => ({ staffMfaEnrolled: vi.fn(), staffMfaSessionVerified: vi.fn() }));
vi.mock('../../services/portal-session.js', () => ({ enforcePortalSession: vi.fn(async () => 'session-1'), PortalSessionError: class extends Error {} }));

describe('customer KYC authorization', () => {
    it.each([[false, 0, 200], [true, 0, 403], [true, 1, 200]])(
        'applies required=%s at tier %s', async (required, tier, expected) => {
            current.required = required; current.tier = tier;
            const { default: authPlugin } = await import('../auth.js');
            const app = Fastify();
            await app.register(authPlugin);
            app.post('/purchase', { preHandler: app.requireKycTier(1) }, async () => ({ ok: true }));
            const response = await app.inject({ method: 'POST', url: '/purchase', headers: { authorization: 'Bearer token' } });
            expect(response.statusCode).toBe(expected);
            await app.close();
        },
    );
});
