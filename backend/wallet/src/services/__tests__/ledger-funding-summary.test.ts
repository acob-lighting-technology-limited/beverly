import { describe, expect, it } from 'vitest';
import { classifyFundingCredits } from '../ledger-funding-summary.js';

describe('wallet funding totals', () => {
    it('includes historical Paystack request credits without double counting', () => {
        expect(classifyFundingCredits([
            { amount_minor: 5_900_000, reference_type: 'funding_request', reference_id: 'legacy' },
            { amount_minor: 10_000_000, reference_type: 'funding_request', reference_id: 'bank' },
            { amount_minor: 20_000_000, reference_type: 'funding_request', reference_id: 'current' },
        ], [
            { id: 'legacy', channel: 'paystack' },
            { id: 'bank', channel: 'bank_transfer' },
            { id: 'current', channel: 'paystack' },
        ], [])).toEqual({
            fundingCount: 3, fundingValueMinor: 35_900_000,
            paystackFundingCount: 2, paystackFundingValueMinor: 25_900_000,
            bankFundingCount: 1, bankFundingValueMinor: 10_000_000,
            otherFundingCount: 0, otherFundingValueMinor: 0,
        });
    });

    it('preserves unexplained credits in the total', () => {
        const result = classifyFundingCredits([
            { amount_minor: 1_000, reference_type: 'unknown', reference_id: null },
        ], [], []);
        expect(result.fundingValueMinor).toBe(1_000);
        expect(result.otherFundingValueMinor).toBe(1_000);
    });
});
