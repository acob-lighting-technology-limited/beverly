/**
 * Staff portal access — which Beverly staff portals an account may sign in to.
 *
 * Source of truth: `public.users.portal_access` (text[]), written only by
 * super admins through Wallet Admin → Roles & Team. Role permissions still
 * decide what a staff member can do once inside a portal; this list only
 * decides which portals they can enter.
 *
 * Consumers:
 *   - staff-provisioning.ts (create / update staff)
 *   - routes/admin-password-recovery.ts (Staff Wallet + PUE sign-in)
 *   - plugins/auth.ts (per-request portal check)
 *   - routes/admin.ts (staff directory payload + portal catalog)
 * Mirrors: backend/src/services/supabase-service.js (CRM sign-in) and the
 * separate Beverly Call project, which read the same column.
 */
import { z } from 'zod';

export const STAFF_PORTALS = [
    { key: 'crm', label: 'Beverly CRM', description: 'Meter, station, and consumption operations.' },
    { key: 'staff_wallet', label: 'Beverly Staff Wallet', description: 'Wallet admin, funding, vending, and access control.' },
    { key: 'call', label: 'Beverly Call', description: 'Call centre desk and customer cases.' },
    { key: 'pue', label: 'Beverly PUE', description: 'Battery swap stations and electronic appliances.' },
] as const;

export type StaffPortalKey = (typeof STAFF_PORTALS)[number]['key'];

export const STAFF_PORTAL_KEYS: readonly StaffPortalKey[] = STAFF_PORTALS.map((portal) => portal.key);

export const staffPortalKeySchema = z.enum(['crm', 'staff_wallet', 'call', 'pue']);

/** Portals served by this wallet backend's staff APIs. */
export const BACKEND_STAFF_PORTALS = ['crm', 'staff_wallet', 'pue'] as const satisfies readonly StaffPortalKey[];
export type BackendStaffPortal = (typeof BACKEND_STAFF_PORTALS)[number];

/** Header a staff client sends so the backend knows which portal it is. */
export const STAFF_PORTAL_HEADER = 'x-beverly-portal';

/* The old hard-coded gates these lists replace. Keep in sync with the migration backfill. */
const CRM_LEGACY_ROLES = new Set([
    'super-admin', 'super_admin', 'operations-manager', 'operations_manager',
    'operations-officer', 'operations_officer', 'account', 'account-officer', 'account_officer',
]);
const WALLET_LEGACY_ROLES = new Set(['super-admin', 'developer', 'account', 'finance-checker', 'operations-manager', 'operations-officer']);

function isStaffPortalKey(value: unknown): value is StaffPortalKey {
    return typeof value === 'string' && (STAFF_PORTAL_KEYS as readonly string[]).includes(value);
}

/** Keeps known portal keys only, de-duplicated, in catalog order. */
export function normalizePortalAccess(values: unknown): StaffPortalKey[] {
    if (!Array.isArray(values)) return [];
    const wanted = new Set(values.map((value) => String(value ?? '').trim().toLowerCase()).filter(isStaffPortalKey));
    return STAFF_PORTAL_KEYS.filter((key) => wanted.has(key));
}

/**
 * Portal list for an account created before `portal_access` existed.
 * Matches the old hard-coded rules exactly, so nobody gains or loses access
 * while the migration is pending. Mirrors the migration backfill.
 */
export function legacyPortalAccess(roleKey: string): StaffPortalKey[] {
    const role = roleKey.trim().toLowerCase();
    const portals: StaffPortalKey[] = [];
    const walletStaff = WALLET_LEGACY_ROLES.has(role) || role.startsWith('custom-');
    if (CRM_LEGACY_ROLES.has(role)) portals.push('crm');
    if (walletStaff) portals.push('staff_wallet');
    // Beverly Call let any staff directory row sign in.
    portals.push('call');
    if (walletStaff) portals.push('pue');
    return portals;
}

/**
 * Effective access. Super admins always reach every portal so access control
 * itself can never be locked out. `raw === undefined` means the column is not
 * deployed yet, so the legacy rules apply.
 */
export function effectivePortalAccess(roleKey: string, raw: unknown): StaffPortalKey[] {
    if (roleKey === 'super-admin') return [...STAFF_PORTAL_KEYS];
    if (raw === undefined) return legacyPortalAccess(roleKey);
    return normalizePortalAccess(raw);
}

export function hasPortalAccess(roleKey: string, raw: unknown, portal: StaffPortalKey): boolean {
    return effectivePortalAccess(roleKey, raw).includes(portal);
}

/** Reads the portal a staff client identifies as; defaults to Staff Wallet. */
export function requestedBackendPortal(headerValue: unknown): BackendStaffPortal {
    const value = String(Array.isArray(headerValue) ? headerValue[0] : headerValue ?? '').trim().toLowerCase();
    return (BACKEND_STAFF_PORTALS as readonly string[]).includes(value) ? value as BackendStaffPortal : 'staff_wallet';
}

export function portalLabel(portal: StaffPortalKey): string {
    return STAFF_PORTALS.find((item) => item.key === portal)?.label ?? portal;
}

export function isMissingPortalAccessColumn(error: { message?: string } | null | undefined): boolean {
    const message = String(error?.message ?? '').toLowerCase();
    return message.includes('portal_access') && (message.includes('schema cache') || message.includes('does not exist'));
}
