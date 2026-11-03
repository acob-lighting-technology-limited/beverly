import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ role: 'operations-manager', profile: true }));
vi.mock('../../config/env.js', () => ({ env: { SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'test-key' } }));
vi.mock('../../db/supabase.js', () => ({ adminClient: {
    from: () => ({ select: () => ({ or: () => ({ maybeSingle: async () => ({ data: fixture.profile ? { role_key: fixture.role, user_name: 'Operations User', email: 'staff@example.test' } : null, error: null }) }) }) }),
    auth: { admin: { signOut: vi.fn(async () => undefined) } },
} }));
vi.mock('../../services/audit.js', () => ({ logSecurityEvent: vi.fn(async () => undefined) }));
vi.mock('../../services/password-reset.js', () => ({ requestPasswordReset: vi.fn(), verifyPasswordResetOtp: vi.fn(), confirmPasswordReset: vi.fn(), PasswordResetError: class extends Error {} }));
import routes from '../admin-password-recovery.js';

describe('operations staff wallet login', () => {
    afterEach(() => vi.unstubAllGlobals());
    it.each(['operations-manager', 'operations-officer'])('authenticates %s with its database role', async (role) => {
        fixture.role = role; fixture.profile = true;
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ access_token: 'test-token', user: { id: 'staff-id', user_metadata: { role_key: 'super-admin' } } }), { status: 200 })));
        const app = Fastify(); await app.register(routes);
        const response = await app.inject({ method: 'POST', url: '/password-login', payload: { email: 'staff@example.test', password: 'password' } });
        expect(response.statusCode).toBe(200);
        expect(response.json().user.role).toBe(role);
        await app.close();
    });
    it('rejects metadata without a staff profile', async () => {
        fixture.profile = false;
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ access_token: 'test-token', user: { id: 'user-id', user_metadata: { role_key: 'super-admin' } } }), { status: 200 })));
        const app = Fastify(); await app.register(routes);
        const response = await app.inject({ method: 'POST', url: '/password-login', payload: { email: 'staff@example.test', password: 'password' } });
        expect(response.statusCode).toBe(403);
        await app.close();
    });
});
