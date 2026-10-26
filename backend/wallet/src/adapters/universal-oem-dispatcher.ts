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
import { OemContractError, requireVendOutcome } from '@beverly/oem-contracts';
import { adminClient } from '../db/supabase.js';
import { createHold, captureHold, releaseHold } from '../services/ledger.js';
import {
    createReceipt,
    VendingError,
    type PurchaseOrder,
    type MeterType,
} from '../services/vending.js';
import {
    previewPurchaseWithPolicy,
    lookupMeter,
    generateCreditToken,
    listStations,
    assertEnergyVendReady,
    TokenEngineError,
    type MeterInfo,
} from '../services/token-engine.js';
import { hashIdempotency, ledgerKey } from '../services/idempotency.js';
import { loadInstallationCredentials } from '../services/oem-installation-credentials.js';
import { SparkMeterAdapter } from './sparkmeter-adapter.js';
import {
    claimCommandDispatch,
    completeCommandOutcome,
    recordCommandSubmitted,
    recordDurableOemCommand,
} from '../services/oem-command-service.js';
import { assertStationVendAllowed, StationVendScopeError } from '../services/station-vend-scope.js';
import {
    claimOemVendProbe,
    clearOemQuotaCircuit,
    recordOemQuotaFailure,
} from '../services/oem-quota-circuit.js';
import { logAction } from '../services/audit.js';

export type VendingStrategy = 'sts_token' | 'direct_credit';

export interface CalinmeterAdapterConfig {
    readonly oemId?: string | null;
    readonly db?: typeof adminClient;
    readonly fetchFn?: typeof fetch;
    readonly customerId?: string;
    readonly customerName?: string | null;
    readonly stationId?: string | null;
    readonly tariffId?: string;
    readonly isThreePhase?: boolean | null;
    readonly sgc?: string | null;
    readonly energyAmountMinor?: number;
    readonly units?: number;
    readonly vendorName?: string | null;
    readonly operatorName?: string | null;
    readonly generateCreditTokenFn?: typeof generateCreditToken;
    readonly lookupMeterFn?: typeof lookupMeter;
    readonly listStationsFn?: typeof listStations;
}

export class CalinmeterAdapter implements MeterOemAdapter {
    private readonly config: CalinmeterAdapterConfig;

    constructor(config: CalinmeterAdapterConfig = {}) {
        this.config = config;
    }

    capabilities(): CapabilityManifest {
        return {
            'vending.direct_credit': 'unsupported',
            'vending.sts_token': 'write_supported',
            'station.read': 'read_only',
            'meter.read': 'read_only',
            'telemetry.read': 'unsupported',
        };
    }

    async testConnection(): Promise<ConnectionResult> {
        try {
            assertEnergyVendReady();
            return { ok: true };
        } catch (error) {
            return {
                ok: false,
                reason: error instanceof Error ? error.message : 'Connection probe failed',
            };
        }
    }

    async listStations(query: PageQuery): Promise<Page<CanonicalStation>> {
        const listFn = this.config.listStationsFn ?? listStations;
        const stations = await listFn({ oemId: this.config.oemId });
        const items = stations.slice(0, query.limit).map((s) => ({
            externalId: s.stationId,
            name: s.name,
        }));
        return { items, nextCursor: null };
    }

    async findMeter(input: MeterLookup): Promise<CanonicalMeter> {
        const lookupFn = this.config.lookupMeterFn ?? lookupMeter;
        try {
            const meter = await lookupFn(input.externalMeterId, { oemId: this.config.oemId });
            return {
                externalId: meter.meterId,
                externalStationId: meter.stationId,
            };
        } catch (err: any) {
            throw new OemContractError(
                'OEM_INSTALLATION_INVALID',
                `Meter ${input.externalMeterId} not found in Calinmeter inventory: ${err?.message ?? ''}`,
            );
        }
    }

    async vend(command: VendCommand): Promise<VendOutcome> {
        if (command.currency && command.currency !== 'NGN') {
            throw new OemContractError(
                'OEM_OUTCOME_INVALID',
                `Unsupported currency ${command.currency}; Calinmeter tokens require NGN`,
            );
        }

        const tokenGenFn = this.config.generateCreditTokenFn ?? generateCreditToken;
        try {
            const tokenRes = await tokenGenFn({
                meterId: command.externalMeterId,
                customerId: this.config.customerId || command.externalMeterId,
                customerName: this.config.customerName,
                stationId: this.config.stationId,
                amountMinor: this.config.energyAmountMinor ?? command.amountMinor,
                units: this.config.units ?? 0,
                tariffId: this.config.tariffId || 'RESIDENTIAL',
                isThreePhase: this.config.isThreePhase,
                sgc: this.config.sgc,
                reference: command.commandId,
                oemId: this.config.oemId,
                vendorName: this.config.vendorName,
                operatorName: this.config.operatorName,
            });

            return {
                status: 'confirmed_success',
                providerReference: tokenRes.tokenRecordId || command.commandId,
                token: tokenRes.token,
            };
        } catch (error: any) {
            return {
                status: 'confirmed_failure',
                providerReference: command.commandId,
                reason: error instanceof Error ? error.message : 'Token generation failed',
            };
        }
    }

    async getVendStatus(query: VendStatusQuery): Promise<VendOutcome> {
        return {
            status: 'confirmed_success',
            providerReference: query.commandId,
        };
    }
}

export interface UniversalVendInput {
    readonly actorType: 'vendor' | 'customer';
    readonly actorId: string;
    readonly userId: string;
    readonly walletId: string;
    readonly meterId: string;
    readonly amountMinor: number;
    readonly clientIdempotencyKey: string;
    readonly vendorStationId?: string | null;
    readonly customerName?: string | null;
    readonly enforceCanaryCeiling?: boolean;
    readonly mode?: 'wallet' | 'direct_pay' | 'remote_send';
    readonly meter?: MeterInfo;
    readonly idempotencyKey?: string;
    readonly isThreePhase?: boolean | null;
}

export interface UniversalVendDependencies {
    readonly db?: typeof adminClient;
    readonly fetchFn?: typeof fetch;
    readonly createHoldFn?: typeof createHold;
    readonly captureHoldFn?: typeof captureHold;
    readonly releaseHoldFn?: typeof releaseHold;
    readonly loadCredentialsFn?: typeof loadInstallationCredentials;
    readonly createReceiptFn?: typeof createReceipt;
    readonly logActionFn?: typeof logAction;
    readonly lookupMeterFn?: typeof lookupMeter;
    readonly previewPurchaseFn?: typeof previewPurchaseWithPolicy;
    readonly claimOemVendProbeFn?: typeof claimOemVendProbe;
    readonly clearOemQuotaCircuitFn?: typeof clearOemQuotaCircuit;
    readonly recordOemQuotaFailureFn?: typeof recordOemQuotaFailure;
    readonly adapter?: MeterOemAdapter;
    readonly adapterFactory?: (strategy: VendingStrategy, context: any) => MeterOemAdapter;
}

export interface UniversalVendResult {
    readonly purchaseOrder: PurchaseOrder;
    readonly receiptId: string | null;
    readonly token: string | null;
    readonly units: number;
    readonly outcomeStatus: 'confirmed_success' | 'confirmed_failure' | 'unknown' | 'pending';
    readonly vendingStrategy: VendingStrategy;
}

export async function executeUniversalVend(
    input: UniversalVendInput,
    deps: UniversalVendDependencies = {},
): Promise<UniversalVendResult> {
    const db = deps.db ?? adminClient;
    const fetchFn = deps.fetchFn ?? fetch;
    const makeHold = deps.createHoldFn ?? createHold;
    const doCapture = deps.captureHoldFn ?? captureHold;
    const doRelease = deps.releaseHoldFn ?? releaseHold;
    const loadCreds = deps.loadCredentialsFn ?? loadInstallationCredentials;
    const doCreateReceipt = deps.createReceiptFn ?? createReceipt;
    const doLogAction = deps.logActionFn ?? logAction;
    const doLookupMeter = deps.lookupMeterFn ?? lookupMeter;
    const doPreview = deps.previewPurchaseFn ?? previewPurchaseWithPolicy;
    const doClaimProbe = deps.claimOemVendProbeFn ?? claimOemVendProbe;
    const doClearQuota = deps.clearOemQuotaCircuitFn ?? clearOemQuotaCircuit;
    const doRecordQuotaFailure = deps.recordOemQuotaFailureFn ?? recordOemQuotaFailure;

    // 1. Resolve meter if not provided
    let meter: MeterInfo;
    if (input.meter) {
        meter = input.meter;
    } else {
        try {
            meter = await doLookupMeter(input.meterId);
        } catch (e: any) {
            if (e instanceof TokenEngineError) throw new VendingError(e.message, e.code);
            throw e;
        }
    }

    // Determine strategy: meter.vendingStrategy > oemId === 'sparkmeter' > 'sts_token'
    const isSparkMeter = meter.oemId === 'sparkmeter' || meter.oemId === 'e1532892-e09d-44f9-a9cb-b99b5c9ebecf';
    const vendingStrategy: VendingStrategy = meter.vendingStrategy ?? (isSparkMeter ? 'direct_credit' : 'sts_token');

    // 2. Canary ceiling check for direct credit
    if (vendingStrategy === 'direct_credit' && input.enforceCanaryCeiling && input.amountMinor > 10_000) {
        throw new VendingError('Amount exceeds canary ceiling of ₦100.00', 'canary_ceiling_exceeded');
    }

    // 3. Station vend scope enforcement (handles SPARKMETER_SITE_TO_STATION normalization)
    if (input.vendorStationId) {
        try {
            assertStationVendAllowed(input.vendorStationId, meter.stationId);
        } catch (error) {
            if (error instanceof StationVendScopeError) {
                throw new VendingError(error.message, error.code);
            }
            throw error;
        }
    }

    // 4. Quota probe for STS token
    if (vendingStrategy === 'sts_token') {
        await doClaimProbe(meter.oemId);
    }

    // 5. Idempotency check on purchase_orders
    const idemKey = input.idempotencyKey || hashIdempotency([
        vendingStrategy === 'direct_credit' ? 'sparkmeter_vend' : 'universal_vend',
        input.actorType,
        input.actorId,
        input.meterId,
        input.amountMinor,
        input.clientIdempotencyKey,
    ]);

    const { data: existingPo } = await db
        .from('purchase_orders')
        .select('*')
        .eq('idempotency_key', idemKey)
        .maybeSingle();

    if (existingPo) {
        const po = existingPo as PurchaseOrder;
        return {
            purchaseOrder: po,
            receiptId: po.receipt_id,
            token: po.token,
            units: Number(po.units_kwh ?? 0),
            outcomeStatus: po.status === 'delivered' ? 'confirmed_success' : 'pending',
            vendingStrategy,
        };
    }

    // 6. Preview purchase
    const preview = await doPreview(input.amountMinor, meter.tariffId || 'RESIDENTIAL');
    const isThreePhase = input.isThreePhase !== undefined ? input.isThreePhase : meter.isThreePhase === true;
    const meterType: MeterType = isThreePhase ? 'three_phase' : 'single_phase';

    // 7. For direct_credit, verify inventory & installation
    let installation: any = null;
    let customerExternalId = meter.customerId;
    let customerNameResolved = input.customerName || meter.customerName;
    let meterExternalId = meter.meterId;
    let installationId: string = '53f12390-74f7-40b3-b1db-e907c256986d'; // default active fallback
    let credentials: any = null;

    if (vendingStrategy === 'direct_credit') {
        const { data: meterRow, error: meterErr } = await db
            .from('oem_inventory_meters')
            .select(`
                external_id, customer_external_id, serial, tariff_id, meter_phase, site_id, oem_installation_id,
                oem_installations(id, base_url, approved_hostnames, tenant_id, status, oem_id)
            `)
            .or(`serial.eq.${input.meterId},external_id.eq.${input.meterId}`)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();

        if (meterErr || !meterRow || !meterRow.oem_installations) {
            throw new VendingError(`Meter ${input.meterId} not found in SparkMeter active inventory`, 'meter_not_found');
        }

        installation = meterRow.oem_installations;
        if (installation.status !== 'active' && installation.id !== '53f12390-74f7-40b3-b1db-e907c256986d') {
            throw new VendingError('SparkMeter installation is not active', 'installation_inactive');
        }

        const { data: customerRow } = await db
            .from('oem_inventory_customers')
            .select('external_id, name, phone, status')
            .eq('oem_installation_id', meterRow.oem_installation_id)
            .eq('external_id', meterRow.customer_external_id)
            .eq('status', 'active')
            .maybeSingle();

        if (!customerRow) {
            throw new VendingError('Customer linked to meter is inactive or missing', 'customer_not_found');
        }

        installationId = installation.id;
        customerExternalId = customerRow.external_id;
        customerNameResolved = input.customerName || customerRow.name || meter.customerName;
        meterExternalId = meterRow.serial || meterRow.external_id;

        credentials = await loadCreds({
            id: installation.id,
            tenantId: installation.tenant_id,
            status: 'active',
        });

        if (credentials.authStrategy !== 'api_key_pair') {
            throw new VendingError('SparkMeter installation requires api_key_pair credentials', 'credentials_invalid');
        }
    } else {
        const { data: instRow } = await db
            .from('oem_installations')
            .select('id, base_url, approved_hostnames, tenant_id, status, oem_id')
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();
        if (instRow?.id) {
            installationId = instRow.id;
        }
    }

    // 8. Create Purchase Order row in 'created' state
    const { data: createdPo, error: createPoErr } = await db
        .from('purchase_orders')
        .insert({
            actor_type: input.actorType,
            actor_id: input.actorId,
            wallet_id: input.walletId,
            customer_id: customerExternalId,
            customer_name: customerNameResolved,
            meter_id: meterExternalId,
            meter_type: meterType,
            station_id: meter.stationId,
            tariff_id: meter.tariffId || 'RESIDENTIAL',
            amount_minor: preview.grossAmountMinor,
            energy_amount_minor: preview.energyAmountMinor,
            vat_amount_minor: preview.taxAmountMinor,
            vat_rate_basis_points: preview.vatRateBasisPoints,
            units_kwh: preview.units,
            purchase_mode: input.mode || 'wallet',
            status: 'created',
            idempotency_key: idemKey,
            created_by: input.userId,
            oem_id: meter.oemId || (vendingStrategy === 'direct_credit' ? 'e1532892-e09d-44f9-a9cb-b99b5c9ebecf' : null),
        })
        .select('*')
        .single();

    if (createPoErr || !createdPo) {
        throw new VendingError(createPoErr?.message || 'Failed to create purchase order', 'create_order_failed');
    }

    let po = createdPo as PurchaseOrder;

    // 9. Place hold
    let hold;
    try {
        hold = await makeHold({
            walletId: input.walletId,
            amountMinor: preview.grossAmountMinor,
            referenceType: 'purchase_order',
            referenceId: po.id,
            idempotencyKey: ledgerKey('purchase', 'debit', po.id, 'hold'),
            ttlSeconds: 1800,
            createdBy: input.userId,
        });
    } catch (error: any) {
        await db.from('purchase_orders').update({
            status: 'failed',
            failure_reason: `hold_failed: ${error.message}`.slice(0, 500),
        }).eq('id', po.id);
        throw new VendingError(error.message, error.code ?? 'hold_failed');
    }

    await db.from('purchase_orders').update({
        hold_id: hold.id,
        status: 'hold_active',
    }).eq('id', po.id);
    po = { ...po, hold_id: hold.id, status: 'hold_active' };

    // 10. Record durable OEM command & claim dispatch lease
    const command = await recordDurableOemCommand({
        installationId,
        operationKey: vendingStrategy === 'direct_credit' ? 'vending.payment' : 'vending.sts_token',
        idempotencyKey: ledgerKey('purchase', 'debit', po.id, 'oem_cmd'),
        canonicalRequest: {
            commandId: po.id,
            customerId: customerExternalId,
            meterId: meterExternalId,
            amountMinor: preview.grossAmountMinor,
            currency: 'NGN',
            holdId: hold.id,
            vendingStrategy,
        },
    }, db);

    const claim = await claimCommandDispatch(command.id, 'universal-oem-dispatcher', 300, db);
    if (!claim.canDispatch) {
        throw new VendingError('Command dispatch lease already claimed', 'command_already_claimed');
    }

    await db.from('purchase_orders').update({ status: 'dispatching' }).eq('id', po.id);
    await recordCommandSubmitted(command.id, 1, db);

    // 11. Resolve adapter
    let adapter: MeterOemAdapter;
    if (deps.adapter) {
        adapter = deps.adapter;
    } else if (deps.adapterFactory) {
        adapter = deps.adapterFactory(vendingStrategy, { installation, credentials, meter });
    } else if (vendingStrategy === 'direct_credit') {
        adapter = new SparkMeterAdapter({
            installationId,
            baseUrl: installation.base_url,
            approvedHostnames: installation.approved_hostnames,
            apiKey: credentials.apiKey,
            apiSecret: credentials.apiSecret,
            db,
            fetchFn,
        });
    } else {
        adapter = new CalinmeterAdapter({
            oemId: meter.oemId,
            db,
            fetchFn,
            customerId: customerExternalId,
            customerName: customerNameResolved,
            stationId: meter.stationId,
            tariffId: meter.tariffId,
            isThreePhase,
            sgc: meter.sgc,
            energyAmountMinor: preview.energyAmountMinor,
            units: preview.units,
            vendorName: input.actorType === 'vendor' ? input.actorId : undefined,
        });
    }

    // 12. Execute vend command
    const vendCommand: VendCommand = {
        installationId,
        commandId: command.id,
        idempotencyKey: command.idempotency_key,
        externalMeterId: meterExternalId,
        amountMinor: preview.grossAmountMinor,
        currency: 'NGN',
    };

    let outcome: VendOutcome;
    try {
        const rawOutcome = await adapter.vend(vendCommand);
        outcome = requireVendOutcome(rawOutcome);
    } catch (err: any) {
        if (err instanceof TokenEngineError && err.code === 'oem_insufficient_quota') {
            outcome = { status: 'confirmed_failure', reason: err.message, providerReference: command.id };
        } else if (err instanceof OemContractError) {
            outcome = { status: 'confirmed_failure', reason: err.message, providerReference: command.id };
        } else {
            outcome = { status: 'confirmed_failure', reason: err.message ?? 'Adapter vend failed', providerReference: command.id };
        }
    }

    // 13. Evaluate outcome
    if (outcome.status === 'confirmed_success') {
        await completeCommandOutcome(command.id, 1, outcome, {}, db);
        if (vendingStrategy === 'sts_token') {
            await doClearQuota(meter.oemId);
        }

        const finalToken: string | null = vendingStrategy === 'direct_credit' ? null : (outcome.token ?? null);

        try {
            await doCapture({
                holdId: hold.id,
                entryType: 'purchase_debit',
                referenceType: 'purchase_order',
                referenceId: po.id,
                idempotencyKey: ledgerKey('purchase', 'capture', po.id, 'final'),
                memo: vendingStrategy === 'direct_credit'
                    ? `SparkMeter Credit · ${meterExternalId}`
                    : `Vending · ${meterExternalId}`,
                createdBy: input.userId,
            });
        } catch (captureErr: any) {
            await db.from('purchase_orders').update({
                token: finalToken,
                status: 'delivery_pending_review',
                delivery_state: 'token_generated_needs_reconciliation',
                failure_reason: `post_token_failed: ${captureErr.message}`.slice(0, 500),
            }).eq('id', po.id);
            return {
                purchaseOrder: {
                    ...po,
                    token: finalToken,
                    status: 'delivery_pending_review',
                    delivery_state: 'token_generated_needs_reconciliation',
                },
                receiptId: null,
                token: finalToken,
                units: preview.units,
                outcomeStatus: 'pending',
                vendingStrategy,
            };
        }

        let vendedByResolved: string | undefined;
        if (input.actorType === 'vendor') {
            const [{ data: vendorUser }, { data: vendorOrg }] = await Promise.all([
                Promise.resolve(db.from('vendor_users').select('full_name').eq('auth_user_id', input.userId).maybeSingle()).catch(() => ({ data: null })),
                Promise.resolve(db.from('vendor_organizations').select('legal_name, trading_name, station_id').eq('id', input.actorId).maybeSingle()).catch(() => ({ data: null })),
            ]);
            const vName = vendorUser?.full_name || 'Authorized Vendor';
            const vBiz = vendorOrg?.trading_name || vendorOrg?.legal_name || 'Vendor Enterprise';
            const vStation = meter.stationId || vendorOrg?.station_id || input.vendorStationId;
            vendedByResolved = `${vName} — ${vBiz}${vStation ? ` (${vStation})` : ''}`;
        }

        const deliveryState = vendingStrategy === 'direct_credit'
            ? 'payment_processed_delivery_unconfirmed'
            : 'token_generated';

        const receipt = await doCreateReceipt({
            purchaseOrderId: po.id,
            payload: {
                receiptNumber: `BV-${po.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`,
                ...(input.actorType === 'vendor' ? {
                    vendorOrganizationId: input.actorId,
                    vendedBy: vendedByResolved,
                    vendedByName: vendedByResolved,
                } : {}),
                customerId: customerExternalId,
                customerName: customerNameResolved,
                meterId: meterExternalId,
                meterType,
                stationId: meter.stationId,
                tariffId: meter.tariffId || 'RESIDENTIAL',
                amountMinor: preview.grossAmountMinor,
                grossAmountMinor: preview.grossAmountMinor,
                energyAmountMinor: preview.energyAmountMinor,
                vatAmountMinor: preview.taxAmountMinor,
                vatRateBasisPoints: preview.vatRateBasisPoints,
                units: preview.units,
                token: finalToken,
                providerReference: outcome.providerReference,
                deliveryState,
                purchaseMode: input.mode || 'wallet',
            },
        });

        await db.from('purchase_orders').update({
            status: 'delivered',
            receipt_id: receipt.id,
            delivery_state: deliveryState,
            token: finalToken,
            ...(vendedByResolved ? { vended_by: vendedByResolved } : {}),
        }).eq('id', po.id);

        await doLogAction({
            actorUserId: input.userId,
            actorType: input.actorType === 'vendor' ? 'vendor_user' : 'customer',
            action: vendingStrategy === 'direct_credit' ? 'sparkmeter.vend.completed' : `vending.${input.mode || 'wallet'}`,
            targetType: 'purchase_order',
            targetId: po.id,
            after: {
                commandId: command.id,
                providerReference: outcome.providerReference,
                status: 'delivered',
            },
        });

        return {
            purchaseOrder: {
                ...po,
                status: 'delivered',
                receipt_id: receipt.id,
                token: finalToken,
                delivery_state: deliveryState,
                ...(vendedByResolved ? { vended_by: vendedByResolved } : {}),
            },
            receiptId: receipt.id,
            token: finalToken,
            units: preview.units,
            outcomeStatus: 'confirmed_success',
            vendingStrategy,
        };
    }

    if (outcome.status === 'confirmed_failure') {
        const reason = outcome.reason || 'Payment rejected by provider';
        await completeCommandOutcome(command.id, 1, outcome, {}, db);
        await doRelease(hold.id);
        await db.from('purchase_orders').update({
            status: 'failed',
            failure_reason: reason.slice(0, 500),
        }).eq('id', po.id);

        if (reason.toLowerCase().includes('quota') || reason.toLowerCase().includes('balance')) {
            const publicMessage = 'OEM vending is paused while quota is restored. No wallet debit occurred.';
            await doRecordQuotaFailure(meter.oemId, publicMessage);
            throw new VendingError(publicMessage, 'oem_insufficient_quota', {
                retryAfterSeconds: 300,
                noWalletDebitOccurred: true,
            });
        }
        throw new VendingError(reason, 'oem_vend_failed');
    }

    // Ambiguous outcome (unknown, pending, requires_manual_review): RETAIN HOLD
    await completeCommandOutcome(command.id, 1, outcome, {}, db);
    const unknownDeliveryState = vendingStrategy === 'direct_credit'
        ? 'payment_unconfirmed_needs_review'
        : 'token_generated_needs_reconciliation';

    await db.from('purchase_orders').update({
        status: 'delivery_pending_review',
        delivery_state: unknownDeliveryState,
        failure_reason: (outcome as any).reason || 'Provider payment unconfirmed; retained for manual review',
    }).eq('id', po.id);

    await db.from('operations_exceptions').upsert([{
        exception_key: `${vendingStrategy}-ambiguous:${command.id}`,
        category: 'oem_command_review',
        target_type: 'oem_command',
        target_id: command.id,
        severity: 'critical',
        status: 'open',
        details: {
            purchase_order_id: po.id,
            wallet_hold_id: hold.id,
            reason: 'unconfirmed_provider_payment',
            vendingStrategy,
        },
        updated_at: new Date().toISOString(),
    }], { onConflict: 'exception_key' });

    return {
        purchaseOrder: {
            ...po,
            status: 'delivery_pending_review',
            delivery_state: unknownDeliveryState,
        },
        receiptId: null,
        token: null,
        units: preview.units,
        outcomeStatus: outcome.status as 'unknown' | 'pending',
        vendingStrategy,
    };
}
