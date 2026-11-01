import { adminClient } from '../db/supabase.js';
import { isKycRequiredForSubject } from './kyc-policy.js';

export class VendorKycGateError extends Error {
    constructor(message: string, public code: string, public status: number) {
        super(message);
    }
}

/**
 * Organization approval is always required. The KYC rollout policy decides
 * whether this organization must also complete verification before vending.
 */
export async function assertVendorKycReadyForVending(vendorOrganizationId: string): Promise<void> {
    const { data, error } = await adminClient
        .from('vendor_organizations')
        .select('status, kyc_tier, kyc_status')
        .eq('id', vendorOrganizationId)
        .maybeSingle();
    if (error) {
        throw new VendorKycGateError('Vendor verification status is unavailable. Try again shortly.', 'vendor_kyc_unavailable', 503);
    }
    if (!data) {
        throw new VendorKycGateError('Vendor account was not found.', 'vendor_not_found', 404);
    }
    if ((data as any).status !== 'approved') {
        throw new VendorKycGateError('Your vendor organization is not active.', 'vendor_not_approved', 403);
    }
    if (await isKycRequiredForSubject('vendor', vendorOrganizationId)
        && (Number((data as any).kyc_tier ?? 0) < 2 || (data as any).kyc_status !== 'verified')) {
        throw new VendorKycGateError('Complete Tier 2 verification before vending.', 'vendor_kyc_tier_required', 403);
    }
}
