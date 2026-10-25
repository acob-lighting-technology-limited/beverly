import { describe, expect, it, vi } from 'vitest';
import {
    submitSparkMeterPayment,
    lookupSparkMeterPayment,
    type SparkMeterClientInput,
} from '../sparkmeter-payment-client.js';

const baseInput: SparkMeterClientInput = {
    baseUrl: 'https://www.sparkmeter.cloud',
    approvedHostnames: ['www.sparkmeter.cloud'],
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    commandId: 'cmd-test-1',
    amountMinor: 10000,
    currency: 'NGN',
    settlementCurrency: 'NGN',
    externalCustomerId: 'cust-uuid-1',
};

describe('SparkMeter Koios v1 payment client', () => {
    it('submits payment request to Koios v1 endpoint with dual headers', async () => {
        let requestedUrl = '';
        let requestedMethod = '';
        let requestedHeaders: Record<string, string> = {};
        let requestedBody = '';

        const fetchFn = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
            requestedUrl = url;
            requestedMethod = init.method ?? 'GET';
            requestedHeaders = init.headers as Record<string, string>;
            requestedBody = String(init.body ?? '');
            return new Response(JSON.stringify({
                data: {
                    id: '11111111-1111-4111-8111-111111111111',
                    recipient_id: 'cust-uuid-1',
                    amount: { value: '100.00', currency: 'NGN' },
                    external_id: 'cmd-test-1',
                    status: 'processed',
                },
                errors: [],
            }), { status: 201 });
        });

        const outcome = await submitSparkMeterPayment(baseInput, { fetchFn });

        expect(outcome).toEqual({
            status: 'confirmed_success',
            providerReference: 'cmd-test-1',
        });
        expect(requestedUrl).toBe('https://www.sparkmeter.cloud/api/v1/customers/cust-uuid-1/payments');
        expect(requestedMethod).toBe('POST');
        expect(requestedHeaders['X-API-KEY']).toBe('test-key');
        expect(requestedHeaders['X-API-SECRET']).toBe('test-secret');
        expect(JSON.parse(requestedBody)).toEqual({
            amount: '100.00',
            memo: 'Beverly vend cmd-test-1',
            external_id: 'cmd-test-1',
        });
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('never retries payment POST automatically on network timeout, falls back to read-only lookup', async () => {
        const fetchFn = vi.fn()
            // First call: payment POST times out
            .mockImplementationOnce(async () => {
                const err = new Error('The operation was aborted');
                err.name = 'TimeoutError';
                throw err;
            })
            // Second call: read-only lookup GET finds the processed payment
            .mockImplementationOnce(async (url: string, init: RequestInit) => {
                expect(init.method).toBe('GET');
                expect(url).toContain('/api/v1/payments?external_id=cmd-test-1');
                return new Response(JSON.stringify({
                    data: [{
                        id: '22222222-2222-4222-8222-222222222222',
                        recipient_id: 'cust-uuid-1',
                        amount: { value: '100.00', currency: 'NGN' },
                        external_id: 'cmd-test-1',
                        status: 'processed',
                    }],
                    errors: [],
                }), { status: 200 });
            });

        const outcome = await submitSparkMeterPayment(baseInput, { fetchFn });

        expect(outcome).toEqual({
            status: 'confirmed_success',
            providerReference: 'cmd-test-1',
        });
        // Exactly 1 POST and 1 GET lookup
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('leaves hold retained and outcome unknown when lookup returns 404 after POST timeout', async () => {
        const fetchFn = vi.fn()
            .mockImplementationOnce(async () => {
                const err = new Error('The operation was aborted');
                err.name = 'TimeoutError';
                throw err;
            })
            .mockImplementationOnce(async () => {
                return new Response(JSON.stringify({ data: [], errors: [] }), { status: 404 });
            });

        const outcome = await submitSparkMeterPayment(baseInput, { fetchFn });

        expect(outcome).toEqual({ status: 'unknown' });
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('performs read-only lookup when provider returns duplicate external ID error', async () => {
        const fetchFn = vi.fn()
            .mockImplementationOnce(async () => {
                return new Response(JSON.stringify({
                    errors: [{ title: 'Duplicate external ID', details: 'Payment already exists' }],
                    data: null,
                }), { status: 400 });
            })
            .mockImplementationOnce(async () => {
                return new Response(JSON.stringify({
                    data: {
                        id: '33333333-3333-4333-8333-333333333333',
                        recipient_id: 'cust-uuid-1',
                        amount: { value: '100.00', currency: 'NGN' },
                        external_id: 'cmd-test-1',
                        status: 'processed',
                    },
                    errors: [],
                }), { status: 200 });
            });

        const outcome = await submitSparkMeterPayment(baseInput, { fetchFn });

        expect(outcome).toEqual({
            status: 'confirmed_success',
            providerReference: 'cmd-test-1',
        });
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('confirms failure on documented 400 validation error without lookup', async () => {
        const fetchFn = vi.fn().mockImplementationOnce(async () => {
            return new Response(JSON.stringify({
                errors: [{ title: 'Unknown parameter', details: 'unsupported_field' }],
                data: null,
            }), { status: 400 });
        });

        const outcome = await submitSparkMeterPayment(baseInput, { fetchFn });

        expect(outcome).toEqual({
            status: 'confirmed_failure',
            reason: 'Unknown parameter: unsupported_field',
        });
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('enforces SSRF protection using validateOemEndpoint', async () => {
        const validateEndpoint = vi.fn().mockRejectedValue(new Error('Endpoint host not approved'));
        await expect(submitSparkMeterPayment({
            ...baseInput,
            baseUrl: 'https://malicious-host.com',
            approvedHostnames: ['www.sparkmeter.cloud'],
        }, { validateEndpoint })).rejects.toThrow('Endpoint host not approved');
    });

    it('retries read-only lookup on 429 within Retry-After budget', async () => {
        const fetchFn = vi.fn()
            .mockImplementationOnce(async () => new Response(JSON.stringify({}), {
                status: 429,
                headers: { 'Retry-After': '1' },
            }))
            .mockImplementationOnce(async () => new Response(JSON.stringify({
                data: {
                    id: '44444444-4444-4444-8444-444444444444',
                    recipient_id: 'cust-uuid-1',
                    amount: { value: '100.00', currency: 'NGN' },
                    external_id: 'cmd-test-1',
                    status: 'processed',
                },
                errors: [],
            }), { status: 200 }));

        const wait = vi.fn().mockResolvedValue(undefined);
        const outcome = await lookupSparkMeterPayment(baseInput, { fetchFn, wait });

        expect(outcome).toEqual({
            status: 'confirmed_success',
            providerReference: 'cmd-test-1',
        });
        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(wait).toHaveBeenCalledWith(1000);
    });
});
