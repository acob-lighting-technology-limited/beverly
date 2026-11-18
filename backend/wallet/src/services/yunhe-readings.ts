/**
 * The few Yunhe battery fields the backend needs to choose which battery to offer a rider.
 *
 * UNVERIFIED MAPPING (no Yunhe API docs yet). These candidate key lists must stay identical to the
 * ones in apps/battery-swap/src/services/yunhe-normalize.js; a test compares them. A missing or
 * unreadable field is null, never a default, so a battery with no charge reading is never offered.
 */

export const READING_KEYS = {
    batteryNumber: ['id', 'battery_id', 'batteryId', 'battery_number', 'batteryNumber'],
    serialNumber: ['sn', 'serial', 'serial_number', 'serialNumber'],
    soc: ['soc', 'battery_life', 'batteryLife', 'electricity'],
    updatedAt: ['last_time', 'update_time', 'updateTime', 'time'],
    online: ['online', 'online_status', 'onlineStatus', 'is_online'],
} as const;

export interface LiveReading {
    batteryNumber: string | null;
    serialNumber: string | null;
    soc: number | null;
    online: boolean | null;
    updatedAt: string | null;
}

function pick(raw: Record<string, unknown>, keys: readonly string[]): unknown {
    for (const key of keys) {
        const value = raw[key];
        if (value !== null && value !== undefined && value !== '') return value;
    }
    return null;
}

function toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function toOnline(value: unknown): boolean | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value;
    const text = String(value).trim().toLowerCase();
    if (text === '1' || text === 'true' || text === 'online') return true;
    if (text === '0' || text === 'false' || text === 'offline') return false;
    return null;
}

function toIso(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    const time = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(String(value).replace(' ', 'T'));
    const date = new Date(time);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function readLiveBattery(raw: Record<string, unknown>): LiveReading {
    const text = (value: unknown) => (value === null ? null : String(value));
    return {
        batteryNumber: text(pick(raw, READING_KEYS.batteryNumber)),
        serialNumber: text(pick(raw, READING_KEYS.serialNumber)),
        soc: toNumber(pick(raw, READING_KEYS.soc)),
        online: toOnline(pick(raw, READING_KEYS.online)),
        updatedAt: toIso(pick(raw, READING_KEYS.updatedAt)),
    };
}

export interface BatteryRow { id: string; battery_number: string; serial_number: string | null }
export interface PickRules { minSoc: number; maxReadingAgeMinutes: number }
export type PickResult =
    | { ok: true; battery: BatteryRow; reading: LiveReading }
    | { ok: false; reason: 'no_batteries' | 'no_live_readings' | 'none_charged'; checked: number };

/**
 * Chooses the most charged free battery. Only batteries with a charge reading at or above the minimum,
 * not known to be offline, and read recently enough are eligible. No reading means not eligible.
 */
export function pickCharged(candidates: BatteryRow[], liveRecords: Record<string, unknown>[], rules: PickRules, now = Date.now()): PickResult {
    if (!candidates.length) return { ok: false, reason: 'no_batteries', checked: 0 };
    const readings = liveRecords.map(readLiveBattery);
    const withReading = candidates.map((battery) => ({
        battery,
        reading: readings.find((r) => (r.batteryNumber && r.batteryNumber === battery.battery_number) || (r.serialNumber && battery.serial_number && r.serialNumber === battery.serial_number)) ?? null,
    }));
    if (!withReading.some((c) => c.reading)) return { ok: false, reason: 'no_live_readings', checked: candidates.length };

    const eligible = withReading.filter((c): c is { battery: BatteryRow; reading: LiveReading } => {
        const r = c.reading;
        if (!r || r.soc === null || r.soc < rules.minSoc || r.online === false || !r.updatedAt) return false;
        return now - Date.parse(r.updatedAt) <= rules.maxReadingAgeMinutes * 60_000;
    });
    if (!eligible.length) return { ok: false, reason: 'none_charged', checked: candidates.length };
    eligible.sort((a, b) => (b.reading.soc! - a.reading.soc!) || a.battery.battery_number.localeCompare(b.battery.battery_number));
    return { ok: true, battery: eligible[0]!.battery, reading: eligible[0]!.reading };
}
