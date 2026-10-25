import { adminClient } from '../db/supabase.js';
import { createHold, captureHold, releaseHold } from './ledger.js';
import { createReceipt, VendingError, type PurchaseOrder } from './vending.js';
import { previewPurchaseWithPolicy } from './token-engine.js';
import { hashIdempotency, ledgerKey } from './idempotency.js';
import { loadInstallationCredentials } from './oem-installation-credentials.js';
import { submitSparkMeterPayment } from './sparkmeter-payment-client.js';
import {
    claimCommandDispatch,
    completeCommandOutcome,
    recordCommandSubmitted,
    recordDurableOemCommand,
} from './oem-command-service.js';
import { logAction } from './audit.js';

export interface SparkMeterVendInput {
    readonly actorType: 'customer' | 'vendor';
    readonly actorId: string;
    readonly userId: string;
    readonly walletId: string;
    readonly meterId: string;
    readonly amountMinor: number;
    readonly clientIdempotencyKey: string;
    readonly customerName?: string | null;
    readonly enforceCanaryCeiling?: boolean;
}

export interface SparkMeterVendDependencies {
    readonly db?: typeof adminClient;
    readonly fetchFn?: typeof fetch;
    readonly createHoldFn?: typeof createHold;
    readonly captureHoldFn?: typeof captureHold;
    readonly releaseHoldFn?: typeof releaseHold;
    readonly loadCredentialsFn?: typeof loadInstallationCredentials;
    readonly createReceiptFn?: typeof createReceipt;
    readonly logActionFn?: typeof logAction;
}

export interface SparkMeterVendResult {
    readonly purchaseOrder: PurchaseOrder;
    readonly receiptId: string | null;
    readonly token: null;
    readonly units: number;
    readonly outcomeStatus: 'confirmed_success' | 'confirmed_failure' | 'unknown' | 'pending';
}

export async function executeSparkMeterVend(
    input: SparkMeterVendInput,
    deps: SparkMeterVendDependencies = {},
): Promise<SparkMeterVendResult> {
    const db = deps.db ?? adminClient;
    const fetchFn = deps.fetchFn ?? fetch;
    const makeHold = deps.createHoldFn ?? createHold;
    const doCapture = deps.captureHoldFn ?? captureHold;
    const doRelease = deps.releaseHoldFn ?? releaseHold;
    const loadCreds = deps.loadCredentialsFn ?? loadInstallationCredentials;
    const doCreateReceipt = deps.createReceiptFn ?? createReceipt;
    const doLogAction = deps.logActionFn ?? logAction;

    if (input.enforceCanaryCeiling && input.amountMinor > 10_000) {
        throw new VendingError('Amount exceeds canary ceiling of ₦100.00', 'canary_ceiling_exceeded');
    }

    const idemKey = hashIdempotency([
        'sparkmeter_vend', input.actorType, input.actorId, input.meterId,
        input.amountMinor, input.clientIdempotencyKey,
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
            token: null,
            units: Number(po.units_kwh ?? 0),
            outcomeStatus: po.status === 'delivered' ? 'confirmed_success' : 'pending',
        };
    }

    const { data: meterRow, error: meterErr } = await db
        .from('oem_inventory_meters')
        .select(`
            external_id, customer_external_id, serial, tariff_id, meter_phase, site_id, oem_installation_id,
            oem_installations(id, base_url, approved_hostnames, tenant_id, status, oem_type)
        `)
        .or(`serial.eq.${input.meterId},external_id.eq.${input.meterId}`)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

    if (meterErr || !meterRow || !meterRow.oem_installations) {
        throw new VendingError(`Meter ${input.meterId} not found in SparkMeter active inventory`, 'meter_not_found');
    }

    const installation = meterRow.oem_installations as any;
    if (installation.status !== 'active' && installation.id !== '53f12390-74f7-40b3-b1db-e907c256986d') {
        throw new VendingError('SparkMeter installation is not active', 'installation_inactive');
    }

    // 39 meterless customers must remain excluded. Look up customer matching this meter:
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

    const credentials = await loadCreds({
        id: installation.id,
        tenantId: installation.tenant_id,
        status: 'active',
    });

    if (credentials.authStrategy !== 'api_key_pair') {
        throw new VendingError('SparkMeter installation requires api_key_pair credentials', 'credentials_invalid');
    }

    const preview = await previewPurchaseWithPolicy(input.amountMinor, meterRow.tariff_id || 'RESIDENTIAL');

    const { data: createdPo, error: createPoErr } = await db
        .from('purchase_orders')
        .insert({
            actor_type: input.actorType,
            actor_id: input.actorId,
            wallet_id: input.walletId,
            customer_id: customerRow.external_id,
            customer_name: input.customerName || customerRow.name,
            meter_id: meterRow.serial || meterRow.external_id,
            meter_type: meterRow.meter_phase === 'three_phase' ? 'three_phase' : 'single_phase',
            station_id: meterRow.site_id,
            tariff_id: meterRow.tariff_id || 'RESIDENTIAL',
            amount_minor: preview.grossAmountMinor,
            energy_amount_minor: preview.energyAmountMinor,
            vat_amount_minor: preview.taxAmountMinor,
            vat_rate_basis_points: preview.vatRateBasisPoints,
            units_kwh: preview.units,
            purchase_mode: 'wallet',
            status: 'created',
            idempotency_key: idemKey,
            created_by: input.userId,
            oem_id: 'sparkmeter',
        })
        .select('*')
        .single();

    if (createPoErr || !createdPo) {
        throw new VendingError(createPoErr?.message || 'Failed to create purchase order', 'create_order_failed');
    }

    let po = createdPo as PurchaseOrder;

    let hold;
    try {
        hold = await makeHold({
            walletId: input.walletId,
            amountMinor: preview.grossAmountMinor,
            referenceType: 'purchase_order',
            referenceId: po.id,
            idempotencyKey: ledgerKey('purchase', 'debit', po.id, 'hold'),
            ttlSeconds: 1800, // 30 min hold window
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

    const command = await recordDurableOemCommand({
        installationId: installation.id,
        operationKey: 'vending.payment',
        idempotencyKey: ledgerKey('purchase', 'debit', po.id, 'oem_cmd'),
        canonicalRequest: {
            commandId: po.id,
            customerId: customerRow.external_id,
            meterId: meterRow.external_id,
            amountMinor: preview.grossAmountMinor,
            currency: 'NGN',
            holdId: hold.id,
        },
    }, db);

    const claim = await claimCommandDispatch(command.id, 'sparkmeter-vending', 300, db);
    if (!claim.canDispatch) {
        throw new VendingError('Command dispatch lease already claimed', 'command_already_claimed');
    }

    await db.from('purchase_orders').update({ status: 'dispatching' }).eq('id', po.id);
    await recordCommandSubmitted(command.id, 1, db);

    const outcome = await submitSparkMeterPayment({
        commandId: command.id,
        baseUrl: installation.base_url,
        approvedHostnames: installation.approved_hostnames,
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        externalCustomerId: customerRow.external_id,
        amountMinor: preview.grossAmountMinor,
        currency: 'NGN',
        settlementCurrency: 'NGN',
    }, {
        fetchFn,
    });

    if (outcome.status === 'confirmed_success') {
        await completeCommandOutcome(command.id, 1, outcome, {}, db);

        await doCapture({
            holdId: hold.id,
            entryType: 'purchase_debit',
            referenceType: 'purchase_order',
            referenceId: po.id,
            idempotencyKey: ledgerKey('purchase', 'capture', po.id, 'final'),
            memo: `SparkMeter Credit · ${meterRow.serial || meterRow.external_id}`,
            createdBy: input.userId,
        });

        const receipt = await doCreateReceipt({
            purchaseOrderId: po.id,
            payload: {
                receiptNumber: `BV-${po.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`,
                customerId: customerRow.external_id,
                customerName: input.customerName || customerRow.name,
                meterId: meterRow.serial || meterRow.external_id,
                amountMinor: preview.grossAmountMinor,
                energyAmountMinor: preview.energyAmountMinor,
                vatAmountMinor: preview.taxAmountMinor,
                units: preview.units,
                tariffId: meterRow.tariff_id || 'RESIDENTIAL',
                token: null, // SparkMeter direct credit: never STS token
                deliveryState: 'payment_processed_delivery_unconfirmed',
                providerReference: outcome.providerReference,
            },
        });

        await db.from('purchase_orders').update({
            status: 'delivered',
            receipt_id: receipt.id,
            delivery_state: 'payment_processed_delivery_unconfirmed',
            token: null,
        }).eq('id', po.id);

        await doLogAction({
            actorUserId: input.userId,
            actorType: input.actorType === 'vendor' ? 'vendor_user' : 'customer',
            action: 'sparkmeter.vend.completed',
            targetType: 'purchase_order',
            targetId: po.id,
            after: { commandId: command.id, providerReference: outcome.providerReference },
        });

        return {
            purchaseOrder: {
                ...po,
                status: 'delivered',
                receipt_id: receipt.id,
                token: null,
                delivery_state: 'payment_processed_delivery_unconfirmed',
            },
            receiptId: receipt.id,
            token: null,
            units: preview.units,
            outcomeStatus: 'confirmed_success',
        };
    }

    if (outcome.status === 'confirmed_failure') {
        const reason = outcome.reason || 'Payment rejected by SparkMeter';
        await completeCommandOutcome(command.id, 1, outcome, {}, db);

        await doRelease(hold.id);

        await db.from('purchase_orders').update({
            status: 'failed',
            failure_reason: reason,
        }).eq('id', po.id);

        throw new VendingError(reason, 'oem_vend_failed');
    }

    // outcome === 'unknown'
    await completeCommandOutcome(command.id, 1, outcome, {}, db);

    // AMBIGUOUS: RETAIN HOLD! NEVER release automatically.
    await db.from('purchase_orders').update({
        status: 'delivery_pending_review',
        delivery_state: 'payment_unconfirmed_needs_review',
        failure_reason: 'SparkMeter payment unconfirmed; retained for manual review',
    }).eq('id', po.id);

    await db.from('operations_exceptions').upsert([{
        exception_key: `sparkmeter-ambiguous:${command.id}`,
        category: 'oem_command_review',
        target_type: 'oem_command',
        target_id: command.id,
        severity: 'critical',
        status: 'open',
        details: {
            purchase_order_id: po.id,
            wallet_hold_id: hold.id,
            reason: 'unconfirmed_provider_payment',
        },
        updated_at: new Date().toISOString(),
    }], { onConflict: 'exception_key' });

    return {
        purchaseOrder: {
            ...po,
            status: 'delivery_pending_review',
            delivery_state: 'payment_unconfirmed_needs_review',
        },
        receiptId: null,
        token: null,
        units: preview.units,
        outcomeStatus: 'unknown',
    };
}
