import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ created: 0 }));
vi.mock('../../db/supabase.js', () => ({ adminClient: { from(table: string) {
  let rows = table === 'purchase_orders' ? [
    { id: '11111111-1111-4111-8111-111111111111', actor_type: 'customer', actor_id: 'customer-a' },
    { id: '22222222-2222-4222-8222-222222222222', actor_type: 'customer', actor_id: 'customer-b' },
  ] : [];
  if (table === 'receipts') rows = [{ id: 'receipt', receipt_number: 'R-1', purchase_order_id: '11111111-1111-4111-8111-111111111111', payload: {}, created_at: '2026-10-30' }] as any;
  const q: any = { select() { return q; }, eq(key: string, value: unknown) { rows = rows.filter((row: any) => row[key] === value); return q; }, in(key: string, values: unknown[]) { rows = rows.filter((row: any) => values.includes(row[key])); return q; }, order() { return q; }, limit() { return q; }, maybeSingle: async () => ({ data: rows[0] ?? null, error: null }), single: async () => ({ data: rows[0] ?? null, error: null }), then(resolve: any) { return resolve({ data: rows, error: null }); } }; return q;
} } }));
vi.mock('../../services/disputes.js', () => ({ raiseDispute: async () => { state.created++; return { id: 'case', reference: 'DISP-1' }; }, listDisputes: async () => [], getDispute: async () => null, addMessage: async () => undefined }));
vi.mock('../../services/vending.js', () => ({ getReceiptByOrder: async (id: string) => ({ id: 'receipt', purchase_order_id: id, payload: {}, receipt_number: 'R-1' }) }));
import customerRoutes from '../customer.js';
async function createApp() {
  const app = Fastify();
  app.decorate('requireAuth', () => async () => undefined);
  app.decorate('requireKycTier', () => async () => undefined);
  app.decorate('requireCustomer', () => async (req: any) => { req.actor = { customerId: 'customer-a', actorId: 'customer-a', userId: 'user', type: 'customer' }; });
  await app.register(customerRoutes); return app;
}
describe('customer dispute purchase ownership', () => {
  it('lists receipts for purchases made by this customer', async () => {
    const app = await createApp();
    try { const response = await app.inject('/receipts'); expect(response.statusCode).toBe(200); expect(response.json().receipts).toHaveLength(1); }
    finally { await app.close(); }
  });
  it('opens only the customer own receipt', async () => {
    const app = await createApp();
    try {
      expect((await app.inject('/receipts/11111111-1111-4111-8111-111111111111')).statusCode).toBe(200);
      expect((await app.inject('/receipts/22222222-2222-4222-8222-222222222222')).statusCode).toBe(403);
    } finally { await app.close(); }
  });
  it('rejects a purchase belonging to another customer', async () => {
    state.created = 0; const app = await createApp();
    try {
      const response = await app.inject({ method: 'POST', url: '/disputes', payload: { purchase_order_id: '22222222-2222-4222-8222-222222222222', subject: 'Meter issue', description: 'Token was not received' } });
      expect(response.statusCode).toBe(404); expect(state.created).toBe(0);
    } finally { await app.close(); }
  });
  it('accepts the customer purchase', async () => {
    state.created = 0; const app = await createApp();
    try {
      const response = await app.inject({ method: 'POST', url: '/disputes', payload: { purchase_order_id: '11111111-1111-4111-8111-111111111111', subject: 'Meter issue', description: 'Token was not received' } });
      expect(response.statusCode).toBe(200); expect(state.created).toBe(1);
    } finally { await app.close(); }
  });
});
