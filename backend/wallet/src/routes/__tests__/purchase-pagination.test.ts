import { describe, expect, it, vi } from 'vitest';
import { applyPurchasePageCursor, purchasePageCursor } from '../purchase-pagination.js';

describe('purchase pagination', () => {
    const row = { created_at: '2026-10-20T14:00:00.123456Z', id: '0e95dd3f-41be-45f0-a1d2-cea82099db69' };

    it('keeps rows sharing a timestamp', () => {
        const query = { or: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis() };
        applyPurchasePageCursor(query, purchasePageCursor(row));
        expect(query.or).toHaveBeenCalledWith(`created_at.lt.${row.created_at},and(created_at.eq.${row.created_at},id.lt.${row.id})`);
        expect(query.lt).not.toHaveBeenCalled();
    });

    it('accepts legacy timestamp cursors', () => {
        const query = { or: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis() };
        applyPurchasePageCursor(query, row.created_at);
        expect(query.lt).toHaveBeenCalledWith('created_at', row.created_at);
    });

    it('rejects malformed cursor filters', () => {
        const query = { or: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis() };
        expect(() => applyPurchasePageCursor(query, `${row.created_at}|id.lt.anything`)).toThrow('Invalid purchase cursor');
    });
});
