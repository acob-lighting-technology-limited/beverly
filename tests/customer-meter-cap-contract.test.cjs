"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const purchase = read("backend/wallet/src/services/customer-purchase.ts");
const routes = read("backend/wallet/src/routes/customer.ts");
const meters = read("apps/customer/src/views/Meters.vue");
const policy = read("backend/wallet/src/services/kyc-tier-policy.ts");
const settings = read("apps/admin/src/views/KycSettings.vue");
const migration = read("supabase/migrations/20261020100000_configurable_kyc_meter_limits.sql");
const enforcement = read("supabase/migrations/20261020110000_enforce_customer_meter_tier_allowance.sql");

assert.match(migration, /tier0_meter_limit integer not null default 3/, "Tier 0 must start with a three-meter allowance");
assert.match(migration, /tier1_meter_limit integer not null default 5/, "Tier 1 must start with a five-meter allowance");
assert.match(migration, /tier2_meter_limit integer not null default 10/, "Tier 2 must start with a ten-meter allowance");
assert.match(policy, /effectiveTierMeterLimit/, "meter allowances must come from the KYC policy");
assert.match(purchase, /getKycTierPolicy\(\)/, "new meter links must read the active KYC policy");
assert.match(settings, /Tier 0 meter allowance/, "staff must be able to choose Tier 0 meter allowance");
assert.match(settings, /tier2MeterLimit/, "staff saves an allowance for every tier");
assert.match(enforcement, /pg_advisory_xact_lock/, "concurrent meter links must serialize per customer");
assert.match(enforcement, /customer_meter_limit_reached/, "database must reject links beyond the configured allowance");
assert.match(purchase, /customer_meter_limit_reached/, "customer links must present database capacity rejections clearly");
assert.match(purchase, /meter_limit_unavailable/, "meter links must fail safely when the existing-meter count cannot be read");
assert.match(purchase, /meter_list_unavailable/, "meter lists must report storage failures");
assert.match(routes, /Meter removal failed\. Please try again\./, "unlink failures must be safe for customers");
assert.match(meters, /metersError/, "the customer portal must show meter loading failures");
assert.match(meters, /unlinkError/, "the customer portal must show meter removal failures");

console.log("customer meter capacity contract passed");
