import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ org: 'org-a', disputeOrg: 'org-b', messages: 0 }));
vi.mock('../../db/supabase.js', () => ({ adminClient: { from() { let rows = [{ id: '11111111-1111-4111-8111-111111111111', actor_type: 'vendor', actor_id: 'org-a' }]; const q: any = { select() { return q; }, eq(key: string, value: unknown) { rows = rows.filter((row: any) => row[key] === value); return q; }, maybeSingle: async () => ({ data: rows[0] ?? null, error: null }), single: async () => ({ data: state.org ? { vendor_organization_id: state.org } : null, error: null }) }; return q; } } }));
vi.mock('../../services/disputes.js', () => ({
  getDispute: async () => ({ id: 'case', vendor_organization_id: state.disputeOrg }),
  listDisputes: async () => [{ id: 'case' }],
  addMessage: async () => { state.messages++; },
  raiseDispute: async () => ({ id: 'case', reference: 'DISP-1' }),
}));
import vendorRoutes from '../vendor.js';
async function appForVendor() {
  const app = Fastify();
  app.decorate('requireAuth', () => async () => undefined);
  app.decorate('requireVendor', () => async (req: any) => { req.actor = { actorId: 'vendor-user', vendorOrganizationId: state.org, userId: 'user', type: 'vendor' }; });
  await app.register(vendorRoutes);
  return app;
}
describe('vendor dispute ownership', () => {
  it('denies another organization access and replies', async () => {
    state.org = 'org-a'; state.disputeOrg = 'org-b'; state.messages = 0;
    const app = await appForVendor();
    try {
      expect((await app.inject('/disputes/case')).statusCode).toBe(404);
      expect((await app.inject({ method: 'POST', url: '/disputes/case/messages', payload: { body: 'hello' } })).statusCode).toBe(404);
      expect(state.messages).toBe(0);
    } finally { await app.close(); }
  });
  it('does not list all disputes without an organization', async () => {
    state.org = '';
    const app = await appForVendor();
    try { expect((await app.inject('/disputes')).statusCode).toBe(403); }
    finally { await app.close(); state.org = 'org-a'; }
  });
  it('allows the owning organization to read and reply', async () => {
    state.org = 'org-a'; state.disputeOrg = 'org-a'; state.messages = 0;
    const app = await appForVendor();
    try {
      expect((await app.inject('/disputes/case')).statusCode).toBe(200);
      expect((await app.inject({ method: 'POST', url: '/disputes/case/messages', payload: { body: 'hello' } })).statusCode).toBe(200);
      expect(state.messages).toBe(1);
    } finally { await app.close(); }
  });
  it('returns the created case and reference', async () => {
    const app = await appForVendor();
    try {
      const response = await app.inject({ method: 'POST', url: '/disputes', payload: { subject: 'Meter issue', description: 'Token was not received' } });
      expect(response.json()).toEqual({ id: 'case', reference: 'DISP-1' });
    } finally { await app.close(); }
  });
  it('rejects purchase links from another organization', async () => {
    state.org = 'org-b'; const app = await appForVendor();
    try {
      const response = await app.inject({ method: 'POST', url: '/disputes', payload: { purchase_order_id: '11111111-1111-4111-8111-111111111111', subject: 'Meter issue', description: 'Token was not received' } });
      expect(response.statusCode).toBe(404);
    } finally { state.org = 'org-a'; await app.close(); }
  });
});
