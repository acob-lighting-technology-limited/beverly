# Meter upload incident: evidence-based investigation

What this repo does: Beverly reads Calinmeter daily readings from an upstream meter service, stores them in Supabase, and serves consumption reports. Token vending uses separate endpoints and persistence. This investigation assumes the actual 11-entry station directory and the six operating sites named in the staff email.

Audit date: 25 October 2026. Scope: upstream reading and gateway APIs, production database, import run history, database jobs, archive catalogue, report-serving code and the source of the verified production deployment. Initial audit excluded production repairs.

**Subsequent repair:** production fixes are deployed.
Missing readings have been recovered.
Runtime configuration now uses 8GB.
Earlier observations remain historical evidence.
See [verified implementation status](METER_INGESTION_IMPLEMENTATION_STATUS_2026-10-25.md).

## Conclusion

The staff's missing-reading counts are real: **all 24 supplied counts match the live database exactly for 21–24 October 2026**. The upstream service has readings that Beverly lacks. A universal loss of collection at all six sites is not supported by the current evidence.

The latest scheduled import was invoked but stopped at the application's capacity guard. Before that, the scheduler rotated through only four of eleven station-directory entries per day, recording partial runs for the six sites. The importer advances using the latest reading date rather than a verified complete date. This combination explains the staggered, frozen reporting pattern and prevents a guarantee of automatic recovery.

The email calls 24 October Friday and 25 October Saturday, which matches 2025 rather than 2026. The exact reproduced database values belong to 2026. The screenshot does not establish the email year; do not silently rewrite its original date.

## Reproduced staff counts

Counts are distinct station/meter/date records, not sales or successful communication percentages. SQL confirmed row counts equal distinct meter counts for these dates.

| Site | 21 Oct | 22 Oct | 23 Oct | 24 Oct |
| --- | ---: | ---: | ---: | ---: |
| Tunga | 610 | 610 | 137 | 1 |
| Umaisha | 744 | 744 | 531 | 105 |
| Ogufa | 544 | 508 | 200 | 0 |
| Kyakale | 246 | 56 | 0 | 0 |
| Musha | 330 | 281 | 31 | 0 |
| Ofemili | 138 | 133 | 76 | 0 |

Kyakale's 21 October figure is not a verified normal baseline: the bounded upstream scan already found 324 distinct meters for that date, 78 absent from Beverly.

## Upstream comparison

Read ten pages of 500 records per site, checked HTTP and business success codes, grouped by the actual `currentDate`, and compared meter identifiers against stored identifiers. The upstream did not honor the supplied `FROM`/`TO` bounds: for example, a request restricted to 24 October returned 25 October readings, and bounded requests returned dates as old as 2015. Therefore the API's `total` was not treated as the requested date's meter count.

These are **observed lower bounds**, not certified complete upstream totals. The upstream remained live during pagination; a stable database snapshot and exhaustive source reconciliation were unavailable.

| Site | Source meters observed, 23 Oct | Beverly, 23 Oct | Source meters observed, 24 Oct | Beverly, 24 Oct | Missing source meter-days observed, 22–24 Oct |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tunga | 610 | 137 | 341 | 1 | 813 |
| Umaisha | 744 | 531 | 533 | 105 | 641 |
| Ogufa | 544 | 200 | 511 | 0 | 891 |
| Kyakale | 324 | 0 | 245 | 0 | 837 |
| Musha | 330 | 31 | 284 | 0 | 632 |
| Ofemili | 138 | 76 | 133 | 0 | 200 |
| **Total** | | | | | **4,014** |

Source readings dated 25 October were also observed for all six sites. Their Beverly stored counts were zero at the comparison time. Today is incomplete; do not use its morning counts as a full-day collection success rate.

## Must fix

1. **Scheduled import stops at 400 MB, below the configured 500 MB budget.**
   - **What this is:** The import's safety guard compares the exact database bytes with a configured budget (`consumption-sync-service.js`, `databaseQuotaState`).
   - **Problem:** The 25 October run at `03:04:30.803 UTC` recorded `quota_paused`, `hard_stop`, and `Database usage 80.48% reached hard_stop`, with zero pages fetched. The current measurement is 409.59 MB against the same 400 MB cutoff. This latest pause does not by itself explain every earlier missing date.
   - **Fix:** Verify the provider entitlement and establish sustainable database headroom before restarting; retain the guard until a measured capacity decision supports a change. Recheck usage after catch-up.
   - **If we skip it:** Scheduled attempts continue without collecting any rows, even while source readings are available.

2. **Daily scheduling does not visit every station each day.**
   - **What this is:** The deployed scheduler runs once daily at `03:00 UTC` (04:00 Lagos), limits itself to four claimed directory entries and rotates oldest-started stations.
   - **Problem:** The source directory has 11 entries, including ADMIN, 0001 and empty stations. Kyakale last ran on 22 October; Musha, Ofemili and Ogufa on 23 October; Tunga and Umaisha on 24 October. This is directly recorded in run history. Zero-row stations consume scheduling slots too.
   - **Fix:** Schedule all eligible operating sites within a measured execution budget, with bounded continuation where needed. Define which directory entries are actually collectible stations.
   - **If we skip it:** A daily report is fed by imports spaced several days apart, and fresh partial-day counts remain frozen between visits.

3. **Automatic recovery skips older incomplete dates.**
   - **What this is:** `syncWindow` starts at the maximum stored reading date with a default zero-day lookback.
   - **Problem:** Tunga has one row on 24 October and only 137 on 23 October; the default next window starts on the 24th. It cannot fetch the 473 observed missing meter records on the 23rd. Kyakale similarly has 56 on the 22nd but is already missing 78 observed records on the 21st. A single late/newer reading advances the date without proving previous dates complete.
   - **Fix:** Reconcile the incident window explicitly, including 21 October where already incomplete. Use overlap for late arrivals and advance a completion boundary only after source reconciliation, rather than maximum-date presence.
   - **If we skip it:** Importing resumes but old gaps remain in O&M reporting.

4. **Scheduled imports are capped at eight pages and cannot resume a partial page sequence.**
   - **What this is:** `runScheduledConsumptionSync` explicitly supplies eight pages, overriding the configured `CONSUMPTION_SYNC_INCREMENTAL_MAX_PAGES=50`. Each station invocation starts again at page one.
   - **Problem:** The incident runs for the six sites consistently show eight pages/4,000 fetched rows and `partial`. Actual source responses mix old and recent dates despite the requested bounds, consuming the budget. A single page's descending dates also cannot prove global ordering across pages; the early-stop rule relies on that assumption.
   - **Fix:** Verify supported source filtering and stable sorting, then continue bounded jobs from durable progress and distinguish exhausted budgets from complete reconciliation. Do not merely increase an environment value that this caller overrides.
   - **If we skip it:** Repeated partial imports can leave historical gaps while the maximum stored date still moves forward. The current scan does not establish that page truncation alone caused each specific missing record.

5. **Nonempty local report results can hide newer source readings.**
   - **What this is:** The deployed facade tries `readDailyMeterRows` before proxying the upstream request (`api/reference.js`).
   - **Problem:** For a station/date range with any stored rows, `readDailyMeterRows` returns those rows and their local count without reconciling source completeness. It returns `null` only when no local rows exist. A range containing 23–24 October for Tunga can therefore look valid while missing hundreds of source records.
   - **Fix:** Surface incomplete/stale import status with the report and provide a deliberate reconciliation path. Do not treat a nonempty cache as proof of completeness.
   - **If we skip it:** Staff receive plausible counts that cannot be trusted as full collection totals. A full authenticated browser reproduction was unavailable; this finding is grounded in verified deployed source and the database/source mismatch.

## Should fix

6. **Production records the quota stop as AUTO instead of updating every affected station.**
   - **What this is:** In the verified deployed commit, the guard runs before resolving the station directory and calls `recordQuotaPause(requestedStations, ...)`.
   - **Problem:** The 25 October pause appears under AUTO; station state still shows old partial/success entries. The current workspace has a correction to resolve stations first, but that correction is absent from verified production.
   - **Fix:** Release the existing correction after its normal checks and show both global capacity pauses and site freshness. Do not describe this as already fixed in production.
   - **If we skip it:** Operators have to read global logs to discover why every site stopped updating.

7. **Capacity and retention information differs between deployed configuration and the database.**
   - **What this is:** Production source declares a 90-day hot window; the live `run_consumption_retention()` definition deletes eligible raw/delta/daily-weekly aggregate data older than 60 days. The workspace also has unreleased retention changes.
   - **Problem:** The importer and retention job do not share the same deployed hot-window setting. That mismatch can cause repeated fetch/delete work for the extra month, adding unnecessary load. It is not evidence that October 22–24 data was deleted: those dates are inside both windows.
   - **Fix:** Align the verified live retention function and deployed import/archive configuration, with archive validation before any further retention change.
   - **If we skip it:** Capacity planning and recovery expectations remain inconsistent. Archive coverage dates and successful archive refreshes alone do not certify complete readings.

## Gateway findings

The raw gateway endpoint returned 30 entries. Current reported states relevant to the six sites:

| Site association | Reported state and success rate |
| --- | --- |
| Tunga | TUNGA_1 online 60.49%; TUNGA_2 online 72.47%; TUNGA_3 online 87.86% |
| Umaisha | UMAISHA_COMMUNITY online 20.83%; UMAISHA_2 online 87.89%; UMAISHA_3 online 87.63% |
| Ogufa | OGUFA_COMMUNITY online 98.6%; OGUFA_2 online 84.06%; OGUFA_3 online 64.58% |
| Kyakale | KYAKALE_COMMUNITY online 69.82%; KYAKALE_2 offline 0%, update date 19 July 2026 |
| Musha | MUSHA_COMMUNITY online 76.06%; MUSHA_2 offline 0%, update date 24 October 2026 |
| Ofemili name association | Obafemil1 online 100%; Obafemili2 online 87.69% |

Most upstream gateways carry `stationId=admin`. Associations above use their displayed gateway names, not a verified physical site inventory. Ofemili names differ in spelling. Success-rate periods and the meaning/timezone of `updateDate` are undocumented; do not present them as direct network probes or last successful upload times.

There are individual gateway issues worth field investigation, particularly MUSHA_2 and the low UMAISHA_COMMUNITY rate. Current source readings for every site rule out the assertion that every site has completely stopped supplying data at the time of this audit. Historical gateway connectivity throughout the incident is not established.

The gateway health normalizer also fabricates fallback RSSI, IP, MAC and on-call fields when source fields are absent. This investigation used raw source states and did not use those generated values as evidence.

## Sales and jobs

The source credit-token record endpoint returned business success. A bounded 500-record sample contained records on 22, 23, 24 and 25 October (35/234/202/29 respectively). Those sample counts are not daily totals. They confirm continued record presence, not normal sales volume, payment reconciliation or token delivery. The local `token_transactions` table returned no rows in the queried recent period, so it was not used to corroborate sales.

Database cron history records successful consumption aggregate refreshes and the 60-day retention job during 22–25 October. Aggregate refreshes recompute available stored readings; their success does not prove new reading ingestion succeeded. The import's own run log proves the 25 October attempt reached the application and paused. No production scheduler restart is justified by a claim that it was simply not invoked.

## Recovery answer and acceptance criteria

**At least the 4,014 observed missing meter-days are available from the upstream service. Automatic complete backfill is not guaranteed by the existing implementation.**

1. Confirm project plan entitlement and sufficient sustainable headroom using the [capacity status](DATABASE_CAPACITY_STATUS_2026-10-25.md). Do not bypass the stop threshold just to get a green job.
2. Reconcile an explicit per-site incident window starting no later than 21 October, checking actual dates and distinct meter identities in source responses. Include later dates as they close.
3. Preserve bounded progress across partial jobs and handle source date filtering/order as observed, not assumed.
4. Verify raw readings, derived consumption aggregates and the staff-facing report against the same source snapshot or bounded observation window. Record remaining source-side gaps separately.
5. Observe successful refreshes for all operating sites after a complete collection cycle. Make stale/partial/quota-paused state visible.
6. Investigate the named individual gateway failures using physical inventory and actual gateway/collector logs. Recheck source gaps after imports catch up.

## Evidence and checks

Local evidence directory: `.codex-audits/meter-upload-incident-2026-10-25/`.

- `initial-evidence.json`: station directory, raw gateways, latest 40 import runs, station states, public site reachability.
- `comparison-evidence.json`: exact REST count headers for 30 station/date combinations and source date-filter probes.
- `source-pages-evidence.json`: 60 source-page summaries and per-date distinct source-versus-store comparisons. Missing-meter examples are hashed; customer payloads were not saved.
- `database-evidence.json`, `operations-evidence.json`, `capacity-evidence.json`: read-only SQL allocation, table sizes, cron history, function definitions, archive metadata and counts. All SQL sessions used `BEGIN READ ONLY` and rolled back. Initial direct-host DNS failure was resolved using the pooler already documented in this repo.
- `token-evidence.json`: aggregate-only token record sample.
- `public-evidence.json`: production public site and API authentication boundary. The upstream bearer token is not a Beverly server session; report API access returned 401.
- `deployed-*`: source extracted from Git at the Vercel-confirmed production commit `c1b68e8421b82b4d9d842cbdb946f50e59ef4807`. Production deployment: `dpl_Eia7ZXvaG9Hv3MChhNriEx2pS4WP`.

Existing consumption sync service, governance and cron-configuration tests passed. The new capacity report test passed and the read-only capacity command succeeded against the live project. These tests do not certify incident recovery.

**Verdict:** Confirmed ingestion/report completeness failure, with a confirmed capacity pause on the latest attempt and scheduling/recovery defects in deployed source. Establish headroom and explicit reconciliation before relying on the monthly O&M totals.

**Not checked:** Physical concentrator access; collector operating-system logs and buffers; historical gateway packet traces; provider project subscription/disk entitlement; exhaustive source history; archive file integrity; authenticated end-to-end browser reporting; future automatic recovery. No production data, jobs, source configuration or deployment was changed by this investigation.
