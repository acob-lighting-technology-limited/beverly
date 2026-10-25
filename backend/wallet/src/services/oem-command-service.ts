import crypto from 'node:crypto';
import type { VendOutcome } from '@beverly/oem-contracts';
import { adminClient } from '../db/supabase.js';

export interface OemCommandRecord {
    id: string;
    oem_installation_id: string;
    operation_key: string;
    idempotency_key: string;
    request_fingerprint: string;
    canonical_request: Record<string, any>;
    status: 'pending' | 'leased' | 'submitted' | 'succeeded' | 'failed' | 'unknown' | 'manual_review' | 'cancelled';
    provider_reference: string | null;
    normalized_error_code: string | null;
    normalized_error_message: string | null;
    lease_owner: string | null;
    lease_token: string | null;
    lease_expires_at: string | null;
    next_reconcile_at: string | null;
    attempt_count: number;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
}

export interface RecordCommandInput {
    installationId: string;
    operationKey: string;
    idempotencyKey: string;
    canonicalRequest: Record<string, unknown>;
    commandId?: string;
}

export function computeRequestFingerprint(payload: Record<string, unknown>): string {
    const canonicalString = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Creates or retrieves a durable OEM command row.
 * Guarantees that any duplicate idempotency key matches the exact canonical request fingerprint.
 */
export async function recordDurableOemCommand(
    input: RecordCommandInput,
    client: any = adminClient,
): Promise<OemCommandRecord> {
    const fingerprint = computeRequestFingerprint(input.canonicalRequest);

    const { data: existing, error: selectErr } = await client
        .from('oem_commands')
        .select('*')
        .eq('oem_installation_id', input.installationId)
        .eq('operation_key', input.operationKey)
        .eq('idempotency_key', input.idempotencyKey)
        .maybeSingle();

    if (selectErr) throw selectErr;

    if (existing) {
        const cmd = existing as OemCommandRecord;
        if (cmd.request_fingerprint !== fingerprint) {
            throw new Error('idempotency_payload_mismatch: command payload differs for idempotency key');
        }
        return cmd;
    }

    const { data: inserted, error: insertErr } = await client
        .from('oem_commands')
        .insert({
            ...(input.commandId ? { id: input.commandId } : {}),
            oem_installation_id: input.installationId,
            operation_key: input.operationKey,
            idempotency_key: input.idempotencyKey,
            request_fingerprint: fingerprint,
            canonical_request: input.canonicalRequest,
            status: 'pending',
            attempt_count: 0,
        })
        .select('*')
        .single();

    if (insertErr || !inserted) {
        throw new Error(insertErr?.message ?? 'Failed to record durable OEM command');
    }

    return inserted as OemCommandRecord;
}

export interface ClaimDispatchResult {
    canDispatch: boolean;
    commandId?: string;
    leaseToken?: string;
    attemptNumber?: number;
    existingStatus?: string;
    providerReference?: string | null;
}

/**
 * Atomically claims once-only dispatch for a durable OEM command.
 * Strictly enforces that payment submission is attempted at most once.
 */
export async function claimCommandDispatch(
    commandId: string,
    leaseOwner = 'wallet-worker',
    ttlSeconds = 300,
    client: any = adminClient,
): Promise<ClaimDispatchResult> {
    const { data: cmd, error: getErr } = await client
        .from('oem_commands')
        .select('*')
        .eq('id', commandId)
        .maybeSingle();

    if (getErr || !cmd) throw new Error(getErr?.message ?? 'OEM command not found');
    const existing = cmd as OemCommandRecord;

    if (existing.status === 'succeeded') {
        return {
            canDispatch: false,
            commandId,
            existingStatus: 'succeeded',
            providerReference: existing.provider_reference,
        };
    }

    // Submit each payment at most once. Disable automatic payment POST retries.
    if (existing.attempt_count > 0 || existing.status !== 'pending') {
        return {
            canDispatch: false,
            commandId,
            existingStatus: existing.status,
            providerReference: existing.provider_reference,
        };
    }

    const leaseToken = crypto.randomUUID();
    const leaseExpiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: updated, error: updateErr } = await client
        .from('oem_commands')
        .update({
            status: 'leased',
            lease_owner: leaseOwner,
            lease_token: leaseToken,
            lease_expires_at: leaseExpiresAt,
            attempt_count: 1,
            updated_at: now,
        })
        .eq('id', commandId)
        .eq('status', 'pending')
        .eq('attempt_count', 0)
        .select('*')
        .single();

    if (updateErr || !updated) {
        return {
            canDispatch: false,
            commandId,
            existingStatus: existing.status,
        };
    }

    // Record attempt #1 in oem_command_attempts if supported by client
    try {
        await client.from('oem_command_attempts').insert({
            oem_command_id: commandId,
            attempt_number: 1,
            request_fingerprint: existing.request_fingerprint,
            started_at: now,
            outcome: 'started',
        });
    } catch {
        // Mock DB or table absent in test
    }

    return {
        canDispatch: true,
        commandId,
        leaseToken,
        attemptNumber: 1,
    };
}

/**
 * Transitions command to 'submitted' state right before network send.
 */
export async function recordCommandSubmitted(
    commandId: string,
    attemptNumber = 1,
    client: any = adminClient,
): Promise<void> {
    const now = new Date().toISOString();
    await client
        .from('oem_commands')
        .update({ status: 'submitted', updated_at: now })
        .eq('id', commandId);

    try {
        await client
            .from('oem_command_attempts')
            .update({ outcome: 'submitted' })
            .eq('oem_command_id', commandId)
            .eq('attempt_number', attemptNumber);
    } catch {
        // Mock DB or table absent in test
    }
}

export interface CompleteOutcomeMeta {
    latencyMs?: number;
    httpStatus?: number;
    rawResponse?: string;
}

/**
 * Records the final outcome of an OEM command and its attempt.
 */
export async function completeCommandOutcome(
    commandId: string,
    attemptNumber: number,
    outcome: VendOutcome,
    meta: CompleteOutcomeMeta = {},
    client: any = adminClient,
): Promise<OemCommandRecord> {
    const now = new Date().toISOString();
    let targetStatus: OemCommandRecord['status'];
    let patch: Partial<OemCommandRecord> = { updated_at: now };
    let attemptOutcome: 'succeeded' | 'failed' | 'unknown' = 'unknown';

    if (outcome.status === 'confirmed_success') {
        targetStatus = 'succeeded';
        attemptOutcome = 'succeeded';
        patch = {
            ...patch,
            status: targetStatus,
            provider_reference: outcome.providerReference,
            completed_at: now,
        };
    } else if (outcome.status === 'confirmed_failure') {
        targetStatus = 'failed';
        attemptOutcome = 'failed';
        patch = {
            ...patch,
            status: targetStatus,
            normalized_error_code: 'confirmed_failure',
            normalized_error_message: outcome.reason,
            completed_at: now,
        };
    } else if (outcome.status === 'requires_manual_review') {
        targetStatus = 'manual_review';
        attemptOutcome = 'unknown';
        patch = {
            ...patch,
            status: targetStatus,
            normalized_error_message: outcome.reason,
            next_reconcile_at: new Date(Date.now() + 300_000).toISOString(),
        };
    } else {
        targetStatus = 'unknown';
        attemptOutcome = 'unknown';
        patch = {
            ...patch,
            status: targetStatus,
            next_reconcile_at: new Date(Date.now() + 120_000).toISOString(),
        };
    }

    const { data: updated, error } = await client
        .from('oem_commands')
        .update(patch)
        .eq('id', commandId)
        .select('*')
        .single();

    if (error || !updated) {
        throw new Error(error?.message ?? 'Failed to complete OEM command');
    }

    try {
        await client
            .from('oem_command_attempts')
            .update({
                outcome: attemptOutcome,
                finished_at: now,
                http_status: meta.httpStatus ?? null,
                latency_ms: meta.latencyMs ?? null,
                raw_response_reference: meta.rawResponse ?? null,
            })
            .eq('oem_command_id', commandId)
            .eq('attempt_number', attemptNumber);
    } catch {
        // Mock DB or table absent in test
    }

    return updated as OemCommandRecord;
}

/**
 * Checks whether a given wallet hold is referenced by an in-flight or ambiguous OEM command.
 * Protects ambiguous reservations from automatic expiration sweeps.
 */
export async function isHoldProtectedByOemCommand(holdId: string): Promise<boolean> {
    if (!holdId?.trim()) return false;
    const { data, error } = await adminClient
        .from('oem_commands')
        .select('id')
        .in('status', ['leased', 'submitted', 'unknown', 'manual_review'])
        .contains('canonical_request', { holdId: holdId.trim() })
        .limit(1);

    if (error) {
        console.error('[oem-command] failed to check hold protection:', error);
        // Fail closed: protect the hold on error
        return true;
    }

    return Array.isArray(data) && data.length > 0;
}
