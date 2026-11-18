import { beforeEach, describe, expect, it, vi } from 'vitest';

type Op = { op: string; args: unknown[] };
type Call = { table: string; ops: Op[]; terminal: string };
type Result = { data?: unknown; error?: { code?: string; message?: string } | null };

const env = vi.hoisted(() => ({
    PAYSTACK_PAYMENTS_ENABLED: true, PAYSTACK_SECRET_KEY: 'sk_test_x' as string | undefined,
    PUE_PORTAL_URL: 'https://beverly.example.test/battery-swap/', PUE_PAYSTACK_FALLBACK_EMAIL: undefined as string | undefined,
}));
const fake = vi.hoisted(() => ({
    handler: ((_c: unknown) => ({ data: null })) as (call: Call) => Result,
    rpc: ((_n: string, _a: unknown) => ({ data: {} })) as (name: string, args: Record<string, unknown>) => Result,
    calls: [] as Call[], rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
}));
const paystack = vi.hoisted(() => ({ init: vi.fn(), verify: vi.fn() }));
const audit = vi.hoisted(() => ({ log: vi.fn(async () => true) }));

vi.mock('../../config/env.js', () => ({ env }));
// The wallet reconciler's own module pulls in the job queue; only the hand-off matters here.
vi.mock('../payment-transactions.js', () => ({ fulfillSuccessfulPaystackTransaction: vi.fn(), markUnsuccessfulPaystackTransaction: vi.fn() }));
vi.mock('../audit.js', () => ({ logAction: audit.log }));
vi.mock('../../adapters/paystack.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../adapters/paystack.js')>()),
    initializeTransaction: paystack.init, verifyTransaction: paystack.verify,
}));
vi.mock('../../db/supabase.js', () => ({
    adminClient: {
        from: (table: string) => {
            const ops: Op[] = [];
            const finish = (terminal: string) => { const call = { table, ops: [...ops], terminal }; fake.calls.push(call); return { error: null, ...fake.handler(call) }; };
            const chain: any = new Proxy({}, {
                get: (_t, prop) => {
                    if (prop === 'then') return (resolve: (v: Result) => void) => resolve(finish('await'));
                    if (prop === 'single' || prop === 'maybeSingle') return async () => finish(String(prop));
                    return (...args: unknown[]) => { ops.push({ op: String(prop), args }); return chain; };
                },
            });
            return chain;
        },
        rpc: async (name: string, args: Record<string, unknown>) => { fake.rpcCalls.push({ name, args }); return { error: null, ...fake.rpc(name, args) }; },
    },
}));

import { applyVerifiedPaystack, startPaystackPayment, swapReference, verifyPaystackForSwap } from '../pue-swap-paystack.js';
import { processPaystackChargeSuccess } from '../payment-webhooks.js';
import type { VerifyResult } from '../../adapters/paystack.js';

const SWAP = '33333333-3333-4333-8333-333333333333';
const REF = swapReference(SWAP, 1);
const verified = (over: Partial<VerifyResult> = {}): VerifyResult => ({ status: 'success', reference: REF, amount: 130000, currency: 'NGN', paid_at: null, channel: 'card', customer: { email: 'a@b.c', customer_code: 'C' }, ...over });
const swap = (over: Record<string, unknown> = {}) => ({ id: SWAP, status: 'reserved', price_minor: 130000, reserved_until: new Date(Date.now() + 20 * 60_000).toISOString(), pue_riders: { email: 'rider@example.com', full_name: 'Ada' }, ...over });
const updatesTo = (table: string) => fake.calls.filter((c) => c.table === table && c.ops.some((o) => o.op === 'update')).map((c) => c.ops.find((o) => o.op === 'update')!.args[0] as Record<string, unknown>);

function db(opts: { swap?: unknown; attempts?: unknown[]; attempt?: unknown } = {}) {
    fake.handler = (call) => {
        if (call.table === 'pue_swaps') return { data: opts.swap === undefined ? swap() : opts.swap };
        if (call.table === 'pue_swap_paystack_attempts') {
            if (call.ops.some((o) => o.op === 'insert' || o.op === 'update')) return { data: null };
            if (call.terminal === 'maybeSingle') return { data: opts.attempt ?? null };
            return { data: opts.attempts ?? [] };
        }
        return { data: null };
    };
}

beforeEach(() => {
    vi.clearAllMocks(); fake.calls = []; fake.rpcCalls = []; fake.rpc = () => ({ data: {} });
    Object.assign(env, { PAYSTACK_PAYMENTS_ENABLED: true, PAYSTACK_SECRET_KEY: 'sk_test_x', PUE_PAYSTACK_FALLBACK_EMAIL: undefined });
    paystack.init.mockResolvedValue({ authorization_url: 'https://checkout.paystack.test/abc', access_code: 'ac', reference: REF });
    db();
});

describe('starting an online payment', () => {
    it('records the attempt BEFORE asking Paystack, with the swap price and a PUE reference', async () => {
        const order: string[] = [];
        fake.handler = (call) => { if (call.ops.some((o) => o.op === 'insert')) order.push('insert'); return call.table === 'pue_swaps' ? { data: swap() } : { data: [] }; };
        paystack.init.mockImplementation(async () => { order.push('paystack'); return { authorization_url: 'https://checkout.paystack.test/abc', access_code: 'a', reference: REF }; });
        const result = await startPaystackPayment(SWAP, 'u-1');
        expect(order).toEqual(['insert', 'paystack']);
        expect(result).toEqual({ reference: REF, authorizationUrl: 'https://checkout.paystack.test/abc', amountMinor: 130000, reused: false });
        expect(REF).toMatch(/^pue-swap-[a-f0-9]{32}-1$/);
        expect(paystack.init).toHaveBeenCalledWith(expect.objectContaining({ email: 'rider@example.com', amountMinor: 130000, reference: REF, callbackUrl: 'https://beverly.example.test/battery-swap/swaps', metadata: { purpose: 'pue_swap', swapId: SWAP } }));
        const insert = fake.calls.find((c) => c.ops.some((o) => o.op === 'insert'))!.ops.find((o) => o.op === 'insert')!.args[0];
        expect(insert).toMatchObject({ reference: REF, swap_id: SWAP, amount_minor: 130000, created_by: 'u-1' });
    });

    it('reuses the open checkout on a second tap, so there are never two live checkouts', async () => {
        db({ attempts: [{ reference: REF, status: 'initialized', authorization_url: 'https://checkout.paystack.test/abc' }] });
        const result = await startPaystackPayment(SWAP, 'u-1');
        expect(result).toMatchObject({ reference: REF, reused: true });
        expect(paystack.init).not.toHaveBeenCalled();
    });

    it('numbers a new attempt after a failed one', async () => {
        db({ attempts: [{ reference: REF, status: 'failed', authorization_url: null }] });
        expect((await startPaystackPayment(SWAP, 'u-1')).reference).toBe(swapReference(SWAP, 2));
    });

    it('refuses when online payments are off, and calls nothing', async () => {
        env.PAYSTACK_PAYMENTS_ENABLED = false;
        await expect(startPaystackPayment(SWAP, 'u-1')).rejects.toMatchObject({ code: 'online_payments_disabled', statusCode: 503 });
        expect(paystack.init).not.toHaveBeenCalled();
    });

    it('does not invent an email: it uses the rider email, then a configured fallback, else asks', async () => {
        db({ swap: swap({ pue_riders: { email: null } }) });
        await expect(startPaystackPayment(SWAP, 'u-1')).rejects.toMatchObject({ code: 'rider_email_needed', statusCode: 422 });
        env.PUE_PAYSTACK_FALLBACK_EMAIL = 'swaps@example.com';
        await startPaystackPayment(SWAP, 'u-1');
        expect(paystack.init).toHaveBeenCalledWith(expect.objectContaining({ email: 'swaps@example.com' }));
    });

    it.each([['paid', 'already_paid'], ['completed', 'swap_not_open'], ['cancelled', 'swap_not_open']])('refuses a %s swap', async (status, code) => {
        db({ swap: swap({ status }) });
        await expect(startPaystackPayment(SWAP, 'u-1')).rejects.toMatchObject({ code });
    });

    it('refuses an expired reservation', async () => {
        db({ swap: swap({ reserved_until: new Date(Date.now() - 1000).toISOString() }) });
        await expect(startPaystackPayment(SWAP, 'u-1')).rejects.toMatchObject({ code: 'reservation_expired' });
    });

    it('marks the attempt failed when Paystack cannot start it', async () => {
        paystack.init.mockRejectedValue(new Error('paystack: down'));
        await expect(startPaystackPayment(SWAP, 'u-1')).rejects.toMatchObject({ code: 'paystack_unavailable', statusCode: 503 });
        expect(updatesTo('pue_swap_paystack_attempts')).toContainEqual({ status: 'failed', review_reason: 'initialize_failed' });
    });
});

describe('applying a verified Paystack result', () => {
    const attempt = (status = 'initialized') => ({ reference: REF, swap_id: SWAP, amount_minor: 130000, status });

    it('records the payment once, with a key derived from the Paystack reference', async () => {
        db({ attempt: attempt() });
        expect(await applyVerifiedPaystack(REF, verified())).toEqual({ status: 'fulfilled' });
        expect(fake.rpcCalls).toEqual([{ name: 'pue_record_swap_payment', args: { p_swap_id: SWAP, p_amount_minor: 130000, p_method: 'paystack', p_reference: REF, p_idempotency_key: `paystack:${REF}`, p_actor: null } }]);
        expect(updatesTo('pue_swap_paystack_attempts')).toContainEqual({ status: 'succeeded', review_reason: null });
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'pue.swap_paystack.paid' }));
    });

    it('uses the principal, not the gross charge, when Paystack adds fees', async () => {
        db({ attempt: attempt() });
        expect(await applyVerifiedPaystack(REF, verified({ amount: 132000, requestedAmount: 130000 }))).toEqual({ status: 'fulfilled' });
    });

    it('an already applied attempt is not applied twice', async () => {
        db({ attempt: attempt('succeeded') });
        expect(await applyVerifiedPaystack(REF, verified())).toEqual({ status: 'already_fulfilled' });
        expect(fake.rpcCalls).toEqual([]);
    });

    it.each([
        ['a different amount', { amount: 100000 }], ['a different currency', { currency: 'USD' }],
    ])('flags %s for review and records nothing', async (_label, over) => {
        db({ attempt: attempt() });
        expect(await applyVerifiedPaystack(REF, verified(over))).toEqual({ status: 'blocked', reason: 'amount_or_currency_mismatch' });
        expect(fake.rpcCalls).toEqual([]);
        expect(updatesTo('pue_swap_paystack_attempts')).toContainEqual({ status: 'needs_review', review_reason: 'amount_or_currency_mismatch' });
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'pue.swap_paystack.needs_review' }));
    });

    it.each(['reservation_expired', 'swap_not_open', 'already_paid'])('money that arrives when the swap cannot take it (%s) is flagged for refund, never dropped', async (code) => {
        db({ attempt: attempt() });
        fake.rpc = () => ({ data: null, error: { code: 'P0002', message: code } });
        expect(await applyVerifiedPaystack(REF, verified())).toEqual({ status: 'blocked', reason: code });
        expect(updatesTo('pue_swap_paystack_attempts')).toContainEqual({ status: 'needs_review', review_reason: code });
    });

    it('lets an unexpected database error propagate so the webhook is retried', async () => {
        db({ attempt: attempt() });
        fake.rpc = () => ({ data: null, error: { code: '57014', message: 'timeout' } });
        await expect(applyVerifiedPaystack(REF, verified())).rejects.toMatchObject({ code: '57014' });
        expect(updatesTo('pue_swap_paystack_attempts')).not.toContainEqual(expect.objectContaining({ status: 'succeeded' }));
    });

    it('ignores a reference with no PUE attempt', async () => {
        db({ attempt: null });
        expect(await applyVerifiedPaystack(REF, verified())).toEqual({ status: 'ignored', reason: 'no_pue_attempt' });
        expect(fake.rpcCalls).toEqual([]);
    });

    it('marks a failed or abandoned checkout, and leaves a pending one alone', async () => {
        db({ attempt: attempt() });
        expect(await applyVerifiedPaystack(REF, verified({ status: 'abandoned' }))).toEqual({ status: 'failed', reason: 'verify_status=abandoned' });
        expect(updatesTo('pue_swap_paystack_attempts')).toContainEqual({ status: 'failed', review_reason: 'verify_status=abandoned' });
        fake.calls = [];
        expect(await applyVerifiedPaystack(REF, verified({ status: 'pending' }))).toEqual({ status: 'ignored', reason: 'verify_status=pending' });
        expect(updatesTo('pue_swap_paystack_attempts')).toEqual([]);
        expect(fake.rpcCalls).toEqual([]);
    });
});

describe('the shared Paystack reconciler hands PUE references to PUE', () => {
    it('applies a PUE reference without touching Beverly wallet payments', async () => {
        paystack.verify.mockResolvedValue(verified());
        db({ attempt: { reference: REF, swap_id: SWAP, amount_minor: 130000, status: 'initialized' } });
        expect(await processPaystackChargeSuccess(REF, 'webhook')).toEqual({ status: 'fulfilled' });
        expect(fake.calls.some((c) => c.table === 'payment_transactions')).toBe(false);
        expect(fake.rpcCalls[0]?.name).toBe('pue_record_swap_payment');
    });

    it('still sends other references to the wallet reconciler', async () => {
        paystack.verify.mockResolvedValue(verified({ reference: 'wallet-ref-1' }));
        fake.handler = () => ({ data: null });
        expect(await processPaystackChargeSuccess('wallet-ref-1', 'webhook')).toEqual({ status: 'ignored', reason: 'no_local_tx' });
        expect(fake.calls.some((c) => c.table === 'payment_transactions')).toBe(true);
        expect(fake.rpcCalls).toEqual([]);
    });
});

describe('checking Paystack by hand when the webhook is late', () => {
    it('verifies each open checkout and applies the result', async () => {
        fake.handler = (call) => {
            if (call.table === 'pue_swap_paystack_attempts' && call.terminal === 'maybeSingle') return { data: { reference: REF, swap_id: SWAP, amount_minor: 130000, status: 'initialized' } };
            if (call.table === 'pue_swap_paystack_attempts' && !call.ops.some((o) => o.op === 'update')) return { data: [{ reference: REF }] };
            return { data: null };
        };
        paystack.verify.mockResolvedValue(verified());
        expect(await verifyPaystackForSwap(SWAP)).toEqual({ results: [{ reference: REF, status: 'fulfilled' }] });
    });

    it('reports Paystack being unreachable instead of guessing', async () => {
        fake.handler = () => ({ data: [{ reference: REF }] });
        paystack.verify.mockRejectedValue(new Error('network'));
        expect(await verifyPaystackForSwap(SWAP)).toEqual({ results: [{ reference: REF, status: 'ignored', reason: 'paystack_unreachable' }] });
        expect(fake.rpcCalls).toEqual([]);
    });
});
