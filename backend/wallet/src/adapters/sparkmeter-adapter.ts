import type {
    CanonicalMeter,
    CanonicalStation,
    CapabilityManifest,
    ConnectionResult,
    MeterLookup,
    MeterOemAdapter,
    Page,
    PageQuery,
    VendCommand,
    VendOutcome,
    VendStatusQuery,
} from '@beverly/oem-contracts';
import { OemContractError } from '@beverly/oem-contracts';
import { z } from 'zod';
import { adminClient } from '../db/supabase.js';
import { validateOemEndpoint } from '../services/oem-endpoint-security.js';
import { buildSparkMeterAuthHeaders } from './sparkmeter-v1.js';
import {
    lookupSparkMeterPayment,
    submitSparkMeterPayment,
} from '../services/sparkmeter-payment-client.js';

const customerResponse = z.object({
    errors: z.array(z.unknown()).length(0),
    data: z.object({
        id: z.string().min(1), name: z.string().optional(), site_id: z.string().nullable().optional(),
        balances: z.object({ credit: z.object({ value: z.string(), currency: z.string() }).nullable().optional() }).optional(),
        meters: z.array(z.object({
            id: z.string().min(1), serial: z.string().min(1), tariff_id: z.string().nullable().optional(),
            latest_reading: z.object({
                heartbeat_end: z.string().optional(), energy: z.number().nullable().optional(),
                voltage_avg: z.number().nullable().optional(), current_avg: z.number().nullable().optional(),
                power_factor_avg: z.number().nullable().optional(), true_power_avg: z.number().nullable().optional(),
                apparent_power_avg: z.number().nullable().optional(), frequency: z.number().nullable().optional(),
                state: z.string().nullable().optional(),
            }).nullable().optional(),
        })).max(100),
    }),
});

export interface SparkMeterAdapterConfig {
    readonly installationId: string;
    readonly baseUrl: string;
    readonly approvedHostnames: readonly string[];
    readonly apiKey: string;
    readonly apiSecret: string;
    readonly db?: typeof adminClient;
    readonly fetchFn?: typeof fetch;
}

export class SparkMeterAdapter implements MeterOemAdapter {
    private readonly installationId: string;
    private readonly baseUrl: string;
    private readonly approvedHostnames: readonly string[];
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly db: typeof adminClient;
    private readonly fetchFn?: typeof fetch;

    constructor(config: SparkMeterAdapterConfig) {
        this.installationId = config.installationId;
        this.baseUrl = config.baseUrl;
        this.approvedHostnames = config.approvedHostnames;
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.db = config.db ?? adminClient;
        this.fetchFn = config.fetchFn;
    }

    capabilities(): CapabilityManifest {
        return {
            'vending.direct_credit': 'write_supported',
            'vending.sts_token': 'unsupported',
            'station.read': 'read_only',
            'meter.read': 'read_only',
            'telemetry.read': 'read_only',
        };
    }

    async testConnection(): Promise<ConnectionResult> {
        try {
            const origin = await validateOemEndpoint(this.baseUrl, this.approvedHostnames);
            const headers = buildSparkMeterAuthHeaders(this.apiKey, this.apiSecret);
            const url = new URL('/api/v1/customers?per_page=1', origin);
            const fetcher = this.fetchFn ?? fetch;
            const res = await fetcher(url.toString(), {
                method: 'GET',
                redirect: 'error',
                signal: AbortSignal.timeout(10_000),
                headers: {
                    Accept: 'application/json',
                    ...headers,
                },
            });
            if (res.ok) {
                const body: unknown = await res.json();
                if (!body || typeof body !== 'object' || !Array.isArray((body as { data?: unknown }).data)) {
                    return { ok: false, reason: 'Invalid provider response' };
                }
                const errors = (body as { errors?: unknown }).errors;
                if (errors !== undefined && (!Array.isArray(errors) || errors.length > 0)) {
                    return { ok: false, reason: 'Provider returned errors' };
                }
                return { ok: true };
            }
            return { ok: false, reason: `HTTP probe rejected with status ${res.status}` };
        } catch (error) {
            return {
                ok: false,
                reason: error instanceof Error ? error.message : 'Connection probe failed',
            };
        }
    }

    async readCustomer(input: { installationId: string; customerId: string }) {
        if (input.installationId !== this.installationId || !input.customerId.trim()) {
            throw new OemContractError('OEM_INSTALLATION_INVALID', 'Invalid customer scope');
        }
        const origin = await validateOemEndpoint(this.baseUrl, this.approvedHostnames);
        const url = new URL(`/api/v1/customers/${encodeURIComponent(input.customerId)}`, origin);
        url.searchParams.set('reading_details', 'true');
        const response = await (this.fetchFn ?? fetch)(url.toString(), {
            method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000),
            headers: { Accept: 'application/json', ...buildSparkMeterAuthHeaders(this.apiKey, this.apiSecret) },
        });
        if (!response.ok) throw new OemContractError('OEM_INSTALLATION_INVALID', 'Provider customer data unavailable');
        const body = customerResponse.safeParse(await response.json().catch(() => null));
        if (!body.success || body.data.data.id !== input.customerId) {
            throw new OemContractError('OEM_INSTALLATION_INVALID', 'Provider customer data invalid');
        }
        const customer = body.data.data;
        return { id: customer.id, name: customer.name ?? null, siteId: customer.site_id ?? null,
            credit: customer.balances?.credit ?? null, meters: customer.meters.map((meter) => ({
                id: meter.id, serial: meter.serial, tariffId: meter.tariff_id ?? null,
                latestReading: meter.latest_reading ?? null,
            })) };
    }

    async listStations(query: PageQuery): Promise<Page<CanonicalStation>> {
        if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100) {
            throw new OemContractError('OEM_INSTALLATION_INVALID', 'Invalid station page size');
        }
        const siteSet = new Set<string>();
        for (let page = 0; page <= 100; page++) {
            const { data, error } = await this.db.from('oem_inventory_meters')
                .select('site_id').eq('oem_installation_id', this.installationId).eq('status', 'active')
                .order('id', { ascending: true }).range(page * 1000, page * 1000 + 999);
            if (error || !data || (page === 100 && data.length > 0)) {
                throw new OemContractError('OEM_INSTALLATION_INVALID', 'Station inventory unavailable');
            }
            for (const row of data) {
                if (typeof row.site_id === 'string' && row.site_id.trim()) siteSet.add(row.site_id.trim());
            }
            if (data.length < 1000) break;
        }
        const sites = [...siteSet].sort();
        if (query.cursor && !siteSet.has(query.cursor)) {
            throw new OemContractError('OEM_INSTALLATION_INVALID', 'Invalid station cursor');
        }
        const start = query.cursor ? sites.indexOf(query.cursor) + 1 : 0;
        const selected = sites.slice(start, start + query.limit);
        return { items: selected.map((siteId) => ({ externalId: siteId, name: siteId })),
            nextCursor: start + selected.length < sites.length ? selected[selected.length - 1] : null };
    }

    async findMeter(input: MeterLookup): Promise<CanonicalMeter> {
        if (input.installationId !== this.installationId) {
            throw new OemContractError('OEM_INSTALLATION_INVALID', 'Installation does not match adapter');
        }
        const { data, error } = await this.db
            .from('oem_inventory_meters')
            .select('external_id, site_id, status')
            .eq('oem_installation_id', input.installationId)
            .or(`external_id.eq.${input.externalMeterId},serial.eq.${input.externalMeterId}`)
            .eq('status', 'active')
            .maybeSingle();

        if (error || !data) {
            throw new OemContractError(
                'OEM_INSTALLATION_INVALID',
                `Meter ${input.externalMeterId} not found in active inventory`,
            );
        }

        return {
            externalId: data.external_id,
            externalStationId: data.site_id ?? 'UNKNOWN',
        };
    }

    async vend(command: VendCommand): Promise<VendOutcome> {
        if (command.installationId !== this.installationId) {
            throw new OemContractError('OEM_INSTALLATION_INVALID', 'Installation does not match adapter');
        }
        if (command.currency !== 'NGN') {
            throw new OemContractError(
                'OEM_OUTCOME_INVALID',
                `Unsupported currency ${command.currency}; SparkMeter payments require NGN`,
            );
        }

        const { data: meter, error } = await this.db
            .from('oem_inventory_meters')
            .select('external_id, customer_external_id, site_id')
            .eq('oem_installation_id', command.installationId)
            .or(`external_id.eq.${command.externalMeterId},serial.eq.${command.externalMeterId}`)
            .eq('status', 'active')
            .maybeSingle();

        if (error || !meter || !meter.customer_external_id) {
            throw new OemContractError(
                'OEM_INSTALLATION_INVALID',
                `Meter ${command.externalMeterId} has no assigned customer in active inventory`,
            );
        }

        const customer = await this.readCustomer({ installationId: command.installationId, customerId: meter.customer_external_id });
        if (!meter.site_id || customer.siteId !== meter.site_id || !customer.meters.some((item) => item.id === meter.external_id)) {
            throw new OemContractError('OEM_INSTALLATION_INVALID', 'Provider meter ownership differs from inventory');
        }

        const outcome = await submitSparkMeterPayment({
            commandId: command.commandId,
            baseUrl: this.baseUrl,
            approvedHostnames: this.approvedHostnames,
            apiKey: this.apiKey,
            apiSecret: this.apiSecret,
            externalCustomerId: meter.customer_external_id,
            amountMinor: command.amountMinor,
            currency: command.currency,
            settlementCurrency: command.currency,
        }, {
            fetchFn: this.fetchFn,
        });

        return outcome;
    }

    async getVendStatus(query: VendStatusQuery & {
        externalCustomerId?: string;
        expectedAmountMinor?: number;
        expectedCurrency?: string;
    }): Promise<VendOutcome> {
        if (query.installationId !== this.installationId) {
            throw new OemContractError('OEM_INSTALLATION_INVALID', 'Installation does not match adapter');
        }
        let customerId = query.externalCustomerId;
        let amountMinor = query.expectedAmountMinor;
        let currency = query.expectedCurrency ?? 'NGN';

        if (!customerId || !amountMinor) {
            // Load command payload from db if not passed directly
            const { data: cmd } = await this.db
                .from('oem_commands')
                .select('canonical_request')
                .eq('id', query.commandId)
                .eq('oem_installation_id', this.installationId)
                .maybeSingle();
            if (cmd?.canonical_request) {
                customerId = customerId ?? cmd.canonical_request.customerId ?? cmd.canonical_request.customer_id;
                amountMinor = amountMinor ?? cmd.canonical_request.amountMinor ?? cmd.canonical_request.expectedAmountMinor;
                currency = currency ?? cmd.canonical_request.currency ?? 'NGN';
            }
        }

        const outcome = await lookupSparkMeterPayment({
            commandId: query.commandId,
            baseUrl: this.baseUrl,
            approvedHostnames: this.approvedHostnames,
            apiKey: this.apiKey,
            apiSecret: this.apiSecret,
            externalCustomerId: customerId ?? '',
            amountMinor: amountMinor ?? 0,
            currency,
            settlementCurrency: currency,
        }, {
            fetchFn: this.fetchFn,
        });

        return outcome;
    }
}
