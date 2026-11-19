/**
 * Beverly PUE appliances: catalogue, stock units, sales to Beverly CRM customers, payments, faults.
 *
 * Customers are the existing Beverly CRM customers (public.customers), found by name, phone, email or
 * meter number. Money is recorded by an attendant (cash, transfer, POS); nothing here moves money or
 * switches hardware. A payment is only ever added, never edited.
 *
 * Used by: routes/pue-appliances.ts. Tables: supabase/migrations/20261118120000_pue_appliances.sql.
 */
import { z } from 'zod';
import { adminClient } from '../db/supabase.js';

export class PueApplianceError extends Error {
    constructor(public code: string, message: string, public statusCode: number) {
        super(message);
        this.name = 'PueApplianceError';
    }
}

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable().optional();
const uuid = z.string().uuid();
const money = z.number().int().min(0).max(10_000_000_000);

const typeBase = z.object({
    name: text(2, 120), category: z.enum(['fridge', 'grinder', 'freezer', 'other']).optional(),
    defaultPriceMinor: money.nullable().optional(), active: z.boolean().optional(), notes: optionalText(500),
});
const unitBase = z.object({
    typeId: uuid, serialNumber: text(3, 64), siteId: uuid.nullable().optional(),
    status: z.enum(['in_stock', 'faulty', 'retired']).optional(), notes: optionalText(500),
});
const update = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
    schema.partial().strict().refine((value) => Object.keys(value).length > 0, 'Send at least one field to change.');

export const APPLIANCE_RESOURCES = {
    types: { table: 'pue_appliance_types', create: typeBase.strict(), update: update(typeBase), search: ['name'], order: 'name', select: '*' },
    units: {
        table: 'pue_appliances', create: unitBase.strict(), update: update(unitBase), search: ['serial_number'], order: 'serial_number',
        select: '*, pue_appliance_types(name, category), pue_sites(name)',
    },
} as const;
export type ApplianceResource = keyof typeof APPLIANCE_RESOURCES;
export const isApplianceResource = (value: string): value is ApplianceResource => value in APPLIANCE_RESOURCES;

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toRow = (input: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined).map(([k, v]) => [snake(k), v]));

/** Database errors become safe messages. Raw errors never reach the client. */
export function mapDbError(error: { code?: string; message?: string } | null | undefined): PueApplianceError {
    switch (error?.code) {
        case '23505': return new PueApplianceError('duplicate', 'A record with that unique value already exists.', 409);
        case '23503': return new PueApplianceError('reference_not_found', 'A linked record does not exist.', 400);
        case '23514': case '22023': return new PueApplianceError('invalid_value', 'A value is outside what is allowed.', 400);
        case 'P0002': {
            const known: Record<string, [string, number]> = {
                appliance_not_found: ['That appliance does not exist.', 404],
                appliance_not_available: ['That appliance is not in stock.', 409],
                customer_not_found: ['That customer does not exist.', 404],
                customer_not_active: ['That customer is not active.', 409],
                meter_not_on_customer: ['That meter does not belong to this customer.', 400],
                sale_not_found: ['That sale does not exist.', 404],
                sale_not_active: ['That sale is not active.', 409],
                overpayment: ['That is more than the balance still owed.', 409],
                idempotency_conflict: ['That request key was already used for a different payment.', 409],
            };
            const hit = known[String(error?.message ?? '')];
            return hit ? new PueApplianceError(String(error?.message), hit[0], hit[1]) : new PueApplianceError('not_found', 'Record not found.', 404);
        }
        default:
            if (/relation .* does not exist|schema cache/i.test(String(error?.message ?? ''))) {
                return new PueApplianceError('appliances_unavailable', 'Appliances are not set up in this database yet. An administrator needs to apply the 20261118120000_pue_appliances database update.', 503);
            }
            return new PueApplianceError('appliances_failed', 'The appliance request could not be completed.', 503);
    }
}

type ListOpts = { limit: number; offset: number; q?: string; status?: string };

export async function listApplianceResource(resource: ApplianceResource, opts: ListOpts) {
    const cfg = APPLIANCE_RESOURCES[resource];
    let query = adminClient.from(cfg.table).select(cfg.select, { count: 'exact' }).order(cfg.order, { ascending: true }).range(opts.offset, opts.offset + opts.limit - 1);
    const q = opts.q?.trim().replace(/[%,()]/g, '');
    if (q) query = query.or(cfg.search.map((column) => `${column}.ilike.%${q}%`).join(','));
    if (opts.status) query = query.eq('status', opts.status);
    const { data, error, count } = await query;
    if (error) throw mapDbError(error);
    return { items: data ?? [], total: count ?? 0 };
}

export async function createApplianceResource(resource: ApplianceResource, body: unknown, actorId: string) {
    const cfg = APPLIANCE_RESOURCES[resource];
    const input = cfg.create.parse(body) as Record<string, unknown>;
    const { data, error } = await adminClient.from(cfg.table).insert({ ...toRow(input), created_by: actorId }).select('*').single();
    if (error) throw mapDbError(error);
    return data;
}

export async function updateApplianceResource(resource: ApplianceResource, id: string, body: unknown) {
    const cfg = APPLIANCE_RESOURCES[resource];
    uuid.parse(id);
    const input = cfg.update.parse(body) as Record<string, unknown>;
    const { data, error } = await adminClient.from(cfg.table).update(toRow(input)).eq('id', id).select('*').maybeSingle();
    if (error) throw mapDbError(error);
    if (!data) throw new PueApplianceError('not_found', 'Record not found.', 404);
    return data;
}

// ── Beverly CRM customer lookup (read-only) ──────────────────────────────────────────────────────
export async function searchCustomers(q: string) {
    const safe = q.trim().replace(/[%,()\\_]/g, '');
    if (safe.length < 2) throw new PueApplianceError('query_too_short', 'Type at least 2 characters to search customers.', 400);
    const found = new Map<string, Record<string, unknown>>();
    const byText = await adminClient.from('customers').select('id, full_name, phone, email, status')
        .or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`).limit(10);
    if (byText.error) throw mapDbError(byText.error);
    for (const row of byText.data ?? []) found.set((row as { id: string }).id, row as Record<string, unknown>);

    const byMeter = await adminClient.from('customer_meters').select('customer_id').ilike('meter_id', `%${safe}%`).limit(10);
    if (byMeter.error) throw mapDbError(byMeter.error);
    const extra = (byMeter.data ?? []).map((r) => (r as { customer_id: string }).customer_id).filter((id) => !found.has(id));
    if (extra.length) {
        const more = await adminClient.from('customers').select('id, full_name, phone, email, status').in('id', extra);
        if (more.error) throw mapDbError(more.error);
        for (const row of more.data ?? []) found.set((row as { id: string }).id, row as Record<string, unknown>);
    }
    const ids = [...found.keys()];
    const meters = ids.length ? await adminClient.from('customer_meters').select('customer_id, meter_id').in('customer_id', ids) : { data: [], error: null };
    if (meters.error) throw mapDbError(meters.error);
    return [...found.values()].slice(0, 10).map((c) => ({
        ...c, meters: (meters.data ?? []).filter((m) => (m as { customer_id: string }).customer_id === c.id).map((m) => (m as { meter_id: string }).meter_id),
    }));
}

// ── Sales ───────────────────────────────────────────────────────────────────────────────────────
const methodEnum = z.enum(['cash', 'transfer', 'pos']);

export const sellSchema = z.object({
    applianceId: uuid, customerId: uuid, meterId: optionalText(64), saleType: z.enum(['full', 'instalment']),
    totalMinor: money.refine((v) => v > 0, 'The price must be more than zero.'), depositMinor: money.default(0), depositMethod: methodEnum.default('cash'),
}).strict()
    .refine((v) => v.depositMinor <= v.totalMinor, { message: 'The deposit cannot be more than the price.', path: ['depositMinor'] })
    // A full sale is paid in one go: the whole price, or nothing taken yet.
    .refine((v) => v.saleType === 'instalment' || v.depositMinor === 0 || v.depositMinor === v.totalMinor, { message: 'A full sale takes the whole price, or no deposit.', path: ['depositMinor'] });

export const paymentSchema = z.object({ amountMinor: money.refine((v) => v > 0, 'The amount must be more than zero.'), method: methodEnum, reference: optionalText(80) }).strict();
export const endSaleSchema = z.object({ outcome: z.enum(['repossessed', 'cancelled']), reason: text(3, 200) }).strict();

export function requireIdempotencyKey(value: unknown): string {
    if (typeof value === 'string' && value.length >= 8 && value.length <= 120) return value;
    throw new PueApplianceError('idempotency_key_required', 'Send an Idempotency-Key header (8 to 120 characters).', 400);
}

export async function sellAppliance(body: unknown, actorId: string) {
    const input = sellSchema.parse(body);
    const { data, error } = await adminClient.rpc('pue_sell_appliance', {
        p_appliance_id: input.applianceId, p_customer_id: input.customerId, p_meter_id: input.meterId ?? null, p_sale_type: input.saleType,
        p_total_minor: input.totalMinor, p_deposit_minor: input.depositMinor, p_deposit_method: input.depositMethod, p_actor: actorId,
    });
    if (error) throw mapDbError(error);
    return data;
}

export async function recordAppliancePayment(saleId: string, body: unknown, key: string, actorId: string) {
    uuid.parse(saleId);
    const input = paymentSchema.parse(body);
    const { data, error } = await adminClient.rpc('pue_record_appliance_payment', {
        p_sale_id: saleId, p_amount_minor: input.amountMinor, p_method: input.method, p_reference: input.reference ?? null, p_key: key, p_actor: actorId,
    });
    if (error) throw mapDbError(error);
    return data;
}

export async function endApplianceSale(id: string, body: unknown) {
    uuid.parse(id);
    const input = endSaleSchema.parse(body);
    const { data, error } = await adminClient.rpc('pue_end_appliance_sale', { p_id: id, p_outcome: input.outcome });
    if (error) throw mapDbError(error);
    return { sale: data, reason: input.reason };
}

type SaleRow = { total_minor: number; pue_appliance_payments?: { amount_minor: number }[] } & Record<string, unknown>;

/** Adds paidMinor and balanceMinor, worked out from the recorded payments only. */
export function withBalance(row: SaleRow) {
    const { pue_appliance_payments: payments, ...rest } = row;
    const paidMinor = (payments ?? []).reduce((sum, p) => sum + Number(p.amount_minor), 0);
    return { ...rest, paidMinor, balanceMinor: Number(row.total_minor) - paidMinor };
}

const SALE_SELECT = '*, customers(full_name, phone), pue_appliances(serial_number, pue_appliance_types(name)), pue_appliance_payments(amount_minor)';

export async function listApplianceSales(opts: { limit: number; offset: number; status?: string }) {
    let query = adminClient.from('pue_appliance_sales').select(SALE_SELECT, { count: 'exact' })
        .order('created_at', { ascending: false }).range(opts.offset, opts.offset + opts.limit - 1);
    if (opts.status) query = query.eq('status', opts.status);
    const { data, error, count } = await query;
    if (error) throw mapDbError(error);
    return { items: (data ?? []).map((r) => withBalance(r as unknown as SaleRow)), total: count ?? 0 };
}

export async function getApplianceSale(id: string) {
    uuid.parse(id);
    const { data, error } = await adminClient.from('pue_appliance_sales')
        .select('*, customers(full_name, phone), pue_appliances(serial_number, pue_appliance_types(name)), pue_appliance_payments(id, amount_minor, method, reference, created_at)')
        .eq('id', id).maybeSingle();
    if (error) throw mapDbError(error);
    if (!data) throw new PueApplianceError('not_found', 'Record not found.', 404);
    const row = data as unknown as SaleRow & { pue_appliance_payments: Record<string, unknown>[] };
    const payments = [...row.pue_appliance_payments].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    return { ...withBalance(row), payments };
}

// ── Faults ──────────────────────────────────────────────────────────────────────────────────────
export const faultCreateSchema = z.object({ applianceId: uuid, summary: text(3, 300), severity: z.enum(['low', 'medium', 'high']).default('medium') }).strict();
export const faultUpdateSchema = z.object({ status: z.enum(['open', 'in_progress', 'resolved']), resolution: optionalText(500) }).strict()
    .refine((v) => v.status !== 'resolved' || Boolean(v.resolution), { message: 'Say how the fault was resolved.', path: ['resolution'] });

export async function listFaults(opts: { limit: number; offset: number; status?: string }) {
    let query = adminClient.from('pue_appliance_faults').select('*, pue_appliances(serial_number, pue_appliance_types(name))', { count: 'exact' })
        .order('created_at', { ascending: false }).range(opts.offset, opts.offset + opts.limit - 1);
    if (opts.status) query = query.eq('status', opts.status);
    const { data, error, count } = await query;
    if (error) throw mapDbError(error);
    return { items: data ?? [], total: count ?? 0 };
}

export async function createFault(body: unknown, actorId: string) {
    const input = faultCreateSchema.parse(body);
    const { data, error } = await adminClient.from('pue_appliance_faults')
        .insert({ appliance_id: input.applianceId, summary: input.summary, severity: input.severity, reported_by: actorId }).select('*').single();
    if (error) throw mapDbError(error);
    return data;
}

export async function updateFault(id: string, body: unknown) {
    uuid.parse(id);
    const input = faultUpdateSchema.parse(body);
    const { data, error } = await adminClient.from('pue_appliance_faults')
        .update({ status: input.status, resolution: input.status === 'resolved' ? input.resolution : null, resolved_at: input.status === 'resolved' ? new Date().toISOString() : null })
        .eq('id', id).select('*').maybeSingle();
    if (error) throw mapDbError(error);
    if (!data) throw new PueApplianceError('not_found', 'Record not found.', 404);
    return data;
}
