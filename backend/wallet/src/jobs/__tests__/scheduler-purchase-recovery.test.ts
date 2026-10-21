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
                        eq: () => ({ in: async () => {
                            state.deliveredUpdates.push(payload);
                            return { error: null };
                        }, eq: () => ({ is: () => ({ select: async () => {
                            state.reviewUpdates.push(payload);
                            return { data: [{ id: 'order-1' }], error: null };
                        } }) }) }),
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
            throw new Error(`unexpected table ${table}`);
        },
        rpc: async (_name: string, args: { p_hold_id: string }) => {
            state.releasedHolds.push(args.p_hold_id);
            return { error: null };
        },
    },
}));

import { sweepExpiredHolds } from '../scheduler.js';

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
});
