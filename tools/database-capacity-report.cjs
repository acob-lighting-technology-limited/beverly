"use strict";

const { loadEnvFile } = require("./env-loader.cjs");
const { databaseQuotaState } = require("../backend/src/services/consumption-sync-service");
const deploymentDefaults = require("../vercel.json").env;

async function readDatabaseCapacity() {
  const setting = (key) => process.env[key] || deploymentDefaults[key];
  const quota = await databaseQuotaState({
    databaseQuotaMb: setting("DATABASE_QUOTA_MB"),
    quotaWarnPercent: setting("DATABASE_QUOTA_WARN_PERCENT"),
    quotaBackfillPausePercent: setting("DATABASE_QUOTA_BACKFILL_PAUSE_PERCENT"),
    quotaHardStopPercent: setting("DATABASE_QUOTA_HARD_STOP_PERCENT"),
  }, "incremental");
  const capacityBytes = quota.quotaMb * 1000000;
  const thresholdBytes = (percent) => capacityBytes * percent / 100;
  return {
    measuredAt: new Date().toISOString(),
    databaseHost: new URL(process.env.SUPABASE_URL).host,
    usedBytes: quota.usedBytes,
    usedMB: quota.usedMb,
    usedMiB: Math.round(quota.usedBytes / 1048576 * 100) / 100,
    configuredBudgetMB: quota.quotaMb,
    providerPlanVerified: false,
    capacitySource: "Beverly configuration; verify the project's current plan separately",
    usedPercentOfBudget: quota.usedPercent,
    remainingBudgetBytes: capacityBytes - quota.usedBytes,
    warningAtBytes: thresholdBytes(quota.thresholds.warnPercent),
    backfillPauseAtBytes: thresholdBytes(quota.thresholds.backfillPausePercent),
    importStopAtBytes: thresholdBytes(quota.thresholds.hardStopPercent),
    incrementalImportPaused: quota.quotaPaused,
    backfillPaused: quota.usedBytes >= thresholdBytes(quota.thresholds.backfillPausePercent)
      || quota.quotaPaused,
    note: "Database allocation only. Object storage, physical disk, RAM and billing usage are separate. MB = 1,000,000 bytes; MiB = 1,048,576 bytes.",
  };
}

if (require.main === module) {
  loadEnvFile();
  readDatabaseCapacity().then((report) => {
    console.log(JSON.stringify(report, null, 2));
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = { readDatabaseCapacity };
