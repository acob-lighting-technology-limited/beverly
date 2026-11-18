import { describe, expect, it } from 'vitest';
import { pickCharged, READING_KEYS, readLiveBattery, type BatteryRow } from '../yunhe-readings.js';
// The frontend's field map. The backend list below must never drift from it.
import { FIELD_KEYS } from '../../../../../apps/battery-swap/src/services/yunhe-normalize.js';

const NOW = Date.parse('2026-11-17T12:00:00Z');
const fresh = '2026-11-17T11:30:00Z';
const rules = { minSoc: 90, maxReadingAgeMinutes: 120 };
const bat = (n: string, sn: string | null = null): BatteryRow => ({ id: `id-${n}`, battery_number: n, serial_number: sn });

describe('field map stays in step with the frontend', () => {
    it.each(Object.keys(READING_KEYS) as (keyof typeof READING_KEYS)[])('%s uses the same provider keys', (field) => {
        expect([...READING_KEYS[field]]).toEqual((FIELD_KEYS as Record<string, string[]>)[field]);
    });
});

describe('readLiveBattery', () => {
    it('reads recognised fields and treats the rest as unknown, never as a default', () => {
        expect(readLiveBattery({ id: 'BT1', sn: 'S1', soc: '95', online: 1, last_time: fresh })).toEqual({
            batteryNumber: 'BT1', serialNumber: 'S1', soc: 95, online: true, updatedAt: '2026-11-17T11:30:00.000Z',
        });
        expect(readLiveBattery({})).toEqual({ batteryNumber: null, serialNumber: null, soc: null, online: null, updatedAt: null });
        expect(readLiveBattery({ id: 'B', soc: 'abc', online: 'maybe', last_time: 'garbage' })).toMatchObject({ soc: null, online: null, updatedAt: null });
    });
});

describe('pickCharged', () => {
    it('offers the most charged eligible battery', () => {
        const result = pickCharged([bat('A'), bat('B'), bat('C')], [{ id: 'A', soc: 92, last_time: fresh }, { id: 'B', soc: 99, last_time: fresh }, { id: 'C', soc: 95, last_time: fresh }], rules, NOW);
        expect(result).toMatchObject({ ok: true, battery: { battery_number: 'B' }, reading: { soc: 99 } });
    });

    it('matches by serial number when the battery number differs', () => {
        const result = pickCharged([bat('A', 'S-A')], [{ sn: 'S-A', soc: 97, last_time: fresh }], rules, NOW);
        expect(result).toMatchObject({ ok: true, battery: { battery_number: 'A' } });
    });

    it('never offers a battery below the minimum, offline, unread, or with an old reading', () => {
        const live = [
            { id: 'LOW', soc: 60, last_time: fresh },
            { id: 'OFF', soc: 99, online: 0, last_time: fresh },
            { id: 'NOTIME', soc: 99 },
            { id: 'OLD', soc: 99, last_time: '2026-11-17T08:00:00Z' },
            { id: 'NOSOC', last_time: fresh },
        ];
        const result = pickCharged(['LOW', 'OFF', 'NOTIME', 'OLD', 'NOSOC', 'MISSING'].map((n) => bat(n)), live, rules, NOW);
        expect(result).toEqual({ ok: false, reason: 'none_charged', checked: 6 });
    });

    it('explains why nothing can be offered', () => {
        expect(pickCharged([], [], rules, NOW)).toEqual({ ok: false, reason: 'no_batteries', checked: 0 });
        expect(pickCharged([bat('A')], [], rules, NOW)).toEqual({ ok: false, reason: 'no_live_readings', checked: 1 });
        expect(pickCharged([bat('A')], [{ id: 'OTHER', soc: 99, last_time: fresh }], rules, NOW)).toEqual({ ok: false, reason: 'no_live_readings', checked: 1 });
    });

    it('breaks a tie by battery number so the choice is stable', () => {
        const result = pickCharged([bat('B'), bat('A')], [{ id: 'A', soc: 95, last_time: fresh }, { id: 'B', soc: 95, last_time: fresh }], rules, NOW);
        expect(result).toMatchObject({ ok: true, battery: { battery_number: 'A' } });
    });
});
