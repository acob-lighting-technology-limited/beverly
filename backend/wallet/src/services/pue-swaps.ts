/**
 * Beverly PUE battery swaps: reserve a charged battery, take payment, hand it over.
 *
 * Money and hardware state change only inside the database functions in
 * supabase/migrations/20261117130000_pue_swaps.sql (atomic, idempotent, append-only payments).
 * This layer adds what the database cannot know: which battery is actually charged, which comes
 * from LIVE Yunhe readings. If those readings are unavailable the swap is refused; a charge
 * level is never guessed.
 *
 * Used by: routes/pue-swaps.ts and services/pue-swap-paystack.ts.
 */
import crypto from 'node:crypto';
import { z } from 'zod';
import { adminClient } from '../db/supabase.js';
import { yunheQuery, YunheGatewayError } from './yunhe-gateway.js';
import { pickCharged, type BatteryRow } from './yunhe-readings.js';

export class PueSwapError extends Error {
    constructor(public code: string, message: string, public statusCode: number) {
        super(message);
        this.name = 'PueSwapError';
    }
}

/** Rule failures raised by the database functions (errcode P0002, message = code) and what to tell the user. */
const RULES: Record<string, [string, number]> = {
    rider_not_active: ['That rider is not active.', 409],
    no_active_bike: ['That rider has no active bike sale.', 409],
    several_bikes: ['That rider has more than one bike. Swaps for several bikes are not supported yet.', 409],
    station_not_active: ['That swap station is not active.', 409],
    battery_not_available: ['That battery is no longer available. Start the swap again.', 409],
    idempotency_conflict: ['That request key was already used for a different request.', 409],
    settings_missing: ['Swap settings are missing in the database.', 503],
    already_paid: ['This swap is already paid.', 409],
    swap_not_open: ['This swap is no longer open.', 409],
    reservation_expired: ['The reservation expired. Start a new swap.', 409],
    amount_mismatch: ['The amount must be exactly the swap price.', 422],
    swap_not_found: ['Swap not found.', 404],
    not_paid: ['Record the payment before handing over the battery.', 409],
    returned_battery_mismatch: ["The returned battery must be the one on this rider's bike. A first-time rider returns none.", 409],
};

/** Database errors become safe messages. Raw errors never reach the client. */
export function mapSwapDbError(error: { code?: string; message?: string } | null | undefined): PueSwapError {
    if (error?.code === 'P0002') {
        const rule = RULES[String(error.message ?? '')];
        return rule ? new PueSwapError(String(error?.message), rule[0], rule[1]) : new PueSwapError('not_found', 'Record not found.', 404);
    }
    if (error?.code === '23505') return new PueSwapError('conflict', 'That conflicts with an open swap or an already used payment reference.', 409);
    if (error?.code === '23514' || error?.code === '22023') return new PueSwapError('invalid_value', 'A value is outside what is allowed.', 400);
    if (/does not exist|schema cache/i.test(String(error?.message ?? ''))) return new PueSwapError('swaps_unavailable', 'Swaps are not set up in this database yet.', 503);
    return new PueSwapError('swap_failed', 'The swap request could not be completed.', 503);
}

const MIN_KEY = 8;
/** Money routes need a caller-chosen key so a retry never acts twice. */
export function requireIdempotencyKey(value: unknown): string {
    const key = String(Array.isArray(value) ? value[0] : value ?? '').trim();
    if (key.length < MIN_KEY || key.length > 120) throw new PueSwapError('idempotency_key_required', 'Send an Idempotency-Key header of 8 to 120 characters.', 400);
    return key;
}

// ── settings ───────────────────────────────────────────────────────────────────
export interface SwapSettings { priceMinor: number; minSoc: number; reservationMinutes: number; maxReadingAgeMinutes: number }
const SETTING_KEYS = { priceMinor: 'swap_price_minor', minSoc: 'swap_min_soc', reservationMinutes: 'swap_reservation_minutes', maxReadingAgeMinutes: 'swap_max_reading_age_minutes' } as const;

export async function getSettings(): Promise<SwapSettings> {
    const { data, error } = await adminClient.from('pue_settings').select('key, value').in('key', Object.values(SETTING_KEYS));
    if (error) throw mapSwapDbError(error);
    const byKey = new Map((data ?? []).map((row: { key: string; value: unknown }) => [row.key, Number(row.value)]));
    const settings = {} as SwapSettings;
    for (const [field, key] of Object.entries(SETTING_KEYS) as [keyof SwapSettings, string][]) {
        const value = byKey.get(key);
        if (value === undefined || !Number.isFinite(value)) throw new PueSwapError('settings_missing', 'Swap settings are missing in the database.', 503);
        settings[field] = value;
    }
    return settings;
}

export const settingsSchema = z.object({
    priceMinor: z.number().int().min(0).max(10_000_000),
    minSoc: z.number().int().min(1).max(100),
    reservationMinutes: z.number().int().min(5).max(240),
    maxReadingAgeMinutes: z.number().int().min(5).max(1440),
}).partial().strict().refine((v) => Object.keys(v).length > 0, 'Send at least one setting.');

export async function updateSettings(body: unknown, actorId: string): Promise<SwapSettings> {
    const input = settingsSchema.parse(body);
    const rows = (Object.entries(input) as [keyof SwapSettings, number][]).map(([field, value]) => ({ key: SETTING_KEYS[field], value, updated_by: actorId, updated_at: new Date().toISOString() }));
    const { error } = await adminClient.from('pue_settings').upsert(rows, { onConflict: 'key' });
    if (error) throw mapSwapDbError(error);
    return getSettings();
}

// ── reserve ────────────────────────────────────────────────────────────────────
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I, so a code read aloud is not misheard
export function newReservationCode(): string {
    return Array.from({ length: 6 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
}

export const reserveSchema = z.object({ riderId: z.string().uuid(), stationId: z.string().uuid() }).strict();

const OPEN = ['reserved', 'paid'];

async function freeBatteriesAt(stationId: string): Promise<BatteryRow[]> {
    const { data: inBay, error } = await adminClient.from('pue_batteries').select('id, battery_number, serial_number').eq('station_id', stationId).eq('status', 'in_bay');
    if (error) throw mapSwapDbError(error);
    const { data: open, error: openError } = await adminClient.from('pue_swaps').select('battery_out_id').in('status', OPEN);
    if (openError) throw mapSwapDbError(openError);
    const taken = new Set((open ?? []).map((row: { battery_out_id: string }) => row.battery_out_id));
    return ((inBay ?? []) as BatteryRow[]).filter((battery) => !taken.has(battery.id));
}

export async function reserveSwap(body: unknown, idempotencyKey: string, actorId: string) {
    const input = reserveSchema.parse(body);

    // A retry with the same key must return the same swap even if batteries have moved since.
    const { data: existing } = await adminClient.from('pue_swaps').select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing) return mapSwapRow(existing);

    const { data: open } = await adminClient.from('pue_swaps').select('id, status').eq('rider_id', input.riderId).in('status', OPEN).maybeSingle();
    if (open) throw Object.assign(new PueSwapError('swap_already_open', 'This rider already has an open swap. Continue or cancel it first.', 409), { swapId: (open as { id: string }).id });

    const settings = await getSettings();
    const candidates = await freeBatteriesAt(input.stationId);

    let live: Record<string, unknown>[] = [];
    if (candidates.length) {
        try {
            const result = await yunheQuery('getBattery', {});
            const list = (result.data as { list?: unknown } | null)?.list;
            live = Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
        } catch (error) {
            if (error instanceof YunheGatewayError) throw new PueSwapError('readings_unavailable', `Battery charge levels are unavailable (${error.message}). A swap cannot be started without them.`, 503);
            throw error;
        }
    }

    const pick = pickCharged(candidates, live, { minSoc: settings.minSoc, maxReadingAgeMinutes: settings.maxReadingAgeMinutes });
    if (!pick.ok) {
        const text = {
            no_batteries: 'There are no batteries in the bays at this station.',
            no_live_readings: 'The platform has no live reading for any battery at this station.',
            none_charged: `No battery at this station is charged to ${settings.minSoc}% or more with a recent reading.`,
        }[pick.reason];
        throw new PueSwapError(`no_charged_battery_${pick.reason}`, text, 409);
    }

    // The code only has to be unique among open swaps; a clash is rare, so retry with a new one.
    for (let attempt = 0; attempt < 4; attempt++) {
        const { data, error } = await adminClient.rpc('pue_reserve_swap', {
            p_rider_id: input.riderId, p_station_id: input.stationId, p_battery_id: pick.battery.id,
            p_code: newReservationCode(), p_idempotency_key: idempotencyKey, p_actor: actorId,
        });
        if (!error) return { ...mapSwapRow(data), chargeAtReservation: pick.reading.soc };
        if (error.code === '23505' && /reservation_code|open_code/.test(String(error.message))) continue;
        throw mapSwapDbError(error);
    }
    throw new PueSwapError('code_clash', 'A pickup code could not be generated. Try again.', 503);
}

/** Row shape returned to the app (camelCase). */
export function mapSwapRow(row: Record<string, any>) {
    return {
        id: row.id, riderId: row.rider_id, stationId: row.station_id, bikeId: row.bike_id,
        batteryOutId: row.battery_out_id, batteryInId: row.battery_in_id,
        priceMinor: Number(row.price_minor), status: row.status, reservationCode: row.reservation_code,
        reservedUntil: row.reserved_until, paidAt: row.paid_at, completedAt: row.completed_at, cancelledAt: row.cancelled_at,
        cancelReason: row.cancel_reason, createdAt: row.created_at,
    };
}

// ── payment (attendant records cash / transfer / POS) ──────────────────────────
export const recordPaymentSchema = z.object({
    method: z.enum(['cash', 'transfer', 'pos']),
    amountMinor: z.number().int().positive(),
    reference: z.string().trim().min(3).max(80).optional(),
}).strict().refine((v) => v.method === 'cash' || Boolean(v.reference), { message: 'A transfer or POS payment needs its reference.', path: ['reference'] });

export async function recordPayment(swapId: string, body: unknown, idempotencyKey: string, actorId: string) {
    z.string().uuid().parse(swapId);
    const input = recordPaymentSchema.parse(body);
    const { data, error } = await adminClient.rpc('pue_record_swap_payment', {
        p_swap_id: swapId, p_amount_minor: input.amountMinor, p_method: input.method,
        p_reference: input.reference ?? null, p_idempotency_key: idempotencyKey, p_actor: actorId,
    });
    if (error) throw mapSwapDbError(error);
    return mapSwapRow(data);
}

// ── hand over, cancel ──────────────────────────────────────────────────────────
export const completeSchema = z.object({ returnedBatteryId: z.string().uuid().nullable().optional() }).strict();
export async function completeSwap(swapId: string, body: unknown, actorId: string) {
    z.string().uuid().parse(swapId);
    const input = completeSchema.parse(body ?? {});
    const { data, error } = await adminClient.rpc('pue_complete_swap', { p_swap_id: swapId, p_returned_battery_id: input.returnedBatteryId ?? null, p_actor: actorId });
    if (error) throw mapSwapDbError(error);
    return mapSwapRow(data);
}

export const cancelSchema = z.object({ reason: z.string().trim().min(3).max(200) }).strict();
export async function cancelSwap(swapId: string, body: unknown, actorId: string) {
    z.string().uuid().parse(swapId);
    const input = cancelSchema.parse(body);
    const { data, error } = await adminClient.rpc('pue_cancel_swap', { p_swap_id: swapId, p_reason: input.reason, p_actor: actorId });
    if (error) throw mapSwapDbError(error);
    return { swap: mapSwapRow(data), reason: input.reason };
}

// ── reads ──────────────────────────────────────────────────────────────────────
const SWAP_SELECT = '*, pue_riders(full_name, phone), pue_bikes(serial_number), pue_swap_stations(name), battery_out:pue_batteries!pue_swaps_battery_out_id_fkey(battery_number), battery_in:pue_batteries!pue_swaps_battery_in_id_fkey(battery_number), pue_swap_payments(kind, amount_minor, method, reference, created_at), pue_swap_paystack_attempts(reference, status, review_reason)';

export async function listSwaps(opts: { limit: number; offset: number; status?: string }) {
    let query = adminClient.from('pue_swaps').select(SWAP_SELECT, { count: 'exact' }).order('created_at', { ascending: false }).range(opts.offset, opts.offset + opts.limit - 1);
    if (opts.status) query = query.eq('status', opts.status);
    const { data, error, count } = await query;
    if (error) throw mapSwapDbError(error);
    return { items: (data ?? []).map(shapeSwap), total: count ?? 0 };
}

export async function getSwap(id: string) {
    z.string().uuid().parse(id);
    const { data, error } = await adminClient.from('pue_swaps').select(SWAP_SELECT).eq('id', id).maybeSingle();
    if (error) throw mapSwapDbError(error);
    if (!data) throw new PueSwapError('swap_not_found', RULES.swap_not_found![0], 404);
    return shapeSwap(data);
}

/** A swap with its names and money trail. `refundDue` is true when a refund was recorded or an online payment needs review. */
function shapeSwap(row: Record<string, any>) {
    const payments = (row.pue_swap_payments ?? []) as { kind: string; amount_minor: number; method: string; reference: string | null; created_at: string }[];
    const attempts = (row.pue_swap_paystack_attempts ?? []) as { reference: string; status: string; review_reason: string | null }[];
    return {
        ...mapSwapRow(row),
        rider: row.pue_riders ? { name: row.pue_riders.full_name, phone: row.pue_riders.phone } : null,
        bikeSerial: row.pue_bikes?.serial_number ?? null,
        stationName: row.pue_swap_stations?.name ?? null,
        batteryOutNumber: row.battery_out?.battery_number ?? null,
        batteryInNumber: row.battery_in?.battery_number ?? null,
        payments: payments.map((p) => ({ kind: p.kind, amountMinor: Number(p.amount_minor), method: p.method, reference: p.reference, at: p.created_at })),
        paystackAttempts: attempts.map((a) => ({ reference: a.reference, status: a.status, reason: a.review_reason })),
        refundDue: payments.some((p) => p.kind === 'refund') || attempts.some((a) => a.status === 'needs_review'),
    };
}

export async function batteryCustody(batteryId: string) {
    z.string().uuid().parse(batteryId);
    const { data, error } = await adminClient.from('pue_battery_custody')
        .select('event, created_at, swap_id, note, pue_swap_stations(name), pue_riders(full_name), pue_bikes(serial_number)')
        .eq('battery_id', batteryId).order('created_at', { ascending: false }).limit(100);
    if (error) throw mapSwapDbError(error);
    return (data ?? []).map((row: Record<string, any>) => ({ event: row.event, at: row.created_at, swapId: row.swap_id, note: row.note, station: row.pue_swap_stations?.name ?? null, rider: row.pue_riders?.full_name ?? null, bike: row.pue_bikes?.serial_number ?? null }));
}
