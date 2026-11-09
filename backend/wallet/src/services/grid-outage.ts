import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const servicePath = path.resolve(__dirname, '../../../../backend/src/services/grid-outage-service.js');
const service = require(servicePath);

export interface GridOutageIncident {
    id: string;
    stationId: string;
    gatewayId: string;
    severity: string;
    title: string;
    sopGuidance: string;
    isGatewayDown: boolean;
    connectedNodes: number;
    offlineNodes: number;
    offlineRatio: number;
    packetDeliveryRate: number;
    rssiDbm: number;
    downtimeMinutes: number;
    eueKwh: number;
    revenueLossNaira: number;
    isFlapping: boolean;
    flappingTransitions: number;
    startedAt: string;
    updatedAt: string;
    status: 'active' | 'resolved';
    acknowledged?: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
}

export function listActiveGridOutages(): GridOutageIncident[] {
    return service.listActiveOutages();
}

export function evaluateGridOutage(params: any): GridOutageIncident | null {
    return service.evaluateGridOutage(params);
}

export function acknowledgeGridOutage(incidentId: string, actor?: string, notes?: string): boolean {
    return service.acknowledgeOutage(incidentId, actor, notes);
}

export function silenceGridOutage(incidentId: string, durationMs?: number): boolean {
    return service.silenceOutage(incidentId, durationMs);
}

export function resolveGridOutage(incidentId: string, recoveryMetrics?: any): any {
    return service.resolveOutageIncident(incidentId, recoveryMetrics);
}
