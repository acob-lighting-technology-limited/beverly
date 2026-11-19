import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db/supabase.js', () => ({ adminClient: {} }));

import { buildApplianceAnalytics, buildSwapAnalytics, dayKey, dayRange, median } from '../pue-analytics.js';

// 2026-11-19 12:00 West Africa Time is 11:00 UTC.
const NOW = Date.parse('2026-11-19T11:00:00Z');
const iso = (offsetHours: number) => new Date(NOW + offsetHours * 3_600_000).toISOString();

describe('days', () => {
    it('buckets in West Africa time, so a 23:30 UTC swap belongs to the next day', () => {
        expect(dayKey(Date.parse('2026-11-18T23:30:00Z'))).toBe('2026-11-19');
        expect(dayKey(Date.parse('2026-11-18T22:30:00Z'))).toBe('2026-11-18');
    });
    it('lists every day, oldest first, ending today', () => {
        const days = dayRange(NOW, 7);
        expect(days).toHaveLength(7);
        expect(days[6]).toBe('2026-11-19');
        expect(days[0]).toBe('2026-11-13');
    });
    it('median of nothing is null, not zero', () => {
        expect(median([])).toBeNull();
        expect(median([4, 1, 9])).toBe(4);
        expect(median([2, 4])).toBe(3);
    });
});

describe('swap analytics', () => {
    const stations = [{ id: 'st1', name: 'Musha hub' }, { id: 'st2', name: 'Bako hub' }];
    const swap = (id: string, over: Partial<Record<string, unknown>> = {}) => ({
        id, rider_id: 'r1', station_id: 'st1', status: 'completed', price_minor: 130000,
        created_at: iso(-3), paid_at: iso(-3), completed_at: iso(-2.5), ...over,
    }) as never;

    it('counts outcomes, completion rate, revenue and refunds from real rows', () => {
        const result = buildSwapAnalytics({
            swaps: [swap('a'), swap('b', { rider_id: 'r2' }), swap('c', { status: 'cancelled', completed_at: null }), swap('d', { status: 'expired', completed_at: null }), swap('e', { status: 'reserved', completed_at: null })],
            payments: [
                { swap_id: 'a', kind: 'payment', amount_minor: 130000, method: 'cash', created_at: iso(-3) },
                { swap_id: 'b', kind: 'payment', amount_minor: 130000, method: 'paystack', created_at: iso(-3) },
                { swap_id: 'c', kind: 'payment', amount_minor: 130000, method: 'cash', created_at: iso(-3) },
                { swap_id: 'c', kind: 'refund', amount_minor: 130000, method: 'cash', created_at: iso(-2) },
            ],
            stations, now: NOW, days: 7,
        });
        expect(result.totals).toMatchObject({ swaps: 5, completed: 2, cancelled: 1, expired: 1, open: 1, revenueMinor: 390000, refundsMinor: 130000, netRevenueMinor: 260000, activeRiders: 2 });
        expect(result.totals.completionRate).toBeCloseTo(0.5);
        expect(result.totals.avgRevenuePerSwapMinor).toBe(195000);
        expect(result.totals.medianMinutesToHandover).toBe(30);
        expect(result.byMethod.map((m) => m.method)).toEqual(['cash', 'paystack']);
        expect(result.byStation[0]).toMatchObject({ name: 'Musha hub', completed: 2, revenueMinor: 390000 });
    });

    it('with no swaps every rate is null and every day is a true zero', () => {
        const result = buildSwapAnalytics({ swaps: [], payments: [], stations, now: NOW, days: 7 });
        expect(result.totals.completionRate).toBeNull();
        expect(result.totals.avgRevenuePerSwapMinor).toBeNull();
        expect(result.totals.medianMinutesToHandover).toBeNull();
        expect(result.daily).toHaveLength(7);
        expect(result.daily.every((d) => d.swaps === 0 && d.revenueMinor === 0)).toBe(true);
        expect(result.byHour).toHaveLength(24);
    });

    it('measures repeat riders and peak hours', () => {
        const result = buildSwapAnalytics({ swaps: [swap('a'), swap('b'), swap('c', { rider_id: 'r2' })], payments: [], stations, now: NOW, days: 7 });
        expect(result.totals.repeatRiderShare).toBeCloseTo(0.5);
        expect(result.byHour.reduce((sum, h) => sum + h.completed, 0)).toBe(3);
    });
});

describe('appliance analytics', () => {
    const types = [{ id: 't1', name: 'Chest freezer', category: 'freezer' }, { id: 't2', name: 'Grinder', category: 'grinder' }];
    const units = [
        { id: 'u1', type_id: 't1', status: 'sold' }, { id: 'u2', type_id: 't1', status: 'in_stock' },
        { id: 'u3', type_id: 't2', status: 'faulty' }, { id: 'u4', type_id: 't2', status: 'sold' },
    ];
    const sale = (id: string, applianceId: string, total: number, status = 'active', type: 'full' | 'instalment' = 'instalment') => ({ id, appliance_id: applianceId, sale_type: type, total_minor: total, status, created_at: iso(-5) }) as never;

    it('works out what is owed and how much of it is paid from recorded payments only', () => {
        const active = [sale('s1', 'u1', 1_000_000), sale('s2', 'u4', 500_000)];
        const result = buildApplianceAnalytics({
            units, types, sales: active, salesInWindow: active,
            paymentsAll: [
                { sale_id: 's1', amount_minor: 400_000, method: 'cash', created_at: iso(-5) },
                { sale_id: 's2', amount_minor: 100_000, method: 'transfer', created_at: iso(-4) },
            ],
            faults: [], now: NOW, days: 7,
        });
        expect(result.totals).toMatchObject({ unitsTotal: 4, soldInWindow: 2, collectedMinor: 500_000, activeSales: 2, outstandingMinor: 1_000_000 });
        expect(result.totals.paidShare).toBeCloseTo(1 / 3);
        expect(result.unitsByStatus).toMatchObject({ in_stock: 1, sold: 2, faulty: 1 });
        expect(result.byType[0]).toMatchObject({ name: 'Chest freezer', sold: 1 });
    });

    it('never counts a cancelled sale as sold, and has no paid share without active sales', () => {
        const result = buildApplianceAnalytics({ units, types, sales: [], salesInWindow: [sale('s9', 'u1', 100, 'cancelled')], paymentsAll: [], faults: [], now: NOW, days: 7 });
        expect(result.totals.soldInWindow).toBe(0);
        expect(result.totals.paidShare).toBeNull();
        expect(result.totals.outstandingMinor).toBe(0);
    });

    it('summarises faults: open by severity and the median hours to fix', () => {
        const result = buildApplianceAnalytics({
            units, types, sales: [], salesInWindow: [], paymentsAll: [], now: NOW, days: 7,
            faults: [
                { id: 'f1', appliance_id: 'u1', severity: 'high', status: 'open', created_at: iso(-10), resolved_at: null },
                { id: 'f2', appliance_id: 'u2', severity: 'low', status: 'in_progress', created_at: iso(-10), resolved_at: null },
                { id: 'f3', appliance_id: 'u3', severity: 'medium', status: 'resolved', created_at: iso(-30), resolved_at: iso(-26) },
                { id: 'f4', appliance_id: 'u4', severity: 'medium', status: 'resolved', created_at: iso(-30), resolved_at: iso(-20) },
            ],
        });
        expect(result.totals.openFaults).toBe(2);
        expect(result.openFaultsBySeverity).toMatchObject({ high: 1, low: 1 });
        expect(result.totals.medianHoursToResolve).toBe(7);
    });
});
