# Meter ingestion implementation

Branch: `codex/meter-ingestion-recovery`.
Base: `c1b68e8421b82b4d9d842cbdb946f50e59ef4807`.

## Implemented changes

- Pro database budget: 8,000 MB.
- Existing safety percentages remain unchanged.
- Source requests use `currentDateRange`.
- Source ordering includes meter identifiers.
- Unsupported date boundaries never terminate scans.
- Bounded scans retain durable checkpoints.
- Resumption replays the preceding boundary.
- Station leases prevent overlapping execution.
- Failed writes cannot advance checkpoints.
- Failed aggregates cannot report success.
- Every eligible station receives processing.
- ADMIN is excluded from automatic collection.
- Zero-row stations cannot exhaust fixed slots.
- Default lookback spans seven days.
- Explicit recovery windows override newest dates.
- Closed reporting days use Lagos boundaries.
- Per-station health records capacity pauses.
- Reports expose unverified source completeness.
- XLSX exports include collection warnings.
- Report reads never repair ingestion implicitly.
- Missing gateway telemetry remains unavailable.
- Archive sizes correctly display MiB.
- Organization storage remains separately accounted.
- Import retention matches sixty-day storage.

## Scheduling

Vercel's daily fallback remains compatible.
Hourly dispatch uses existing Supabase infrastructure.
Its initial job state is inactive.
Enable only after production canary verification.

Job name: `consumption-sync-hourly`.
Schedule: minute twenty, every hour.
Endpoint budget: forty-five seconds per invocation.
Authentication uses existing Vault credentials.
Successful enqueueing does not prove ingestion.

## Recovery commands

These commands require configured server credentials.
Dry runs do not modify readings.

```powershell
npm run database:capacity
npm run consumption:reconcile -- --from 2026-10-21 --to 2026-10-24
npm run consumption:reconcile -- --from 2026-10-21 --to 2026-10-24 --stations OFEMILI --apply
npm run consumption:reconcile -- --from 2026-10-21 --to 2026-10-24 --apply
```

Reconciliation compares identities and energy values.
Evidence contains counts, never customer payloads.
Results remain observed, not snapshot-certified.
Earlier retained periods require separate assessment.

## Verification evidence

Evidence directory: `tmp/meter-recovery/`.

- Targeted production backup exported successfully.
- Six table row counts matched.
- Restoration used isolated local PostgreSQL.
- External foreign keys were excluded.
- External authorization policies were unavailable.
- State RLS was explicitly enabled locally.
- Lease ownership regression checks passed.
- Full application tests passed locally.
- Security and wallet tests passed.
- Browser suite passed after completed builds.
- Hardening checks passed: sixteen of sixteen.

Production deployment and recovery remain pending.
Release evidence must update this document.

## Remaining external verification

- Full-day scheduled operation remains unobserved.
- Physical gateway repair requires field evidence.
- Provider project access remains permission-blocked.
- Physical free disk remains separately unmeasured.
- Organization-wide ERP usage remains separately unmeasured.

## Rollback

Disable `consumption-sync-hourly` before runtime rollback.
Keep additive columns and recovered readings.
Use the preceding verified production deployment.
Retain the 8,000 MB budget correction.
Do not restore unrelated ERP resources.
Do not delete recovered reading records.
