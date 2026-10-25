import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminClient } from '../../db/supabase.js';
import {
    recordDurableOemCommand,
    claimCommandDispatch,
    completeCommandOutcome,
    isHoldProtectedByOemCommand,
    type OemCommandRecord,
} from '../oem-command-service.js';

describe('durable OEM command service', () => {
    let mockCommands: Map<string, OemCommandRecord>;
    let mockAttempts: Array<Record<string, unknown>>;

    beforeEach(() => {
        mockCommands = new Map();
        mockAttempts = [];
        vi.restoreAllMocks();

        vi.spyOn(adminClient, 'from').mockImplementation((table: string): any => {
            if (table === 'oem_commands') {
                return {
                    select: (_cols?: string) => ({
                        eq: (col: string, val: string) => ({
                            eq: (c2: string, v2: string) => ({
                                eq: (c3: string, v3: string) => ({
                                    maybeSingle: async () => {
                                        for (const cmd of mockCommands.values()) {
                                            if (cmd.oem_installation_id === val
                                                && cmd.operation_key === v2
                                                && cmd.idempotency_key === v3) {
                                                return { data: cmd, error: null };
                                            }
                                        }
                                        return { data: null, error: null };
                                    },
                                }),
                            }),
                            in: (c2: string, values: string[]) => ({
                                contains: (c3: string, payload: Record<string, string>) => ({
                                    limit: async () => {
                                        const matches = Array.from(mockCommands.values()).filter((cmd) => (
                                            values.includes(cmd.status) && cmd.canonical_request.holdId === payload.holdId
                                        ));
                                        return { data: matches, error: null };
                                    },
                                }),
                            }),
                            maybeSingle: async () => {
                                const cmd = mockCommands.get(val);
                                return { data: cmd ?? null, error: null };
                            },
                        }),
                        in: (col: string, values: string[]) => ({
                            contains: (_c: string, payload: Record<string, string>) => ({
                                limit: async () => {
                                    const matches = Array.from(mockCommands.values()).filter((cmd) => (
                                        values.includes(cmd.status) && cmd.canonical_request.holdId === payload.holdId
                                    ));
                                    return { data: matches, error: null };
                                },
                            }),
                        }),
                    }),
                    insert: (row: any) => ({
                        select: () => ({
                            single: async () => {
                                const id = row.id ?? `cmd-${mockCommands.size + 1}`;
                                const record: OemCommandRecord = {
                                    id,
                                    oem_installation_id: row.oem_installation_id,
                                    operation_key: row.operation_key,
                                    idempotency_key: row.idempotency_key,
                                    request_fingerprint: row.request_fingerprint,
                                    canonical_request: row.canonical_request,
                                    status: row.status ?? 'pending',
                                    provider_reference: row.provider_reference ?? null,
                                    normalized_error_code: null,
                                    normalized_error_message: null,
                                    lease_owner: null,
                                    lease_token: null,
                                    lease_expires_at: null,
                                    next_reconcile_at: null,
                                    attempt_count: 0,
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                    completed_at: null,
                                };
                                mockCommands.set(id, record);
                                return { data: record, error: null };
                            },
                        }),
                    }),
                    update: (patch: any) => ({
                        eq: (col: string, val: string) => ({
                            eq: (c2?: string, v2?: any) => ({
                                eq: (_c3?: string, _v3?: any) => ({
                                    select: () => ({
                                        single: async () => {
                                            const existing = mockCommands.get(val);
                                            if (!existing) return { data: null, error: new Error('not found') };
                                            if (c2 && existing[c2 as keyof OemCommandRecord] !== v2) {
                                                return { data: null, error: null };
                                            }
                                            const updated = { ...existing, ...patch };
                                            mockCommands.set(val, updated);
                                            return { data: updated, error: null };
                                        },
                                    }),
                                }),
                                select: () => ({
                                    single: async () => {
                                        const existing = mockCommands.get(val);
                                        if (!existing) return { data: null, error: new Error('not found') };
                                        if (c2 && existing[c2 as keyof OemCommandRecord] !== v2) {
                                            return { data: null, error: null };
                                        }
                                        const updated = { ...existing, ...patch };
                                        mockCommands.set(val, updated);
                                        return { data: updated, error: null };
                                    },
                                }),
                            }),
                            select: () => ({
                                single: async () => {
                                    const existing = mockCommands.get(val);
                                    if (!existing) return { data: null, error: new Error('not found') };
                                    const updated = { ...existing, ...patch };
                                    mockCommands.set(val, updated);
                                    return { data: updated, error: null };
                                },
                            }),
                        }),
                    }),
                };
            }
            if (table === 'oem_command_attempts') {
                return {
                    insert: async (row: any) => {
                        mockAttempts.push(row);
                        return { data: row, error: null };
                    },
                    update: (patch: any) => ({
                        eq: (_col: string, val: string) => ({
                            eq: (_col2: string, attemptNumber: number) => ({
                                select: async () => {
                                    const attempt = mockAttempts.find((a) => (
                                        a.oem_command_id === val && a.attempt_number === attemptNumber
                                    ));
                                    if (attempt) Object.assign(attempt, patch);
                                    return { data: attempt, error: null };
                                },
                            }),
                        }),
                    }),
                };
            }
            throw new Error(`Unexpected table ${table}`);
        });
    });

    it('creates a durable OEM command and returns existing on duplicate idempotency key with matching fingerprint', async () => {
        const canonical = {
            commandId: 'cmd-1',
            purchaseOrderId: 'order-1',
            holdId: 'hold-1',
            externalCustomerId: 'cust-1',
            amountMinor: 5000,
            currency: 'NGN',
        };

        const created = await recordDurableOemCommand({
            installationId: '53f12390-74f7-40b3-b1db-e907c256986d',
            operationKey: 'vending.direct_credit',
            idempotencyKey: 'idem-1',
            canonicalRequest: canonical,
        });

        expect(created.id).toBeDefined();
        expect(created.status).toBe('pending');
        expect(created.attempt_count).toBe(0);

        // Replaying with identical payload returns existing
        const replayed = await recordDurableOemCommand({
            installationId: '53f12390-74f7-40b3-b1db-e907c256986d',
            operationKey: 'vending.direct_credit',
            idempotencyKey: 'idem-1',
            canonicalRequest: canonical,
        });

        expect(replayed.id).toBe(created.id);
    });

    it('rejects duplicate idempotency key when request payload differs', async () => {
        await recordDurableOemCommand({
            installationId: '53f12390-74f7-40b3-b1db-e907c256986d',
            operationKey: 'vending.direct_credit',
            idempotencyKey: 'idem-2',
            canonicalRequest: { commandId: 'c1', holdId: 'h1', amountMinor: 5000 },
        });

        await expect(recordDurableOemCommand({
            installationId: '53f12390-74f7-40b3-b1db-e907c256986d',
            operationKey: 'vending.direct_credit',
            idempotencyKey: 'idem-2',
            canonicalRequest: { commandId: 'c1', holdId: 'h1', amountMinor: 9999 },
        })).rejects.toThrow('idempotency_payload_mismatch');
    });

    it('atomically claims once-only dispatch and blocks duplicate submissions', async () => {
        const cmd = await recordDurableOemCommand({
            installationId: '53f12390-74f7-40b3-b1db-e907c256986d',
            operationKey: 'vending.direct_credit',
            idempotencyKey: 'idem-3',
            canonicalRequest: { commandId: 'c3', holdId: 'h3', amountMinor: 5000 },
        });

        const firstClaim = await claimCommandDispatch(cmd.id);
        expect(firstClaim.canDispatch).toBe(true);
        expect(firstClaim.attemptNumber).toBe(1);

        // Second attempt to claim dispatch fails closed: submit at most once!
        const secondClaim = await claimCommandDispatch(cmd.id);
        expect(secondClaim.canDispatch).toBe(false);
    });

    it('records confirmed success with provider reference and completed timestamp', async () => {
        const cmd = await recordDurableOemCommand({
            installationId: '53f12390-74f7-40b3-b1db-e907c256986d',
            operationKey: 'vending.direct_credit',
            idempotencyKey: 'idem-4',
            canonicalRequest: { commandId: 'c4', holdId: 'h4', amountMinor: 5000 },
        });
        await claimCommandDispatch(cmd.id);

        const updated = await completeCommandOutcome(cmd.id, 1, {
            status: 'confirmed_success',
            providerReference: 'provider-ref-123',
        });

        expect(updated.status).toBe('succeeded');
        expect(updated.provider_reference).toBe('provider-ref-123');
        expect(updated.completed_at).toBeDefined();
    });

    it('protects ambiguous holds from automated hold sweeps', async () => {
        await recordDurableOemCommand({
            installationId: '53f12390-74f7-40b3-b1db-e907c256986d',
            operationKey: 'vending.direct_credit',
            idempotencyKey: 'idem-5',
            canonicalRequest: { commandId: 'c5', holdId: 'hold-ambiguous-1', amountMinor: 5000 },
        });

        // Not claimed yet (pending)
        expect(await isHoldProtectedByOemCommand('hold-ambiguous-1')).toBe(false);

        // Claimed -> leased
        const cmd = Array.from(mockCommands.values()).find((c) => c.canonical_request.holdId === 'hold-ambiguous-1')!;
        await claimCommandDispatch(cmd.id);

        // Now in 'leased' status -> protected!
        expect(await isHoldProtectedByOemCommand('hold-ambiguous-1')).toBe(true);

        // Timeout occurs -> completed as 'unknown' -> still protected!
        await completeCommandOutcome(cmd.id, 1, { status: 'unknown' });
        expect(await isHoldProtectedByOemCommand('hold-ambiguous-1')).toBe(true);
    });
});
