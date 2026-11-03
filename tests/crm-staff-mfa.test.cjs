'use strict';
const assert = require('node:assert/strict');
const { signInWithPassword, authUserFromAccessToken, refreshAccessToken } = require('../backend/src/services/supabase-service');

const originalFetch = global.fetch;
const keys = ['SUPABASE_AUTH_ENABLED', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
Object.assign(process.env, { SUPABASE_AUTH_ENABLED: 'true', SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' });
let active = true;
let verified = false;
let calls = 0;
function response(data) { return { ok: true, status: 200, text: async () => JSON.stringify(data) }; }
global.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.includes('/auth/v1/token')) return response({ access_token: 'staff-token', user: { id: 'staff-id', email: 'staff@example.test' } });
  if (target.includes('/auth/v1/user')) return response({ id: 'staff-id', email: 'staff@example.test' });
  if (target.includes('/rest/v1/users')) return response([{ id: 'profile', auth_user_id: 'staff-id', user_id: 'staff-id', role_key: 'operations-officer', station_ids: ['*'] }]);
  if (target.includes('/rest/v1/staff_mfa_factors')) return response(active ? [{ id: 'factor' }] : []);
  if (target.includes('/rest/v1/staff_mfa_sessions')) return response(options.method === 'POST' ? [] : verified ? [{ expires_at: '2099-01-01T00:00:00Z' }] : []);
  throw new Error(`Unexpected URL: ${target}`);
};

(async () => {
  const challenge = await signInWithPassword({ userId: 'staff@example.test', password: 'secret' });
  assert.equal(challenge.status, 403);
  assert.equal(challenge.body.error, 'mfa_required');
  assert.equal(await authUserFromAccessToken('staff-token'), null, 'unverified tokens cannot authorize CRM');
  const failed = await signInWithPassword({ userId: 'staff@example.test', password: 'secret', mfaCode: '000000' }, { verifyStaffMfa: async () => { calls++; return false; } });
  assert.equal(failed.status, 403);
  assert.equal(failed.body.error, 'mfa_invalid');
  assert.equal(calls, 1);
  const success = await signInWithPassword({ userId: 'staff@example.test', password: 'secret', mfaCode: '123456' }, { verifyStaffMfa: async () => { verified = true; return true; } });
  assert.equal(success.status, 200);
  assert.equal((await authUserFromAccessToken('staff-token')).roleId, 'operations-officer');
  assert.equal(await refreshAccessToken('refresh', ''), null, 'MFA refresh needs the previous verified token');
  assert.equal((await refreshAccessToken('refresh', 'staff-token')).roleId, 'operations-officer');
  active = false; verified = false;
  assert.equal((await signInWithPassword({ userId: 'staff@example.test', password: 'secret' })).status, 200);
  console.log('CRM staff MFA checks passed.');
})().finally(() => { global.fetch = originalFetch; for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } }).catch(error => { console.error(error); process.exitCode = 1; });
