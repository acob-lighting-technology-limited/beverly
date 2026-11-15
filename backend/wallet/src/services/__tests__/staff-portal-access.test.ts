import { describe, expect, it } from 'vitest';
import {
    effectivePortalAccess,
    hasPortalAccess,
    isMissingPortalAccessColumn,
    legacyPortalAccess,
    normalizePortalAccess,
    requestedBackendPortal,
} from '../staff-portal-access.js';
import { createStaffSchema, updateStaffSchema } from '../staff-provisioning.js';

describe('staff portal access', () => {
    it('keeps known portals only, de-duplicated, in catalog order', () => {
        expect(normalizePortalAccess(['pue', 'CRM', 'pue', 'admin', null])).toEqual(['crm', 'pue']);
        expect(normalizePortalAccess('crm')).toEqual([]);
    });

    it('always gives super admins every portal', () => {
        expect(effectivePortalAccess('super-admin', [])).toEqual(['crm', 'staff_wallet', 'call', 'pue']);
    });

    it('uses the saved list for everyone else', () => {
        expect(effectivePortalAccess('account', ['call'])).toEqual(['call']);
        expect(hasPortalAccess('account', ['call'], 'staff_wallet')).toBe(false);
        expect(hasPortalAccess('account', [], 'call')).toBe(false);
    });

    it('falls back to the old hard-coded gates while the column is missing', () => {
        expect(effectivePortalAccess('account', undefined)).toEqual(legacyPortalAccess('account'));
        expect(legacyPortalAccess('account')).toEqual(['crm', 'staff_wallet', 'call', 'pue']);
        // Finance checkers never had CRM sign-in.
        expect(legacyPortalAccess('finance-checker')).toEqual(['staff_wallet', 'call', 'pue']);
        expect(legacyPortalAccess('custom-auditor')).toEqual(['staff_wallet', 'call', 'pue']);
        // Non-staff directory rows could only use Beverly Call.
        expect(legacyPortalAccess('support-agent')).toEqual(['call']);
    });

    it('reads the portal header, defaulting to Staff Wallet', () => {
        expect(requestedBackendPortal('pue')).toBe('pue');
        expect(requestedBackendPortal(['crm'])).toBe('crm');
        expect(requestedBackendPortal('call')).toBe('staff_wallet');
        expect(requestedBackendPortal(undefined)).toBe('staff_wallet');
    });

    it('detects a missing portal_access column only', () => {
        expect(isMissingPortalAccessColumn({ message: "Could not find the 'portal_access' column of 'users' in the schema cache" })).toBe(true);
        expect(isMissingPortalAccessColumn({ message: 'column users.station_ids does not exist' })).toBe(false);
        expect(isMissingPortalAccessColumn(null)).toBe(false);
    });
});

describe('staff provisioning portal input', () => {
    const base = { email: 'ada@acoblighting.com', fullName: 'Ada Okonkwo', roleKey: 'account', allStations: true };

    it('requires at least one known portal when creating staff', () => {
        expect(createStaffSchema.safeParse({ ...base, portalAccess: ['call'] }).success).toBe(true);
        expect(createStaffSchema.safeParse({ ...base, portalAccess: [] }).success).toBe(false);
        expect(createStaffSchema.safeParse({ ...base }).success).toBe(false);
        expect(createStaffSchema.safeParse({ ...base, portalAccess: ['support-centre'] }).success).toBe(false);
    });

    it('keeps the saved list when an update omits portals', () => {
        const parsed = updateStaffSchema.parse({ roleKey: 'account', allStations: true });
        expect(parsed.portalAccess).toBeUndefined();
        expect(updateStaffSchema.safeParse({ roleKey: 'account', allStations: true, portalAccess: [] }).success).toBe(false);
    });
});
