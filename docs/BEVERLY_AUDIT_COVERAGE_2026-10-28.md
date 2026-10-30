# Beverly audit coverage appendix

Audit date: October 28, 2026.
Revision: `4b20fab4`.
Timezone: Africa/Lagos.

See [audit findings](BEVERLY_WEEKLY_AUDIT_2026-10-28.md).
See [implementation plan](BEVERLY_MASTER_FIX_PLAN_2026-10-28.md).

## Coverage classifications

- **Inventoried:** route declaration discovered only.
- **Inspected:** relevant source chain investigated.
- **Fixture exercised:** existing mocked browser exercised.
- **Focused pass:** listed focused check passed.
- **Failed:** actual check failed.
- **Blocked:** required access/evidence unavailable.
- **Not verified:** no sufficient execution evidence.

Inventoried never means functionally complete.
Source inspection never proves deployed behavior.
Fixture execution never proves live integration.

## Route totals

| Surface | Declarations | Inventory source |
|---|---:|---|
| CRM | 52 | `src/data/route-manifest.js` |
| Wallet admin | 58 | `apps/admin/src/router/index.ts` |
| Vendor | 26 | `apps/vendor/src/router/index.ts` |
| Customer | 32 | `apps/customer/src/router/index.ts` |
| Total | 168 | Aliases/catchalls included |

These counts measure declarations, not unique journeys.
Landing/public components require separate runtime inventory.
Manual OEM overlays are listed separately.

## Route-by-route inspection matrix

Line anchors reference the audited source.
Full keyboard/visual review remains unverified.
“Live” browser fixtures intercepted every API.

### CRM

| Route | Source line | Audit coverage |
|---|---:|---|
| `#/dashboard` | `src/data/route-manifest.js:2` | Inspected; fixture exercised; F04 |
| `#/admin/reports` | `src/data/route-manifest.js:3` | Inventoried; journey not verified |
| `#/token-generate/credit-token` | `src/data/route-manifest.js:4` | Inventoried; journey not verified |
| `#/token-generate/change-meter-key` | `src/data/route-manifest.js:5` | Inventoried; journey not verified |
| `#/token-generate/clear-tamper-token` | `src/data/route-manifest.js:6` | Inventoried; journey not verified |
| `#/token-generate/clear-credit-token` | `src/data/route-manifest.js:7` | Inventoried; journey not verified |
| `#/token-generate/set-maximum-power-limit-token` | `src/data/route-manifest.js:8` | Inventoried; journey not verified |
| `#/token-record/credit-token-record` | `src/data/route-manifest.js:9` | Inventoried; journey not verified |
| `#/token-record/clear-tamper-token-record` | `src/data/route-manifest.js:10` | Inventoried; journey not verified |
| `#/token-record/clear-credit-token-record` | `src/data/route-manifest.js:11` | Inventoried; journey not verified |
| `#/token-record/set-maximum-power-limit-token-record` | `src/data/route-manifest.js:12` | Inventoried; journey not verified |
| `#/remote-operation/remote-meter-reading` | `src/data/route-manifest.js:13` | Inventoried; journey not verified |
| `#/remote-operation/remote-meter-control` | `src/data/route-manifest.js:14` | Inventoried; journey not verified |
| `#/remote-operation/remote-meter-token` | `src/data/route-manifest.js:15` | Inventoried; journey not verified |
| `#/remote-operation-record/remote-meter-reading-task` | `src/data/route-manifest.js:16` | Inventoried; journey not verified |
| `#/remote-operation-record/remote-meter-control-task` | `src/data/route-manifest.js:17` | Inventoried; journey not verified |
| `#/remote-operation-record/remote-meter-token-task` | `src/data/route-manifest.js:18` | Inventoried; journey not verified |
| `#/prepay-report/long-nonpurchase-situation` | `src/data/route-manifest.js:19` | Inventoried; journey not verified |
| `#/prepay-report/low-purchase-situation` | `src/data/route-manifest.js:20` | Inventoried; journey not verified |
| `#/prepay-report/consumption-statistics` | `src/data/route-manifest.js:21` | Inventoried; journey not verified |
| `#/prepay-report/daily-data-meter` | `src/data/route-manifest.js:22` | Inspected changed report flow; focused regressions passed |
| `#/prepay-report/abnormal-alarm` | `src/data/route-manifest.js:23` | Inventoried; journey not verified |
| `#/prepay-report/station-consumption` | `src/data/route-manifest.js:24` | Inspected changed report flow; focused regressions passed |
| `#/prepay-report/archive-reports` | `src/data/route-manifest.js:25` | Inventoried; journey not verified |
| `#/management/gateway` | `src/data/route-manifest.js:26` | Inventoried; journey not verified |
| `#/management/customer` | `src/data/route-manifest.js:27` | Inspected CRM data path; F03/F04 |
| `#/management/tariff` | `src/data/route-manifest.js:28` | Inventoried; journey not verified |
| `#/management/account` | `src/data/route-manifest.js:29` | Inspected CRM data path; F03/F04 |
| `#/admin/user` | `src/data/route-manifest.js:30` | Inventoried; journey not verified |
| `#/admin/role` | `src/data/route-manifest.js:31` | Inventoried; journey not verified |
| `#/admin/log` | `src/data/route-manifest.js:32` | Inventoried; journey not verified |
| `#/admin/station` | `src/data/route-manifest.js:33` | Inventoried; journey not verified |
| `#/admin/item` | `src/data/route-manifest.js:34` | Inventoried; journey not verified |
| `#/admin/meter` | `src/data/route-manifest.js:35` | Inventoried; journey not verified |
| `#/admin/debt` | `src/data/route-manifest.js:36` | Inventoried; journey not verified |
| `#/wallet` | `src/data/route-manifest.js:37` | Inventoried; journey not verified |
| `#/protocol/dlms` | `src/data/route-manifest.js:38` | Inventoried; journey not verified |
| `#/protocol/dlt645` | `src/data/route-manifest.js:39` | Inventoried; journey not verified |
| `#/remote-support/gprs-tasks` | `src/data/route-manifest.js:40` | Inventoried; journey not verified |
| `#/remote-support/gprs-online-status` | `src/data/route-manifest.js:41` | Inventoried; journey not verified |
| `#/remote-support/load-profile` | `src/data/route-manifest.js:42` | Inventoried; journey not verified |
| `#/remote-support/event-notification` | `src/data/route-manifest.js:43` | Inventoried; journey not verified |
| `#/remote-support/firmware-update` | `src/data/route-manifest.js:44` | Inventoried; journey not verified |
| `#/remote-support/file-upload` | `src/data/route-manifest.js:45` | Inventoried; journey not verified |
| `#/system/station-onboarding-studio` | `src/data/route-manifest.js:49` | Inventoried; journey not verified |
| `#/system/automation-command` | `src/data/route-manifest.js:57` | Inventoried; journey not verified |
| `#/telemetry/power-quality` | `src/data/route-manifest.js:58` | Inspected; fixture exercised; F05 |
| `#/telemetry/demand-curves` | `src/data/route-manifest.js:59` | Inspected; fixture exercised; F05 |
| `#/grid-control/remote-relay` | `src/data/route-manifest.js:60` | Inspected; fixture exercised; F01 |
| `#/analytics/energy-audit` | `src/data/route-manifest.js:61` | Inspected; fixture exercised; F06 |
| `#/mesh/gateways` | `src/data/route-manifest.js:62` | Inspected; fixture exercised; F05 |
| `#/guide` | `src/data/route-manifest.js:63` | Inspected navigation/content; F12/F13 |

### Wallet admin

| Route | Source line | Audit coverage |
|---|---:|---|
| `/login` | `apps/admin/src/router/index.ts:17` | Inventoried; journey not verified |
| `/forgot-password` | `apps/admin/src/router/index.ts:18` | Inventoried; journey not verified |
| `/reset-password` | `apps/admin/src/router/index.ts:19` | Inventoried; journey not verified |
| `/setup-account` | `apps/admin/src/router/index.ts:20` | Inventoried; journey not verified |
| `/password-change` | `apps/admin/src/router/index.ts:21` | Inventoried; journey not verified |
| `/` | `apps/admin/src/router/index.ts:22` | Inventoried; journey not verified |
| `/applications` | `apps/admin/src/router/index.ts:23` | Inventoried; journey not verified |
| `/vendors` | `apps/admin/src/router/index.ts:24` | Inventoried; journey not verified |
| `/vendors/new` | `apps/admin/src/router/index.ts:25` | Inventoried; journey not verified |
| `/vendors/analytics` | `apps/admin/src/router/index.ts:26` | Inventoried; journey not verified |
| `/vendors/:id` | `apps/admin/src/router/index.ts:27` | Inventoried; journey not verified |
| `/funding` | `apps/admin/src/router/index.ts:28` | Inventoried; journey not verified |
| `/funding/history` | `apps/admin/src/router/index.ts:29` | Inventoried; journey not verified |
| `/wallets` | `apps/admin/src/router/index.ts:30` | Inventoried; journey not verified |
| `/vendor-transfers` | `apps/admin/src/router/index.ts:31` | Inventoried; journey not verified |
| `/purchases` | `apps/admin/src/router/index.ts:32` | Inventoried; journey not verified |
| `/customers` | `apps/admin/src/router/index.ts:33` | Inventoried; journey not verified |
| `/customers/:id` | `apps/admin/src/router/index.ts:34` | Inventoried; journey not verified |
| `/meter-approvals` | `apps/admin/src/router/index.ts:35` | Inventoried; journey not verified |
| `/vending` | `apps/admin/src/router/index.ts:36` | Inventoried; journey not verified |
| `/consumption` | `apps/admin/src/router/index.ts:37` | Inventoried; journey not verified |
| `/audit` | `apps/admin/src/router/index.ts:38` | Inventoried; journey not verified |
| `/meter-orders` | `apps/admin/src/router/index.ts:39` | Inventoried; journey not verified |
| `/meter-orders/new` | `apps/admin/src/router/index.ts:40` | Inventoried; journey not verified |
| `/meter-pricing` | `apps/admin/src/router/index.ts:41` | Inventoried; journey not verified |
| `/fraud` | `apps/admin/src/router/index.ts:42` | Inventoried; journey not verified |
| `/kyc-reviews` | `apps/admin/src/router/index.ts:43` | Inventoried; journey not verified |
| `/kyc-settings` | `apps/admin/src/router/index.ts:44` | Inventoried; journey not verified |
| `/disputes` | `apps/admin/src/router/index.ts:45` | Inventoried; journey not verified |
| `/support` | `apps/admin/src/router/index.ts:46` | Inventoried; journey not verified |
| `/announcements` | `apps/admin/src/router/index.ts:47` | Inventoried; journey not verified |
| `/refunds` | `apps/admin/src/router/index.ts:48` | Inventoried; journey not verified |
| `/settlement` | `apps/admin/src/router/index.ts:49` | Inventoried; journey not verified |
| `/reconciliation` | `apps/admin/src/router/index.ts:50` | Inventoried; journey not verified |
| `/feature-flags` | `apps/admin/src/router/index.ts:51` | Inventoried; journey not verified |
| `/roles` | `apps/admin/src/router/index.ts:52` | Inventoried; journey not verified |
| `/permissions` | `apps/admin/src/router/index.ts:53` | Inventoried; journey not verified |
| `/roles-permissions` | `apps/admin/src/router/index.ts:54` | Inventoried; journey not verified |
| `/privacy` | `apps/admin/src/router/index.ts:55` | Inventoried; journey not verified |
| `/profile` | `apps/admin/src/router/index.ts:56` | Inventoried; journey not verified |
| `/security` | `apps/admin/src/router/index.ts:57` | Inventoried; journey not verified |
| `/notifications` | `apps/admin/src/router/index.ts:58` | Inventoried; journey not verified |
| `/settings` | `apps/admin/src/router/index.ts:59` | Inventoried; journey not verified |
| `/guide` | `apps/admin/src/router/index.ts:60` | Inspected routing/content; F12 |
| `/reports` | `apps/admin/src/router/index.ts:61` | Inventoried; journey not verified |
| `/dev` | `apps/admin/src/router/index.ts:63` | Inventoried; journey not verified |
| `/dev/oem` | `apps/admin/src/router/index.ts:64` | Changed OEM-console source traced; deployed behavior unverified |
| `/dev/api-keys` | `apps/admin/src/router/index.ts:65` | Inventoried; journey not verified |
| `/dev/webhooks` | `apps/admin/src/router/index.ts:66` | Inventoried; journey not verified |
| `/dev/api-log` | `apps/admin/src/router/index.ts:67` | Inventoried; journey not verified |
| `/dev/sandbox` | `apps/admin/src/router/index.ts:68` | Inventoried; journey not verified |
| `/dev/service-health` | `apps/admin/src/router/index.ts:69` | Inventoried; journey not verified |
| `/dev/queue-monitor` | `apps/admin/src/router/index.ts:70` | Inventoried; journey not verified |
| `/dev/error-explorer` | `apps/admin/src/router/index.ts:71` | Inventoried; journey not verified |
| `/dev/toolkit` | `apps/admin/src/router/index.ts:72` | Inventoried; journey not verified |
| `/dev/sys-config` | `apps/admin/src/router/index.ts:73` | Inventoried; journey not verified |
| `/dev/schema` | `apps/admin/src/router/index.ts:74` | Inventoried; journey not verified |
| `/:pathMatch(.*)*` | `apps/admin/src/router/index.ts:75` | Inventoried; journey not verified |

### Vendor portal

| Route | Source line | Audit coverage |
|---|---:|---|
| `/login` | `apps/vendor/src/router/index.ts:28` | Inventoried; journey not verified |
| `/forgot-password` | `apps/vendor/src/router/index.ts:29` | Inventoried; journey not verified |
| `/reset-password` | `apps/vendor/src/router/index.ts:30` | Inventoried; journey not verified |
| `/password-change` | `apps/vendor/src/router/index.ts:31` | Inventoried; journey not verified |
| `/vend-access` | `apps/vendor/src/router/index.ts:32` | Inventoried; journey not verified |
| `/` | `apps/vendor/src/router/index.ts:33` | Inventoried; journey not verified |
| `/wallet` | `apps/vendor/src/router/index.ts:34` | Inventoried; journey not verified |
| `/wallet/fund` | `apps/vendor/src/router/index.ts:35` | Inventoried; journey not verified |
| `/wallet/funding` | `apps/vendor/src/router/index.ts:36` | Inventoried; journey not verified |
| `/vend` | `apps/vendor/src/router/index.ts:37` | Backend purchase/receipt chain inspected; real browser flow unverified |
| `/meter-orders` | `apps/vendor/src/router/index.ts:38` | Inventoried; journey not verified |
| `/meter-orders/new` | `apps/vendor/src/router/index.ts:39` | Inventoried; journey not verified |
| `/remote-send` | `apps/vendor/src/router/index.ts:40` | Inventoried; journey not verified |
| `/transactions` | `apps/vendor/src/router/index.ts:41` | Inventoried; journey not verified |
| `/receipts` | `apps/vendor/src/router/index.ts:42` | Inventoried; journey not verified |
| `/statement` | `apps/vendor/src/router/index.ts:43` | Inventoried; journey not verified |
| `/consumption` | `apps/vendor/src/router/index.ts:44` | Inventoried; journey not verified |
| `/notifications` | `apps/vendor/src/router/index.ts:45` | Inventoried; journey not verified |
| `/profile` | `apps/vendor/src/router/index.ts:46` | Inventoried; journey not verified |
| `/settings` | `apps/vendor/src/router/index.ts:47` | Inventoried; journey not verified |
| `/kyc` | `apps/vendor/src/router/index.ts:48` | Inventoried; journey not verified |
| `/security` | `apps/vendor/src/router/index.ts:49` | Inventoried; journey not verified |
| `/disputes` | `apps/vendor/src/router/index.ts:50` | Inventoried; journey not verified |
| `/help` | `apps/vendor/src/router/index.ts:51` | Inventoried; journey not verified |
| `/error` | `apps/vendor/src/router/index.ts:52` | Inventoried; journey not verified |
| `/:pathMatch(.*)*` | `apps/vendor/src/router/index.ts:53` | Inventoried; journey not verified |

### Customer portal

| Route | Source line | Audit coverage |
|---|---:|---|
| `/` | `apps/customer/src/router/index.ts:28` | Inventoried; journey not verified |
| `/welcome` | `apps/customer/src/router/index.ts:29` | Changed ownership/capability entry inspected; browser unverified |
| `/signup` | `apps/customer/src/router/index.ts:30` | Inventoried; journey not verified |
| `/login` | `apps/customer/src/router/index.ts:31` | Inventoried; journey not verified |
| `/recover` | `apps/customer/src/router/index.ts:32` | Inventoried; journey not verified |
| `/reset-password` | `apps/customer/src/router/index.ts:33` | Inventoried; journey not verified |
| `/terms` | `apps/customer/src/router/index.ts:34` | Inventoried; journey not verified |
| `/privacy` | `apps/customer/src/router/index.ts:35` | Inventoried; journey not verified |
| `/verify` | `apps/customer/src/router/index.ts:36` | Inventoried; journey not verified |
| `/kyc` | `apps/customer/src/router/index.ts:37` | Inventoried; journey not verified |
| `/onboard-meter` | `apps/customer/src/router/index.ts:38` | Inventoried; journey not verified |
| `/buy-token` | `apps/customer/src/router/index.ts:39` | Changed purchase/receipt chain inspected; settlement unverified |
| `/vend-pin` | `apps/customer/src/router/index.ts:40` | Inventoried; journey not verified |
| `/buy-meter` | `apps/customer/src/router/index.ts:41` | Inventoried; journey not verified |
| `/meter-orders` | `apps/customer/src/router/index.ts:42` | Inventoried; journey not verified |
| `/wallet` | `apps/customer/src/router/index.ts:43` | Inventoried; journey not verified |
| `/wallet/fund` | `apps/customer/src/router/index.ts:44` | Inventoried; journey not verified |
| `/wallet/funding` | `apps/customer/src/router/index.ts:45` | Inventoried; journey not verified |
| `/meters` | `apps/customer/src/router/index.ts:46` | Inventoried; journey not verified |
| `/usage` | `apps/customer/src/router/index.ts:47` | Inspected API/state/semantics; F03/F09/F10/F11 |
| `/consumption` | `apps/customer/src/router/index.ts:48` | Inventoried; journey not verified |
| `/transactions` | `apps/customer/src/router/index.ts:49` | Inventoried; journey not verified |
| `/receipts` | `apps/customer/src/router/index.ts:50` | Inventoried; journey not verified |
| `/receipts/:id` | `apps/customer/src/router/index.ts:51` | Inventoried; journey not verified |
| `/notifications` | `apps/customer/src/router/index.ts:52` | Inventoried; journey not verified |
| `/profile` | `apps/customer/src/router/index.ts:53` | Inventoried; journey not verified |
| `/password-change` | `apps/customer/src/router/index.ts:54` | Inventoried; journey not verified |
| `/security` | `apps/customer/src/router/index.ts:55` | Inventoried; journey not verified |
| `/verify-email` | `apps/customer/src/router/index.ts:56` | Inventoried; journey not verified |
| `/disputes` | `apps/customer/src/router/index.ts:57` | Inventoried; journey not verified |
| `/help` | `apps/customer/src/router/index.ts:58` | Inventoried; journey not verified |
| `/:pathMatch(.*)*` | `apps/customer/src/router/index.ts:59` | Inventoried; journey not verified |

## Shared shells and interactions

| Surface | Inspected / exercised | Remaining verification |
|---|---|---|
| CRM login | Local screenshot captured | Production auth, MFA, expiry |
| CRM navigation | Role source inspected; fixture responsive assertions | Every role, focus, deep links |
| CRM NOVA bell | Source inspected; fixture exercised | Real source, counts, tenant isolation |
| CRM OEM hub/settings | Changed registry/source traced; fixture hub exercised | Real discovery, credential rotation, persistence |
| CRM grid confirmations | Handler/UI source inspected | Real supported provider acknowledgement |
| Mesh gateway detail/ping | Source inspected; fixture click exercised | Actual network diagnostic evidence |
| Customer meter selector | Usage source inspected | Delayed-response browser scenario |
| Customer range/data-item controls | Source inspected | Complete unit/period/capability matrix |
| Customer remote-read feedback | Source inspected | Honest freshness or actual job completion |
| Customer daily reports | Existing request-fencing pattern inspected | Live report data correctness |
| CRM/admin guide sections/FAQ | Source inspected | Full keyboard, focus, screen-reader review |
| Wallet admin developer shell | Routes inventoried | Production developer-only policy exercise |
| Vendor/customer shells | Routes inventoried | Mobile overlays, auth expiry, navigation |
| Funding/order/refund dialogs | Family inventoried through routes | Detailed form, maker/checker, recovery exercise |
| Public landing/terms/privacy | Family inventoried | Full page and link inventory/exercise |

## API and persistence chains

| Entry / chain | Source | Coverage | Outcome / next action |
|---|---|---|---|
| CRM reference gateway authorization | `api/reference.js:654` | Inspected | Role/group drift; F13 |
| Dashboard panels and charts | `api/reference.js:2825` | Inspected; isolated assertion | Constants/query gaps; F04 |
| CRM inventory/customer/account reads | `api/reference.js:3029` | Inspected | Scope and generated balances; F03/F04 |
| Power-quality endpoint | `api/reference.js:3594`, `:4199` | Inspected; focused pass | Duplicate handler/synthetic data; F05 |
| Load/demand curves | `api/reference.js:4296` | Inspected; fixture exercised | Generated curves; F05 |
| Grid list/status/switch/limit | `api/reference.js:3820`, `:3953`, `:4079` | Inspected; isolated test failed | No real provider actuation; F01 |
| Energy-audit endpoint | `backend/src/services/energy-audit-service.js:192` | Inspected; focused pass | Invalid analytics assumptions; F06 |
| Mesh gateway endpoint | `backend/src/services/mesh-gateway-service.js:8` | Inspected; focused pass | Static operational inventory; F05 |
| NOVA alert/diagnostic path | `api/reference.js:7325`, `:7410` | Inspected; fixture exercised | Generated health; scoping gap |
| Customer telemetry | `backend/wallet/src/routes/customer.ts:2053` | Inspected; source-string test passed | F03/F09 |
| Customer remote read | `backend/wallet/src/routes/customer.ts:2208` | Inspected | Cached-read success claim; F10 |
| Universal purchase dispatcher | `backend/wallet/src/adapters/universal-oem-dispatcher.ts` | Inspected; test collection blocked | F02/F08/F17/F18 |
| SparkMeter payment translator/client | `sparkmeter-v1.ts`; `sparkmeter-payment-client.ts` | Inspected; client seven tests passed | Good exact matching; status/currency gaps |
| SparkMeter canonical adapter | `backend/wallet/src/adapters/sparkmeter-adapter.ts` | Inspected | Schema/identity/pagination gaps |
| Calinmeter extracted adapter | Universal dispatcher class | Inspected | Unsupported status success; F17 |
| OEM command foundation | `20260915140000_oem_command_foundation.sql` | Schema inspected | Code mismatch; real apply unverified |
| Wallet hold capture | `20260622140000_wallet_atomic_holds.sql:155` | Schema inspected | Expiry/recovery conflict; F08 |
| Authorized installation resolution | `backend/wallet/src/services/oem-installations.ts` | Inspected | Existing reusable boundary |
| Canonical telemetry contracts | `packages/oem-contracts/index.d.ts`, `index.js` | Inspected | Preserve unknown semantics |
| Versioned V2 telemetry transport | `backend/wallet/src/adapters/sparkmeter-koios-v2.ts` | Inspected | Source alignment; live traversal unverified |
| Funding/webhooks/refunds/settlement | Wallet route families | Inventoried only | Full security/financial runtime checks required |

## Background processing and integration coverage

| Process / integration | Evidence level | Remaining gap |
|---|---|---|
| Consumption sync fairness | Source plus focused regression passed | Deployed scheduler/load behavior |
| Report stale-response fencing | Focused regression passed | Real source completeness |
| Wallet maintenance | Source plus 13 recovery tests passed | Actual schema and crash convergence |
| Ambiguous payment reconciliation | Source inspected | F07/F08/F17 |
| Hold expiry sweeper | Source/schema inspected | Protected expired-hold policy |
| Receipt publication/retrieval | Dispatcher chain inspected | Post-capture recovery demonstration |
| Telemetry ingestion/checkpoints/quarantine | Architecture and adapter chain traced | Fresh full ingestion/replay execution |
| Historical backfill | Existing provider evidence reviewed | Complete current traversal and convergence |
| Vercel cron configuration | Deployment model inspected | Actual schedules, secrets, logs unverified |
| Paystack funding webhook | Domain family inventoried | Signature/idempotency live exercise unverified |
| Calinmeter upstream | Extraction source inspected | Live regression and real lookup unverified |
| SparkMeter Koios v1 | Retained contract plus current source comparison | Fresh official access and financial verification |
| SparkMeter Koios v2 | Retained observed wire correction plus source | Current provider responses, cursor expiry |
| IHEMETER | Historical user context only | Current adapter/API evidence not audited |
| Supabase RLS/grants | Migration/source inspection only | Actual database grants and policies |
| Vercel deployment | Local build evidence only | Actual deployed revision/configuration/smoke |
| GitHub CI / PRs | Local commit messages/ref history only | Remote checks and merge status |

## State and device matrix

| State / condition | Executed evidence | Status |
|---|---|---|
| Desktop 1440×900 | Existing mocked browser assertions | Fixture passed |
| Tablet 768×1024 | Existing mocked browser assertions | Fixture passed |
| Mobile 390×844 | Existing mocked browser assertions | Fixture passed |
| Small mobile 360×740 | Existing mocked browser assertions | Fixture passed |
| Login screenshot | Isolated local browser | Captured |
| Authenticated screenshots | Not retained by fixture | Not visually verified |
| Console errors | Fixture assertions reported none | Mocked scope only |
| Physical relay confirmation | No provider actuation attempted | Not verified |
| Real financial payment | No authorized canary executed | Not verified |
| Two-tenant collision | Source risk investigated | Runtime negative test pending |
| Slow network / reversed responses | Source race identified | Browser reproduction pending |
| Offline / recovery | No complete journey executed | Not verified |
| Expired session | No complete journey executed | Not verified |
| Empty / unavailable operational data | Isolated handler behavior inspected | Synthetic fallbacks confirmed |
| Validation / unauthorized | Source policy inspection | Full role matrix pending |
| Duplicate delivery / crash recovery | Existing unit fixtures partly exercised | Actual database proof pending |
| Keyboard / focus / screen reader | Source review only | Not verified |
| Contrast / zoom / reduced motion | No sufficient measured execution | Not verified |
| Back/forward / refresh / deep link | Guide route probe only | Full browser matrix pending |
| Load / concurrent users | No load test executed | Not verified |

## Worktree preservation and exclusions

Primary checkout started clean.
Only audit documentation was created.
No fixes, tests, commits, or deployments were made.

| Worktree / group | Observed state | Treatment |
|---|---|---|
| Primary Beverly | Feature-guide branch; clean initially | Audited HEAD |
| `oem-restored-main/Beverly` | Main at `a030de93`; clean | Preserved |
| `oem-live-canary/Beverly` | Four uncommitted telemetry diagnostics/test changes | Inspected diff; not integrated |
| `meter-ingestion-recovery/Beverly` | Untracked modernization prompt/browser test | Preserved; unfamiliar test unexecuted |
| `acob-crm4` | Audit/report artifacts | Not treated as current implementation |
| June24 worktree | Disabled Vercel directory artifact | Preserved |
| Developer-console/vendor-funding worktree | Modified playbook/untracked documentation | Preserved |
| Live-write production worktree | Temporary reports | Preserved |
| Stale multi-OEM v2 | Onboarding/report/CLI artifacts | Avoided for implementation |
| Production-hardening worktree | Untracked documentation | Preserved |
| Vendor funding history | Browser reports/results | Preserved |
| Ownership-inaccessible worktrees | Git refused ownership access | Excluded; no trust override |

Inaccessible examples included audit-hardening, database-storage-remediation, KYC reconciliation/tier work, email merge, QA hardening, vendor-consumption, import validation, gateway, and retention worktrees.

Creation dates of uncommitted files are uncertain.
They cannot be attributed to this week reliably.

## Explicit nonclaims

This inventory does not prove whole-product completeness.
No deployed build success is established.
No database migration was applied.
No production data absence is established.
The audit incident requires separate read-only inspection.
No fresh authenticated SparkMeter contract was retrieved.
No provider retry guarantee was inferred.
No application behavior fix was implemented.

