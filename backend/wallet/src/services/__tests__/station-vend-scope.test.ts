import { describe, expect, it } from 'vitest';
import { assertStationVendAllowed, StationVendScopeError } from '../station-vend-scope.js';

describe('station vending boundary', () => {
    it('allows matching stations case-insensitively', () => {
        expect(() => assertStationVendAllowed('tunga', 'TUNGA')).not.toThrow();
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
