import { describe, expect, it } from 'vitest';
import { adminRelativePath, PASSWORD_SETUP_ROUTES, PORTAL_EXEMPT_ROUTES } from '../admin-route-path.js';

describe('adminRelativePath', () => {
    it('strips the production prefix', () => {
        expect(adminRelativePath('/api/v1/admin/account-setup')).toBe('/account-setup');
        expect(adminRelativePath('/api/v1/admin/customers/:id')).toBe('/customers/:id');
    });

    it('keeps already relative paths', () => {
        expect(adminRelativePath('/account-setup')).toBe('/account-setup');
        expect(adminRelativePath('/dev/oem')).toBe('/dev/oem');
    });

    it('drops a query string', () => {
        expect(adminRelativePath('/api/v1/admin/customers?limit=5')).toBe('/customers');
    });

    it('maps the bare prefix and empty input to the root', () => {
        expect(adminRelativePath('/api/v1/admin')).toBe('/');
        expect(adminRelativePath('')).toBe('/');
        expect(adminRelativePath(undefined)).toBe('/');
        expect(adminRelativePath(null)).toBe('/');
    });

    it('does not strip a lookalike prefix', () => {
        expect(adminRelativePath('/api/v1/administrators/x')).toBe('/api/v1/administrators/x');
    });
});

describe('setup route allowlists', () => {
    it('exempts exactly the routes an invitee needs', () => {
        expect([...PASSWORD_SETUP_ROUTES].sort()).toEqual(['/account-setup', '/logout', '/me', '/password-change']);
        expect([...PORTAL_EXEMPT_ROUTES].sort()).toEqual(['/account-setup', '/logout', '/password-change']);
    });
});
