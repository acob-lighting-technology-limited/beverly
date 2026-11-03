"use strict";

const assert = require("assert");
const {
  resolveAuthEmail,
  getAuthUserByIdentifier,
  authUserFromAccessToken,
  signInWithPassword,
  refreshAccessToken
} = require("../backend/src/services/supabase-service");

const previousEnv = {
  SUPABASE_AUTH_ENABLED: process.env.SUPABASE_AUTH_ENABLED,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  LOGIN_EMAIL_DOMAIN: process.env.LOGIN_EMAIL_DOMAIN
};
const originalFetch = global.fetch;

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_AUTH_ENABLED = "true";
process.env.SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
process.env.LOGIN_EMAIL_DOMAIN = "org.acoblighting.com";

global.fetch = async (url) => {
  if (String(url).includes('/rest/v1/staff_mfa_factors')) return { ok: true, text: async () => '[]' };
  if (String(url).includes('/rest/v1/users')) {
    return { ok: true, text: async () => JSON.stringify([{ id: 'admin-row', auth_user_id: 'admin-auth', user_id: 'admin-auth', user_name: 'Admin', role_key: 'super-admin' }]) };
  }
  if (String(url).includes("/auth/v1/user")) {
    return {
      ok: true,
      text: async () => JSON.stringify({
        id: "admin-auth",
        email: "admin@acoblighting.com",
        user_metadata: {
          user_id: "admin",
          role: "super-admin"
        }
      })
    };
  }
  return {
    ok: true,
    text: async () => JSON.stringify({
      users: [
        {
          id: "user-1",
          email: "mary@org.acoblighting.com",
          user_metadata: {
            user_id: "mary",
            role_key: "operations-manager"
          }
        }
      ]
    })
  };
};

(async () => {
  const authUser = await getAuthUserByIdentifier("mary");
  assert.strictEqual(authUser.email, "mary@org.acoblighting.com");
  assert.strictEqual(await resolveAuthEmail("mary"), "mary@org.acoblighting.com");
  assert.strictEqual(await resolveAuthEmail("mary@org.acoblighting.com"), "mary@org.acoblighting.com");
  assert.strictEqual(await resolveAuthEmail("jane"), "jane@org.acoblighting.com");
  assert.strictEqual((await authUserFromAccessToken("admin-token")).roleId, "super-admin");

  global.fetch = async (url) => {
  if (String(url).includes('/rest/v1/staff_mfa_factors')) return { ok: true, text: async () => '[]' };
    if (String(url).includes("/auth/v1/user")) {
      return {
        ok: true,
        text: async () => JSON.stringify({
          id: "staff-auth",
          email: "staff@acoblighting.com",
          user_metadata: {}
        })
      };
    }
    if (String(url).includes("/rest/v1/users")) {
      return {
        ok: true,
        text: async () => JSON.stringify([
          {
            id: "staff-row",
            auth_user_id: "staff-auth",
            user_id: "staff-auth",
            email: "staff@acoblighting.com",
            user_name: "Staff User",
            role_key: "operations-manager",
            station_ids: ["UMAISHA", "TUNGA"]
          }
        ])
      };
    }
    throw new Error(`unexpected URL: ${url}`);
  };
  const staffActor = await authUserFromAccessToken("staff-token");
  assert.strictEqual(staffActor.roleId, "operations-manager");
  assert.strictEqual(staffActor.userName, "Staff User");
  assert.deepStrictEqual(staffActor.stationIds, ["UMAISHA", "TUNGA"]);

  global.fetch = async (url) => {
  if (String(url).includes('/rest/v1/staff_mfa_factors')) return { ok: true, text: async () => '[]' };
    if (String(url).includes('/auth/v1/user')) return { ok: true, text: async () => JSON.stringify({ id: 'impostor', user_metadata: { role_key: 'super-admin' } }) };
    if (String(url).includes('/rest/v1/users')) return { ok: true, text: async () => '[]' };
    return { ok: true, text: async () => '[]' };
  };
  assert.strictEqual(await authUserFromAccessToken('forged-staff'), null, 'editable metadata must not grant staff access');

  global.fetch = async (url) => {
  if (String(url).includes('/rest/v1/staff_mfa_factors')) return { ok: true, text: async () => '[]' };
    if (String(url).includes('/auth/v1/token')) return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: 'forged', user: { id: 'impostor', user_metadata: { role_key: 'super-admin' } } }) };
    if (String(url).includes('/rest/v1/users')) return { ok: true, text: async () => '[]' };
    throw new Error(`unexpected URL: ${url}`);
  };
  assert.strictEqual((await signInWithPassword({ userId: 'fake@example.com', password: 'secret' })).status, 403, 'CRM login requires a staff profile');

  global.fetch = async (url) => {
  if (String(url).includes('/rest/v1/staff_mfa_factors')) return { ok: true, text: async () => '[]' };
    if (String(url).includes('/auth/v1/token')) return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: 'pending', user: { id: 'staff-auth' } }) };
    if (String(url).includes('/rest/v1/users')) return { ok: true, text: async () => JSON.stringify([{ id: 'staff-row', role_key: 'operations-officer', password_reset_required: true }]) };
    throw new Error(`unexpected URL: ${url}`);
  };
  assert.strictEqual((await signInWithPassword({ userId: 'staff@example.com', password: 'secret' })).status, 403, 'staff setup must finish before CRM access');

  for (const role of ['operations-manager', 'operations-officer']) {
    global.fetch = async (url) => {
  if (String(url).includes('/rest/v1/staff_mfa_factors')) return { ok: true, text: async () => '[]' };
      if (String(url).includes('/auth/v1/token')) return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: 'valid', refresh_token: 'refresh', user: { id: 'staff-auth', email: 'staff@example.com', user_metadata: { role_key: 'super-admin' } } }) };
      if (String(url).includes('/rest/v1/users')) return { ok: true, text: async () => JSON.stringify([{ id: 'staff-row', auth_user_id: 'staff-auth', user_id: 'staff-auth', user_name: 'Staff User', role_key: role, station_ids: ['*'] }]) };
      throw new Error(`unexpected URL: ${url}`);
    };
    const login = await signInWithPassword({ userId: 'staff@example.com', password: 'secret' });
    assert.strictEqual(login.status, 200);
    assert.strictEqual(login.body.data.roleId, role, 'staff database role overrides editable metadata');
    const refreshed = await refreshAccessToken('refresh');
    assert.strictEqual(refreshed.roleId, role, 'refresh must retain the database role');
  }

  global.fetch = async () => {
    throw new Error("network down");
  };
  const failedLogin = await signInWithPassword({ userId: "admin", password: "secret" });
  assert.strictEqual(failedLogin.status, 503);
  assert.strictEqual(failedLogin.body.msg, "Authentication service unavailable");

  let transientAttempts = 0;
  global.fetch = async (url) => {
  if (String(url).includes('/rest/v1/staff_mfa_factors')) return { ok: true, text: async () => '[]' };
    if (String(url).includes("/auth/v1/token")) {
      transientAttempts += 1;
      if (transientAttempts === 1) {
        return new Response(JSON.stringify({ error: "gateway timeout" }), {
          status: 504,
          headers: { "content-type": "application/json" }
        });
      }
      return new Response(JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        user: {
          id: "admin-auth",
          email: "admin@acoblighting.com",
          user_metadata: { role_key: "super-admin" }
        }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (String(url).includes("/rest/v1/users")) {
      return new Response(JSON.stringify([{
        id: "admin-row",
        auth_user_id: "admin-auth",
        user_id: "admin",
        email: "admin@acoblighting.com",
        name: "Beverly Admin",
        role_key: "super-admin"
      }]), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`unexpected URL: ${url}`);
  };
  const recoveredLogin = await signInWithPassword({ userId: "admin@acoblighting.com", password: "secret" });
  assert.strictEqual(transientAttempts, 2);
  assert.strictEqual(recoveredLogin.status, 200);

  if (typeof previousEnv.SUPABASE_AUTH_ENABLED === "undefined") delete process.env.SUPABASE_AUTH_ENABLED;
  else process.env.SUPABASE_AUTH_ENABLED = previousEnv.SUPABASE_AUTH_ENABLED;

  if (typeof previousEnv.SUPABASE_URL === "undefined") delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = previousEnv.SUPABASE_URL;

  if (typeof previousEnv.SUPABASE_ANON_KEY === "undefined") delete process.env.SUPABASE_ANON_KEY;
  else process.env.SUPABASE_ANON_KEY = previousEnv.SUPABASE_ANON_KEY;

  if (typeof previousEnv.SUPABASE_SERVICE_ROLE_KEY === "undefined") delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = previousEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (typeof previousEnv.LOGIN_EMAIL_DOMAIN === "undefined") delete process.env.LOGIN_EMAIL_DOMAIN;
  else process.env.LOGIN_EMAIL_DOMAIN = previousEnv.LOGIN_EMAIL_DOMAIN;

  global.fetch = originalFetch;

  console.log(JSON.stringify({
    status: "supabase auth resolution passed"
  }, null, 2));
})().catch((error) => {
  global.fetch = originalFetch;
  console.error(error);
  process.exit(1);
});
