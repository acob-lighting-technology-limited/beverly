"use strict";

const assert = require("node:assert/strict");
const supabase = require("../backend/src/services/supabase-service");
const originalRequest = supabase.restRequest;
const savedEnv = { ...process.env };

(async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("DATABASE_QUOTA_")) delete process.env[key];
  }
  supabase.restRequest = async (pathname, options) => {
    assert.equal(pathname, "/rpc/consumption_database_usage");
    assert.equal(options.method, "POST");
    return { bytes: 409521299, megabytes: 390.55 };
  };
  const { readDatabaseCapacity } = require("../tools/database-capacity-report.cjs");
  const report = await readDatabaseCapacity();
  assert.equal(report.usedBytes, 409521299);
  assert.equal(report.usedMB, 409.52);
  assert.equal(report.usedMiB, 390.55);
  assert.equal(report.configuredBudgetMB, 8000);
  assert.equal(report.remainingBudgetBytes, 7590478701);
  assert.equal(report.importStopAtBytes, 6400000000);
  assert.equal(report.incrementalImportPaused, false);
  assert.equal(report.backfillPaused, false);
  assert.equal(report.providerPlanVerified, false);
  process.env.DATABASE_QUOTA_MB = "500";
  const changed = await readDatabaseCapacity();
  assert.equal(changed.configuredBudgetMB, 500);
  assert.equal(changed.incrementalImportPaused, true);
  assert.equal(changed.backfillPaused, true);
  console.log("database capacity report passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  supabase.restRequest = originalRequest;
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key];
  }
  Object.assign(process.env, savedEnv);
});
