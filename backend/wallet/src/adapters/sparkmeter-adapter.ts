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
import { adminClient } from '../db/supabase.js';
import { validateOemEndpoint } from '../services/oem-endpoint-security.js';
import { buildSparkMeterAuthHeaders } from './sparkmeter-v1.js';
import {
    lookupSparkMeterPayment,
    submitSparkMeterPayment,
} from '../services/sparkmeter-payment-client.js';

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
            const url = new URL('/api/v1/customers?limit=1', origin);
            const fetcher = this.fetchFn ?? fetch;
            const res = await fetcher(url.toString(), {
                method: 'GET',
                signal: AbortSignal.timeout(10_000),
                headers: {
                    Accept: 'application/json',
                    ...headers,
                },
            });
            if (res.ok) {
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

    async listStations(query: PageQuery): Promise<Page<CanonicalStation>> {
        const { data, error } = await this.db
            .from('oem_inventory_meters')
            .select('site_id')
            .eq('oem_installation_id', this.installationId)
            .eq('status', 'active');
        if (error) {
            throw new OemContractError('OEM_INSTALLATION_INVALID', `Failed to list stations: ${error.message}`);
        }
        const siteSet = new Set<string>();
        for (const row of data ?? []) {
            if (row.site_id && typeof row.site_id === 'string' && row.site_id.trim()) {
                siteSet.add(row.site_id.trim());
            }
        }
        const items: CanonicalStation[] = Array.from(siteSet)
            .slice(0, query.limit)
            .map((siteId) => ({
                externalId: siteId,
                name: siteId,
            }));
        return {
            items,
            nextCursor: null,
        };
    }

    async findMeter(input: MeterLookup): Promise<CanonicalMeter> {
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
        let customerId = query.externalCustomerId;
        let amountMinor = query.expectedAmountMinor;
        let currency = query.expectedCurrency ?? 'NGN';

        if (!customerId || !amountMinor) {
            // Load command payload from db if not passed directly
            const { data: cmd } = await this.db
                .from('oem_commands')
                .select('request_payload')
                .eq('id', query.commandId)
                .maybeSingle();
            if (cmd?.request_payload) {
                customerId = customerId ?? cmd.request_payload.customerId ?? cmd.request_payload.customer_id;
                amountMinor = amountMinor ?? cmd.request_payload.amountMinor ?? cmd.request_payload.expectedAmountMinor;
                currency = currency ?? cmd.request_payload.currency ?? 'NGN';
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
