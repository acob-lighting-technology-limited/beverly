import { describe, expect, it } from 'vitest';
import { pagedAmountTotal } from '../paged-amount-total.js';

describe('pagedAmountTotal', () => {
    it('sums beyond the database page limit', async () => {
        const rows = Array.from({ length: 1_049 }, () => ({ amount_minor: 200 }));
        const pages: number[] = [];
        const result = await pagedAmountTotal(async (start, end) => {
            pages.push(start);
            return { data: rows.slice(start, end + 1), count: rows.length, error: null };
        });
        expect(result).toEqual({ count: 1_049, amountMinor: 209_800 });
        expect(pages).toEqual([0, 1_000]);
    });

    it('fails closed on incomplete pages', async () => {
        await expect(pagedAmountTotal(async () => ({ data: [], count: 2, error: null })))
            .rejects.toThrow('Amount page incomplete');
    });

    it('rejects unsafe totals', async () => {
        await expect(pagedAmountTotal(async () => ({
            data: [{ amount_minor: Number.MAX_SAFE_INTEGER }, { amount_minor: 1 }], count: 2, error: null,
        }))).rejects.toThrow('Invalid amount total');
    });
});
