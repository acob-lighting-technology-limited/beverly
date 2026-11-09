import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    captureHold: vi.fn(),
    deliveredUpdates: [] as Record<string, unknown>[],
    reviewUpdates: [] as Record<string, unknown>[],
    exceptions: [] as Record<string, unknown>[],
    hold: { status: 'active', wallet_id: 'wallet-1', amount_minor: 1000 } as Record<string, unknown>,
    debits: [] as Record<string, unknown>[],
    receipt: { id: 'receipt-1', payload: { token: 'TOKEN' } } as Record<string, unknown> | null,
    orders: [] as Record<string, unknown>[],
    staleHolds: [] as Record<string, unknown>[],
    releasedHolds: [] as string[],
    oemCommands: [] as Record<string, unknown>[],
    oemCommandUpdates: [] as Record<string, unknown>[],
    holdCommandQuery: [] as string[],
    paymentCommandFilter: [] as string[],
    orderUpdateFound: true,
    lookupOutcome: { status: 'confirmed_success', providerReference: 'sm-pay-123', rawResponse: { id: 'sm-pay-123' } } as any,
}));

vi.mock('../../services/sparkmeter-payment-client.js', () => ({
    lookupSparkMeterPayment: vi.fn(async () => state.lookupOutcome),
}));
vi.mock('../../services/oem-installation-credentials.js', () => ({
    loadInstallationCredentials: vi.fn(async () => ({
        authStrategy: 'api_key_pair',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
    })),
}));
vi.mock('../../services/ledger.js', () => ({ captureHold: state.captureHold }));
vi.mock('../../services/idempotency.js', () => ({
    ledgerKey: (...parts: string[]) => parts.join('.'),
}));
vi.mock('../../services/fraud-engine.js', () => ({ refreshCustomerBaseline: vi.fn() }));
vi.mock('../../services/vending.js', () => ({ reconcileRemoteSendOrders: vi.fn() }));
vi.mock('../../adapters/paystack.js', () => ({ verifyTransaction: vi.fn() }));
vi.mock('../../services/payment-transactions.js', () => ({
    fulfillSuccessfulPaystackTransaction: vi.fn(),
    markUnsuccessfulPaystackTransaction: vi.fn(),
}));
vi.mock('../../services/notifications.js', () => ({ notifyPaymentFailed: vi.fn() }));

vi.mock('../../db/supabase.js', () => ({
    adminClient: {
        from(table: string) {
            if (table === 'purchase_orders') {
                return {
                    select: (columns: string) => columns === 'id, hold_id, meter_id, amount_minor' ? ({
                        eq: () => ({ eq: () => ({ is: () => ({ limit: async () => ({
                            data: state.orders.filter((row) => !row.token), error: null,
                        }) }) }) }),
                    }) : columns === 'hold_id' ? ({
                        in: () => ({ in: async () => ({ data: state.orders.map((row) => ({ hold_id: row.hold_id })), error: null }) }),
                    }) : ({
                        in: () => ({ eq: () => ({
                            not: () => ({
                                limit: async () => ({ data: state.orders.filter((row) => Boolean(row.token)) }),
                            }),
                        }) }),
                    }),
                    update: (payload: Record<string, unknown>) => ({
                        eq: () => ({
                            in: () => {
                                state.deliveredUpdates.push(payload);
                                const result = Promise.resolve({ error: null, data: state.orderUpdateFound ? [{ id: 'order-1' }] : [] });
                                return Object.assign(result, { select: async () => result });
                            },
                            eq: () => ({
                                is: () => ({
                                    select: async () => {
                                        state.reviewUpdates.push(payload);
                                        return { data: [{ id: 'order-1' }], error: null };
                                    },
                                }),
                            }),
                        }),
                    }),
                };
            }
            if (table === 'wallet_holds') {
                return { select: () => ({ eq: () => ({
                    lt: async () => ({ data: state.staleHolds, error: null }),
                    single: async () => ({ data: state.hold, error: null }),
                    maybeSingle: async () => ({ data: state.hold, error: null }),
                }) }) };
            }
            if (table === 'receipts') {
                return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.receipt, error: null }) }) }) };
            }
            if (table === 'wallet_ledger_entries') {
                return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({
                    eq: async () => ({ data: state.debits, error: null }),
                }) }) }) }) };
            }
            if (table === 'operations_exceptions') {
                return {
                    upsert: async (payload: Record<string, unknown>[]) => {
                        state.exceptions.push(...payload);
                        return { error: null };
                    },
                };
            }
            if (table === 'oem_commands') {
                return {
                    select: (_cols: string) => ({
                        eq: (column: string, value: string) => {
                            state.paymentCommandFilter.push(column, value);
                            return { in: () => ({ limit: async () => ({ data: state.oemCommands, error: null }) }) };
                        },
                        in: (_c1: string, _v1: any[]) => ({
                            in: async (_c2: string, _v2: any[]) => ({
                                data: (state.holdCommandQuery.push(_cols, _c1), state.oemCommands.map((c) => ({ canonical_request: c.canonical_request }))),
                                error: null,
                            }),
                            limit: async () => ({
                                data: state.oemCommands,
                                error: null,
                            }),
                        }),
                    }),
                    update: (payload: Record<string, unknown>) => ({
                        eq: (_col: string, val: string) => {
                            state.oemCommandUpdates.push({ id: val, ...payload });
                            return Promise.resolve({ error: null });
                        },
                    }),
                };
            }
            throw new Error(`unexpected table ${table}`);
        },
        rpc: async (_name: string, args: { p_hold_id: string }) => {
            state.releasedHolds.push(args.p_hold_id);
            return { error: null };
        },
    },
}));

import { sweepExpiredHolds, reconcileAmbiguousOemCommands } from '../scheduler.js';

describe('purchase recovery scheduler', () => {
    beforeEach(() => {
        state.captureHold.mockReset();
        state.deliveredUpdates.length = 0;
        state.reviewUpdates.length = 0;
        state.exceptions.length = 0;
        state.hold = { status: 'active', wallet_id: 'wallet-1', amount_minor: 1000 };
        state.debits = [];
        state.staleHolds = [];
        state.releasedHolds = [];
        state.oemCommands = [];
        state.oemCommandUpdates = [];
        state.paymentCommandFilter = [];
        state.orderUpdateFound = true;
        state.receipt = { id: 'receipt-1', payload: { token: 'TOKEN' } };
        state.orders = [{ id: 'order-1', hold_id: 'hold-1', meter_id: '1234',
            created_by: 'customer-1', delivery_state: null, token: 'TOKEN' }];
    });

    it('captures generated-token holds before marking delivery complete', async () => {
        state.captureHold.mockResolvedValue({ id: 'ledger-1' });
        await sweepExpiredHolds();
        expect(state.captureHold).toHaveBeenCalledOnce();
        expect(state.deliveredUpdates).toContainEqual({
            status: 'delivered',
            receipt_id: 'receipt-1',
            delivery_state: 'token_generated',
        });
    });

    it('keeps delivery incomplete when hold capture fails', async () => {
        state.captureHold.mockRejectedValue(new Error('ledger unavailable'));
        await sweepExpiredHolds();
        expect(state.deliveredUpdates).toHaveLength(0);
        expect(state.exceptions).toContainEqual(expect.objectContaining({
            category: 'purchase_recovery_failed',
            target_id: 'order-1',
            status: 'open',
        }));
    });

    it('does not recapture an already captured hold with a matching debit', async () => {
        state.hold.status = 'captured';
        state.debits = [{ id: 'debit-1', wallet_id: 'wallet-1', amount_minor: 1000 }];
        await sweepExpiredHolds();
        expect(state.captureHold).not.toHaveBeenCalled();
        expect(state.deliveredUpdates).toHaveLength(1);
    });

    it('does not mark delivery when a captured hold has no matching debit', async () => {
        state.hold.status = 'captured';
        await sweepExpiredHolds();
        expect(state.deliveredUpdates).toHaveLength(0);
        expect(state.exceptions).toHaveLength(1);
    });

    it('delivers issued tokens while preserving remote-send status', async () => {
        state.orders[0].delivery_state = 'remote_send_pending_review';
        state.hold.status = 'captured';
        state.debits = [{ id: 'debit-1', wallet_id: 'wallet-1', amount_minor: 1000 }];
        await sweepExpiredHolds();
        expect(state.captureHold).not.toHaveBeenCalled();
        expect(state.deliveredUpdates).toContainEqual({
            status: 'delivered', receipt_id: 'receipt-1', delivery_state: 'remote_send_pending_review',
        });
        expect(state.exceptions).toHaveLength(0);
    });

    it('does not deliver an unverified token', async () => {
        state.hold.status = 'captured';
        state.debits = [{ id: 'debit-1', wallet_id: 'wallet-1', amount_minor: 1000 }];
        state.receipt = { id: 'receipt-1', payload: { token: 'DIFFERENT' } };
        await sweepExpiredHolds();
        expect(state.deliveredUpdates).toHaveLength(0);
        expect(state.exceptions).toContainEqual(expect.objectContaining({ category: 'purchase_recovery_failed' }));
    });

    it('never releases an unresolved purchase hold', async () => {
        state.orders[0].token = null;
        state.staleHolds = [{ id: 'hold-1' }];
        await sweepExpiredHolds();
        expect(state.releasedHolds).toHaveLength(0);
    });

    it('flags captured purchases lacking local tokens for review', async () => {
        state.orders[0].token = null;
        state.orders[0].amount_minor = 1000;
        state.hold.status = 'captured';
        state.debits = [{ wallet_id: 'wallet-1', amount_minor: 1000 }];
        await sweepExpiredHolds();
        expect(state.deliveredUpdates).toHaveLength(0);
        expect(state.reviewUpdates).toContainEqual(expect.objectContaining({
            status: 'delivery_pending_review', delivery_state: 'token_not_persisted_needs_review',
        }));
        expect(state.exceptions).toContainEqual(expect.objectContaining({ category: 'purchase_token_review' }));
    });

    it('never releases a hold protected by an ambiguous oem_command', async () => {
        state.orders = [];
        state.staleHolds = [{ id: 'hold-ambiguous' }];
        state.holdCommandQuery = [];
        state.oemCommands = [{ canonical_request: { holdId: 'hold-ambiguous' }, status: 'submitted' }];
        await sweepExpiredHolds();
        expect(state.holdCommandQuery).toEqual(['canonical_request', 'canonical_request->>holdId']);
        expect(state.releasedHolds).toHaveLength(0);
    });

    it('releases a stale hold when oem_command is terminal (succeeded or failed)', async () => {
        state.orders = [];
        state.staleHolds = [{ id: 'hold-terminal' }];
        state.oemCommands = [];
        await sweepExpiredHolds();
        expect(state.releasedHolds).toContain('hold-terminal');
    });

    it('reconciles ambiguous oem command on confirmed_success by capturing hold and delivering order', async () => {
        state.captureHold.mockResolvedValue({ id: 'ledger-1' });
        state.oemCommands = [{
            id: 'cmd-1',
            operation_key: 'vending.payment',
            canonical_request: { commandId: 'order-1', holdId: 'hold-1', customerId: 'cust-1', amountMinor: 1000 },
            status: 'submitted',
            attempt_count: 1,
            installation_id: 'inst-1',
            tenant_id: 'tenant-1',
            request_payload: { customerId: 'cust-1', amountMinor: 1000 },
            oem_installations: {
                id: 'inst-1',
                base_url: 'https://api.sparkmeter.cloud',
                approved_hostnames: ['api.sparkmeter.cloud'],
                status: 'active',
                oem_manufacturers: { slug: 'sparkmeter' },
            },
        }];
        state.lookupOutcome = {
            status: 'confirmed_success',
            providerReference: 'sm-pay-123',
            rawResponse: { id: 'sm-pay-123' },
        };

        const result = await reconcileAmbiguousOemCommands();
        expect(state.paymentCommandFilter).toEqual(['operation_key', 'vending.payment']);
        expect(result.succeeded).toBe(1);
        expect(state.captureHold).toHaveBeenCalledOnce();
        expect(state.oemCommandUpdates).toContainEqual(expect.objectContaining({
            id: 'cmd-1',
            status: 'succeeded',
            provider_reference: 'sm-pay-123',
        }));
        expect(state.deliveredUpdates).toContainEqual(expect.objectContaining({
            status: 'delivered',
            delivery_state: 'payment_processed_delivery_unconfirmed',
        }));
    });

    it('reconciles ambiguous oem command on confirmed_failure by releasing hold and failing order', async () => {
        state.oemCommands = [{
            id: 'cmd-2',
            operation_key: 'vending.payment',
            canonical_request: { commandId: 'order-2', holdId: 'hold-2', customerId: 'cust-2', amountMinor: 1000 },
            status: 'submitted',
            attempt_count: 1,
            installation_id: 'inst-1',
            tenant_id: 'tenant-1',
            request_payload: { customerId: 'cust-2', amountMinor: 1000 },
            oem_installations: {
                id: 'inst-1',
                base_url: 'https://api.sparkmeter.cloud',
                approved_hostnames: ['api.sparkmeter.cloud'],
                status: 'active',
                oem_manufacturers: { slug: 'sparkmeter' },
            },
        }];
        state.lookupOutcome = {
            status: 'confirmed_failure',
            reason: 'Customer not found',
            rawResponse: { error: 'not_found' },
        };

        const result = await reconcileAmbiguousOemCommands();
        expect(result.failed).toBe(1);
        expect(state.releasedHolds).toContain('hold-2');
        expect(state.oemCommandUpdates).toContainEqual(expect.objectContaining({
            id: 'cmd-2',
            status: 'failed',
            normalized_error_message: 'Customer not found',
        }));
    });

    it('escalates ambiguous oem command to manual_review after retry exhaustion', async () => {
        state.oemCommands = [{
            id: 'cmd-3',
            operation_key: 'vending.payment',
            canonical_request: { commandId: 'order-3', holdId: 'hold-3', customerId: 'cust-3', amountMinor: 1000 },
            status: 'submitted',
            attempt_count: 5,
            installation_id: 'inst-1',
            tenant_id: 'tenant-1',
            request_payload: { customerId: 'cust-3', amountMinor: 1000 },
            oem_installations: {
                id: 'inst-1',
                base_url: 'https://api.sparkmeter.cloud',
                approved_hostnames: ['api.sparkmeter.cloud'],
                status: 'active',
                oem_manufacturers: { slug: 'sparkmeter' },
            },
        }];
        state.lookupOutcome = { status: 'unknown' };

        const result = await reconcileAmbiguousOemCommands();
        expect(result.pendingReview).toBe(1);
        expect(state.oemCommandUpdates).toContainEqual(expect.objectContaining({
            id: 'cmd-3',
            status: 'manual_review',
        }));
        expect(state.exceptions).toContainEqual(expect.objectContaining({
            category: 'oem_command_review',
            target_id: 'cmd-3',
        }));
    });

    it('does not reconcile commands from another manufacturer', async () => {
        state.oemCommands = [{ id: 'other', operation_key: 'vending.payment', status: 'submitted',
            oem_installations: { id: 'other', status: 'active', oem_manufacturers: { slug: 'calinmeter' } } }];
        await reconcileAmbiguousOemCommands();
        expect(state.oemCommandUpdates).toHaveLength(0);
        expect(state.captureHold).not.toHaveBeenCalled();
    });

    it('keeps a payment unresolved if capture fails', async () => {
        state.captureHold.mockRejectedValue(new Error('ledger unavailable'));
        state.oemCommands = [{ id: 'cmd-pending', operation_key: 'vending.payment', status: 'submitted', attempt_count: 1,
            canonical_request: { commandId: 'order-1', holdId: 'hold-1', customerId: 'cust-1', amountMinor: 1000 },
            oem_installations: { id: 'inst-1', tenant_id: 'tenant-1', status: 'active',
                base_url: 'https://api.sparkmeter.cloud', approved_hostnames: ['api.sparkmeter.cloud'],
                oem_manufacturers: { slug: 'sparkmeter' } } }];
        state.lookupOutcome = { status: 'confirmed_success', providerReference: 'ref-1' };
        const result = await reconcileAmbiguousOemCommands();
        expect(result.succeeded).toBe(0);
        expect(state.oemCommandUpdates).toHaveLength(0);
    });

    it('keeps a payment unresolved if its order cannot be updated', async () => {
        state.orderUpdateFound = false;
        state.hold.status = 'captured';
        state.oemCommands = [{ id: 'cmd-no-order', operation_key: 'vending.payment', status: 'submitted', attempt_count: 1,
            canonical_request: { commandId: 'order-1', holdId: 'hold-1', customerId: 'cust-1', amountMinor: 1000 },
            oem_installations: { id: 'inst-1', tenant_id: 'tenant-1', status: 'active',
                base_url: 'https://api.sparkmeter.cloud', approved_hostnames: ['api.sparkmeter.cloud'],
                oem_manufacturers: { slug: 'sparkmeter' } } }];
        state.lookupOutcome = { status: 'confirmed_success', providerReference: 'ref-1' };
        const result = await reconcileAmbiguousOemCommands();
        expect(result.succeeded).toBe(0);
        expect(state.oemCommandUpdates).toHaveLength(0);
    });

    it('escalates provider-confirmed payments with released holds', async () => {
        state.hold.status = 'released';
        state.oemCommands = [{ id: 'cmd-released', operation_key: 'vending.payment', status: 'unknown', attempt_count: 1,
            canonical_request: { commandId: 'order-1', holdId: 'hold-1', customerId: 'cust-1', amountMinor: 1000 },
            oem_installations: { id: 'inst-1', tenant_id: 'tenant-1', status: 'active',
                base_url: 'https://api.sparkmeter.cloud', approved_hostnames: ['api.sparkmeter.cloud'],
                oem_manufacturers: { slug: 'sparkmeter' } } }];
        state.lookupOutcome = { status: 'confirmed_success', providerReference: 'ref-1' };
        const result = await reconcileAmbiguousOemCommands();
        expect(result.pendingReview).toBe(1);
        expect(state.oemCommandUpdates).toContainEqual(expect.objectContaining({ id: 'cmd-released', status: 'manual_review' }));
        expect(state.exceptions).toContainEqual(expect.objectContaining({ target_id: 'cmd-released', category: 'oem_command_review' }));
        expect(state.captureHold).not.toHaveBeenCalled();
    });
});

