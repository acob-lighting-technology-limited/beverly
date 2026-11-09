import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    lookupMeter: vi.fn(),
    previewPurchaseWithPolicy: vi.fn(),
    assertEnergyVendReady: vi.fn(),
    assertStationVendAllowed: vi.fn(),
    dispatchGeneratedVendorToken: vi.fn(),
    vendorPurchase: vi.fn(),
    verifyVendorVendCredential: vi.fn(),
}));

vi.mock('../../services/token-engine.js', () => ({
    lookupMeter: mocks.lookupMeter,
    previewPurchaseWithPolicy: mocks.previewPurchaseWithPolicy,
    assertEnergyVendReady: mocks.assertEnergyVendReady,
    buildCreditTokenPreviewPlan: vi.fn(),
    buildRemoteTokenTaskPayload: vi.fn(),
    TokenEngineError: class TokenEngineError extends Error {},
}));

vi.mock('../../services/station-vend-scope.js', () => ({
    assertStationVendAllowed: mocks.assertStationVendAllowed,
    StationVendScopeError: class StationVendScopeError extends Error {},
}));

vi.mock('../../services/vending.js', () => ({
    vendorPurchase: mocks.vendorPurchase,
    dispatchGeneratedVendorToken: mocks.dispatchGeneratedVendorToken,
    listVendorPurchases: vi.fn(),
    getReceiptByOrder: vi.fn(),
    VendingError: class VendingError extends Error {},
}));

vi.mock('../../services/vendor-vend-credential.js', () => ({
    verifyVendorVendCredential: mocks.verifyVendorVendCredential,
    getVendorVendCredentialStatus: vi.fn(),
    setVendorVendCredential: vi.fn(),
    VendorVendCredentialError: class VendorVendCredentialError extends Error {},
}));

vi.mock('../../services/oem-quota-circuit.js', () => ({
    assertOemVendAvailable: vi.fn(async () => {}),
    OemQuotaCircuitError: class OemQuotaCircuitError extends Error {},
}));

import vendorRoutes from '../vendor.js';

async function appForPreview() {
    const app = Fastify();
    app.decorate('requireAuth', () => async (req: any) => {
        req.actor = {
            type: 'vendor_user',
            userId: 'vendor-user-1',
            vendorOrganizationId: 'vendor-org-1',
            stationId: 'TUNGA',
            emailVerified: true,
        };
    });
    app.decorate('requireVendor', () => async (req: any) => {
        req.actor = {
            type: 'vendor_user',
            userId: 'vendor-user-1',
            vendorOrganizationId: 'vendor-org-1',
            stationId: 'TUNGA',
            emailVerified: true,
        };
    });
    await app.register(vendorRoutes);
    return app;
}

describe('Vendor vending preview HTTP seam', () => {
    beforeEach(() => {
        mocks.lookupMeter.mockReset();
        mocks.previewPurchaseWithPolicy.mockReset();
        mocks.assertEnergyVendReady.mockReset();
        mocks.assertStationVendAllowed.mockReset();
        mocks.dispatchGeneratedVendorToken.mockReset();
        mocks.vendorPurchase.mockReset();
        mocks.verifyVendorVendCredential.mockReset();
    });

    it('returns an actionable response when live meter lookup fails unexpectedly', async () => {
        mocks.lookupMeter.mockRejectedValue(new Error('upstream connection reset'));
        const app = await appForPreview();
        const response = await app.inject({
            method: 'POST',
            url: '/vend/preview',
            payload: { meterId: '47005376315', amountMinor: 10_600 },
        });
        await app.close();

        expect(response.statusCode).toBe(503);
        expect(response.json()).toMatchObject({
            error: 'vend_meter_lookup_unavailable',
            message: 'Live meter verification is temporarily unavailable. No wallet debit or vend was attempted.',
            retryable: true,
            details: { noVendAttempted: true, stage: 'meter_lookup' },
        });
        expect(response.json().details.correlationId).toEqual(expect.any(String));
    });

    it('does not require Calinmeter credentials for SparkMeter preview', async () => {
        mocks.lookupMeter.mockResolvedValue({ meterId: 'SM-1', stationId: 'TUNGA', tariffId: 'TARIFF',
            oemId: 'sparkmeter', vendingStrategy: 'direct_credit' });
        mocks.previewPurchaseWithPolicy.mockResolvedValue({ grossAmountMinor: 10600 });
        const app = await appForPreview();
        const response = await app.inject({ method: 'POST', url: '/vend/preview',
            payload: { meterId: 'SM-1', amountMinor: 10600 } });
        await app.close();
        expect(response.statusCode).toBe(200);
        expect(mocks.assertEnergyVendReady).not.toHaveBeenCalled();
        expect(response.json().preview).toMatchObject({ units: null, effectivePricePerKwh: null });
    });

    it('describes a direct-credit payment instead of an STS token plan', async () => {
        mocks.lookupMeter.mockResolvedValue({ meterId: 'SM-1', customerId: 'customer-1', stationId: 'TUNGA',
            tariffId: 'TARIFF', oemId: 'sparkmeter', vendingStrategy: 'direct_credit' });
        mocks.previewPurchaseWithPolicy.mockResolvedValue({ grossAmountMinor: 10600 });
        const app = await appForPreview();
        const response = await app.inject({ method: 'POST', url: '/vend/live-plan',
            payload: { meterId: 'SM-1', amountMinor: 10600, mode: 'wallet' } });
        await app.close();
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ liveWrite: false, vendingStrategy: 'direct_credit',
            payment: { method: 'POST', path: '/api/v1/customers/customer-1/payments', body: { amount: '106.00' } },
            tokenGeneration: null, remoteSend: null });
    });

    it('keeps an existing token recoverable when remote delivery fails unexpectedly', async () => {
        mocks.dispatchGeneratedVendorToken.mockRejectedValue(new Error('upstream connection reset'));
        const app = await appForPreview();
        const response = await app.inject({
            method: 'POST',
            url: '/vend/11111111-1111-4111-8111-111111111111/remote-send',
        });
        await app.close();

        expect(response.statusCode).toBe(503);
        expect(response.json()).toMatchObject({
            error: 'remote_send_service_unavailable',
            status: 'failed',
            deliveryState: 'remote_send_failed_needs_manual_entry',
            retryable: true,
            details: { tokenRemainsValid: true },
        });
    });

    it('returns a generated token while reconciliation remains pending', async () => {
        mocks.vendorPurchase.mockResolvedValue({
            token: '1234 5678 9012 3456 7890',
            units: 0.2818,
            receiptId: null,
            remoteTaskId: null,
            ledgerEntryId: null,
            purchaseOrder: {
                id: '11111111-1111-4111-8111-111111111111',
                status: 'delivery_pending_review',
                delivery_state: 'token_generated_needs_reconciliation',
                meter_id: '47005376315',
                amount_minor: 10_600,
                token: '1234 5678 9012 3456 7890',
            },
        });
        const app = await appForPreview();
        const response = await app.inject({
            method: 'POST',
            url: '/vend',
            headers: { 'idempotency-key': 'vend-reconciliation-test-0001' },
            payload: {
                meterId: '47005376315',
                amountMinor: 10_600,
                mode: 'wallet',
                authorization: '1598',
            },
        });
        await app.close();

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            token: '1234 5678 9012 3456 7890',
            purchaseOrder: {
                status: 'delivery_pending_review',
                delivery_state: 'token_generated_needs_reconciliation',
            },
        });
    });
});
