export type StationVendScopeErrorCode =
    | 'station_assignment_required'
    | 'meter_station_unavailable'
    | 'cross_station_vend_forbidden';

export class StationVendScopeError extends Error {
    constructor(message: string, public readonly code: StationVendScopeErrorCode) {
        super(message);
        this.name = 'StationVendScopeError';
    }
}

const SPARKMETER_SITE_TO_STATION: Record<string, string> = {
    '0619f73f-922d-4ddd-afe5-901c2ae771f7': 'OTU-COSTAIN',
    '3a1bb0d2-4521-4f24-bab9-8426d4827480': 'ADEBAYO',
    '655ace31-6683-4521-b8ed-fcb7b32b287c': 'OLOYAN',
    '5c2114b8-9d56-42c1-92de-6180dada42a1': 'SULE',
    '31454d1f-6cf7-49d2-9567-eb506079ca60': 'ADEWALE',
    'a790a744-ee49-4a3f-8995-7843439f4c6f': 'MILE-13',
    'ca0e1988-41c8-4298-a229-1ec1c2f19585': 'AJEGUNLE',
    'e99e124f-c0a2-4f71-b659-4cf3f7b36cba': 'ONIPANU',
};

export function normalizeStationId(value: string | null | undefined): string {
    const raw = String(value ?? '').trim().toLowerCase();
    const resolved = SPARKMETER_SITE_TO_STATION[raw] || value;
    return String(resolved ?? '').trim().toUpperCase().replace(/[\s_\-&]+/g, '');
}

export function assertStationVendAllowed(
    assignedStationId: string | null | undefined,
    meterStationId: string | null | undefined,
): void {
    const assigned = normalizeStationId(assignedStationId);
    const meter = normalizeStationId(meterStationId);

    if (!assigned) {
        throw new StationVendScopeError(
            'Your station is not assigned. Contact Beverly support before vending.',
            'station_assignment_required',
        );
    }
    if (!meter || meter === 'UNKNOWN') {
        throw new StationVendScopeError(
            'The meter station could not be verified. No purchase was started.',
            'meter_station_unavailable',
        );
    }
    if (assigned !== meter) {
        throw new StationVendScopeError(
            `This meter belongs to ${meter}. Your account is assigned to ${assigned}.`,
            'cross_station_vend_forbidden',
        );
    }
}
