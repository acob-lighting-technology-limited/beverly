# Meter ingestion implementation

Updated: 26 October 2026, Lagos.

## Production release

- PR #202 repaired ingestion.
- PR #203 corrected date filters.
- PR #208 prevented station starvation.
- All three changes were merged.
- Production deployment reached READY.
- Production commit: `2efc26f43009cd7173b2406e616200a9c35ea935`.
- Deployment: `dpl_HoQJzRR9nHHnrNwhJXom331HuD8w`.
- Later releases require separate verification.

## Implemented behavior

- Database budget now matches 8 GB.
- Capacity thresholds retain existing percentages.
- Source requests use calendar dates.
- Source ordering includes meter identifiers.
- Scans traverse every returned page.
- Bounded scans retain durable checkpoints.
- Resumption replays the preceding boundary.
- Owner leases prevent overlapping execution.
- Failed writes cannot advance checkpoints.
- Failed aggregates cannot report success.
- Oldest stations receive scheduling priority.
- ADMIN remains excluded from collection.
- Default lookback spans seven days.
- Recovery supports explicit historical windows.
- Reporting days follow Lagos boundaries.
- Reports disclose unverified source completeness.
- Exports include collection status warnings.
- Ordinary report reads avoid ingestion.
- Missing gateway telemetry remains unavailable.
- Archive sizes correctly display MiB.
- Import retention matches sixty-day storage.

## Database capacity

Measurement: `2026-10-26T10:16:51.367Z`.

- Allocated database size: 489,942,163 bytes.
- Decimal database size: 489.94 MB.
- Binary database size: 467.25 MiB.
- Configured budget: 8,000 MB.
- Budget utilization: approximately 6.12%.
- Remaining budget: approximately 7.51 GB.
- User confirmed organization Pro membership.
- Provider plan access remains blocked.
- Physical disk remains separately unmeasured.
- Organization storage remains separately shared.
- ERP organization usage remains unmeasured.

These figures measure database allocation.
They exclude object storage usage.
They exclude physical free disk.

## Applied database migrations

Both migrations were applied successfully.
Migration history records both versions.

- `20261025100406_consumption_sync_resumable_leases.sql`
- `20261025102302_consumption_sync_hourly_dispatch.sql`

Anonymous execution remains denied.
Authenticated client execution remains denied.
Server execution was explicitly verified.

## Hourly collection

- Job: `consumption-sync-hourly`, identifier `27`.
- Current job state: active.
- Schedule: minute twenty, every hour.
- Authentication uses existing Vault credentials.
- Vercel's daily fallback remains configured.
- Dispatcher request `8774` returned HTTP200.
- Dispatcher request `8775` returned HTTP200.
- Neither request timed out.
- Second dispatch visited ten stations.
- Both dispatches reported zero failures.
- Bounded partial scans retained checkpoints.
- Changing source pages remained flagged.

HTTP success alone proves insufficient.
Actual station outcomes were inspected.
Automatic scheduled ingestion was verified.
Its response reported zero failures.
It stored 10,308 reading records.
Full-day scheduling remains unobserved.

## Recovered readings

Initial reconciliation covered six sites.
Incident window: 21–24 October 2026.
Retained window: 26 August–20 October 2026.

| Site | Incident keys | Earlier keys |
|---|---:|---:|
| TUNGA | 2,440 | 34,154 |
| UMAISHA | 2,976 | 41,212 |
| OGUFA | 2,176 | 30,426 |
| KYAKALE | 1,296 | 18,024 |
| MUSHA | 1,320 | 18,228 |
| OFEMILI | 554 | 6,986 |
| Total | 10,762 | 149,030 |

- Restored 80,678 missing meter-days.
- Initially corrected 7,430 differing records.
- Completed comparisons showed zero gaps.
- Completed comparisons showed zero mismatches.
- Later checks detected ten changes.
- Targeted corrections now match sources.

Results represent observed source comparisons.
OEM provides no immutable snapshot.
Later source corrections remain possible.
Normal retention continues advancing daily.
Historical counts describe recorded recovery evidence.

## Derived consumption verification

- Current retained reading snapshots match.
- Comparable daily consumption deltas match.
- September and October monthly totals match.
- Monthly counts match stored deltas.
- Missing prior-day baselines remain uncertified.
- Existing boundary deltas remain preserved.
- No substitute baseline was invented.

## Archive verification

Eighteen monthly partitions were rebuilt.
Six annual bundles were rebuilt.
Annual checksums and row counts matched.
Existing earlier rows remain preserved.
Existing objects receive private backups.
Monthly checksums and reading comparisons passed.
One later correction required archive refreshing.

## Validation and evidence

- Targeted production backup exported successfully.
- Six restored table counts matched.
- Restoration used isolated local PostgreSQL.
- External foreign keys were excluded.
- External authorization policies were unavailable.
- Local lease ownership checks passed.
- Local recovery server was stopped.
- Full application tests passed locally.
- Wallet tests passed: 697 cases.
- Type checks and builds passed.
- Security dependency checks passed.
- Scheduler fairness regressions also passed.
- Release CI completed successfully.
- Conditional API integrity tests skipped.
- CodeRabbit skipped its independent review.
- Authenticated CRM verification remains pending.

Private evidence: `tmp/meter-recovery/`.
Customer payloads remain excluded from summaries.
Backup files retain restricted local access.

## Remaining external verification

- Renew expired CRM authentication.
- Verify authenticated reports and downloads.
- Observe one full scheduled day.
- Inspect physical gateways using field evidence.
- Verify provider billing through authorized access.
- Measure organization-wide ERP storage separately.

## Rollback

Disable hourly dispatch before runtime rollback.
Keep additive columns and recovered readings.
Use the preceding verified production deployment.
Retain the corrected database budget.
Preserve unrelated ERP resources throughout rollback.
Preserve all recovered reading records.
