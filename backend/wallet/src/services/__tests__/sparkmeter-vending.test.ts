import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeSparkMeterVend, SparkMeterVendInput } from '../sparkmeter-vending.js';
import { VendingError } from '../vending.js';

vi.mock('../token-engine.js', () => ({
    previewPurchaseWithPolicy: vi.fn(async (amountMinor: number) => ({
        grossAmountMinor: amountMinor,
        energyAmountMinor: Math.round(amountMinor * 0.93),
        taxAmountMinor: Math.round(amountMinor * 0.07),
        vatRateBasisPoints: 750,
        units: 10,
    })),
}));

vi.mock('../audit.js', () => ({
    logAction: vi.fn(async () => {}),
}));

describe('SparkMeter Vending Orchestration', () => {
    let mockState: any;

    beforeEach(() => {
        mockState = {
            holds: [] as any[],
            releasedHolds: [] as any[],
            capturedHolds: [] as any[],
            purchaseOrders: [] as any[],
            oemCommands: [] as any[],
            exceptions: [] as any[],
            receipts: [] as any[],
            auditLogs: [] as any[],
        };
    });

    const createMockDb = (opts: {
        meterExists?: boolean;
        customerExists?: boolean;
        installationStatus?: string;
    } = {}) => {
        const {
            meterExists = true,
            customerExists = true,
            installationStatus = 'active',
        } = opts;

        return {
            from: (table: string) => {
                if (table === 'purchase_orders') {
                    return {
                        select: () => ({
                            eq: () => ({
                                maybeSingle: async () => ({ data: null, error: null }),
                            }),
                        }),
                        insert: (po: any) => ({
                            select: () => ({
                                single: async () => {
                                    const record = { id: 'po-101', ...po };
                                    mockState.purchaseOrders.push(record);
                                    return { data: record, error: null };
                                },
                            }),
                        }),
                        update: (payload: any) => ({
                            eq: (_col: string, val: string) => {
                                const po = mockState.purchaseOrders.find((p: any) => p.id === val);
                                if (po) Object.assign(po, payload);
                                return Promise.resolve({ error: null });
                            },
                        }),
                    };
                }
                if (table === 'oem_inventory_meters') {
                    return {
                        select: () => ({
                            or: () => ({
                                eq: () => ({
                                    limit: () => ({
                                        maybeSingle: async () => ({
                                            data: meterExists ? {
                                                external_id: 'sm-meter-uuid',
                                                customer_external_id: 'sm-cust-uuid',
                                                serial: '12345678',
                                                tariff_id: 'RESIDENTIAL',
                                                meter_phase: 'single_phase',
                                                site_id: 'SITE-1',
                                                oem_installation_id: '53f12390-74f7-40b3-b1db-e907c256986d',
                                                oem_installations: {
                                                    id: '53f12390-74f7-40b3-b1db-e907c256986d',
                                                    base_url: 'https://api.sparkmeter.cloud',
                                                    approved_hostnames: ['api.sparkmeter.cloud'],
                                                    tenant_id: 'tenant-1',
                                                    status: installationStatus,
                                                    oem_type: 'sparkmeter',
                                                },
                                            } : null,
                                            error: null,
                                        }),
                                    }),
                                }),
                            }),
                        }),
                    };
                }
                if (table === 'oem_inventory_customers') {
                    return {
                        select: () => ({
                            eq: () => ({
                                eq: () => ({
                                    eq: () => ({
                                        maybeSingle: async () => ({
                                            data: customerExists ? {
                                                external_id: 'sm-cust-uuid',
                                                name: 'Grace Hopper',
                                                phone: '+2348000000000',
                                                status: 'active',
                                            } : null,
                                            error: null,
                                        }),
                                    }),
                                }),
                            }),
                        }),
                    };
                }
                if (table === 'oem_commands') {
                    const queryBuilder: any = {
                        _targetId: null as string | null,
                        eq: function(this: any, col: string, val: string) {
                            if (col === 'id') this._targetId = val;
                            return this;
                        },
                        in: function(this: any) { return this; },
                        maybeSingle: async function(this: any) {
                            const found = this._targetId
                                ? mockState.oemCommands.find((c: any) => c.id === this._targetId)
                                : null;
                            return { data: found ?? null, error: null };
                        },
                        single: async function(this: any) {
                            const found = this._targetId
                                ? mockState.oemCommands.find((c: any) => c.id === this._targetId)
                                : mockState.oemCommands[0];
                            return { data: found ?? null, error: null };
                        },
                    };
                    return {
                        select: () => queryBuilder,
                        insert: (cmd: any) => ({
                            select: () => ({
                                single: async () => {
                                    const record = { id: 'cmd-999', ...cmd, attempt_count: 0, status: 'pending' };
                                    mockState.oemCommands.push(record);
                                    return { data: record, error: null };
                                },
                            }),
                        }),
                        update: (payload: any) => {
                            const updateChain: any = {
                                eq: function(this: any, col: string, val: string) {
                                    if (col === 'id') {
                                        const cmd = mockState.oemCommands.find((c: any) => c.id === val);
                                        if (cmd) Object.assign(cmd, payload);
                                    }
                                    return this;
                                },
                                select: () => ({
                                    single: async () => ({ data: mockState.oemCommands[0], error: null }),
                                }),
                                then: (resolve: any) => resolve({ data: [mockState.oemCommands[0]], error: null }),
                            };
                            return updateChain;
                        },
                    };
                }
                if (table === 'operations_exceptions') {
                    return {
                        upsert: async (records: any[]) => {
                            mockState.exceptions.push(...records);
                            return { error: null };
                        },
                    };
                }
                if (table === 'receipts') {
                    return {
                        insert: (rcpt: any) => ({
                            select: () => ({
                                single: async () => {
                                    const r = { id: 'rcpt-1', ...rcpt };
                                    mockState.receipts.push(r);
                                    return { data: r, error: null };
                                },
                            }),
                        }),
                    };
                }
                if (table === 'audit_logs') {
                    return {
                        insert: async (record: any) => {
                            mockState.auditLogs.push(record);
                            return { error: null };
                        },
                    };
                }
                throw new Error(`Unexpected table ${table}`);
            },
            rpc: async (name: string, args: any) => {
                if (name === 'fn_release_hold') {
                    mockState.releasedHolds.push(args.p_hold_id);
                    return { error: null };
                }
                throw new Error(`Unexpected rpc ${name}`);
            },
        };
    };

    const sampleInput: SparkMeterVendInput = {
        actorType: 'customer',
        actorId: 'cust-1',
        userId: 'user-1',
        walletId: 'wallet-1',
        meterId: '12345678',
        amountMinor: 5000, // NGN 50.00
        clientIdempotencyKey: 'idem-test-1',
    };

    it('rejects vend when canary ceiling (NGN 100 = 10,000 minor) is exceeded', async () => {
        const mockDb = createMockDb();
        await expect(executeSparkMeterVend({
            ...sampleInput,
            amountMinor: 15000, // NGN 150.00
            enforceCanaryCeiling: true,
        }, { db: mockDb as any })).rejects.toThrow('canary ceiling');
    });

    it('rejects vend if meter is missing from active inventory', async () => {
        const mockDb = createMockDb({ meterExists: false });
        await expect(executeSparkMeterVend(sampleInput, { db: mockDb as any }))
            .rejects.toThrow('not found in SparkMeter active inventory');
    });

    it('rejects vend for meterless customer', async () => {
        const mockDb = createMockDb({ meterExists: true, customerExists: false });
        await expect(executeSparkMeterVend(sampleInput, { db: mockDb as any }))
            .rejects.toThrow('Customer linked to meter is inactive or missing');
    });

    it('executes end-to-end direct credit vend successfully', async () => {
        const mockDb = createMockDb();
        const fetchFn = vi.fn(async () => new Response(JSON.stringify({
            errors: [],
            data: {
                id: '11111111-1111-1111-1111-111111111111',
                external_id: 'cmd-999',
                recipient_id: 'sm-cust-uuid',
                status: 'processed',
                amount: { value: '50.00', currency: 'NGN' },
            },
        }), { status: 201 }));

        const result = await executeSparkMeterVend(sampleInput, {
            db: mockDb as any,
            fetchFn,
            createHoldFn: async () => ({ id: 'hold-1' } as any),
            captureHoldFn: async (args: any) => { mockState.capturedHolds.push(args); return {} as any; },
            createReceiptFn: async () => ({ id: 'rcpt-1' } as any),
            loadCredentialsFn: async () => ({
                authStrategy: 'api_key_pair',
                apiKey: 'test-key',
                apiSecret: 'test-secret',
            } as any),
        });

        expect(result.outcomeStatus).toBe('confirmed_success');
        expect(result.token).toBeNull(); // Direct credit: never synthetic STS token
        expect(result.purchaseOrder.status).toBe('delivered');
        expect(result.purchaseOrder.delivery_state).toBe('payment_processed_delivery_unconfirmed');
        expect(mockState.capturedHolds).toHaveLength(1);
        expect(mockState.releasedHolds).toHaveLength(0);
    });

    it('releases hold and fails order on confirmed provider rejection', async () => {
        const mockDb = createMockDb();
        const fetchFn = vi.fn(async () => new Response(JSON.stringify({
            data: null,
            errors: [{ title: 'Unknown parameter', details: 'invalid memo' }],
        }), { status: 400 }));

        await expect(executeSparkMeterVend(sampleInput, {
            db: mockDb as any,
            fetchFn,
            createHoldFn: async () => ({ id: 'hold-2' } as any),
            captureHoldFn: async () => ({} as any),
            releaseHoldFn: async () => { mockState.releasedHolds.push('hold-2'); return {} as any; },
            loadCredentialsFn: async () => ({
                authStrategy: 'api_key_pair',
                apiKey: 'test-key',
                apiSecret: 'test-secret',
            } as any),
        })).rejects.toThrow(VendingError);

        expect(mockState.releasedHolds).toContain('hold-2');
        expect(mockState.capturedHolds).toHaveLength(0);
        expect(mockState.purchaseOrders[0].status).toBe('failed');
    });

    it('retains hold and flags exception on unknown outcome', async () => {
        const mockDb = createMockDb();
        // Network timeout / drop
        const fetchFn = vi.fn(async () => { throw new Error('Network timeout'); });

        const result = await executeSparkMeterVend(sampleInput, {
            db: mockDb as any,
            fetchFn,
            createHoldFn: async () => ({ id: 'hold-3' } as any),
            captureHoldFn: async () => ({} as any),
            loadCredentialsFn: async () => ({
                authStrategy: 'api_key_pair',
                apiKey: 'test-key',
                apiSecret: 'test-secret',
            } as any),
        });

        expect(result.outcomeStatus).toBe('unknown');
        expect(mockState.releasedHolds).toHaveLength(0); // Hold must NOT be released!
        expect(mockState.capturedHolds).toHaveLength(0);
        expect(result.purchaseOrder.status).toBe('delivery_pending_review');
        expect(mockState.exceptions).toContainEqual(expect.objectContaining({
            category: 'oem_command_review',
        }));
    });
});
