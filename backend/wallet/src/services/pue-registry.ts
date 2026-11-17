/**
 * Beverly PUE registry: sites, swap stations, bikes, batteries, riders, and bike sales.
 *
 * Own CRM for PUE: riders are NOT Beverly customers (they may have no meter). The
 * optional beverlyCustomerId is a later binding. Identity and ownership only; live
 * battery readings come from services/yunhe-gateway.ts, never from here.
 *
 * Used by: routes/pue-registry.ts. Tables: supabase/migrations/20261117120000_pue_registry.sql.
 */
import { z } from 'zod';
import { adminClient } from '../db/supabase.js';

export class PueRegistryError extends Error {
    constructor(public code: string, message: string, public statusCode: number) {
        super(message);
        this.name = 'PueRegistryError';
    }
}

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable().optional();
const uuid = z.string().uuid();
const status3 = z.enum(['planned', 'active', 'inactive']);

/** Nigerian numbers: 0803... becomes +234803...; spaces and dashes are dropped. */
export function normalizePhone(raw: string): string {
    const compact = raw.replace(/[\s()-]/g, '');
    if (/^0\d{10}$/.test(compact)) return `+234${compact.slice(1)}`;
    if (/^234\d{10}$/.test(compact)) return `+${compact}`;
    return compact;
}

const phone = z.string().trim().transform(normalizePhone).refine((v) => /^\+?[0-9]{7,15}$/.test(v), 'Enter a valid phone number.');

const siteBase = z.object({
    name: text(2, 120), state: text(2, 60), community: optionalText(120), beverlyStationId: optionalText(60),
    yunheSiteId: optionalText(64), address: optionalText(300),
    lat: z.number().min(-90).max(90).nullable().optional(), lng: z.number().min(-180).max(180).nullable().optional(),
    status: status3.optional(),
});
const stationBase = z.object({
    siteId: uuid, name: text(2, 120), handoverMode: z.enum(['attendant', 'cabinet']).optional(),
    bayCount: z.number().int().min(0).max(200).nullable().optional(), yunheStationId: optionalText(64), status: status3.optional(),
});
const bikeBase = z.object({
    serialNumber: text(3, 64), model: optionalText(120),
    status: z.enum(['in_stock', 'sold', 'repossessed', 'retired']).optional(), siteId: uuid.nullable().optional(),
});
const batteryBase = z.object({
    batteryNumber: text(3, 64), serialNumber: optionalText(64), imsi: optionalText(32),
    cellCount: z.number().int().min(1).max(64).nullable().optional(),
    status: z.enum(['in_stock', 'in_bay', 'with_rider', 'maintenance', 'lost', 'retired']).optional(),
    stationId: uuid.nullable().optional(), bikeId: uuid.nullable().optional(),
});
const riderBase = z.object({
    fullName: text(2, 120), phone, email: z.string().trim().email().max(200).nullable().optional(), address: optionalText(300),
    siteId: uuid.nullable().optional(), status: z.enum(['active', 'suspended', 'closed']).optional(),
    beverlyCustomerId: uuid.nullable().optional(), notes: optionalText(500),
});

const update = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
    schema.partial().strict().refine((value) => Object.keys(value).length > 0, 'Send at least one field to change.');

export const REGISTRY = {
    sites: { table: 'pue_sites', create: siteBase.strict(), update: update(siteBase), search: ['name', 'state', 'community'], order: 'name' },
    'swap-stations': { table: 'pue_swap_stations', create: stationBase.strict(), update: update(stationBase), search: ['name'], order: 'name' },
    bikes: { table: 'pue_bikes', create: bikeBase.strict(), update: update(bikeBase), search: ['serial_number', 'model'], order: 'serial_number' },
    batteries: { table: 'pue_batteries', create: batteryBase.strict(), update: update(batteryBase), search: ['battery_number', 'serial_number'], order: 'battery_number' },
    riders: { table: 'pue_riders', create: riderBase.strict(), update: update(riderBase), search: ['full_name', 'phone'], order: 'full_name' },
} as const;

export type RegistryResource = keyof typeof REGISTRY;
export const REGISTRY_RESOURCES = Object.keys(REGISTRY) as RegistryResource[];
export const isRegistryResource = (value: string): value is RegistryResource => value in REGISTRY;

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
/** Validated camelCase input to a database row. Only whitelisted keys reach here. */
export function toRow(input: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined).map(([k, v]) => [snake(k), v]));
}

/** Database errors become safe messages. Raw errors never reach the client. */
function mapDbError(error: { code?: string; message?: string } | null | undefined): PueRegistryError {
    switch (error?.code) {
        case '23505': return new PueRegistryError('duplicate', 'A record with that unique value already exists.', 409);
        case '23503': return new PueRegistryError('reference_not_found', 'A linked record does not exist.', 400);
        case '23514': case '22023': return new PueRegistryError('invalid_value', 'A value is outside what is allowed.', 400);
        case 'P0002': {
            const known: Record<string, [string, string, number]> = {
                rider_not_active: ['rider_not_active', 'That rider is not active.', 409],
                bike_not_available: ['bike_not_available', 'That bike is not available to sell.', 409],
                assignment_not_active: ['assignment_not_active', 'That sale is not active.', 409],
            };
            const hit = known[String(error?.message ?? '')];
            if (hit) return new PueRegistryError(hit[0], hit[1], hit[2]);
            return new PueRegistryError('not_found', 'Record not found.', 404);
        }
        default:
            if (/portal_access|relation .* does not exist|schema cache/i.test(String(error?.message ?? ''))) {
                return new PueRegistryError('registry_unavailable', 'The PUE registry is not set up in this database yet.', 503);
            }
            return new PueRegistryError('registry_failed', 'The registry request could not be completed.', 503);
    }
}

export async function listRegistry(resource: RegistryResource, opts: { limit: number; offset: number; q?: string }) {
    const cfg = REGISTRY[resource];
    let query = adminClient.from(cfg.table).select('*', { count: 'exact' }).order(cfg.order, { ascending: true }).range(opts.offset, opts.offset + opts.limit - 1);
    const q = opts.q?.trim().replace(/[%,()]/g, '');
    if (q) query = query.or(cfg.search.map((column) => `${column}.ilike.%${q}%`).join(','));
    const { data, error, count } = await query;
    if (error) throw mapDbError(error);
    return { items: data ?? [], total: count ?? 0 };
}

export async function createRegistry(resource: RegistryResource, body: unknown, actorId: string) {
    const cfg = REGISTRY[resource];
    const input = cfg.create.parse(body) as Record<string, unknown>;
    const { data, error } = await adminClient.from(cfg.table).insert({ ...toRow(input), created_by: actorId }).select('*').single();
    if (error) throw mapDbError(error);
    return data;
}

export async function updateRegistry(resource: RegistryResource, id: string, body: unknown) {
    const cfg = REGISTRY[resource];
    uuid.parse(id);
    const input = cfg.update.parse(body) as Record<string, unknown>;
    const { data, error } = await adminClient.from(cfg.table).update(toRow(input)).eq('id', id).select('*').maybeSingle();
    if (error) throw mapDbError(error);
    if (!data) throw new PueRegistryError('not_found', 'Record not found.', 404);
    return data;
}

export const assignBikeSchema = z.object({
    riderId: uuid, bikeId: uuid, saleType: z.enum(['full', 'instalment']),
    totalMinor: z.number().int().min(0).max(10_000_000_000), depositMinor: z.number().int().min(0).default(0),
}).strict().refine((v) => v.depositMinor <= v.totalMinor, { message: 'The deposit cannot be more than the total.', path: ['depositMinor'] })
    // A full sale is paid in one go, so the deposit must be the whole price or nothing is outstanding to track.
    .refine((v) => v.saleType === 'instalment' || v.depositMinor === 0 || v.depositMinor === v.totalMinor, { message: 'A full sale takes the whole price, or no deposit.', path: ['depositMinor'] });

export const endAssignmentSchema = z.object({
    outcome: z.enum(['completed', 'repossessed', 'cancelled']), reason: text(3, 200),
}).strict();

export async function assignBike(body: unknown, actorId: string) {
    const input = assignBikeSchema.parse(body);
    const { data, error } = await adminClient.rpc('pue_assign_bike', {
        p_rider_id: input.riderId, p_bike_id: input.bikeId, p_sale_type: input.saleType,
        p_total_minor: input.totalMinor, p_deposit_minor: input.depositMinor, p_actor: actorId,
    });
    if (error) throw mapDbError(error);
    return data;
}

export async function endAssignment(id: string, body: unknown) {
    uuid.parse(id);
    const input = endAssignmentSchema.parse(body);
    const { data, error } = await adminClient.rpc('pue_end_assignment', { p_id: id, p_outcome: input.outcome });
    if (error) throw mapDbError(error);
    return { assignment: data, reason: input.reason };
}

export async function listAssignments(opts: { limit: number; offset: number; status?: string }) {
    let query = adminClient.from('pue_bike_assignments')
        .select('*, pue_riders(full_name, phone), pue_bikes(serial_number)', { count: 'exact' })
        .order('created_at', { ascending: false }).range(opts.offset, opts.offset + opts.limit - 1);
    if (opts.status) query = query.eq('status', opts.status);
    const { data, error, count } = await query;
    if (error) throw mapDbError(error);
    return { items: data ?? [], total: count ?? 0 };
}
