"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261021120000_oem_telemetry_ownership_quarantine.sql"), "utf8").toLowerCase();
const rollback = fs.readFileSync(path.join(root, "supabase/rollbacks/20261021120000_oem_telemetry_ownership_quarantine.rollback.sql"), "utf8").toLowerCase();

assert.match(migration, /create or replace function public\.apply_oem_telemetry_page/);
assert.match(migration, /oem_installation_id\s*=\s*p_installation_id/);
assert.match(migration, /m\.serial\s*=\s*r\.external_meter_id/);
assert.match(migration, /m\.site_id\s*=\s*r\.external_site_id/);
assert.match(migration, /m\.customer_external_id\s*=\s*r\.external_customer_id/);
assert.match(migration, /m\.status\s*=\s*'active'/);
assert.match(migration, /'telemetry_meter_ownership_mismatch'/);
assert.match(migration, /insert into public\.oem_telemetry_quarantine/);
assert.match(migration, /q\.provider_payload\s*=\s*r\.provider_payload/);
assert.match(migration, /select distinct p_installation_id, 'telemetry_meter_ownership_mismatch', r\.provider_payload/);
assert.match(migration, /select count\(\*\) into v_quarantine from incoming_readings r/);
assert.doesNotMatch(migration, /get diagnostics v_quarantine = row_count/);
assert.match(migration, /insert into public\.oem_sync_cursors/);
assert.doesNotMatch(migration, /drop trigger|delete from public\.oem_telemetry/);
assert.match(rollback, /create or replace function public\.apply_oem_telemetry_page/);
assert.doesNotMatch(rollback, /drop trigger|delete from public\.oem_telemetry/);

console.log("OEM telemetry ownership quarantine migration contract passed");
