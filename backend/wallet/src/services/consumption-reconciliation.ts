import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const servicePath = path.resolve(__dirname, '../../../../backend/src/services/consumption-reconciliation-engine.js');
const engine = require(servicePath);

export interface GapAuditResult {
    stationId: string;
    dateRange: { from: string; to: string; daysCount: number };
    activeMeterCount: number;
    expectedMeterDays: number;
    actualMeterDays: number;
    missingMeterDays: number;
    completenessPercent: number;
    darkMeterCount: number;
    hasGaps: boolean;
    missingKeys: Array<{ stationId: string; meterId: string; date: string }>;
    meterCoverage: Record<string, {
        presentDays: number;
        missingDays: number;
        coveragePercent: number;
        missingDates: string[];
        isCompletelyDark: boolean;
    }>;
}

export interface TechnicalLossResult {
    stationId: string;
    feederEnergyKwh: number;
    customerEnergyKwh: number;
    lossKwh: number;
    lossPercent: number;
    financialLossNaira: number;
    severity: 'NORMAL' | 'ELEVATED_LOSS' | 'CRITICAL_THEFT_RISK' | 'ANOMALY_NEGATIVE_LOSS';
    diagnosis: string;
    recommendedAction: string;
    assessedAt: string;
}

export function auditStationGaps(
    stationId: string,
    activeMeterIds: string[],
    storedReadings: any[],
    from: string,
    to: string,
): GapAuditResult {
    return engine.auditStationReadingGaps(stationId, activeMeterIds, storedReadings, from, to);
}

export function compareRegisters(sourceReadings: any[], storedReadings: any[]): any {
    return engine.compareSourceVsStoredRegisters(sourceReadings, storedReadings);
}

export function evaluateTechnicalLoss(params: {
    feederEnergyKwh: number;
    customerEnergyKwh: number;
    tariffPerKwh?: number;
    stationId?: string;
}): TechnicalLossResult {
    return engine.calculateTechnicalLoss(params);
}
