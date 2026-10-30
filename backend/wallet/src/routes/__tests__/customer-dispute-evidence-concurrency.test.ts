import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ paths: [] as string[], reads: 0, release: undefined as undefined | (() => void), barrier: undefined as undefined | Promise<void> }));
const customer = '22222222-2222-4222-8222-222222222222';
const dispute = '11111111-1111-4111-8111-111111111111';
vi.mock('../../db/supabase.js', () => ({ adminClient: {
  storage: { from: () => ({ download: async () => ({ data: new Blob(['proof'], { type: 'application/pdf' }), error: null }), createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://example.test/${path}` }, error: null }) }) },
  from() {
    let patch: any; let expected: string | undefined;
    const q: any = {
      select() { return q; }, update(value: any) { patch = value; return q; },
      eq(key: string, value: string) { if (key === 'evidence_paths') expected = value; return q; },
      async maybeSingle() {
        if (!patch) {
          const snapshot = [...state.paths];
          if (++state.reads <= 2) {
            if (!state.barrier) state.barrier = new Promise<void>(resolve => { state.release = resolve; });
            if (state.reads === 2) state.release?.();
            await state.barrier;
          }
          return { data: { evidence_paths: snapshot }, error: null };
        }
        if (expected !== undefined && expected !== JSON.stringify(state.paths)) return { data: null, error: null };
        state.paths = [...patch.evidence_paths]; return { data: { evidence_paths: [...state.paths] }, error: null };
      },
      then(resolve: any) { if (patch) state.paths = [...patch.evidence_paths]; return resolve({ data: null, error: null }); },
    }; return q;
  },
} }));
vi.mock('../../services/file-scan.js', () => ({ runMalwareScan: async () => ({ ok: true }) }));
import customerRoutes from '../customer.js';
async function createApp() {
  const app = Fastify();
  app.decorate('requireCustomer', () => async (req: any) => { req.actor = { customerId: customer, actorId: customer, userId: 'user', type: 'customer' }; });
  app.decorate('requireKycTier', () => async () => undefined);
  await app.register(customerRoutes); return app;
}
describe('dispute evidence activation', () => {
  it('preserves concurrent uploads', async () => {
    state.paths = []; state.reads = 0; state.barrier = undefined; state.release = undefined; const app = await createApp();
    const paths = [`customer/${customer}/${dispute}/one.pdf`, `customer/${customer}/${dispute}/two.pdf`];
    try {
      const responses = await Promise.all(paths.map(path => app.inject({ method: 'POST', url: `/disputes/${dispute}/evidence/activate`, payload: { path } })));
      expect(responses.map(r => r.statusCode)).toEqual([200, 200]);
      expect(state.paths.sort()).toEqual(paths.sort());
    } finally { await app.close(); }
  });
  it('enforces the attachment limit during concurrent uploads', async () => {
    state.paths = ['a', 'b', 'c', 'd']; state.reads = 0; state.barrier = undefined; state.release = undefined; const app = await createApp();
    const paths = [`customer/${customer}/${dispute}/three.pdf`, `customer/${customer}/${dispute}/four.pdf`];
    try {
      const responses = await Promise.all(paths.map(path => app.inject({ method: 'POST', url: `/disputes/${dispute}/evidence/activate`, payload: { path } })));
      expect(responses.map(r => r.statusCode).sort()).toEqual([200, 422]);
      expect(state.paths).toHaveLength(5);
    } finally { await app.close(); }
  });
});
