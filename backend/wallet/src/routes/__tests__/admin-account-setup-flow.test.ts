import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * End to end for the invitee's last step: the "Set up your account" page posts
 * the new password to POST /api/v1/admin/account-setup with the invitation
 * token. This runs the real requireStaff gate and the real route together under
 * the production prefix, with only the database and Supabase Auth faked.
 */

const db = vi.hoisted(() => ({
    staff: null as Record<string, unknown> | null,
    profileUpdates: [] as Record<string, unknown>[],
    passwordUpdates: [] as { userId: string; password: string }[],
    signOuts: [] as string[],
    authUpdateError: null as unknown,
    profileUpdateError: null as unknown,
}));

vi.mock('../../services/kyc-policy.js', () => ({ isKycRequiredForSubject: vi.fn(async () => false) }));
vi.mock('../../services/vendor-mfa.js', () => ({ vendorMfaSessionVerified: vi.fn(async () => false) }));
vi.mock('../../services/staff-mfa.js', () => ({ staffMfaEnrolled: vi.fn(async () => false), staffMfaSessionVerified: vi.fn(async () => false) }));
vi.mock('../../services/portal-session.js', () => ({ enforcePortalSession: vi.fn(async () => 'session-1'), PortalSessionError: class extends Error {} }));
vi.mock('../../services/audit.js', () => ({
    logAction: vi.fn(async () => true),
    auditFromRequest: () => ({ ip: '127.0.0.1', userAgent: 'test', correlationId: 'test' }),
}));
vi.mock('../../db/supabase.js', () => ({
    adminClient: {
        auth: {
            getUser: vi.fn(async () => ({ data: { user: { id: 'auth-1', email: 'ada@acoblighting.com', user_metadata: {} } }, error: null })),
            admin: {
                updateUserById: vi.fn(async (userId: string, attrs: { password: string }) => {
                    db.passwordUpdates.push({ userId, password: attrs.password });
                    return { error: db.authUpdateError };
                }),
                signOut: vi.fn(async (userId: string) => { db.signOuts.push(userId); return { error: null }; }),
            },
        },
        from: (table: string) => {
            if (table === 'users') {
                return {
                    select: () => ({ or: () => ({ maybeSingle: async () => ({ data: db.staff, error: null }) }) }),
                    update: (payload: Record<string, unknown>) => ({
                        or: async () => { db.profileUpdates.push(payload); return { error: db.profileUpdateError }; },
                    }),
                };
            }
            // vendor_users and customers: this auth user is neither.
            const chain: any = new Proxy({}, {
                get: (_target, prop) => prop === 'maybeSingle' ? async () => ({ data: null, error: null }) : prop === 'then' ? undefined : () => chain,
            });
            return chain;
        },
    },
}));

import authPlugin from '../../plugins/auth.js';
import adminRoutes from '../admin.js';

const strongPassword = 'AcoB!2026SecurePass1';
const token = `h.${Buffer.from(JSON.stringify({ iat: Math.floor(Date.now() / 1000), session_id: 's-1' })).toString('base64url')}.s`;

const invitee = (overrides: Record<string, unknown> = {}) => ({
    id: 'row-1', auth_user_id: 'auth-1', user_id: 'auth-1', email: 'ada@acoblighting.com', role_key: 'account',
    station_id: null, station_ids: ['*'], portal_access: ['crm', 'call'],
    password_reset_required: true, password_changed_at: null, password_session_id: null,
    ...overrides,
});

async function app() {
    const instance = Fastify();
    await instance.register(authPlugin);
    await instance.register(adminRoutes, { prefix: '/api/v1/admin' });
    return instance;
}

const post = (instance: Awaited<ReturnType<typeof app>>, password: string) => instance.inject({
    method: 'POST', url: '/api/v1/admin/account-setup',
    headers: { authorization: `Bearer ${token}`, 'x-beverly-portal': 'staff_wallet', 'content-type': 'application/json' },
    payload: { password },
});

beforeEach(() => {
    db.staff = invitee();
    db.profileUpdates = []; db.passwordUpdates = []; db.signOuts = [];
    db.authUpdateError = null; db.profileUpdateError = null;
});

describe('POST /api/v1/admin/account-setup (invitee sets a password)', () => {
    it('activates an invited account: saves the password, clears the reset flag, ends the invitation session', async () => {
        const instance = await app();
        try {
            const response = await post(instance, strongPassword);
            expect(response.statusCode, response.body).toBe(200);
            expect(response.json()).toEqual({ ok: true });
            expect(db.passwordUpdates).toEqual([{ userId: 'auth-1', password: strongPassword }]);
            expect(db.profileUpdates).toHaveLength(1);
            expect(db.profileUpdates[0]).toMatchObject({ password_reset_required: false, password_session_id: null });
            expect(typeof db.profileUpdates[0]?.password_changed_at).toBe('string');
            expect(db.signOuts).toEqual(['auth-1']);
        } finally { await instance.close(); }
    });

    it('works for an invitee who was not given Staff Wallet access', async () => {
        db.staff = invitee({ portal_access: ['call'] });
        const instance = await app();
        try {
            expect((await post(instance, strongPassword)).statusCode).toBe(200);
        } finally { await instance.close(); }
    });

    it('rejects a weak password without touching the account', async () => {
        const instance = await app();
        try {
            const response = await post(instance, 'password1234');
            expect(response.statusCode).toBe(422);
            expect(response.json()).toMatchObject({ error: 'weak_password' });
            expect(db.passwordUpdates).toEqual([]);
            expect(db.profileUpdates).toEqual([]);
        } finally { await instance.close(); }
    });

    it('refuses an account that is already active', async () => {
        db.staff = invitee({ password_reset_required: false });
        const instance = await app();
        try {
            const response = await post(instance, strongPassword);
            expect(response.statusCode).toBe(409);
            expect(response.json()).toMatchObject({ error: 'account_already_active' });
            expect(db.passwordUpdates).toEqual([]);
        } finally { await instance.close(); }
    });

    it('reports a password-save failure and does not clear the reset flag', async () => {
        db.authUpdateError = new Error('upstream');
        const instance = await app();
        try {
            const response = await post(instance, strongPassword);
            expect(response.statusCode).toBe(503);
            expect(response.json()).toMatchObject({ error: 'account_setup_failed' });
            expect(db.profileUpdates).toEqual([]);
            expect(db.signOuts).toEqual([]);
        } finally { await instance.close(); }
    });

    it('tells the invitee to contact an admin when activation cannot be saved', async () => {
        db.profileUpdateError = new Error('db');
        const instance = await app();
        try {
            const response = await post(instance, strongPassword);
            expect(response.statusCode).toBe(503);
            expect(response.json()).toMatchObject({ error: 'account_setup_incomplete' });
            expect(db.signOuts).toEqual([]);
        } finally { await instance.close(); }
    });
});
