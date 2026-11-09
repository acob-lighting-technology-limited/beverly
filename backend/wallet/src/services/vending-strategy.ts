import type { MeterInfo } from './token-engine.js';

export function isDirectCreditMeter(meter: Pick<MeterInfo, 'vendingStrategy' | 'oemId'>): boolean {
    if (meter.vendingStrategy) return meter.vendingStrategy === 'direct_credit';
    return meter.oemId === 'sparkmeter' || meter.oemId === 'e1532892-e09d-44f9-a9cb-b99b5c9ebecf';
}
