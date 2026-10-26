import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    executeUniversalVend,
    CalinmeterAdapter,
    UniversalVendInput,
} from '../universal-oem-dispatcher.js';
import { VendingError } from '../../services/vending.js';
import { SPARKMETER_SITE_TO_STATION } from '../../services/station-vend-scope.js';

vi.mock('../../services/token-engine.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../services/token-engine.js')>();
    return {
        ...actual,
        previewPurchaseWithPolicy: vi.fn(async (amountMinor: number) => ({
            grossAmountMinor: amountMinor,
            energyAmountMinor: Math.round(amountMinor * 0.93),
            taxAmountMinor: Math.round(amountMinor * 0.07),
            vatRateBasisPoints: 750,
            units: 10,
        })),
    };
});

vi.mock('../../services/oem-quota-circuit.js', () => ({
    claimOemVendProbe: vi.fn(async () => {}),
    clearOemQuotaCircuit: vi.fn(async () => {}),
    recordOemQuotaFailure: vi.fn(async () => {}),
}));

vi.mock('../../services/audit.js', () => ({
    logAction: vi.fn(async () => {}),
}));

describe('Universal OEM Dispatcher & CalinmeterAdapter', () => {
    let mockState: {
        holds: any[];
        releasedHolds: string[];
        capturedHolds: any[];
        purchaseOrders: any[];
        oemCommands: any[];
        exceptions: any[];
        receipts: any[];
        auditLogs: any[];
    };

    beforeEach(() => {
        mockState = {
            holds: [],
            releasedHolds: [],
            capturedHolds: [],
            purchaseOrders: [],
            oemCommands: [],
            exceptions: [],
            receipts: [],
            auditLogs: [],
        };
    });

    const createMockDb = (opts: {
        meterExists?: boolean;
        customerExists?: boolean;
        installationStatus?: string;
        leaseAvailable?: boolean;
    } = {}) => {
        const {
            meterExists = true,
            customerExists = true,
            installationStatus = 'active',
            leaseAvailable = true,
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
                                    const record = { id: 'po-universal-1', ...po };
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
                    const meterData = meterExists ? {
                        external_id: 'sm-meter-uuid',
                        customer_external_id: 'sm-cust-uuid',
                        serial: 'SM-12345678',
                        tariff_id: 'RESIDENTIAL',
                        meter_phase: 'single_phase',
                        site_id: '0619f73f-922d-4ddd-afe5-901c2ae771f7',
                        oem_installation_id: '53f12390-74f7-40b3-b1db-e907c256986d',
                        oem_installations: {
                            id: '53f12390-74f7-40b3-b1db-e907c256986d',
                            base_url: 'https://api.sparkmeter.cloud',
                            approved_hostnames: ['api.sparkmeter.cloud'],
                            tenant_id: 'tenant-1',
                            status: installationStatus,
                            oem_type: 'sparkmeter',
                        },
                    } : null;

                    const meterQueryBuilder: any = {
                        or: function() { return this; },
                        eq: function() { return this; },
                        limit: function() { return this; },
                        maybeSingle: async () => ({ data: meterData, error: null }),
                        single: async () => ({ data: meterData, error: null }),
                    };

                    return {
                        select: () => meterQueryBuilder,
                    };
                }
                if (table === 'oem_inventory_customers') {
                    const custData = customerExists ? {
                        external_id: 'sm-cust-uuid',
                        name: 'Spark Customer',
                        phone: '+2348000000000',
                        status: 'active',
                    } : null;

                    const custQueryBuilder: any = {
                        eq: function() { return this; },
                        maybeSingle: async () => ({ data: custData, error: null }),
                        single: async () => ({ data: custData, error: null }),
                    };

                    return {
                        select: () => custQueryBuilder,
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
                                : mockState.oemCommands[0];
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
                                    const record = { id: 'cmd-universal-1', ...cmd, attempt_count: 0, status: 'pending' };
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
                                    single: async () => ({
                                        data: leaseAvailable ? (mockState.oemCommands[0] ?? null) : null,
                                        error: null,
                                    }),
                                }),
                                then: (resolve: any) => resolve({ data: [mockState.oemCommands[0]], error: null }),
                            };
                            return updateChain;
                        },
                    };
                }
                if (table === 'oem_command_attempts') {
                    return {
                        insert: async () => ({ error: null }),
                    };
                }
                if (table === 'oem_installations') {
                    return {
                        select: () => ({
                            eq: () => ({
                                limit: () => ({
                                    maybeSingle: async () => ({
                                        data: {
                                            id: '53f12390-74f7-40b3-b1db-e907c256986d',
                                            base_url: 'https://api.sparkmeter.cloud',
                                            approved_hostnames: ['api.sparkmeter.cloud'],
                                            tenant_id: 'tenant-1',
                                            status: 'active',
                                            oem_id: 'e1532892-e09d-44f9-a9cb-b99b5c9ebecf',
                                        },
                                        error: null,
                                    }),
                                }),
                            }),
                        }),
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
                if (table === 'vendor_users' || table === 'vendor_organizations') {
                    return {
                        select: () => ({
                            eq: () => ({
                                maybeSingle: async () => ({ data: null, error: null }),
                            }),
                        }),
                    };
                }
                throw new Error(`Unexpected table ${table}`);
            },
            rpc: async (name: string, args: any) => {
                if (name === 'claim_oem_command_dispatch') {
                    if (!leaseAvailable) {
                        return { data: [{ can_dispatch: false }], error: null };
                    }
                    return {
                        data: [{
                            can_dispatch: true,
                            command_id: args.p_command_id,
                            lease_token: 'lease-tok-1',
                            attempt_number: 1,
                        }],
                        error: null,
                    };
                }
                if (name === 'complete_oem_command_outcome') {
                    return { data: [{ ok: true }], error: null };
                }
                if (name === 'fn_release_hold') {
                    mockState.releasedHolds.push(args.p_hold_id);
                    return { error: null };
                }
                throw new Error(`Unexpected rpc ${name}`);
            },
        };
    };

    describe('CalinmeterAdapter (MeterOemAdapter conformance)', () => {
        it('declares exact capability manifest', () => {
            const adapter = new CalinmeterAdapter();
            const caps = adapter.capabilities();
            expect(caps['vending.sts_token']).toBe('write_supported');
            expect(caps['vending.direct_credit']).toBe('unsupported');
            expect(caps['station.read']).toBe('read_only');
            expect(caps['meter.read']).toBe('read_only');
        });

        it('tests connection via assertEnergyVendReady', async () => {
            const adapter = new CalinmeterAdapter();
            const result = await adapter.testConnection();
            expect(result.ok).toBe(true);
        });

        it('lists canonical stations from token engine listStations', async () => {
            const mockListStations = vi.fn(async () => [
                { stationId: 'ST-1', name: 'Station 1' },
                { stationId: 'ST-2', name: 'Station 2' },
            ]);
            const adapter = new CalinmeterAdapter({ listStationsFn: mockListStations as any });
            const page = await adapter.listStations({ limit: 10 });
            expect(page.items).toHaveLength(2);
            expect(page.items[0]).toEqual({ externalId: 'ST-1', name: 'Station 1' });
        });

        it('finds canonical meter via token engine lookupMeter', async () => {
            const mockLookupMeter = vi.fn(async (meterId: string) => ({
                meterId,
                stationId: 'ST-1',
                customerId: 'cust-1',
                customerName: 'Customer One',
                tariffId: 'RESIDENTIAL',
            }));
            const adapter = new CalinmeterAdapter({ lookupMeterFn: mockLookupMeter as any });
            const canonical = await adapter.findMeter({ installationId: 'inst-1', externalMeterId: 'CAL-100' });
            expect(canonical.externalId).toBe('CAL-100');
            expect(canonical.externalStationId).toBe('ST-1');
        });

        it('vends 20-digit STS token on success', async () => {
            const mockGenerateToken = vi.fn(async () => ({
                token: '0021 2636 8628 4408 6688',
                tokenRecordId: 'token-rec-1',
                amountMinor: 5000,
                units: 14.28,
                generatedAt: '2026-10-26T00:00:00Z',
                upstreamPayload: {},
            }));

            const adapter = new CalinmeterAdapter({
                generateCreditTokenFn: mockGenerateToken as any,
                customerId: 'cust-1',
                stationId: 'ST-1',
                tariffId: 'RESIDENTIAL',
            });

            const outcome = await adapter.vend({
                installationId: 'inst-1',
                commandId: 'cmd-1',
                idempotencyKey: 'idem-1',
                externalMeterId: 'CAL-100',
                amountMinor: 5000,
                currency: 'NGN',
            });

            expect(outcome.status).toBe('confirmed_success');
            if (outcome.status === 'confirmed_success') {
                expect(outcome.token).toBe('0021 2636 8628 4408 6688');
                expect(outcome.token?.replace(/\s+/g, '')).toHaveLength(20);
                expect(outcome.providerReference).toBe('token-rec-1');
            }
        });

        it('returns confirmed_failure when token generation fails', async () => {
            const mockGenerateToken = vi.fn(async () => {
                throw new Error('Calinmeter HES vending quota is insufficient');
            });

            const adapter = new CalinmeterAdapter({
                generateCreditTokenFn: mockGenerateToken as any,
            });

            const outcome = await adapter.vend({
                installationId: 'inst-1',
                commandId: 'cmd-2',
                idempotencyKey: 'idem-2',
                externalMeterId: 'CAL-100',
                amountMinor: 5000,
                currency: 'NGN',
            });

            expect(outcome.status).toBe('confirmed_failure');
            if (outcome.status === 'confirmed_failure') {
                expect(outcome.reason).toContain('quota is insufficient');
            }
        });
    });

    describe('executeUniversalVend', () => {
        const baseInput: UniversalVendInput = {
            actorType: 'vendor',
            actorId: 'org-1',
            userId: 'user-1',
            walletId: 'wallet-1',
            meterId: 'SM-12345678',
            amountMinor: 5000,
            clientIdempotencyKey: 'client-idem-1',
            vendorStationId: 'OTU-COSTAIN',
        };

        const sparkMeterInfo = {
            meterId: 'SM-12345678',
            customerId: 'sm-cust-uuid',
            customerName: 'Spark Customer',
            stationId: 'OTU-COSTAIN',
            tariffId: 'RESIDENTIAL',
            oemId: 'sparkmeter',
            vendingStrategy: 'direct_credit' as const,
        };

        const calinMeterInfo = {
            meterId: 'CAL-99999999',
            customerId: 'cal-cust-1',
            customerName: 'Calin Customer',
            stationId: 'CALIN-STATION',
            tariffId: 'RESIDENTIAL',
            oemId: 'calinmeter',
            vendingStrategy: 'sts_token' as const,
        };

        it('executes direct_credit vend: token is strictly null', async () => {
            const mockDb = createMockDb();
            const fetchFn = vi.fn(async () => new Response(JSON.stringify({
                errors: [],
                data: {
                    id: '11111111-1111-1111-1111-111111111111',
                    external_id: 'cmd-universal-1',
                    recipient_id: 'sm-cust-uuid',
                    status: 'processed',
                    amount: { value: '50.00', currency: 'NGN' },
                },
            }), { status: 201 }));

            const result = await executeUniversalVend({
                ...baseInput,
                meter: sparkMeterInfo,
            }, {
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
            expect(result.vendingStrategy).toBe('direct_credit');
            expect(result.token).toBeNull(); // Direct credit: token must be null
            expect(result.receiptId).toBe('rcpt-1');
            expect(result.purchaseOrder.status).toBe('delivered');
            expect(result.purchaseOrder.delivery_state).toBe('payment_processed_delivery_unconfirmed');
            expect(mockState.capturedHolds).toHaveLength(1);
            expect(mockState.releasedHolds).toHaveLength(0);
        });

        it('executes sts_token vend: token is a 20-digit string', async () => {
            const mockDb = createMockDb();
            const token20 = '0021 2636 8628 4408 6688';

            const result = await executeUniversalVend({
                ...baseInput,
                meterId: 'CAL-99999999',
                vendorStationId: 'CALIN-STATION',
                meter: calinMeterInfo,
            }, {
                db: mockDb as any,
                createHoldFn: async () => ({ id: 'hold-2' } as any),
                captureHoldFn: async (args: any) => { mockState.capturedHolds.push(args); return {} as any; },
                createReceiptFn: async () => ({ id: 'rcpt-2' } as any),
                adapter: {
                    capabilities: () => ({ 'vending.sts_token': 'write_supported' } as any),
                    testConnection: async () => ({ ok: true }),
                    listStations: async () => ({ items: [], nextCursor: null }),
                    findMeter: async () => ({ externalId: 'CAL-99999999', externalStationId: 'CALIN-STATION' }),
                    vend: async () => ({
                        status: 'confirmed_success',
                        providerReference: 'tok-ref-1',
                        token: token20,
                    }),
                    getVendStatus: async () => ({ status: 'confirmed_success', providerReference: 'tok-ref-1' }),
                },
            });

            expect(result.outcomeStatus).toBe('confirmed_success');
            expect(result.vendingStrategy).toBe('sts_token');
            expect(result.token).toBe(token20);
            expect(result.token?.replace(/\s+/g, '')).toHaveLength(20); // 20-digit STS token
            expect(result.receiptId).toBe('rcpt-2');
            expect(result.purchaseOrder.status).toBe('delivered');
            expect(result.purchaseOrder.delivery_state).toBe('token_generated');
            expect(mockState.capturedHolds).toHaveLength(1);
            expect(mockState.releasedHolds).toHaveLength(0);
        });

        it('enforces assertStationVendAllowed: allows normalized SparkMeter site ID to station name', async () => {
            const mockDb = createMockDb();
            const fetchFn = vi.fn(async () => new Response(JSON.stringify({
                errors: [],
                data: {
                    id: '22222222-2222-2222-2222-222222222222',
                    external_id: 'cmd-universal-1',
                    recipient_id: 'sm-cust-uuid',
                    status: 'processed',
                    amount: { value: '50.00', currency: 'NGN' },
                },
            }), { status: 201 }));

            // Vendor assigned to 'OTU-COSTAIN', meter has site UUID '0619f73f-922d-4ddd-afe5-901c2ae771f7'
            // SPARKMETER_SITE_TO_STATION maps '0619f73f-922d-4ddd-afe5-901c2ae771f7' to 'OTU-COSTAIN'
            const result = await executeUniversalVend({
                ...baseInput,
                vendorStationId: 'OTU-COSTAIN',
                meter: {
                    ...sparkMeterInfo,
                    stationId: '0619f73f-922d-4ddd-afe5-901c2ae771f7',
                },
            }, {
                db: mockDb as any,
                fetchFn,
                createHoldFn: async () => ({ id: 'hold-norm' } as any),
                captureHoldFn: async () => ({} as any),
                createReceiptFn: async () => ({ id: 'rcpt-norm' } as any),
                loadCredentialsFn: async () => ({
                    authStrategy: 'api_key_pair',
                    apiKey: 'test-key',
                    apiSecret: 'test-secret',
                } as any),
            });

            expect(result.outcomeStatus).toBe('confirmed_success');
        });

        it('enforces assertStationVendAllowed: rejects cross-station vend', async () => {
            const mockDb = createMockDb();

            await expect(executeUniversalVend({
                ...baseInput,
                vendorStationId: 'ADEBAYO', // Different station!
                meter: sparkMeterInfo, // stationId is 'OTU-COSTAIN'
            }, {
                db: mockDb as any,
            })).rejects.toThrow(VendingError);
        });

        it('enforces canary ceiling for direct credit when enabled', async () => {
            const mockDb = createMockDb();

            await expect(executeUniversalVend({
                ...baseInput,
                amountMinor: 15000, // NGN 150.00 > 10,000 minor ceiling
                enforceCanaryCeiling: true,
                meter: sparkMeterInfo,
            }, {
                db: mockDb as any,
            })).rejects.toThrow('Amount exceeds canary ceiling of ₦100.00');
        });

        it('handles confirmed failure: releases hold and marks purchase failed', async () => {
            const mockDb = createMockDb();

            await expect(executeUniversalVend({
                ...baseInput,
                meter: sparkMeterInfo,
            }, {
                db: mockDb as any,
                createHoldFn: async () => ({ id: 'hold-fail' } as any),
                releaseHoldFn: async () => { mockState.releasedHolds.push('hold-fail'); return {} as any; },
                loadCredentialsFn: async () => ({
                    authStrategy: 'api_key_pair',
                    apiKey: 'test-key',
                    apiSecret: 'test-secret',
                } as any),
                adapter: {
                    capabilities: () => ({ 'vending.direct_credit': 'write_supported' } as any),
                    testConnection: async () => ({ ok: true }),
                    listStations: async () => ({ items: [], nextCursor: null }),
                    findMeter: async () => ({ externalId: 'SM-1', externalStationId: 'OTU-COSTAIN' }),
                    vend: async () => ({
                        status: 'confirmed_failure',
                        reason: 'Meter disconnected',
                    }),
                    getVendStatus: async () => ({ status: 'confirmed_failure', reason: 'Meter disconnected' }),
                },
            })).rejects.toThrow(VendingError);

            expect(mockState.releasedHolds).toContain('hold-fail');
            expect(mockState.capturedHolds).toHaveLength(0);
            expect(mockState.purchaseOrders[0].status).toBe('failed');
        });

        it('handles ambiguous outcome: retains hold and marks delivery_pending_review', async () => {
            const mockDb = createMockDb();

            const result = await executeUniversalVend({
                ...baseInput,
                meter: sparkMeterInfo,
            }, {
                db: mockDb as any,
                createHoldFn: async () => ({ id: 'hold-ambiguous' } as any),
                loadCredentialsFn: async () => ({
                    authStrategy: 'api_key_pair',
                    apiKey: 'test-key',
                    apiSecret: 'test-secret',
                } as any),
                adapter: {
                    capabilities: () => ({ 'vending.direct_credit': 'write_supported' } as any),
                    testConnection: async () => ({ ok: true }),
                    listStations: async () => ({ items: [], nextCursor: null }),
                    findMeter: async () => ({ externalId: 'SM-1', externalStationId: 'OTU-COSTAIN' }),
                    vend: async () => ({
                        status: 'unknown',
                    }),
                    getVendStatus: async () => ({ status: 'unknown' }),
                },
            });

            expect(result.outcomeStatus).toBe('unknown');
            expect(result.token).toBeNull();
            expect(mockState.releasedHolds).toHaveLength(0); // Hold must NOT be released!
            expect(mockState.capturedHolds).toHaveLength(0);
            expect(result.purchaseOrder.status).toBe('delivery_pending_review');
            expect(mockState.exceptions).toContainEqual(expect.objectContaining({
                category: 'oem_command_review',
            }));
        });

        it('handles lease contention: rejects if command lease cannot be claimed', async () => {
            const mockDb = createMockDb({ leaseAvailable: false });

            await expect(executeUniversalVend({
                ...baseInput,
                meter: sparkMeterInfo,
            }, {
                db: mockDb as any,
                createHoldFn: async () => ({ id: 'hold-conflict' } as any),
                loadCredentialsFn: async () => ({
                    authStrategy: 'api_key_pair',
                    apiKey: 'test-key',
                    apiSecret: 'test-secret',
                } as any),
            })).rejects.toThrow('Command dispatch lease already claimed');
        });
    });
});
