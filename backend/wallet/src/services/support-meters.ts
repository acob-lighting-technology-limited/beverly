import { adminClient } from '../db/supabase.js';
import { z } from 'zod';

export interface SupportMeter { meter_id: string; station_id: string | null }
export const supportMeterSelection = z.array(z.object({
    meter_id: z.string().min(1).max(100),
    station_id: z.string().min(1).max(100).nullable(),
})).max(20);

async function readPages(makeQuery: () => any): Promise<any[]> {
    const result: any[] = [];
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await makeQuery().range(offset, offset + 999);
        if (error) throw error;
        result.push(...(data ?? []));
        if ((data ?? []).length < 1000) return result;
    }
}

export async function customerSupportMeters(customerId: string): Promise<SupportMeter[]> {
    const rows = await readPages(() => adminClient.from('customer_meters')
        .select('meter_id, station_id').eq('customer_id', customerId).eq('status', 'approved').order('id'));
    return normalizeMeters(rows);
}

export async function vendorSupportMeters(orgId: string, stationId?: string | null): Promise<SupportMeter[]> {
    const [sold, assigned] = await Promise.all([
        readPages(() => adminClient.from('purchase_orders').select('meter_id, station_id')
            .eq('actor_type', 'vendor').eq('actor_id', orgId).in('status', ['delivered', 'completed']).order('id')),
        stationId ? readPages(() => adminClient.from('meters').select('meter_sn, site_code')
            .ilike('site_code', stationId.replace(/[\\%_]/g, '\\$&')).order('id')) : Promise.resolve([]),
    ]);
    return normalizeMeters([...sold, ...assigned.map(row => ({ meter_id: row.meter_sn, station_id: row.site_code }))]);
}

function normalizeMeters(rows: any[]): SupportMeter[] {
    const unique = new Map<string, SupportMeter>();
    for (const row of rows) {
        const meter_id = String(row.meter_id ?? '').trim().toUpperCase();
        const station_id = row.station_id ? String(row.station_id).trim().toUpperCase() : null;
        if (meter_id) unique.set(JSON.stringify([meter_id, station_id]), { meter_id, station_id });
    }
    return [...unique.values()].sort((a, b) => a.meter_id.localeCompare(b.meter_id) || String(a.station_id).localeCompare(String(b.station_id)));
}

export function authorizeSupportMeters(requested: SupportMeter[], allowed: SupportMeter[]): SupportMeter[] | null {
    const keys = new Set(allowed.map(m => JSON.stringify([m.meter_id, m.station_id])));
    const requestedKeys = new Set(requested.map(m => JSON.stringify([m.meter_id, m.station_id])));
    if ([...requestedKeys].some(key => !keys.has(key))) return null;
    return allowed.filter(m => requestedKeys.has(JSON.stringify([m.meter_id, m.station_id])));
}
