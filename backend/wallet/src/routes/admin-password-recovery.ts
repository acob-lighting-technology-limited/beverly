import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requestPasswordReset, verifyPasswordResetOtp, confirmPasswordReset, PasswordResetError } from '../services/password-reset.js';
import { logSecurityEvent } from '../services/audit.js';
import { env } from '../config/env.js';
import { adminClient } from '../db/supabase.js';
import { effectivePortalAccess, isMissingPortalAccessColumn, portalLabel } from '../services/staff-portal-access.js';

const STAFF_ROLES = new Set(['super-admin', 'developer', 'account', 'finance-checker', 'operations-manager', 'operations-officer']);

const routes: FastifyPluginAsync = async (fastify) => {
    fastify.post('/password-login', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
        const { email, password, portal } = z.object({
            email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
            password: z.string().min(1).max(200),
            /* Which portal is signing in. CRM signs in through the gateway, Beverly Call through its own project. */
            portal: z.enum(['staff_wallet', 'pue']).default('staff_wallet'),
        }).parse(req.body);
        let response: Response;
        try {
            response = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: env.SUPABASE_ANON_KEY },
                body: JSON.stringify({ email, password }),
            });
        } catch {
            return reply.code(503).send({ error: 'auth_upstream_unreachable', message: 'Authentication service is temporarily unavailable.' });
        }
        const grant = await response.json().catch(() => ({})) as any;
        if (!response.ok || !grant.access_token || !grant.user?.id) {
            const unconfirmed = /confirm|verified/i.test(String(grant.error_description ?? grant.message ?? ''));
            return reply.code(401).send({
                error: unconfirmed ? 'email_not_confirmed' : 'invalid_credentials',
                message: unconfirmed ? 'Confirm your staff email before signing in.' : 'Invalid email or password.',
            });
        }
        const userId = String(grant.user.id);
        let staffLookup = await adminClient.from('users')
            .select('auth_user_id, user_id, email, user_name, role_key, password_reset_required, portal_access')
            .or(`auth_user_id.eq.${userId},user_id.eq.${userId}`).maybeSingle();
        // Before the portal_access migration is pushed, legacy role gates apply.
        if (staffLookup.error && isMissingPortalAccessColumn(staffLookup.error)) {
            staffLookup = await adminClient.from('users')
                .select('auth_user_id, user_id, email, user_name, role_key, password_reset_required')
                .or(`auth_user_id.eq.${userId},user_id.eq.${userId}`).maybeSingle() as typeof staffLookup;
        }
        const { data: staff, error: staffError } = staffLookup;
        const role = String((staff as any)?.role_key ?? '');
        if (staffError || !staff || (!STAFF_ROLES.has(role) && !role.startsWith('custom-'))) {
            await adminClient.auth.admin.signOut(userId, 'global').catch(() => undefined);
            await logSecurityEvent('login_failure', { severity: 'high', ip: req.ip, userAgent: req.headers['user-agent'], metadata: { surface: 'staff', reason: staffError ? 'profile_lookup_failed' : 'not_staff' } }).catch(() => undefined);
            return reply.code(staffError ? 503 : 403).send({
                error: staffError ? 'staff_profile_unavailable' : 'staff_access_denied',
                message: staffError ? 'Staff account verification is temporarily unavailable.' : 'This account does not have staff access.',
            });
        }
        const portalAccess = effectivePortalAccess(role, (staff as any).portal_access);
        if (!portalAccess.includes(portal)) {
            await adminClient.auth.admin.signOut(userId, 'global').catch(() => undefined);
            await logSecurityEvent('login_failure', { actorUserId: userId, severity: 'medium', ip: req.ip, userAgent: req.headers['user-agent'], metadata: { surface: 'staff', portal, reason: 'portal_access_denied' } }).catch(() => undefined);
            return reply.code(403).send({
                error: 'portal_access_denied',
                message: `This account is not allowed to sign in to ${portalLabel(portal)}. Ask a super admin to add it in Wallet Admin → Roles & Team.`,
            });
        }
        await logSecurityEvent('login_success', { actorUserId: userId, severity: 'info', ip: req.ip, userAgent: req.headers['user-agent'], metadata: { surface: 'staff', portal } }).catch(() => undefined);
        return {
            access_token: grant.access_token,
            refresh_token: grant.refresh_token ?? null,
            expires_at: grant.expires_at ?? null,
            expires_in: grant.expires_in ?? null,
            user: {
                id: userId,
                email: (staff as any).email ?? grant.user.email ?? email,
                full_name: (staff as any).user_name ?? grant.user.user_metadata?.full_name ?? null,
                role,
                password_reset_required: (staff as any).password_reset_required === true,
                portal_access: portalAccess,
            },
        };
    });

    /*
     * Keeps a staff session alive. The browser sends the refresh token it got at sign-in; this exchanges it
     * for a new access token and re-checks that the person still has staff access to the portal, so a
     * revoked account or removed portal stops working at the next refresh instead of lasting for days.
     */
    fastify.post('/password-refresh', { config: { rateLimit: { max: 30, timeWindow: '15 minutes' } } }, async (req, reply) => {
        const { refresh_token: refreshToken, portal } = z.object({
            refresh_token: z.string().min(10).max(2000),
            portal: z.enum(['staff_wallet', 'pue']).default('staff_wallet'),
        }).parse(req.body);
        let response: Response;
        try {
            response = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: env.SUPABASE_ANON_KEY },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });
        } catch {
            // Say "try again", not "signed out": the person's session is still good.
            return reply.code(503).send({ error: 'auth_upstream_unreachable', message: 'Authentication service is temporarily unavailable.' });
        }
        const grant = await response.json().catch(() => ({})) as any;
        if (!response.ok || !grant.access_token || !grant.user?.id) {
            if (response.status >= 500) return reply.code(503).send({ error: 'auth_upstream_unreachable', message: 'Authentication service is temporarily unavailable.' });
            return reply.code(401).send({ error: 'refresh_rejected', message: 'Your session has ended. Sign in again.' });
        }
        const userId = String(grant.user.id);
        let staffLookup = await adminClient.from('users')
            .select('auth_user_id, user_id, email, user_name, role_key, portal_access')
            .or(`auth_user_id.eq.${userId},user_id.eq.${userId}`).maybeSingle();
        if (staffLookup.error && isMissingPortalAccessColumn(staffLookup.error)) {
            staffLookup = await adminClient.from('users')
                .select('auth_user_id, user_id, email, user_name, role_key')
                .or(`auth_user_id.eq.${userId},user_id.eq.${userId}`).maybeSingle() as typeof staffLookup;
        }
        const { data: staff, error: staffError } = staffLookup;
        if (staffError) return reply.code(503).send({ error: 'staff_profile_unavailable', message: 'Staff account verification is temporarily unavailable.' });
        const role = String((staff as any)?.role_key ?? '');
        if (!staff || (!STAFF_ROLES.has(role) && !role.startsWith('custom-'))) {
            await adminClient.auth.admin.signOut(userId, 'global').catch(() => undefined);
            return reply.code(403).send({ error: 'staff_access_denied', message: 'This account does not have staff access.' });
        }
        const portalAccess = effectivePortalAccess(role, (staff as any).portal_access);
        if (!portalAccess.includes(portal)) {
            await adminClient.auth.admin.signOut(userId, 'global').catch(() => undefined);
            return reply.code(403).send({ error: 'portal_access_denied', message: `This account is not allowed to use ${portalLabel(portal)}.` });
        }
        return {
            access_token: grant.access_token,
            refresh_token: grant.refresh_token ?? refreshToken,
            expires_at: grant.expires_at ?? null,
            expires_in: grant.expires_in ?? null,
            user: {
                id: userId,
                email: (staff as any).email ?? grant.user.email ?? null,
                full_name: (staff as any).user_name ?? grant.user.user_metadata?.full_name ?? null,
                role,
                portal_access: portalAccess,
            },
        };
    });

    fastify.post('/reset-request', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (req, reply) => {
        const { email } = z.object({ email: z.string().trim().email().max(320) }).parse(req.body);
        try {
            await requestPasswordReset(email.toLowerCase(), 'staff');
            await logSecurityEvent('password_reset_requested', { ip: req.ip, userAgent: req.headers['user-agent'], metadata: { userType: 'staff' } });
            return { ok: true };
        } catch (error) {
            const code = error instanceof PasswordResetError ? error.code : 'password_reset_request_failed';
            await logSecurityEvent('password_reset_failed', { severity: 'high', ip: req.ip, userAgent: req.headers['user-agent'], metadata: { userType: 'staff', code } });
            return reply.code(503).send({ error: 'password_reset_unavailable', message: 'Password reset is temporarily unavailable. Please retry.' });
        }
    });

    fastify.post('/reset-verify', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
        const { email, otp } = z.object({
            email: z.string().trim().email().max(320),
            otp: z.string().regex(/^\d{6}$/),
        }).parse(req.body);
        try {
            return await verifyPasswordResetOtp(email, otp, 'staff');
        } catch (error) {
            if (error instanceof PasswordResetError) return reply.code(error.status).send({ error: error.code, message: error.message });
            throw error;
        }
    });

    fastify.post('/reset-confirm', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
        const { token, new_password } = z.object({
            token: z.string().regex(/^[a-f0-9]{64}$/i), new_password: z.string().min(12).max(128),
        }).parse(req.body);
        try {
            await confirmPasswordReset(token, new_password, 'staff');
            await logSecurityEvent('password_reset_completed', { ip: req.ip, userAgent: req.headers['user-agent'], metadata: { userType: 'staff' } });
            return { ok: true };
        } catch (error) {
            if (error instanceof PasswordResetError) return reply.code(error.status).send({ error: error.code, message: error.message });
            throw error;
        }
    });
};

export default routes;
