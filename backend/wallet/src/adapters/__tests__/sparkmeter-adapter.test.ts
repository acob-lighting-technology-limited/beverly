import { describe, expect, it, vi } from 'vitest';
import { OemContractError } from '@beverly/oem-contracts';
import { SparkMeterAdapter } from '../sparkmeter-adapter.js';

describe('SparkMeterAdapter (MeterOemAdapter conformance)', () => {
    const config = {
        installationId: 'inst-1',
        baseUrl: 'https://api.sparkmeter.cloud',
        approvedHostnames: ['api.sparkmeter.cloud'],
        apiKey: 'test-key',
        apiSecret: 'test-secret',
    };

    it('declares exact capability manifest', () => {
        const adapter = new SparkMeterAdapter(config);
        const caps = adapter.capabilities();
        expect(caps['vending.direct_credit']).toBe('write_supported');
        expect(caps['vending.sts_token']).toBe('unsupported');
        expect(caps['station.read']).toBe('read_only');
        expect(caps['meter.read']).toBe('read_only');
    });

    it('verifies connection via authenticated probe', async () => {
        const fetchFn = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
        const adapter = new SparkMeterAdapter({ ...config, fetchFn });
        const result = await adapter.testConnection();
        expect(result.ok).toBe(true);
        expect(fetchFn).toHaveBeenCalledOnce();
    });

    it('reports connection failure when upstream rejects probe', async () => {
        const fetchFn = vi.fn(async () => new Response('Unauthorized', { status: 401 }));
        const adapter = new SparkMeterAdapter({ ...config, fetchFn });
        const result = await adapter.testConnection();
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toContain('401');
        }
    });

    it('lists canonical stations from scoped inventory sites', async () => {
        const mockDb = {
            from: (table: string) => {
                expect(table).toBe('oem_inventory_meters');
                return {
                    select: () => ({
                        eq: () => ({
                            eq: async () => ({
                                data: [{ site_id: 'SITE-A' }, { site_id: 'SITE-B' }, { site_id: 'SITE-A' }],
                                error: null,
                            }),
                        }),
                    }),
                };
            },
        };
        const adapter = new SparkMeterAdapter({ ...config, db: mockDb as any });
        const stations = await adapter.listStations({ limit: 10 });
        expect(stations.items).toHaveLength(2);
        expect(stations.items.map((s) => s.externalId).sort()).toEqual(['SITE-A', 'SITE-B']);
    });

    it('finds active canonical meter from inventory', async () => {
        const mockDb = {
            from: () => ({
                select: () => ({
                    eq: () => ({
                        or: () => ({
                            eq: () => ({
                                maybeSingle: async () => ({
                                    data: { external_id: 'sm-meter-1', site_id: 'SITE-A' },
                                    error: null,
                                }),
                            }),
                        }),
                    }),
                }),
            }),
        };
        const adapter = new SparkMeterAdapter({ ...config, db: mockDb as any });
        const meter = await adapter.findMeter({ installationId: 'inst-1', externalMeterId: 'sm-meter-1' });
        expect(meter.externalId).toBe('sm-meter-1');
        expect(meter.externalStationId).toBe('SITE-A');
    });

    it('throws OemContractError when meter is not found', async () => {
        const mockDb = {
            from: () => ({
                select: () => ({
                    eq: () => ({
                        or: () => ({
                            eq: () => ({
                                maybeSingle: async () => ({ data: null, error: null }),
                            }),
                        }),
                    }),
                }),
            }),
        };
        const adapter = new SparkMeterAdapter({ ...config, db: mockDb as any });
        await expect(adapter.findMeter({ installationId: 'inst-1', externalMeterId: 'missing' }))
            .rejects.toThrow(OemContractError);
    });

    it('vends direct credit without generating an STS token', async () => {
        const mockDb = {
            from: () => ({
                select: () => ({
                    eq: () => ({
                        or: () => ({
                            eq: () => ({
                                maybeSingle: async () => ({
                                    data: { external_id: 'sm-meter-1', customer_external_id: 'cust-1', site_id: 'SITE-A' },
                                    error: null,
                                }),
                            }),
                        }),
                    }),
                }),
            }),
        };
        const fetchFn = vi.fn(async () => new Response(JSON.stringify({
            errors: [],
            data: {
                id: '11111111-1111-1111-1111-111111111111',
                external_id: 'cmd-1',
                recipient_id: 'cust-1',
                status: 'processed',
                amount: { value: '10.00', currency: 'NGN' },
            },
        }), { status: 201 }));

        const adapter = new SparkMeterAdapter({ ...config, db: mockDb as any, fetchFn });
        const outcome = await adapter.vend({
            installationId: 'inst-1',
            commandId: 'cmd-1',
            idempotencyKey: 'idemp-1',
            externalMeterId: 'sm-meter-1',
            amountMinor: 1000,
            currency: 'NGN',
        });

        expect(outcome.status).toBe('confirmed_success');
        if (outcome.status === 'confirmed_success') {
            expect(outcome.providerReference).toBe('cmd-1');
            expect(outcome.token).toBeUndefined(); // Direct credit: never synthetic STS token
        }
    });

    it('gets vend status via read-only payment lookup', async () => {
        const fetchFn = vi.fn(async () => new Response(JSON.stringify({
            errors: [],
            data: [{
                id: '11111111-1111-1111-1111-111111111111',
                external_id: 'cmd-1',
                recipient_id: 'cust-1',
                status: 'processed',
                amount: { value: '10.00', currency: 'NGN' },
            }],
        }), { status: 200 }));

        const adapter = new SparkMeterAdapter({ ...config, fetchFn });
        const outcome = await adapter.getVendStatus({
            installationId: 'inst-1',
            commandId: 'cmd-1',
            externalCustomerId: 'cust-1',
            expectedAmountMinor: 1000,
            expectedCurrency: 'NGN',
        } as any);

        expect(outcome.status).toBe('confirmed_success');
    });
});
