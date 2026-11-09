import { afterEach, describe, expect, it, vi } from 'vitest';
import { SparkMeterAdapter } from '../../adapters/sparkmeter-adapter.js';
import { lookupOemInventoryMeter } from '../token-engine.js';

vi.mock('../oem-installation-credentials.js', () => ({
    loadInstallationCredentials: vi.fn(async () => ({ authStrategy: 'api_key_pair', apiKey: 'key', apiSecret: 'secret' })),
}));

function database() {
    const meter = { external_id: 'meter-1', customer_external_id: 'customer-1', serial: 'SM-1',
        tariff_id: 'tariff-1', meter_phase: null, site_id: 'site-1', oem_installation_id: 'installation-1',
        oem_installations: { id: 'installation-1', tenant_id: 'tenant-1', status: 'active',
            base_url: 'https://www.sparkmeter.cloud', approved_hostnames: ['www.sparkmeter.cloud'], oem_manufacturers: { slug: 'sparkmeter' } } };
    return { from: (table: string) => {
        const chain: any = { select: () => chain, or: () => chain, eq: () => chain, limit: () => chain,
            maybeSingle: async () => ({ data: table === 'oem_inventory_meters' ? meter :
                { external_id: 'customer-1', name: 'Customer', status: 'active' }, error: null }) };
        return chain;
    } };
}

describe('SparkMeter live meter verification', () => {
    afterEach(() => vi.restoreAllMocks());
    it('marks the meter live only after Koios confirms its site and owner', async () => {
        vi.spyOn(SparkMeterAdapter.prototype, 'readCustomer').mockResolvedValue({
            id: 'customer-1', name: 'Customer', siteId: 'site-1', credit: null,
            meters: [{ id: 'meter-1', serial: 'SM-1', tariffId: 'tariff-1', latestReading: null }],
        });
        const result = await lookupOemInventoryMeter('SM-1', null, database() as any);
        expect(result).toMatchObject({ liveVerified: true, resolutionSource: 'sparkmeter_live', isThreePhase: null });
    });
    it('never labels stored inventory as live when Koios cannot be verified', async () => {
        vi.spyOn(SparkMeterAdapter.prototype, 'readCustomer').mockRejectedValue(new Error('provider unavailable'));
        const result = await lookupOemInventoryMeter('SM-1', null, database() as any);
        expect(result).toMatchObject({ liveVerified: false, resolutionSource: 'oem_inventory' });
    });
    it('rejects a meter identifier shared across installations', async () => {
        const limits: number[] = [];
        const from = vi.fn(() => {
            const chain: any = { select: () => chain, or: () => chain, eq: () => chain,
                limit: (value: number) => { limits.push(value); return chain; },
                maybeSingle: async () => ({ data: null, error: { code: 'PGRST116' } }) };
            return chain;
        });
        const result = await lookupOemInventoryMeter('SM-1', null, { from } as any);
        expect(result).toBeNull();
        expect(limits).toEqual([2]);
        expect(from).toHaveBeenCalledTimes(1);
    });
});
