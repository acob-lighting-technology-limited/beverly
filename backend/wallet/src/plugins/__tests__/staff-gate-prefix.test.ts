import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression: invited staff could not finish "Set up your account".
 *
 * Fastify reports routeOptions.url WITH its plugin prefix. The admin routes are
 * registered under /api/v1/admin in production, so the "password setup" and
 * "portal" exemptions compared '/account-setup' to '/api/v1/admin/account-setup',
 * never matched, and the invitee got "password_reset_required" on the very route
 * that sets the password. Tests that register routes without the prefix hid it.
 * This test registers the real requireStaff gate under the production prefix.
 */

type StaffRow = {
    id: string; auth_user_id: string; user_id: string; email: string; role_key: string;
    station_id: string | null; station_ids: string[]; portal_access: string[] | undefined;
    password_reset_required: boolean; password_changed_at: string | null; password_session_id: string | null;
};

const state = vi.hoisted(() => ({ staff: null as unknown as StaffRow }));

vi.mock('../../services/kyc-policy.js', () => ({ isKycRequiredForSubject: vi.fn(async () => false) }));
vi.mock('../../services/vendor-mfa.js', () => ({ vendorMfaSessionVerified: vi.fn(async () => false) }));
vi.mock('../../services/staff-mfa.js', () => ({ staffMfaEnrolled: vi.fn(async () => false), staffMfaSessionVerified: vi.fn(async () => false) }));
vi.mock('../../services/portal-session.js', () => ({ enforcePortalSession: vi.fn(async () => 'session-1'), PortalSessionError: class extends Error {} }));
vi.mock('../../db/supabase.js', () => ({
    adminClient: {
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-1', email: 'ada@acoblighting.com', user_metadata: {} } }, error: null })) },
        from: (table: string) => {
            const result = { data: table === 'users' ? state.staff : null, error: null };
            const chain: any = new Proxy({}, {
                get: (_target, prop) => prop === 'maybeSingle' ? async () => result : prop === 'then' ? undefined : () => chain,
            });
            return chain;
        },
    },
}));

const token = `h.${Buffer.from(JSON.stringify({ iat: Math.floor(Date.now() / 1000), session_id: 's-1' })).toString('base64url')}.s`;

function invitedStaff(overrides: Partial<StaffRow> = {}): StaffRow {
    return {
        id: 'row-1', auth_user_id: 'auth-1', user_id: 'auth-1', email: 'ada@acoblighting.com', role_key: 'account',
        station_id: null, station_ids: ['*'], portal_access: ['staff_wallet'],
        password_reset_required: true, password_changed_at: null, password_session_id: null,
        ...overrides,
    };
}

async function adminApp() {
    const { default: authPlugin } = await import('../auth.js');
    const app = Fastify();
    await app.register(authPlugin);
    // Same shape as routes/index.ts: the admin plugin lives under this prefix.
    await app.register(async (admin) => {
        admin.addHook('preHandler', admin.requireStaff());
        admin.get('/me', async () => ({ ok: true }));
        admin.post('/account-setup', async () => ({ ok: true }));
        admin.post('/password-change', async () => ({ ok: true }));
        admin.post('/logout', async () => ({ ok: true }));
        admin.get('/customers', async () => ({ ok: true }));
    }, { prefix: '/api/v1/admin' });
    return app;
}

const call = (app: Awaited<ReturnType<typeof adminApp>>, method: 'GET' | 'POST', path: string, portal?: string) =>
    app.inject({ method, url: `/api/v1/admin${path}`, headers: { authorization: `Bearer ${token}`, ...(portal ? { 'x-beverly-portal': portal } : {}) } });

afterEach(() => { vi.clearAllMocks(); });

describe('staff gate under the production /api/v1/admin prefix', () => {
    it.each([
        ['POST', '/account-setup'], ['GET', '/me'], ['POST', '/password-change'], ['POST', '/logout'],
    ] as const)('lets an invited staff member call %s %s before the account is active', async (method, path) => {
        state.staff = invitedStaff();
        const app = await adminApp();
        try {
            const response = await call(app, method, path);
            expect(response.statusCode, response.body).toBe(200);
        } finally { await app.close(); }
    });

    it('still blocks every other route until the password is set', async () => {
        state.staff = invitedStaff();
        const app = await adminApp();
        try {
            const response = await call(app, 'GET', '/customers');
            expect(response.statusCode).toBe(403);
            expect(response.json()).toMatchObject({ error: 'password_reset_required', message: 'Set your account password before continuing.' });
        } finally { await app.close(); }
    });

    it('lets an active staff member use normal routes', async () => {
        state.staff = invitedStaff({ password_reset_required: false });
        const app = await adminApp();
        try {
            expect((await call(app, 'GET', '/customers')).statusCode).toBe(200);
        } finally { await app.close(); }
    });

    it('lets an invitee without Staff Wallet access still set their password and sign out', async () => {
        state.staff = invitedStaff({ portal_access: ['call'] });
        const app = await adminApp();
        try {
            expect((await call(app, 'POST', '/account-setup')).statusCode).toBe(200);
            expect((await call(app, 'POST', '/logout')).statusCode).toBe(200);
        } finally { await app.close(); }
    });

    it('denies an active staff member a portal they were not given', async () => {
        state.staff = invitedStaff({ password_reset_required: false, portal_access: ['call'] });
        const app = await adminApp();
        try {
            const denied = await call(app, 'GET', '/customers', 'staff_wallet');
            expect(denied.statusCode).toBe(403);
            expect(denied.json()).toMatchObject({ error: 'portal_access_denied', portal: 'staff_wallet' });
        } finally { await app.close(); }
    });

    it('lets a super admin reach every portal even with an empty list', async () => {
        state.staff = invitedStaff({ role_key: 'super-admin', password_reset_required: false, portal_access: [] });
        const app = await adminApp();
        try {
            expect((await call(app, 'GET', '/customers', 'pue')).statusCode).toBe(200);
        } finally { await app.close(); }
    });
});
