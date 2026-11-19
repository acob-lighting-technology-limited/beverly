import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db/supabase.js', () => ({ adminClient: {} }));

import {
    faultUpdateSchema, mapDbError, paymentSchema, requireIdempotencyKey, sellSchema, withBalance,
} from '../pue-appliances.js';

const ids = { applianceId: '11111111-1111-4111-8111-111111111111', customerId: '22222222-2222-4222-8222-222222222222' };

describe('sellSchema', () => {
    it('takes an instalment sale with a deposit', () => {
        expect(sellSchema.parse({ ...ids, saleType: 'instalment', totalMinor: 90_000_000, depositMinor: 10_000_000 })).toMatchObject({ depositMethod: 'cash' });
    });
    it('refuses a deposit above the price', () => {
        expect(() => sellSchema.parse({ ...ids, saleType: 'instalment', totalMinor: 100, depositMinor: 101 })).toThrow();
    });
    it('a full sale takes the whole price or nothing', () => {
        expect(() => sellSchema.parse({ ...ids, saleType: 'full', totalMinor: 100, depositMinor: 50 })).toThrow();
        expect(() => sellSchema.parse({ ...ids, saleType: 'full', totalMinor: 100, depositMinor: 100 })).not.toThrow();
        expect(() => sellSchema.parse({ ...ids, saleType: 'full', totalMinor: 100 })).not.toThrow();
    });
    it('refuses a zero price, fractions and unknown fields', () => {
        expect(() => sellSchema.parse({ ...ids, saleType: 'full', totalMinor: 0 })).toThrow();
        expect(() => sellSchema.parse({ ...ids, saleType: 'full', totalMinor: 10.5 })).toThrow();
        expect(() => sellSchema.parse({ ...ids, saleType: 'full', totalMinor: 10, status: 'completed' })).toThrow();
    });
});

describe('paymentSchema', () => {
    it('accepts cash, transfer and POS only', () => {
        for (const method of ['cash', 'transfer', 'pos']) expect(() => paymentSchema.parse({ amountMinor: 5, method })).not.toThrow();
        expect(() => paymentSchema.parse({ amountMinor: 5, method: 'paystack' })).toThrow();
    });
    it('refuses zero and negative amounts', () => {
        expect(() => paymentSchema.parse({ amountMinor: 0, method: 'cash' })).toThrow();
        expect(() => paymentSchema.parse({ amountMinor: -5, method: 'cash' })).toThrow();
    });
});

describe('faultUpdateSchema', () => {
    it('resolving needs a resolution', () => {
        expect(() => faultUpdateSchema.parse({ status: 'resolved' })).toThrow();
        expect(() => faultUpdateSchema.parse({ status: 'resolved', resolution: 'Replaced the compressor' })).not.toThrow();
        expect(() => faultUpdateSchema.parse({ status: 'in_progress' })).not.toThrow();
    });
});

describe('withBalance', () => {
    it('works the balance out from recorded payments only', () => {
        const row = withBalance({ id: 's1', total_minor: 1000, pue_appliance_payments: [{ amount_minor: 300 }, { amount_minor: 200 }] });
        expect(row).toMatchObject({ paidMinor: 500, balanceMinor: 500 });
        expect('pue_appliance_payments' in row).toBe(false);
    });
    it('with no payments the whole price is owed', () => {
        expect(withBalance({ total_minor: 700 })).toMatchObject({ paidMinor: 0, balanceMinor: 700 });
    });
});

describe('mapDbError', () => {
    it('maps business rules to safe messages with the right status', () => {
        expect(mapDbError({ code: 'P0002', message: 'overpayment' })).toMatchObject({ code: 'overpayment', statusCode: 409 });
        expect(mapDbError({ code: 'P0002', message: 'appliance_not_available' })).toMatchObject({ statusCode: 409 });
        expect(mapDbError({ code: 'P0002', message: 'meter_not_on_customer' })).toMatchObject({ statusCode: 400 });
        expect(mapDbError({ code: '23505' })).toMatchObject({ code: 'duplicate', statusCode: 409 });
    });
    it('never leaks raw database text', () => {
        const error = mapDbError({ code: 'XX000', message: 'password authentication failed for user postgres' });
        expect(error.message).not.toMatch(/password|postgres/i);
        expect(error.statusCode).toBe(503);
    });
    it('says so plainly when the tables are not installed yet', () => {
        expect(mapDbError({ message: 'relation "pue_appliances" does not exist' })).toMatchObject({ code: 'appliances_unavailable' });
    });
});

describe('requireIdempotencyKey', () => {
    it('needs a header of a sensible length', () => {
        expect(requireIdempotencyKey('abcdefgh')).toBe('abcdefgh');
        expect(() => requireIdempotencyKey(undefined)).toThrow();
        expect(() => requireIdempotencyKey('short')).toThrow();
    });
});
