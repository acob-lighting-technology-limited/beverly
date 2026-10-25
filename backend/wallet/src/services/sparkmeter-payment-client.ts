import type { VendOutcome } from '@beverly/oem-contracts';
import {
    buildSparkMeterAuthHeaders,
    buildSparkMeterPaymentLookupRequest,
    buildSparkMeterPaymentRequest,
    parseSparkMeterPaymentResponse,
    type SparkMeterPaymentInput,
} from '../adapters/sparkmeter-v1.js';
import { validateOemEndpoint } from './oem-endpoint-security.js';

export interface SparkMeterClientInput extends SparkMeterPaymentInput {
    readonly baseUrl: string;
    readonly approvedHostnames: readonly string[];
    readonly apiKey: string;
    readonly apiSecret: string;
}

export interface SparkMeterClientDependencies {
    readonly fetchFn?: typeof fetch;
    readonly validateEndpoint?: typeof validateOemEndpoint;
    readonly wait?: (milliseconds: number) => Promise<void>;
}

const sleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Execute exactly one payment POST to SparkMeter Koios v1.
 * Automatic POST retries are strictly disabled; any timeout, 429, 5xx, or ambiguous response
 * falls back immediately to read-only lookup by the immutable command ID.
 */
export async function submitSparkMeterPayment(
    input: SparkMeterClientInput,
    deps: SparkMeterClientDependencies = {},
): Promise<VendOutcome> {
    const validate = deps.validateEndpoint ?? validateOemEndpoint;
    const fetchFn = deps.fetchFn ?? fetch;

    const origin = await validate(input.baseUrl, input.approvedHostnames);
    const headers = buildSparkMeterAuthHeaders(input.apiKey, input.apiSecret);
    const paymentRequest = buildSparkMeterPaymentRequest(input);
    const url = new URL(paymentRequest.path, origin);

    let response: Response | null = null;
    let transportFailure = false;

    try {
        response = await fetchFn(url.toString(), {
            method: 'POST',
            redirect: 'error',
            signal: AbortSignal.timeout(15_000),
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...headers,
            },
            body: JSON.stringify(paymentRequest.body),
        });
    } catch {
        transportFailure = true;
    }

    if (transportFailure || !response) {
        // Network drop or timeout: retain hold and reconcile by read-only lookup.
        return lookupSparkMeterPayment(input, deps);
    }

    if (response.status === 201 || response.status === 200) {
        const payload = await response.json().catch(() => null);
        const outcome = parseSparkMeterPaymentResponse(response.status, payload, input);
        if (outcome.status === 'confirmed_success') return outcome;
        return lookupSparkMeterPayment(input, deps);
    }

    if (response.status === 400) {
        const payload = await response.json().catch(() => null);
        const outcome = parseSparkMeterPaymentResponse(400, payload, input);
        if (outcome.status === 'confirmed_failure') return outcome;
        // Duplicate external ID or unconfirmed error: retain hold and lookup.
        return lookupSparkMeterPayment(input, deps);
    }

    await response.body?.cancel().catch(() => undefined);
    // 429, 5xx, or unexpected status: never retry POST; lookup original payment reference.
    return lookupSparkMeterPayment(input, deps);
}

/**
 * Perform authenticated read-only lookup of a payment by external ID.
 * Lookup 404 does not prove payment absence; ambiguous outcomes remain unknown for manual review.
 */
export async function lookupSparkMeterPayment(
    input: SparkMeterClientInput,
    deps: SparkMeterClientDependencies = {},
): Promise<VendOutcome> {
    const validate = deps.validateEndpoint ?? validateOemEndpoint;
    const fetchFn = deps.fetchFn ?? fetch;
    const wait = deps.wait ?? sleep;

    const origin = await validate(input.baseUrl, input.approvedHostnames);
    const headers = buildSparkMeterAuthHeaders(input.apiKey, input.apiSecret);
    const lookupRequest = buildSparkMeterPaymentLookupRequest(input.commandId);
    const url = new URL(lookupRequest.path, origin);

    for (let attempt = 0; attempt < 3; attempt += 1) {
        let response: Response | null = null;
        try {
            response = await fetchFn(url.toString(), {
                method: 'GET',
                redirect: 'error',
                signal: AbortSignal.timeout(15_000),
                headers: {
                    Accept: 'application/json',
                    ...headers,
                },
            });
        } catch {
            if (attempt === 2) return { status: 'unknown' };
            await wait(250 * (2 ** attempt));
            continue;
        }

        if (response.status === 200) {
            const payload = await response.json().catch(() => null);
            return parseSparkMeterPaymentResponse(200, payload, input);
        }

        if (response.status === 404) {
            await response.body?.cancel().catch(() => undefined);
            // Provider lookup 404 does not prove payment absence; delayed visibility remains unconfirmed.
            return { status: 'unknown' };
        }

        await response.body?.cancel().catch(() => undefined);
        if (attempt === 2 || (response.status !== 429 && response.status < 500)) {
            return { status: 'unknown' };
        }

        const retryHeader = response.headers.get('Retry-After');
        const retryDate = new Date(retryHeader ?? '');
        const retryAfter = retryHeader === null ? NaN
            : /^\d+$/.test(retryHeader) ? Number(retryHeader)
                : retryDate.toUTCString() === retryHeader ? (retryDate.getTime() - Date.now()) / 1_000 : NaN;

        if (retryHeader !== null && (!Number.isFinite(retryAfter) || retryAfter > 5)) {
            return { status: 'unknown' };
        }

        await wait(Number.isFinite(retryAfter) ? Math.max(0, retryAfter * 1_000) : 250 * (2 ** attempt));
    }

    return { status: 'unknown' };
}
