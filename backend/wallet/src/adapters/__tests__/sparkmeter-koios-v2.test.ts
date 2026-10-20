import { describe, expect, it, vi } from 'vitest';
import { fetchSparkMeterTelemetryPage } from '../sparkmeter-koios-v2.js';

describe('SparkMeter Koios v2 telemetry client', () => {
    it('validates its origin and sends bounded authenticated reads', async () => {
        const validate = vi.fn().mockResolvedValue('https://www.sparkmeter.cloud/');
        const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            data: [], pagination: { count: 0, has_more: false, cursor: null },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        const page = await fetchSparkMeterTelemetryPage({
            baseUrl: 'https://www.sparkmeter.cloud', approvedHostnames: ['www.sparkmeter.cloud'],
            organizationId: '64bfd8cd-d361-4368-98c9-c0ea3730559d', apiKey: 'key', apiSecret: 'secret',
            sites: ['11111111-1111-4111-8111-111111111111'], mode: 'live', age: '15m', fetchFn, validateEndpoint: validate,
        });
        expect(page.hasMore).toBe(false);
        expect(validate).toHaveBeenCalledOnce();
        expect(fetchFn).toHaveBeenCalledWith(
            'https://www.sparkmeter.cloud/api/v2/organizations/64bfd8cd-d361-4368-98c9-c0ea3730559d/data/live',
            expect.objectContaining({ method: 'POST', redirect: 'error' }),
        );
        const headers = fetchFn.mock.calls[0]?.[1]?.headers as Record<string, string>;
        expect(headers).toMatchObject({ 'X-API-KEY': 'key', 'X-API-SECRET': 'secret' });
    });

    it('retries only throttled read requests', async () => {
        const fetchFn = vi.fn()
            .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '0' } }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], pagination: { count: 0, has_more: false, cursor: null } }), { status: 200 }));
        await fetchSparkMeterTelemetryPage({
            baseUrl: 'https://www.sparkmeter.cloud', approvedHostnames: ['www.sparkmeter.cloud'],
            organizationId: 'org', apiKey: 'key', apiSecret: 'secret', sites: ['11111111-1111-4111-8111-111111111111'],
            mode: 'live', fetchFn, validateEndpoint: vi.fn().mockResolvedValue('https://www.sparkmeter.cloud/'),
            wait: vi.fn().mockResolvedValue(undefined),
        });
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('backs off when Retry-After is absent', async () => {
        const fetchFn = vi.fn()
            .mockResolvedValueOnce(new Response('{}', { status: 429 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], pagination: { count: 0, has_more: false, cursor: null } }), { status: 200 }));
        const wait = vi.fn().mockResolvedValue(undefined);
        await fetchSparkMeterTelemetryPage({
            baseUrl: 'https://www.sparkmeter.cloud', approvedHostnames: ['www.sparkmeter.cloud'],
            organizationId: 'org', apiKey: 'key', apiSecret: 'secret', sites: ['11111111-1111-4111-8111-111111111111'],
            mode: 'live', fetchFn, validateEndpoint: vi.fn().mockResolvedValue('https://www.sparkmeter.cloud/'), wait,
        });
        expect(wait).toHaveBeenCalledWith(250);
    });

    it('stops instead of shortening a Retry-After beyond its wait budget', async () => {
        const cancel = vi.fn().mockResolvedValue(undefined);
        const throttled = new Response('{}', { status: 429, headers: { 'Retry-After': '6' } });
        Object.defineProperty(throttled, 'body', { value: { cancel } });
        const fetchFn = vi.fn()
            .mockResolvedValueOnce(throttled)
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], pagination: { count: 0, has_more: false, cursor: null } }), { status: 200 }));
        const wait = vi.fn().mockResolvedValue(undefined);
        await expect(fetchSparkMeterTelemetryPage({
            baseUrl: 'https://www.sparkmeter.cloud', approvedHostnames: ['www.sparkmeter.cloud'],
            organizationId: 'org', apiKey: 'key', apiSecret: 'secret', sites: ['11111111-1111-4111-8111-111111111111'],
            mode: 'live', fetchFn, validateEndpoint: vi.fn().mockResolvedValue('https://www.sparkmeter.cloud/'), wait,
        })).rejects.toThrow('Retry-After requires operator replay');
        expect(fetchFn).toHaveBeenCalledOnce();
        expect(wait).not.toHaveBeenCalled();
        expect(cancel).toHaveBeenCalledOnce();
    });

    it('honors an HTTP-date Retry-After within its wait budget', async () => {
        const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('Mon, 19 Oct 2026 10:00:00 GMT'));
        try {
            const fetchFn = vi.fn()
                .mockResolvedValueOnce(new Response('{}', { status: 503, headers: { 'Retry-After': 'Mon, 19 Oct 2026 10:00:03 GMT' } }))
                .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], pagination: { count: 0, has_more: false, cursor: null } })));
            const wait = vi.fn().mockResolvedValue(undefined);
            await fetchSparkMeterTelemetryPage({
                baseUrl: 'https://www.sparkmeter.cloud', approvedHostnames: ['www.sparkmeter.cloud'],
                organizationId: 'org', apiKey: 'key', apiSecret: 'secret', sites: ['11111111-1111-4111-8111-111111111111'],
                mode: 'live', fetchFn, validateEndpoint: vi.fn().mockResolvedValue('https://www.sparkmeter.cloud/'), wait,
            });
            expect(wait).toHaveBeenCalledWith(3000);
        } finally { clock.mockRestore(); }
    });

    it.each(['invalid', '-1', '1.5', '', '999999999999999999999999'])('does not retry an unsafe Retry-After: %s', async (retryAfter) => {
        const fetchFn = vi.fn().mockImplementation(async () => new Response('{}', { status: 429, headers: { 'Retry-After': retryAfter } }));
        const wait = vi.fn().mockResolvedValue(undefined);
        await expect(fetchSparkMeterTelemetryPage({
            baseUrl: 'https://www.sparkmeter.cloud', approvedHostnames: ['www.sparkmeter.cloud'],
            organizationId: 'org', apiKey: 'key', apiSecret: 'secret', sites: ['11111111-1111-4111-8111-111111111111'],
            mode: 'live', fetchFn, validateEndpoint: vi.fn().mockResolvedValue('https://www.sparkmeter.cloud/'), wait,
        })).rejects.toThrow('Retry-After requires operator replay');
        expect(fetchFn).toHaveBeenCalledOnce();
        expect(wait).not.toHaveBeenCalled();
    });

    it('sends documented historical date filters', async () => {
        const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            data: [], pagination: { count: 0, has_more: false, cursor: null },
        }), { status: 200 }));
        await fetchSparkMeterTelemetryPage({
            baseUrl: 'https://www.sparkmeter.cloud', approvedHostnames: ['www.sparkmeter.cloud'],
            organizationId: '64bfd8cd-d361-4368-98c9-c0ea3730559d', apiKey: 'key', apiSecret: 'secret',
            sites: ['11111111-1111-4111-8111-111111111111'], mode: 'historical',
            dateFrom: '2026-10-01', dateTo: '2026-10-07', fetchFn,
            validateEndpoint: vi.fn().mockResolvedValue('https://www.sparkmeter.cloud/'),
        });
        expect(fetchFn.mock.calls[0]?.[0]).toBe('https://www.sparkmeter.cloud/api/v2/organizations/64bfd8cd-d361-4368-98c9-c0ea3730559d/data/historical');
        expect(JSON.parse(fetchFn.mock.calls[0]?.[1]?.body as string)).toEqual({
            per_page: 200,
            filters: { sites: ['11111111-1111-4111-8111-111111111111'], date_range: { from: '2026-10-01', to: '2026-10-07' } },
        });
    });

    it('classifies an upstream timeout without retrying automatically', async () => {
        const fetchFn = vi.fn().mockRejectedValue(new DOMException('request expired', 'TimeoutError'));
        await expect(fetchSparkMeterTelemetryPage({
            baseUrl: 'https://www.sparkmeter.cloud', approvedHostnames: ['www.sparkmeter.cloud'],
            organizationId: 'org', apiKey: 'key', apiSecret: 'secret',
            sites: ['11111111-1111-4111-8111-111111111111'], mode: 'historical',
            dateFrom: '2026-10-18', dateTo: '2026-10-18', fetchFn,
            validateEndpoint: vi.fn().mockResolvedValue('https://www.sparkmeter.cloud/'),
        })).rejects.toThrow('telemetry_upstream_timeout');
        expect(fetchFn).toHaveBeenCalledOnce();
    });

    it('hides transport details after network failure', async () => {
        const fetchFn = vi.fn().mockRejectedValue(new TypeError('private upstream address'));
        await expect(fetchSparkMeterTelemetryPage({
            baseUrl: 'https://www.sparkmeter.cloud', approvedHostnames: ['www.sparkmeter.cloud'],
            organizationId: 'org', apiKey: 'key', apiSecret: 'secret',
            sites: ['11111111-1111-4111-8111-111111111111'], mode: 'live', fetchFn,
            validateEndpoint: vi.fn().mockResolvedValue('https://www.sparkmeter.cloud/'),
        })).rejects.toThrow('telemetry_upstream_network_error');
        expect(fetchFn).toHaveBeenCalledOnce();
    });
});
