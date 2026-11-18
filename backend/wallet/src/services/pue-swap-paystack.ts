/**
 * Online (Paystack) payment for a PUE swap, using Beverly's shared Paystack account and webhook.
 *
 *   start  -> record an attempt row, then ask Paystack for a checkout (the attempt row exists BEFORE
 *             the payer can pay, so the webhook can always find it)
 *   apply  -> called by the shared reconciler with Paystack's own server-side verification. Only a
 *             verified success whose principal amount and currency match our attempt is recorded,
 *             through the same idempotent database function the cash path uses.
 *
 * A payment that succeeds but cannot be applied (reservation expired, swap cancelled, a different
 * payment already recorded) is NEVER dropped: the attempt is marked needs_review so finance can refund.
 * Nothing here moves a battery; handover is a separate attendant step.
 */
import { adminClient } from '../db/supabase.js';
import { env } from '../config/env.js';
import { initializeTransaction, verifiedPrincipalAmount, verifyTransaction, type VerifyResult } from '../adapters/paystack.js';
import { logAction } from './audit.js';
import { mapSwapDbError, PueSwapError } from './pue-swaps.js';

export const PUE_SWAP_REFERENCE_PREFIX = 'pue-swap-';
const MAX_ATTEMPTS = 20;

export interface PaystackApplyResult {
    status: 'ignored' | 'fulfilled' | 'already_fulfilled' | 'blocked' | 'failed';
    reason?: string;
}

export function swapReference(swapId: string, attempt: number): string {
    return `${PUE_SWAP_REFERENCE_PREFIX}${swapId.replace(/-/g, '')}-${attempt}`;
}

export async function startPaystackPayment(swapId: string, actorId: string) {
    if (!env.PAYSTACK_PAYMENTS_ENABLED || !env.PAYSTACK_SECRET_KEY) {
        throw new PueSwapError('online_payments_disabled', 'Online payments are not enabled for this deployment. Record a cash payment instead.', 503);
    }
    const { data: swap, error } = await adminClient.from('pue_swaps').select('id, status, price_minor, reserved_until, pue_riders(email, full_name)').eq('id', swapId).maybeSingle();
    if (error) throw mapSwapDbError(error);
    if (!swap) throw new PueSwapError('swap_not_found', 'Swap not found.', 404);
    const row = swap as unknown as { id: string; status: string; price_minor: number; reserved_until: string; pue_riders: { email: string | null } | null };
    if (row.status === 'paid') throw new PueSwapError('already_paid', 'This swap is already paid.', 409);
    if (row.status !== 'reserved') throw new PueSwapError('swap_not_open', 'This swap is no longer open.', 409);
    if (Date.parse(row.reserved_until) < Date.now()) throw new PueSwapError('reservation_expired', 'The reservation expired. Start a new swap.', 409);

    const { data: attempts, error: attemptsError } = await adminClient.from('pue_swap_paystack_attempts').select('reference, status, authorization_url').eq('swap_id', swapId).order('created_at', { ascending: false });
    if (attemptsError) throw mapSwapDbError(attemptsError);
    const list = (attempts ?? []) as { reference: string; status: string; authorization_url: string | null }[];
    // A second tap reuses the open checkout, so two live checkouts never exist for one swap.
    const open = list.find((a) => a.status === 'initialized' && a.authorization_url);
    if (open) return { reference: open.reference, authorizationUrl: open.authorization_url!, amountMinor: Number(row.price_minor), reused: true };
    if (list.length >= MAX_ATTEMPTS) throw new PueSwapError('too_many_attempts', 'Too many online payment attempts for this swap.', 429);

    const email = row.pue_riders?.email || env.PUE_PAYSTACK_FALLBACK_EMAIL;
    if (!email) throw new PueSwapError('rider_email_needed', "Paystack needs an email. Add the rider's email in the Riders register, or record a cash payment.", 422);

    const reference = swapReference(swapId, list.length + 1);
    const amountMinor = Number(row.price_minor);
    const { error: insertError } = await adminClient.from('pue_swap_paystack_attempts').insert({ reference, swap_id: swapId, amount_minor: amountMinor, created_by: actorId });
    if (insertError) throw mapSwapDbError(insertError);

    try {
        const init = await initializeTransaction({
            email, amountMinor, reference,
            callbackUrl: new URL('swaps', env.PUE_PORTAL_URL.replace(/\/+$/, '') + '/').toString(),
            metadata: { purpose: 'pue_swap', swapId },
        });
        await adminClient.from('pue_swap_paystack_attempts').update({ authorization_url: init.authorization_url }).eq('reference', reference);
        return { reference, authorizationUrl: init.authorization_url, amountMinor, reused: false };
    } catch {
        await adminClient.from('pue_swap_paystack_attempts').update({ status: 'failed', review_reason: 'initialize_failed' }).eq('reference', reference);
        throw new PueSwapError('paystack_unavailable', 'Paystack could not start the payment. Try again or record a cash payment.', 503);
    }
}

async function flag(reference: string, swapId: string, reason: string, detail: Record<string, unknown>) {
    await adminClient.from('pue_swap_paystack_attempts').update({ status: 'needs_review', review_reason: reason }).eq('reference', reference);
    await logAction({ actorUserId: 'system', actorType: 'system', action: 'pue.swap_paystack.needs_review', targetType: 'pue_swap', targetId: swapId, metadata: { reference, reason, ...detail } }).catch(() => undefined);
}

/** Applies Paystack's verified result for one reference. Called by the shared reconciler and by manual verify. */
export async function applyVerifiedPaystack(reference: string, verified: VerifyResult): Promise<PaystackApplyResult> {
    const { data: attempt, error } = await adminClient.from('pue_swap_paystack_attempts').select('reference, swap_id, amount_minor, status').eq('reference', reference).maybeSingle();
    if (error) throw error;
    if (!attempt) return { status: 'ignored', reason: 'no_pue_attempt' };
    const a = attempt as { reference: string; swap_id: string; amount_minor: number; status: string };

    if (verified.status !== 'success') {
        if (verified.status === 'failed' || verified.status === 'abandoned') {
            if (a.status === 'initialized') await adminClient.from('pue_swap_paystack_attempts').update({ status: 'failed', review_reason: `verify_status=${verified.status}` }).eq('reference', reference);
            return { status: 'failed', reason: `verify_status=${verified.status}` };
        }
        return { status: 'ignored', reason: `verify_status=${verified.status}` };
    }
    if (a.status === 'succeeded') return { status: 'already_fulfilled' };

    const principal = verifiedPrincipalAmount(verified);
    if (principal !== Number(a.amount_minor) || verified.currency !== 'NGN') {
        await flag(reference, a.swap_id, 'amount_or_currency_mismatch', { paid: principal, expected: Number(a.amount_minor), currency: verified.currency });
        return { status: 'blocked', reason: 'amount_or_currency_mismatch' };
    }

    const { error: rpcError } = await adminClient.rpc('pue_record_swap_payment', {
        p_swap_id: a.swap_id, p_amount_minor: principal, p_method: 'paystack', p_reference: reference,
        p_idempotency_key: `paystack:${reference}`, p_actor: null,
    });
    if (rpcError) {
        if (rpcError.code === 'P0002') {
            // Money arrived but the swap cannot take it (expired, cancelled, or already paid another way).
            await flag(reference, a.swap_id, String(rpcError.message), { paid: principal });
            return { status: 'blocked', reason: String(rpcError.message) };
        }
        throw rpcError;
    }
    await adminClient.from('pue_swap_paystack_attempts').update({ status: 'succeeded', review_reason: null }).eq('reference', reference);
    await logAction({ actorUserId: 'system', actorType: 'system', action: 'pue.swap_paystack.paid', targetType: 'pue_swap', targetId: a.swap_id, metadata: { reference, amountMinor: principal } }).catch(() => undefined);
    return { status: 'fulfilled' };
}

/** For when the webhook is late: asks Paystack about each open checkout and applies what it says. */
export async function verifyPaystackForSwap(swapId: string): Promise<{ results: (PaystackApplyResult & { reference: string })[] }> {
    const { data, error } = await adminClient.from('pue_swap_paystack_attempts').select('reference').eq('swap_id', swapId).eq('status', 'initialized').order('created_at', { ascending: false });
    if (error) throw mapSwapDbError(error);
    const results: (PaystackApplyResult & { reference: string })[] = [];
    for (const { reference } of (data ?? []) as { reference: string }[]) {
        let verified: VerifyResult;
        try {
            verified = await verifyTransaction(reference);
        } catch {
            results.push({ reference, status: 'ignored', reason: 'paystack_unreachable' });
            continue;
        }
        results.push({ reference, ...(await applyVerifiedPaystack(reference, verified)) });
    }
    return { results };
}
