# Database capacity: verified status on 25 October 2026

Project: `qpoipyqgrjsjdvfqmxok`. This is a dated observation, not a live counter. Run `npm run database:capacity` for a new read-only measurement.

## Current plan correction — confirmed by the user

The user subsequently confirmed that Beverly now belongs to a **Pro organization shared with ACOB ERP**, with **8 GB database capacity**. The Free organization visible to the connector was not proof of Beverly's plan. Supabase's published Pro allowance is **8 GB of disk per project**, not one 8 GB database allowance shared between the two projects. Object storage (100 GB included) and egress (250 GB included) are organization-wide allowances shared with other projects; Beverly's file usage alone does not establish the organization's remaining allowance. [Official billing scope](https://supabase.com/docs/guides/platform/billing-on-supabase).

Updated `vercel.json` and `.env.example` to `DATABASE_QUOTA_MB=8000`. The existing percentages now give a **5.6 GB warning**, **6 GB backfill pause**, and **6.4 GB incremental import stop**. This retains headroom for disk overhead. The live report command uses these updated local defaults; exact physical disk use, including WAL, is not measured by the database-size RPC.

Using the latest pre-correction live observation of **409,767,059 bytes (409.77 MB)**, usage is **5.12%** of the new configured budget, leaving **7,590,232,941 bytes (7.59 GB)** against that budget. The database-size snapshot and provider disk capacity have different scopes; this is not a measurement of physical disk free space.

**Deployment status:** this correction is in the workspace. No production deployment or import restart has been performed. The previously verified production deployment still declares the old 500 MB setting; a release must carry the updated configuration before production can use the larger budget. Independent provider-project API verification is still permission-blocked; the plan correction is explicitly sourced to the user.

The observations below describe the **old configuration at the time of the initial audit**, retained as incident evidence. They do not describe the newly confirmed plan.

## Historical observation before the plan correction

| Measure | Verified result |
| --- | --- |
| Application database allocation | 409,586,835 bytes = **409.59 MB = 390.61 MiB** |
| Beverly's configured database budget | **500 MB = 500,000,000 bytes** |
| Used against that configured budget | **81.92%** |
| Remaining against that configured budget | **90,413,165 bytes = 90.41 MB** |
| Warning threshold | 70% = **350 MB** |
| Backfill pause threshold | 75% = **375 MB** |
| Incremental import stop threshold | 80% = **400 MB** |
| Application import status at measurement | Both incremental import and backfill would pause |
| PostgreSQL default read-only setting | `off` at the earlier SQL observation |
| Stored file metadata total | **216,485,391 bytes = 216.49 MB**; measured separately |

MB means 1,000,000 bytes. MiB means 1,048,576 bytes. PostgreSQL's `pg_size_pretty` prints binary units with an `MB` label; its rounded `391 MB` result is not 391 decimal MB. The existing `consumption_database_usage().megabytes` field is also binary; the capacity command uses its exact `bytes` field when available.

The capacity command's measurement timestamp was `2026-10-25T09:38:35.535Z` on the execution host. The database clock was about six minutes ahead of that host during this audit. SQL evidence includes database timestamps. These are separate observations; allocation can change between them.

## Initial verification limitations

The 500 MB value is confirmed in the production deployment's source configuration (`c1b68e8421b82b4d9d842cbdb946f50e59ef4807`) and in the current workspace's `vercel.json`. No project-level quota overrides appeared in the connected Vercel environment-variable listing. The live import log independently reports an 80% hard stop.

At the initial audit, Supabase **project-specific subscription and disk allocation could not be independently verified**. The connected Supabase identity lists no projects and returns a permission error for this project. It can read a Free organization, but that does not establish that Beverly belongs to it. The browser dashboard also returned Forbidden. The later user confirmation above supersedes the initial unknown plan status; connector verification remains unavailable.

Supabase currently publishes 500 MB of database size per Free project, with 1 GB of object storage, and 8 GB of included disk per Pro project. These are plan terms, not evidence of Beverly's current subscription. See [Supabase pricing](https://supabase.com/pricing) and [billing quotas](https://supabase.com/docs/guides/platform/billing-on-supabase).

Database allocation, physical disk (including WAL/system overhead), RAM, object storage, egress and monthly billing averages are different quantities. The measured database is below Beverly's 500 MB budget but above the application's 400 MB import cutoff. The observed stop is an application guard; this audit did not establish a provider-enforced read-only restriction.

## File storage, separately measured

Read-only query against `storage.objects`, summing numeric `metadata.size` values:

| Bucket | Objects | Bytes |
| --- | ---: | ---: |
| archives | 150 | 14,298,655 |
| receipts | 16 | 165,150 |
| uploads | 166 | 100,622,333 |
| wallet-kyc-documents | 84 | 101,074,297 |
| wallet-profile-pictures | 9 | 324,956 |
| **Total** | **425** | **216,485,391** |

This is metadata-based logical object size for this project, not a bucket-content download, organization-wide invoice total, or proof of archive integrity. The archive report's 12.26 `totalSizeMb` is actually MiB for catalogued archive files only; it is not total project storage. Its hardcoded `storageQuotaMb=1024` is not independently verified provider capacity and must not be used as such.

An earlier SQL snapshot also measured `template1` at 7,736,467 bytes. The application command measures `current_database()` only; it does not claim to match every database included in the provider dashboard's scope.

## Updates made

- Added `npm run database:capacity`, which reads the existing database-size RPC and reuses the application's quota calculations. It reports bytes, decimal MB, binary MiB, configured budget, remaining budget and pause thresholds without changing database data.
- Added the quota settings to `.env.example`, then updated the budget from 500 to 8,000 MB following the user's Pro-plan confirmation. The 70/75/80 safety percentages are unchanged.
- Linked this status from the README and operating manual. Historical incident reports retain their original dated measurements.
- Added a capacity test covering units, threshold behavior, environment overrides and the distinction between configured and provider-verified capacity.

The workspace's configured budget was updated following the user's capacity correction. No provider upgrade, production quota change, cleanup, import restart, schema change or deployment was performed by this agent. Actual usage remains measured live; it is not written into runtime configuration as a fixed value.

## Historical operational consequence under the 500 MB setting

At the measurement above, allocation must fall by more than **9.59 MB** to get below the 400 MB incremental import cutoff, and more than **34.59 MB** to get below the 375 MB backfill cutoff, with additional headroom needed for recovered readings and derived tables. These are arithmetic gaps, not promised cleanup savings. Confirm the project's actual provider plan before changing its configured budget.

See [the meter-upload investigation](METER_UPLOAD_INCIDENT_AUDIT_2026-10-25.md) for why restoring capacity alone will not repair all missing readings.
