#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const readline = require("readline");

const INSTALLATION_ID = "53f12390-74f7-40b3-b1db-e907c256986d";
const KEY_VERSION = 2;

function askSecret(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

function encryptInstallationBundle(plaintext, installationId, version, base64Key) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(base64Key)) {
    throw new Error("Encryption key must be a 32-byte base64 string matching /^[A-Za-z0-9+/]{43}=$/");
  }
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("Decoded key must be exactly 32 bytes");

  const aad = Buffer.from(
    JSON.stringify(["beverly-installation-credentials", installationId, version]),
    "utf8"
  );
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

async function main() {
  const envKeysRaw = process.env.OEM_INSTALLATION_ENCRYPTION_KEYS;
  let base64Key;

  if (envKeysRaw) {
    try {
      const parsed = JSON.parse(envKeysRaw);
      base64Key = parsed[String(KEY_VERSION)];
    } catch {
      console.error("OEM_INSTALLATION_ENCRYPTION_KEYS is malformed JSON.");
    }
  }

  if (!base64Key) {
    base64Key = await askSecret(`Enter 32-byte base64 encryption key for version ${KEY_VERSION}: `);
  }

  const apiKey = process.env.SPARKMETER_API_KEY || (await askSecret("Enter SparkMeter API Key: "));
  const apiSecret = process.env.SPARKMETER_API_SECRET || (await askSecret("Enter SparkMeter API Secret: "));

  if (!apiKey || !apiSecret) {
    throw new Error("Both apiKey and apiSecret are required.");
  }

  const plaintext = JSON.stringify({ apiKey, apiSecret });
  const encryptedBundle = encryptInstallationBundle(plaintext, INSTALLATION_ID, KEY_VERSION, base64Key);

  console.log("\n--- Generated Safe Deployment SQL (No plaintext secrets exposed) ---\n");
  console.log(`
begin;

do $$
declare
  v_inst constant uuid := '${INSTALLATION_ID}';
  v_tenant constant uuid := 'd43a9029-8002-4015-a272-b9c835c8909f';
  v_oem constant uuid := 'e1532892-e09d-44f9-a9cb-b99b5c9ebecf';
  v_admin_id uuid;
begin
  -- 1. Validate installation & tenant existence
  if not exists (
    select 1 from public.oem_installations
    where id = v_inst and tenant_id = v_tenant and oem_id = v_oem
  ) then
    raise exception 'Target installation identity mismatch: %', v_inst;
  end if;

  -- 2. Resolve authorized super-admin
  select au.id into v_admin_id
  from auth.users au
  join public.users u on u.auth_user_id = au.id
  where lower(au.email) = lower('admin@acoblighting.com')
    and u.role_key = 'super-admin'
  limit 1;

  if v_admin_id is null then
    select id into v_admin_id from auth.users order by created_at asc limit 1;
  end if;

  -- 3. Configure approved hostnames
  update public.oem_installations
  set approved_hostnames = array['www.sparkmeter.cloud'],
      updated_at = now()
  where id = v_inst;

  -- 4. Upsert encrypted credentials
  insert into public.oem_installation_credentials (
    oem_installation_id,
    auth_strategy,
    encrypted_secret_bundle,
    encryption_key_version,
    token_endpoint,
    token_expiry_policy,
    updated_by,
    updated_at
  )
  values (
    v_inst,
    'api_key_pair',
    '${encryptedBundle}',
    ${KEY_VERSION},
    null,
    '{}'::jsonb,
    v_admin_id,
    now()
  )
  on conflict (oem_installation_id) do update
  set auth_strategy = excluded.auth_strategy,
      encrypted_secret_bundle = excluded.encrypted_secret_bundle,
      encryption_key_version = excluded.encryption_key_version,
      updated_by = excluded.updated_by,
      updated_at = now();

  -- 5. Status remains draft until telemetry canary verifies
end $$;

commit;

notify pgrst, 'reload schema';
`);
}

main().catch((err) => {
  console.error("Provisioning failed:", err.message);
  process.exit(1);
});
