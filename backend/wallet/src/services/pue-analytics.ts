/**
 * Beverly PUE analytics: dashboards and insight for battery swaps and appliance sales.
 *
 * Everything here is worked out from Beverly's own records (swaps, payments, sales, faults). Live battery
 * readings (charge, location, online) come from the Yunhe gateway and are joined in the browser, so this
 * module never makes up a telemetry number and keeps working when Yunhe is not connected.
 *
 * Days are bucketed in West Africa Time (UTC+1, no daylight saving). A day with no activity is a real zero.
 * If a read fails the whole call fails, so a dashboard never shows zeros that are really errors.
 *
 * Used by: routes/pue-analytics.ts. Tables: pue_swaps, pue_swap_payments, pue_swap_stations,
 * pue_appliances, pue_appliance_types, pue_appliance_sales, pue_appliance_payments, pue_appliance_faults.
 */
import { adminClient } from '../db/supabase.js';

export class PueAnalyticsError extends Error {
    constructor(public code: string, message: string, public statusCode: number) {
        super(message);
        this.name = 'PueAnalyticsError';
    }
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WAT_OFFSET = HOUR;
const PAGE = 1000;
const ROW_CAP = 20_000;

/** Calendar day (YYYY-MM-DD) of a timestamp in West Africa Time. */
export const dayKey = (ms: number): string => new Date(ms + WAT_OFFSET).toISOString().slice(0, 10);
export const hourOfDay = (ms: number): number => new Date(ms + WAT_OFFSET).getUTCHours();

/** Every day from `days - 1` days ago up to today, oldest first. */
export function dayRange(now: number, days: number): string[] {
    return Array.from({ length: days }, (_, i) => dayKey(now - (days - 1 - i) * DAY));
}

export function median(values: number[]): number | null {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Median that keeps its decimals (hours to fix a fault). */
function medianExact(values: number[]): number | null {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

const toMs = (value: unknown): number | null => {
    const ms = typeof value === 'string' ? Date.parse(value) : NaN;
    return Number.isFinite(ms) ? ms : null;
};

/** Reads every page of a query, stopping at a hard cap. Returns the rows and whether the cap cut it short. */
async function readAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }>): Promise<{ rows: T[]; truncated: boolean }> {
    const rows: T[] = [];
    for (let from = 0; from < ROW_CAP; from += PAGE) {
        const { data, error } = await build(from, from + PAGE - 1);
        if (error) throw new PueAnalyticsError('analytics_unavailable', 'Analytics could not be read right now.', 503);
        const page = (data ?? []) as T[];
        rows.push(...page);
        if (page.length < PAGE) return { rows, truncated: false };
    }
    return { rows, truncated: true };
}

// ── Swaps ───────────────────────────────────────────────────────────────────────────────────────

export interface SwapRow { id: string; rider_id: string; station_id: string; status: string; price_minor: number; created_at: string; paid_at: string | null; completed_at: string | null }
export interface SwapPaymentRow { swap_id: string; kind: 'payment' | 'refund'; amount_minor: number; method: string; created_at: string }
export interface StationRow { id: string; name: string }

export function buildSwapAnalytics(input: { swaps: SwapRow[]; payments: SwapPaymentRow[]; stations: StationRow[]; now: number; days: number }) {
    const { swaps, payments, stations, now, days } = input;
    const dates = dayRange(now, days);
    const daily = new Map(dates.map((d) => [d, { date: d, swaps: 0, completed: 0, revenueMinor: 0 }]));
    const stationName = new Map(stations.map((s) => [s.id, s.name]));
    const byStation = new Map<string, { stationId: string; name: string; completed: number; revenueMinor: number }>();
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, completed: 0 }));
    const completedRiders = new Map<string, number>();
    const minutesToHandover: number[] = [];
    const swapStation = new Map<string, string>();
    let created = 0, completed = 0, cancelled = 0, expired = 0, open = 0;

    for (const swap of swaps) {
        swapStation.set(swap.id, swap.station_id);
        const createdMs = toMs(swap.created_at);
        if (createdMs === null) continue;
        created += 1;
        const day = daily.get(dayKey(createdMs));
        if (day) day.swaps += 1;
        if (swap.status === 'cancelled') cancelled += 1;
        else if (swap.status === 'expired') expired += 1;
        else if (swap.status === 'reserved' || swap.status === 'paid') open += 1;
        else if (swap.status === 'completed') {
            completed += 1;
            const doneMs = toMs(swap.completed_at) ?? createdMs;
            const doneDay = daily.get(dayKey(doneMs));
            if (doneDay) doneDay.completed += 1;
            byHour[hourOfDay(doneMs)].completed += 1;
            completedRiders.set(swap.rider_id, (completedRiders.get(swap.rider_id) ?? 0) + 1);
            minutesToHandover.push(Math.max(0, Math.round((doneMs - createdMs) / 60_000)));
            const entry = byStation.get(swap.station_id) ?? { stationId: swap.station_id, name: stationName.get(swap.station_id) ?? 'Unknown station', completed: 0, revenueMinor: 0 };
            entry.completed += 1;
            byStation.set(swap.station_id, entry);
        }
    }

    const methods = new Map<string, { method: string; count: number; amountMinor: number }>();
    let revenueMinor = 0, refundsMinor = 0;
    for (const payment of payments) {
        const at = toMs(payment.created_at);
        if (at === null) continue;
        if (payment.kind === 'refund') { refundsMinor += payment.amount_minor; continue; }
        revenueMinor += payment.amount_minor;
        const day = daily.get(dayKey(at));
        if (day) day.revenueMinor += payment.amount_minor;
        const method = methods.get(payment.method) ?? { method: payment.method, count: 0, amountMinor: 0 };
        method.count += 1;
        method.amountMinor += payment.amount_minor;
        methods.set(payment.method, method);
        const stationId = swapStation.get(payment.swap_id);
        if (stationId) {
            const entry = byStation.get(stationId);
            if (entry) entry.revenueMinor += payment.amount_minor;
        }
    }

    const finished = completed + cancelled + expired;
    const riders = [...completedRiders.values()];
    return {
        totals: {
            swaps: created, completed, cancelled, expired, open,
            // Of the swaps that ended, how many ended in a handover. Null when none has ended yet.
            completionRate: finished ? completed / finished : null,
            revenueMinor, refundsMinor, netRevenueMinor: revenueMinor - refundsMinor,
            avgRevenuePerSwapMinor: completed ? Math.round(revenueMinor / completed) : null,
            medianMinutesToHandover: median(minutesToHandover),
            activeRiders: riders.length,
            repeatRiderShare: riders.length ? riders.filter((n) => n > 1).length / riders.length : null,
        },
        daily: [...daily.values()],
        byStation: [...byStation.values()].sort((a, b) => b.completed - a.completed || b.revenueMinor - a.revenueMinor).slice(0, 10),
        byMethod: [...methods.values()].sort((a, b) => b.amountMinor - a.amountMinor),
        byHour,
    };
}

export async function swapAnalytics(days: number, now = Date.now()) {
    const since = new Date(now - days * DAY).toISOString();
    const [swaps, payments, stations] = await Promise.all([
        readAll<SwapRow>((a, b) => adminClient.from('pue_swaps').select('id, rider_id, station_id, status, price_minor, created_at, paid_at, completed_at').gte('created_at', since).order('created_at', { ascending: true }).range(a, b)),
        readAll<SwapPaymentRow>((a, b) => adminClient.from('pue_swap_payments').select('swap_id, kind, amount_minor, method, created_at').gte('created_at', since).order('created_at', { ascending: true }).range(a, b)),
        readAll<StationRow>((a, b) => adminClient.from('pue_swap_stations').select('id, name').range(a, b)),
    ]);
    return {
        source: 'beverly_database' as const,
        generatedAt: new Date(now).toISOString(),
        days,
        truncated: swaps.truncated || payments.truncated,
        ...buildSwapAnalytics({ swaps: swaps.rows, payments: payments.rows, stations: stations.rows, now, days }),
    };
}

// ── Appliances ──────────────────────────────────────────────────────────────────────────────────

export interface ApplianceUnitRow { id: string; type_id: string; status: string }
export interface ApplianceTypeRow { id: string; name: string; category: string }
export interface ApplianceSaleRow { id: string; appliance_id: string; sale_type: 'full' | 'instalment'; total_minor: number; status: string; created_at: string }
export interface AppliancePaymentRow { sale_id: string; amount_minor: number; method: string; created_at: string }
export interface ApplianceFaultRow { id: string; appliance_id: string; severity: string; status: string; created_at: string; resolved_at: string | null }

export function buildApplianceAnalytics(input: {
    units: ApplianceUnitRow[]; types: ApplianceTypeRow[]; sales: ApplianceSaleRow[]; salesInWindow: ApplianceSaleRow[];
    paymentsAll: AppliancePaymentRow[]; faults: ApplianceFaultRow[]; now: number; days: number;
}) {
    const { units, types, sales, salesInWindow, paymentsAll, faults, now, days } = input;
    const dates = dayRange(now, days);
    const windowStart = now - days * DAY;
    const daily = new Map(dates.map((d) => [d, { date: d, sales: 0, collectedMinor: 0 }]));
    const typeById = new Map(types.map((t) => [t.id, t]));
    const unitType = new Map(units.map((u) => [u.id, u.type_id]));

    const unitsByStatus: Record<string, number> = { in_stock: 0, sold: 0, faulty: 0, retired: 0 };
    for (const unit of units) unitsByStatus[unit.status] = (unitsByStatus[unit.status] ?? 0) + 1;

    const paidBySale = new Map<string, number>();
    const methods = new Map<string, { method: string; count: number; amountMinor: number }>();
    let collectedMinor = 0;
    for (const payment of paymentsAll) {
        paidBySale.set(payment.sale_id, (paidBySale.get(payment.sale_id) ?? 0) + payment.amount_minor);
        const at = toMs(payment.created_at);
        if (at === null || at < windowStart) continue;
        collectedMinor += payment.amount_minor;
        const day = daily.get(dayKey(at));
        if (day) day.collectedMinor += payment.amount_minor;
        const method = methods.get(payment.method) ?? { method: payment.method, count: 0, amountMinor: 0 };
        method.count += 1;
        method.amountMinor += payment.amount_minor;
        methods.set(payment.method, method);
    }

    let activeCount = 0, activeValueMinor = 0, activePaidMinor = 0;
    for (const sale of sales) {
        if (sale.status !== 'active') continue;
        activeCount += 1;
        activeValueMinor += sale.total_minor;
        activePaidMinor += Math.min(paidBySale.get(sale.id) ?? 0, sale.total_minor);
    }

    const byType = new Map<string, { typeId: string; name: string; category: string; sold: number; valueMinor: number }>();
    const bySaleType = { full: 0, instalment: 0 };
    let soldInWindow = 0;
    for (const sale of salesInWindow) {
        if (sale.status === 'cancelled') continue;
        const at = toMs(sale.created_at);
        if (at === null) continue;
        soldInWindow += 1;
        bySaleType[sale.sale_type] += 1;
        const day = daily.get(dayKey(at));
        if (day) day.sales += 1;
        const typeId = unitType.get(sale.appliance_id);
        const type = typeId ? typeById.get(typeId) : undefined;
        const key = type?.id ?? 'unknown';
        const entry = byType.get(key) ?? { typeId: key, name: type?.name ?? 'Unknown type', category: type?.category ?? 'other', sold: 0, valueMinor: 0 };
        entry.sold += 1;
        entry.valueMinor += sale.total_minor;
        byType.set(key, entry);
    }

    const stockByCategory = new Map<string, { category: string; inStock: number; sold: number; faulty: number }>();
    for (const unit of units) {
        const category = typeById.get(unit.type_id)?.category ?? 'other';
        const entry = stockByCategory.get(category) ?? { category, inStock: 0, sold: 0, faulty: 0 };
        if (unit.status === 'in_stock') entry.inStock += 1;
        else if (unit.status === 'sold') entry.sold += 1;
        else if (unit.status === 'faulty') entry.faulty += 1;
        stockByCategory.set(category, entry);
    }

    const severity: Record<string, number> = { low: 0, medium: 0, high: 0 };
    const resolutionHours: number[] = [];
    let openFaults = 0, reportedInWindow = 0;
    for (const fault of faults) {
        if (fault.status !== 'resolved') { openFaults += 1; severity[fault.severity] = (severity[fault.severity] ?? 0) + 1; }
        const reported = toMs(fault.created_at);
        if (reported !== null && reported >= windowStart) reportedInWindow += 1;
        const resolved = toMs(fault.resolved_at);
        if (reported !== null && resolved !== null && resolved >= windowStart) resolutionHours.push(Math.max(0, Math.round(((resolved - reported) / HOUR) * 10) / 10));
    }

    return {
        totals: {
            unitsTotal: units.length,
            soldInWindow,
            collectedMinor,
            activeSales: activeCount,
            outstandingMinor: activeValueMinor - activePaidMinor,
            // Of everything owed on active sales, the share already paid. Null when there are no active sales.
            paidShare: activeValueMinor ? activePaidMinor / activeValueMinor : null,
            openFaults, faultsReportedInWindow: reportedInWindow,
            medianHoursToResolve: medianExact(resolutionHours),
        },
        unitsByStatus,
        stockByCategory: [...stockByCategory.values()],
        daily: [...daily.values()],
        byType: [...byType.values()].sort((a, b) => b.sold - a.sold || b.valueMinor - a.valueMinor).slice(0, 10),
        bySaleType,
        byMethod: [...methods.values()].sort((a, b) => b.amountMinor - a.amountMinor),
        openFaultsBySeverity: severity,
    };
}

export async function applianceAnalytics(days: number, now = Date.now()) {
    const since = new Date(now - days * DAY).toISOString();
    const [units, types, sales, salesInWindow, faults] = await Promise.all([
        readAll<ApplianceUnitRow>((a, b) => adminClient.from('pue_appliances').select('id, type_id, status').range(a, b)),
        readAll<ApplianceTypeRow>((a, b) => adminClient.from('pue_appliance_types').select('id, name, category').range(a, b)),
        readAll<ApplianceSaleRow>((a, b) => adminClient.from('pue_appliance_sales').select('id, appliance_id, sale_type, total_minor, status, created_at').eq('status', 'active').range(a, b)),
        readAll<ApplianceSaleRow>((a, b) => adminClient.from('pue_appliance_sales').select('id, appliance_id, sale_type, total_minor, status, created_at').gte('created_at', since).range(a, b)),
        readAll<ApplianceFaultRow>((a, b) => adminClient.from('pue_appliance_faults').select('id, appliance_id, severity, status, created_at, resolved_at').range(a, b)),
    ]);
    // Payments for every sale we need to total: active sales (to know what is still owed) and sales in the window.
    const saleIds = [...new Set([...sales.rows, ...salesInWindow.rows].map((s) => s.id))];
    const payments: AppliancePaymentRow[] = [];
    let truncated = units.truncated || sales.truncated || salesInWindow.truncated || faults.truncated;
    for (let i = 0; i < saleIds.length; i += 150) {
        const chunk = saleIds.slice(i, i + 150);
        const page = await readAll<AppliancePaymentRow>((a, b) => adminClient.from('pue_appliance_payments').select('sale_id, amount_minor, method, created_at').in('sale_id', chunk).range(a, b));
        payments.push(...page.rows);
        truncated = truncated || page.truncated;
    }
    const merged = new Map([...sales.rows, ...salesInWindow.rows].map((s) => [s.id, s]));
    return {
        source: 'beverly_database' as const,
        generatedAt: new Date(now).toISOString(),
        days,
        truncated,
        ...buildApplianceAnalytics({ units: units.rows, types: types.rows, sales: sales.rows, salesInWindow: [...merged.values()].filter((s) => (toMs(s.created_at) ?? 0) >= now - days * DAY), paymentsAll: payments, faults: faults.rows, now, days }),
    };
}
