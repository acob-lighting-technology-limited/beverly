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

    it('does not follow redirects with provider credentials', async () => {
        const fetchFn = vi.fn(async (_url: string, _options?: RequestInit) => { throw new TypeError('redirect rejected'); });
        const result = await new SparkMeterAdapter({ ...config, fetchFn }).testConnection();
        expect(result.ok).toBe(false);
        expect(fetchFn).toHaveBeenCalledOnce();
        expect(fetchFn.mock.calls[0]?.[1]?.redirect).toBe('error');
    });

    it('does not treat an HTML login page as a provider connection', async () => {
        const adapter = new SparkMeterAdapter({ ...config, fetchFn: vi.fn(async () => new Response('<html>Sign in</html>', { status: 200 })) });
        expect((await adapter.testConnection()).ok).toBe(false);
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
                            eq: () => ({ order: () => ({ range: async () => ({
                                data: [{ site_id: 'SITE-A' }, { site_id: 'SITE-B' }, { site_id: 'SITE-A' }],
                                error: null,
                            }) }) }),
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

    it('includes sites beyond the first inventory page and paginates stations', async () => {
        const rows = [...Array.from({ length: 1000 }, () => ({ site_id: 'SITE-A' })), { site_id: 'SITE-B' }];
        const query = { select: () => query, eq: () => query, order: () => query,
            range: async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }),
            then: (resolve: (value: unknown) => void) => resolve({ data: rows.slice(0, 1000), error: null }) };
        const adapter = new SparkMeterAdapter({ ...config, db: { from: () => query } as any });
        const first = await adapter.listStations({ limit: 1 });
        expect(first).toEqual({ items: [{ externalId: 'SITE-A', name: 'SITE-A' }], nextCursor: 'SITE-A' });
        const second = await adapter.listStations({ limit: 1, cursor: first.nextCursor! });
        expect(second).toEqual({ items: [{ externalId: 'SITE-B', name: 'SITE-B' }], nextCursor: null });
    });

    it('rejects meter lookup for a different installation', async () => {
        const from = vi.fn();
        const adapter = new SparkMeterAdapter({ ...config, db: { from } as any });
        await expect(adapter.findMeter({ installationId: 'another-installation', externalMeterId: 'meter' }))
            .rejects.toThrow(OemContractError);
        expect(from).not.toHaveBeenCalled();
    });

    it('rejects payment dispatch for a different installation', async () => {
        const from = vi.fn();
        const fetchFn = vi.fn();
        const adapter = new SparkMeterAdapter({ ...config, db: { from } as any, fetchFn });
        await expect(adapter.vend({ installationId: 'another-installation', commandId: 'command',
            idempotencyKey: 'key', externalMeterId: 'meter', amountMinor: 100, currency: 'NGN' }))
            .rejects.toThrow(OemContractError);
        expect(from).not.toHaveBeenCalled();
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('rejects payment lookup for a different installation', async () => {
        const fetchFn = vi.fn();
        const adapter = new SparkMeterAdapter({ ...config, fetchFn });
        await expect(adapter.getVendStatus({ installationId: 'another-installation', commandId: 'command',
            externalCustomerId: 'customer', expectedAmountMinor: 100, expectedCurrency: 'NGN' }))
            .rejects.toThrow(OemContractError);
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('reads customer meter details using the documented provider endpoint', async () => {
        const fetchFn = vi.fn(async () => Response.json({ errors: [], data: {
            id: 'cust-1', site_id: 'site-1', name: 'Customer',
            balances: { credit: { value: '100.00', currency: 'NGN' } },
            meters: [{ id: 'meter-1', serial: 'SM-1', tariff_id: 'tariff-1',
                latest_reading: { heartbeat_end: '2026-11-04T12:00:00Z', voltage_avg: 225.04, energy: 22.19, state: 'on' } }]
        } }));
        const adapter = new SparkMeterAdapter({ ...config, fetchFn });
        const customer = await adapter.readCustomer({ installationId: 'inst-1', customerId: 'cust-1' });
        expect(fetchFn.mock.calls[0]?.[0]).toBe('https://api.sparkmeter.cloud/api/v1/customers/cust-1?reading_details=true');
        expect(customer).toMatchObject({ id: 'cust-1', siteId: 'site-1', meters: [{ id: 'meter-1', serial: 'SM-1',
            latestReading: { heartbeat_end: '2026-11-04T12:00:00Z', voltage_avg: 225.04 } }] });
    });

    it('does not accept mismatched provider customer identity', async () => {
        const fetchFn = vi.fn(async () => Response.json({ errors: [], data: { id: 'different', site_id: 'site-1', meters: [] } }));
        const adapter = new SparkMeterAdapter({ ...config, fetchFn });
        await expect(adapter.readCustomer({ installationId: 'inst-1', customerId: 'cust-1' })).rejects.toThrow(OemContractError);
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

    it('does not pay when Koios customer no longer owns the meter', async () => {
        const db = { from: () => ({ select: () => ({ eq: () => ({ or: () => ({ eq: () => ({
            maybeSingle: async () => ({ data: { external_id: 'sm-meter-1', customer_external_id: 'cust-1', site_id: 'SITE-A' }, error: null }),
        }) }) }) }) }) };
        const fetchFn = vi.fn(async () => Response.json({ errors: [], data: { id: 'cust-1', site_id: 'SITE-A', meters: [] } }));
        const adapter = new SparkMeterAdapter({ ...config, db: db as any, fetchFn });
        await expect(adapter.vend({ installationId: 'inst-1', commandId: 'cmd-1', idempotencyKey: 'id',
            externalMeterId: 'sm-meter-1', amountMinor: 1000, currency: 'NGN' })).rejects.toThrow(OemContractError);
        expect(fetchFn).toHaveBeenCalledTimes(1);
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
        const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'GET' ? Response.json({ errors: [], data: { id: 'cust-1', site_id: 'SITE-A', meters: [{ id: 'sm-meter-1', serial: 'SM-1' }] } }) : new Response(JSON.stringify({
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

    it('reconciles using the scoped canonical command', async () => {
        const filters: Record<string, string> = {};
        const builder = { select: vi.fn().mockReturnThis(), eq: vi.fn((key: string, value: string) => { filters[key] = value; return builder; }),
            maybeSingle: vi.fn(async () => ({ data: builder.select.mock.calls[0]?.[0] === 'canonical_request'
                && filters.oem_installation_id === 'inst-1' ? { canonical_request: { customerId: 'cust-1', amountMinor: 1000, currency: 'NGN' } } : null, error: null })) };
        const fetchFn = vi.fn(async () => Response.json({ errors: [], data: [{
            id: '11111111-1111-1111-1111-111111111111', external_id: 'cmd-1', recipient_id: 'cust-1',
            status: 'processed', amount: { value: '10.00', currency: 'NGN' }
        }] }));
        const adapter = new SparkMeterAdapter({ ...config, db: { from: () => builder } as any, fetchFn });
        const outcome = await adapter.getVendStatus({ installationId: 'inst-1', commandId: 'cmd-1' });
        expect(outcome.status).toBe('confirmed_success');
        expect(filters).toEqual({ id: 'cmd-1', oem_installation_id: 'inst-1' });
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
