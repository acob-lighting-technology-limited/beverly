import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ role: 'operations-manager', portals: ['pue'] as string[] | null, profile: true }));
vi.mock('../../config/env.js', () => ({ env: { SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'test-key' } }));
const signOut = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../../db/supabase.js', () => ({ adminClient: {
    from: () => ({ select: () => ({ or: () => ({ maybeSingle: async () => ({
        data: fixture.profile ? { role_key: fixture.role, user_name: 'Ops User', email: 'staff@example.test', portal_access: fixture.portals } : null, error: null,
    }) }) }) }),
    auth: { admin: { signOut } },
} }));
vi.mock('../../services/audit.js', () => ({ logSecurityEvent: vi.fn(async () => undefined) }));
vi.mock('../../services/password-reset.js', () => ({ requestPasswordReset: vi.fn(), verifyPasswordResetOtp: vi.fn(), confirmPasswordReset: vi.fn(), PasswordResetError: class extends Error {} }));
import routes from '../admin-password-recovery.js';

const grantOk = () => new Response(JSON.stringify({
    access_token: 'new-access', refresh_token: 'new-refresh', expires_at: 4102444800, expires_in: 3600, user: { id: 'staff-id', email: 'staff@example.test' },
}), { status: 200 });
const call = async (payload: unknown = { refresh_token: 'old-refresh-token', portal: 'pue' }) => {
    const app = Fastify();
    await app.register(routes);
    const response = await app.inject({ method: 'POST', url: '/password-refresh', payload: payload as object });
    await app.close();
    return response;
};

describe('staff session refresh', () => {
    afterEach(() => { vi.unstubAllGlobals(); signOut.mockClear(); fixture.role = 'operations-manager'; fixture.portals = ['pue']; fixture.profile = true; });

    it('exchanges the refresh token for a new session and returns the new refresh token', async () => {
        const fetchMock = vi.fn(async () => grantOk());
        vi.stubGlobal('fetch', fetchMock);
        const response = await call();
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ access_token: 'new-access', refresh_token: 'new-refresh', expires_at: 4102444800, user: { role: 'operations-manager', portal_access: ['pue'] } });
        expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('grant_type=refresh_token');
    });

    it('says the session is over when the refresh token is rejected', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })));
        const response = await call();
        expect(response.statusCode).toBe(401);
        expect(response.json().error).toBe('refresh_rejected');
    });

    it('does NOT say the session is over when the auth service is down', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
        expect((await call()).statusCode).toBe(503);
        vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 502 })));
        expect((await call()).statusCode).toBe(503);
    });

    it('stops a person whose portal access was removed, and signs them out everywhere', async () => {
        fixture.portals = ['staff_wallet'];
        vi.stubGlobal('fetch', vi.fn(async () => grantOk()));
        const response = await call();
        expect(response.statusCode).toBe(403);
        expect(response.json().error).toBe('portal_access_denied');
        expect(signOut).toHaveBeenCalled();
    });

    it('stops an account that is no longer staff', async () => {
        fixture.profile = false;
        vi.stubGlobal('fetch', vi.fn(async () => grantOk()));
        const response = await call();
        expect(response.statusCode).toBe(403);
        expect(response.json().error).toBe('staff_access_denied');
    });

    it('refuses a request with no refresh token', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => grantOk()));
        const response = await call({ portal: 'pue' });
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
});
