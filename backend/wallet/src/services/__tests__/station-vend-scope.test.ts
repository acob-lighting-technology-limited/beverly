import { describe, expect, it } from 'vitest';
import { assertStationVendAllowed, StationVendScopeError } from '../station-vend-scope.js';
import { stationDisplayLabel } from '@beverly/tokens/station-identity';
import { stationGeography } from '../../config/station-geography.js';

describe('station vending boundary', () => {
    it('allows matching stations case-insensitively', () => {
        expect(() => assertStationVendAllowed('tunga', 'TUNGA')).not.toThrow();
    });

    it('treats Mile 9 and Mile 9 & 10 as one upstream station', () => {
        expect(() => assertStationVendAllowed('MILE 9', 'MILE 9 & 10')).not.toThrow();
        expect(() => assertStationVendAllowed('MILE_9', 'MILE 9 AND 10')).not.toThrow();
        expect(() => assertStationVendAllowed('MILE 9 & 10', 'MILE 9')).not.toThrow();
        expect(() => assertStationVendAllowed('MILE 9', 'MILE 10')).toThrowError(
            expect.objectContaining<Partial<StationVendScopeError>>({ code: 'cross_station_vend_forbidden' }),
        );
        expect(stationDisplayLabel('MILE 9')).toBe('Mile 9 & 10');
        expect(stationDisplayLabel('MILE 9 & 10')).toBe('Mile 9 & 10');
        expect(stationDisplayLabel('MILE 10')).toBe('MILE 10');
        expect(stationGeography('MILE 9')).toEqual(stationGeography('MILE 9 & 10'));
        expect(() => assertStationVendAllowed('TUNGA', 'MILE 9 & 10')).toThrow(
            'This meter belongs to Mile 9 & 10. Your account is assigned to TUNGA.',
        );
    });

    it('rejects cross-station vending', () => {
        expect(() => assertStationVendAllowed('TUNGA', 'UMAISHA')).toThrowError(
            expect.objectContaining<Partial<StationVendScopeError>>({ code: 'cross_station_vend_forbidden' }),
        );
    });

    it('rejects missing station assignments', () => {
        expect(() => assertStationVendAllowed(null, 'TUNGA')).toThrowError(
            expect.objectContaining<Partial<StationVendScopeError>>({ code: 'station_assignment_required' }),
        );
    });

    it('normalizes SparkMeter site UUID to station code for vendor scope matching', () => {
        // OTU-COSTAIN site uuid: 0619f73f-922d-4ddd-afe5-901c2ae771f7
        expect(() => assertStationVendAllowed('0619f73f-922d-4ddd-afe5-901c2ae771f7', 'OTU-COSTAIN')).not.toThrow();
        expect(() => assertStationVendAllowed('OTU-COSTAIN', '0619f73f-922d-4ddd-afe5-901c2ae771f7')).not.toThrow();
        expect(() => assertStationVendAllowed('0619f73f-922d-4ddd-afe5-901c2ae771f7', '0619f73f-922d-4ddd-afe5-901c2ae771f7')).not.toThrow();
        // Cross-station with UUID
        expect(() => assertStationVendAllowed('0619f73f-922d-4ddd-afe5-901c2ae771f7', 'ADEBAYO')).toThrowError(
            expect.objectContaining<Partial<StationVendScopeError>>({ code: 'cross_station_vend_forbidden' }),
        );
    });
});
