import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import adminDevRoutes from '../admin-dev.js';

describe('GET /dev/oem', () => {
    it('keeps SparkMeter unavailable until certification completes', async () => {
        const app = Fastify();
        await app.register(adminDevRoutes);

        const response = await app.inject({ method: 'GET', url: '/dev/oem' });
        await app.close();

        expect(response.statusCode).toBe(200);
        expect(response.json().oems).toContainEqual(expect.objectContaining({
            slug: 'sparkmeter',
            status: 'draft',
            vendingStrategy: 'unsupported',
            capabilities: expect.objectContaining({
                vending: false,
                relay_control: false,
                customer_dissociation: false,
            }),
        }));
        expect(response.body).not.toContain('c4c3e809-5487-43cf-be64-2826dbbb4f6d');
        expect(response.body).not.toContain('Acobminigrid@gmail.com');
    });
});

describe('POST /dev/oem/:slug/credentials', () => {
    it('rejects credentials when durable storage is unavailable', async () => {
        const app = Fastify();
        await app.register(adminDevRoutes);

        const response = await app.inject({
            method: 'POST',
            url: '/dev/oem/sparkmeter/credentials',
            payload: {
                authStrategy: 'api_key_header',
                baseUrl: 'https://www.sparkmeter.cloud',
                bearerToken: 'synthetic-test-value',
            },
        });
        await app.close();

        expect(response.statusCode).toBe(501);
        expect(response.json()).toMatchObject({
            ok: false,
            saved: false,
        });
        expect(response.body).not.toContain('synthetic-test-value');
    });
});

describe('POST /dev/oem', () => {
    it('rejects registration when durable provisioning is unavailable', async () => {
        const app = Fastify();
        await app.register(adminDevRoutes);
        const response = await app.inject({
            method: 'POST', url: '/dev/oem',
            payload: { displayName: 'Synthetic Provider', slug: 'synthetic-provider' },
        });
        await app.close();
        expect(response.statusCode).toBe(501);
        expect(response.json()).toMatchObject({ ok: false });
        expect(response.json()).not.toHaveProperty('oem');
    });
});
