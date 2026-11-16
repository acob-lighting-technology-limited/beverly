/**
 * Admin route path normalisation.
 *
 * Fastify reports `req.routeOptions.url` WITH the plugin prefix. The admin
 * routes are registered under `/api/v1/admin` in production, so a route written
 * as `/account-setup` reports `/api/v1/admin/account-setup`. Code that compares
 * that value to a bare `/account-setup` never matches. Unit tests that register
 * the plugin without a prefix hide the problem.
 *
 * Every admin path comparison must go through `adminRelativePath()` so it works
 * with and without the prefix.
 *
 * Used by: plugins/auth.ts (password-reset and portal gates) and
 * routes/admin.ts (permission key, station scoping, developer-console gate).
 */

/** Prefix the admin plugin is registered under (routes/index.ts). */
export const ADMIN_ROUTE_PREFIX = '/api/v1/admin';

/**
 * Returns the admin-relative route pattern, always starting with `/`.
 * `/api/v1/admin/account-setup` and `/account-setup` both give `/account-setup`.
 * The bare prefix gives `/`.
 */
export function adminRelativePath(routeUrl: string | null | undefined): string {
    const path = String(routeUrl ?? '').split('?')[0] ?? '';
    if (path === ADMIN_ROUTE_PREFIX) return '/';
    if (path.startsWith(`${ADMIN_ROUTE_PREFIX}/`)) return path.slice(ADMIN_ROUTE_PREFIX.length);
    return path || '/';
}

/**
 * Routes a staff member may call while their account still needs a password
 * (invited, or reset by an administrator). Anything else returns 403
 * `password_reset_required`.
 */
export const PASSWORD_SETUP_ROUTES: ReadonlySet<string> = new Set([
    '/me', '/password-change', '/account-setup', '/logout',
]);

/**
 * Routes that stay reachable without access to the requested portal, so an
 * invited staff member can finish setup and sign out.
 */
export const PORTAL_EXEMPT_ROUTES: ReadonlySet<string> = new Set([
    '/password-change', '/account-setup', '/logout',
]);
