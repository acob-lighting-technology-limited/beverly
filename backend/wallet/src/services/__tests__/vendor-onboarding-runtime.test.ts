import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;
const writes: Array<{ operation: string; table: string; payload?: any }> = [];
let failInsertTable: string | null = null;
let failInsertMessage = '';
let failUpdateTable: string | null = null;
let existingProvision = false;
let changingLoginEmail = false;

class Query {
    private operation = '';
    private payload: any;
    constructor(private table: string) {}
    insert(payload: any) { this.operation = 'insert'; this.payload = payload; writes.push({ operation: 'insert', table: this.table, payload }); return this; }
    update(payload: any) { this.operation = 'update'; this.payload = payload; writes.push({ operation: 'update', table: this.table, payload }); return this; }
    delete() { this.operation = 'delete'; writes.push({ operation: 'delete', table: this.table }); return this; }
    select() { return this; }
    eq() { return this; }
    limit() { return this; }
    maybeSingle() { return this.execute(true); }
    single() { return this.execute(true); }
    then(resolve: (value: any) => any, reject: (reason: any) => any) { return this.execute(false).then(resolve, reject); }
    private async execute(single: boolean) {
        if (this.operation === 'insert' && failInsertTable === this.table) return { data: null, error: { message: failInsertMessage || `${this.table} failed` } };
        if (this.operation === 'update' && failUpdateTable === this.table) return { data: null, error: { message: `${this.table} update failed` } };
        if (this.operation === 'insert' && single) {
            const id = this.table === 'vendor_organizations' ? 'org-1' : this.table === 'vendor_users' ? 'vendor-user-1' : 'row-1';
            return { data: { id, ...this.payload }, error: null };
        }
        if (this.operation === '' && single && changingLoginEmail) {
            if (this.table === 'vendor_organizations') return { data: { id: 'org-1', legal_name: 'Example Energy Limited', station_id: 'TUNGA' }, error: null };
            if (this.table === 'vendor_users') return { data: { id: 'vendor-user-1', auth_user_id: 'auth-user-1', email: 'owner@example.test' }, error: null };
        }
        if (this.operation === '' && single && existingProvision) {
            if (this.table === 'vendor_organizations') return { data: { id: 'org-existing', provisioning_status: 'active' }, error: null };
            if (this.table === 'vendor_users') return { data: { id: 'vendor-user-existing', auth_user_id: 'auth-existing', invitation_status: 'sent', invitation_message_id: 'email-existing' }, error: null };
            if (this.table === 'wallets') return { data: { id: 'wallet-existing' }, error: null };
        }
        return { data: null, error: null };
    }
}

const createUser = vi.fn();
const generateLink = vi.fn();
const deleteUser = vi.fn();
const updateUserById = vi.fn();
const signOut = vi.fn();
vi.mock('../../db/supabase.js', () => ({
    adminClient: {
        from: (table: string) => new Query(table),
        auth: { admin: { createUser, generateLink, deleteUser, updateUserById, signOut } },
    },
}));
vi.mock('../wallets.js', () => ({
    getOrCreateKycManagedWallet: vi.fn(async () => ({ id: 'wallet-1' })),
    setOwnerWalletStatus: vi.fn(),
    WalletStateError: class extends Error {},
}));
vi.mock('../kyc-tier-policy.js', () => ({
    getKycTierPolicy: vi.fn(async () => ({ tier0DailyLimitMinor: 20_000_000, tier1DailyLimitMinor: 70_000_000, tier2DailyLimitMinor: null })),
    effectiveTierLimit: vi.fn(() => 20_000_000),
}));
vi.mock('../audit.js', () => ({ logAction: vi.fn(), logSecurityEvent: vi.fn() }));
vi.mock('../feature-flags.js', () => ({ isFlagEnabled: vi.fn(async () => true) }));
const sendEmail = vi.fn();
vi.mock('../../adapters/resend.js', () => ({ sendEmail }));

const input = {
    legalName: 'Example Energy Limited',
    contactEmail: 'business@example.test',
    contactPhone: '+2348000000000',
    stationId: 'tunga',
    primaryUserEmail: 'owner@example.test',
    primaryUserFullName: 'Ada Vendor',
    createdByStaffId: 'staff-1',
    provisioningKey: 'vendor-create-key-0001',
};

describe('vendor onboarding runtime workflow', () => {
    beforeEach(() => {
        writes.splice(0);
        failInsertTable = null;
        failInsertMessage = '';
        failUpdateTable = null;
        existingProvision = false;
        changingLoginEmail = false;
        vi.clearAllMocks();
        createUser.mockResolvedValue({ data: { user: { id: 'auth-user-1' } }, error: null });
        generateLink.mockResolvedValue({ data: { user: { id: 'auth-user-1' }, properties: { action_link: 'https://example.test/verify-vendor' } }, error: null });
        deleteUser.mockResolvedValue({ error: null });
        updateUserById.mockResolvedValue({ error: null });
        signOut.mockResolvedValue({ error: null });
        sendEmail.mockResolvedValue({ messageId: 'email-1' });
    });

    it('creates one-station pending identity and records provider-confirmed invitation delivery', async () => {
        const { createVendorOrganization } = await import('../vendor-onboarding.js');
        const result = await createVendorOrganization(input);

        expect(result.invitationDelivery).toEqual({ status: 'sent', messageId: 'email-1' });
        expect(createUser).not.toHaveBeenCalled();
        expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', password: expect.any(String) }));
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining('verify-vendor') }));
        expect(writes).not.toEqual(expect.arrayContaining([expect.objectContaining({ table: 'oem_credentials' })]));
        expect(writes).toEqual(expect.arrayContaining([
            expect.objectContaining({ table: 'vendor_organizations', operation: 'insert', payload: expect.objectContaining({ station_id: 'TUNGA', operating_stations: ['TUNGA'], provisioning_status: 'pending' }) }),
            expect.objectContaining({ table: 'vendor_organizations', operation: 'update', payload: expect.objectContaining({ provisioning_status: 'active' }) }),
            expect.objectContaining({ table: 'vendor_users', payload: expect.objectContaining({ status: 'invited', invitation_status: 'pending' }) }),
            expect.objectContaining({ table: 'vendor_users', operation: 'update', payload: expect.objectContaining({ invitation_status: 'sent', invitation_message_id: 'email-1' }) }),
        ]));
        expect(result).toMatchObject({ invitationDelivery: { status: 'sent', messageId: 'email-1' } });
    });

    it('compensates completed organization and auth writes after provisioning fails', async () => {
        failInsertTable = 'vendor_users';
        const { createVendorOrganization } = await import('../vendor-onboarding.js');

        await expect(createVendorOrganization(input)).rejects.toMatchObject({ code: 'create_vendor_user_failed' });
        expect(deleteUser).toHaveBeenCalledWith('auth-user-1');
        expect(writes).toEqual(expect.arrayContaining([
            expect.objectContaining({ operation: 'delete', table: 'vendor_organizations' }),
        ]));
    });

    it('does not expose database details when organization creation fails', async () => {
        failInsertTable = 'vendor_organizations';
        failInsertMessage = 'new row violates check constraint vendor_organizations_status_check';
        const { createVendorOrganization } = await import('../vendor-onboarding.js');

        await expect(createVendorOrganization(input)).rejects.toMatchObject({
            code: 'create_org_failed',
            message: 'Vendor organization could not be created.',
            statusCode: 503,
        });
    });

    it('identifies a primary email already used by Beverly', async () => {
        generateLink.mockResolvedValue({
            data: { user: null },
            error: { status: 422, code: 'email_exists', message: 'User already registered' },
        });
        const { createVendorOrganization } = await import('../vendor-onboarding.js');

        await expect(createVendorOrganization(input)).rejects.toMatchObject({
            code: 'vendor_email_in_use',
            statusCode: 409,
            message: 'This email already has a Beverly login. Use a different primary-user email or update the existing account.',
        });
        expect(writes).toEqual(expect.arrayContaining([
            expect.objectContaining({ operation: 'delete', table: 'vendor_organizations' }),
        ]));
    });

    it('replays an already completed domain provisioning without creating or exposing another password', async () => {
        existingProvision = true;
        const { createVendorOrganization } = await import('../vendor-onboarding.js');

        const result = await createVendorOrganization(input);

        expect(result).toEqual({
            organizationId: 'org-existing',
            primaryVendorUserId: 'vendor-user-existing',
            authUserId: 'auth-existing',
            walletId: 'wallet-existing',
            temporaryPassword: null,
            invitationDelivery: { status: 'sent', messageId: 'email-existing' },
        });
        expect(createUser).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
        expect(writes).not.toEqual(expect.arrayContaining([expect.objectContaining({ operation: 'insert' })]));
    });

    it('moves a vendor sign-in email, syncs the profile, and ends active sessions', async () => {
        changingLoginEmail = true;
        const { changeVendorLoginEmail } = await import('../vendor-onboarding.js');

        await expect(changeVendorLoginEmail({
            vendorOrganizationId: 'org-1',
            loginEmail: 'pf.zubo@yahoo.com',
            changedByStaffId: 'staff-1',
            reason: 'Correct primary email',
        })).resolves.toEqual({ loginEmail: 'pf.zubo@yahoo.com' });

        expect(updateUserById).toHaveBeenCalledWith('auth-user-1', { email: 'pf.zubo@yahoo.com', email_confirm: true });
        expect(signOut).toHaveBeenCalledWith('auth-user-1', 'global');
        expect(writes).toEqual(expect.arrayContaining([
            expect.objectContaining({ table: 'vendor_users', operation: 'update', payload: expect.objectContaining({ email: 'pf.zubo@yahoo.com', email_verified_at: expect.any(String) }) }),
        ]));
    });

    it('does not attach an email that already belongs to another Beverly login', async () => {
        changingLoginEmail = true;
        updateUserById.mockResolvedValueOnce({ error: { code: 'email_exists', message: 'User already registered' } });
        const { changeVendorLoginEmail } = await import('../vendor-onboarding.js');

        await expect(changeVendorLoginEmail({
            vendorOrganizationId: 'org-1',
            loginEmail: 'pf.zubo@yahoo.com',
            changedByStaffId: 'staff-1',
            reason: 'Correct primary email',
        })).rejects.toMatchObject({ code: 'vendor_email_in_use', statusCode: 409 });
        expect(signOut).not.toHaveBeenCalled();
    });

    it('restores the Auth email when profile synchronization fails', async () => {
        changingLoginEmail = true;
        failUpdateTable = 'vendor_users';
        const { changeVendorLoginEmail } = await import('../vendor-onboarding.js');

        await expect(changeVendorLoginEmail({
            vendorOrganizationId: 'org-1',
            loginEmail: 'pf.zubo@yahoo.com',
            changedByStaffId: 'staff-1',
            reason: 'Correct primary email',
        })).rejects.toMatchObject({ code: 'login_email_update_failed' });
        expect(updateUserById).toHaveBeenNthCalledWith(1, 'auth-user-1', { email: 'pf.zubo@yahoo.com', email_confirm: true });
        expect(updateUserById).toHaveBeenNthCalledWith(2, 'auth-user-1', { email: 'owner@example.test', email_confirm: true });
        expect(signOut).not.toHaveBeenCalled();
    });
});
