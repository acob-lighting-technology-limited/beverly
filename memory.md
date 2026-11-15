# Beverly System Memory (`memory.md`)

> **Canonical System Memory Bank**  
> **Repository**: `acob-lighting-technology-limited/beverly`  
> **Active Working Branch**: `feat/battery-swap-operations`  
> **Runtime Engine**: Node 24.x (`volta.node: 24.13.1`) | Package Manager: `pnpm 10.28.0`  
> **Verification Status**: Canonical architecture in root `ARCHITECTURE.md`. External provider and physical writes remain strictly guarded.

---

## 1. System Topology & Monorepo Inventory

The Beverly platform is organized as a pnpm monorepo governed by `pnpm-workspace.yaml`. Every path and package is verified from inspected repository state:

```
Beverly Workspace Root
├── apps/
│   ├── admin/             -> @beverly/admin-app (Vue 3 Back-office & Operations CRM)
│   ├── battery-swap/      -> @beverly/battery-swap-app (Yunhe OEM operations, 15S cell inspector, locker cabinets, CRM IoT immobilizer)
│   ├── customer/          -> @beverly/customer-app (Customer self-service portal)
│   ├── vendor/            -> @beverly/vendor-app (Vendor vending & digital wallet portal)
│   └── wallet-landing/    -> @beverly/landing-app (Public entry & portal redirect routing)
├── backend/
│   ├── wallet/            -> @beverly/wallet-backend (Canonical TypeScript wallet engine, Fastify/Express, adapters, queues)
│   └── src/               -> Interval exports, gateway health, tariff snapshots, wallet ledger, wallet funding
├── packages/
│   ├── oem-contracts/     -> @beverly/oem-contracts (Canonical OEM types and schema validation)
│   └── tokens/            -> @beverly/tokens (Shared design tokens and CSS custom properties)
├── src/                   -> Root Vue 3 SPA (legacy/reference shell, TablePage, DailyDataMeterPage, StationConsumptionPage)
├── api/                   -> Vercel Serverless Functions (api/reference.js reverse proxying /api/v1/*, lowercase routing)
├── supabase/              -> Migrations (supabase/migrations/), RLS policies, rollback scripts
├── tests/                 -> Vitest, Node test runner, Playwright browser suites, contract tests
└── tools/                 -> Audits, capacity checkers, typechecking, smoke tooling
```

---

## 2. Inviolable Architectural Invariants (Zero Guesswork)

1. **Architecture & Standards Authority**:
   - Root `ARCHITECTURE.md` is the **sole canonical source of architecture truth**. `docs/ARCHITECTURE.md` is legacy reference only.
   - Root [`AGENTS.md`](file:///c:/Users/ACOB/Desktop/VS%20Code/Beverly/AGENTS.md) defines mandatory engineering standards, delivery gates, database security, and zero-hallucination rules across all AI agents.
   - Root [`CLAUDE.md`](file:///c:/Users/ACOB/Desktop/VS%20Code/Beverly/CLAUDE.md) provides agent guidelines and references `AGENTS.md`.
   - Provider wire contracts remain separate authorities; doc headings never certify working integration.
2. **No Measurement or Physical Spoofing**:
   - Never replace unknown telemetry or energy measurements with constants.
   - Never output unverified physical-control success messages (e.g., IoT relay cutoffs, battery unlock confirmation) without confirmed provider receipt.
3. **Financial Convergence & Idempotency**:
   - Ledger entries in `@beverly/wallet-backend` and `backend/src/services/wallet-ledger-service.js` are strictly append-only.
   - All balance mutations, purchases, and vending calls must carry idempotency keys. Double-spends are prevented by database constraints.
   - Ambiguous provider payments must never be resubmitted automatically without explicit reconciliation by command ID.
4. **Multi-Tenant RLS & Installation Scoping**:
   - Actor-to-tenant memberships (`supabase/migrations/20261001130000_oem_tenant_memberships.sql`) require forced RLS.
   - Installation reads require both active tenant membership and an explicit active installation grant in one query. Staff roles alone do not grant implicit access.
5. **Safe / Hermetic Verification**:
   - Default test suites must not reach external production networks.
   - Live-write status is dynamically governed by `/api/system/live-write-control`. Default state for test runners is read-only.
6. **State & Styling Standards**:
   - State management target is Pinia. Legacy Vuex is frozen and must never receive new state.
   - CSS primitives must consume design tokens from `@beverly/tokens` or `src/styles/tokens.css`.
   - All interactive controls, inputs, and table action buttons must expose stable `data-testid` selectors.

---

## 3. Real Monorepo Build & Verification Scripts

All commands below are verified directly from `package.json`:

```powershell
# Monorepo Full Build
npm run build
# Compiles: @beverly/wallet-backend -> root vite -> admin-app -> vendor-app -> customer-app -> landing-app -> battery-swap-app

# Typecheck
npm run typecheck

# Production Hardening Audit
npm run hardening:audit

# Domain Test Suites
npm run test:wallet
npm run test:security
npm run test:oem
npm run test:smart-metering
npm run test:consumption-sync
npm run test:interval-export

# End-to-End Browser Tests (Playwright)
npm run test:browser

# Database Capacity & Migration Verification
npm run database:capacity
npm run test:database-capacity
node tests/supabase-migrations.test.cjs
```

---

## 4. Active Branch Context: `feat/battery-swap-operations`

- **Focus**: Yunhe OEM battery operations, 15S cell inspector, locker cabinet telemetry, site inventory distribution, and CRM IoT immobilizer controls in `apps/battery-swap`.
- **Active Test Trace**: `scripts/test-battery-swap-full-trace.js` verifying navigation and state across `#/fleet`, `#/stations`, `#/crm`, `#/diagnostics`, and `#/map`.
- **Runtime Port**: Vite port 5177 for `@beverly/battery-swap-app`.

---

## 5. Beverly Bot Architecture & Zero-Hallucination Standard

- **Identity**: **Beverly Bot** (also rendered as **Beverly AI**). The bot belongs strictly to the Beverly Smart Power & Battery Ecosystem. It must never refer to itself as "AcoBot" or "ACOB ERP".
- **Backend Services**:
  - Routes: `backend/wallet/src/routes/acobot.ts` registered under `/api/v1/acobot/*`.
  - System Prompt Engine: `backend/wallet/src/services/acobot-prompt.ts` (`buildBeverlySystemPrompt`).
  - Context & Identity Builder: `backend/wallet/src/services/acobot-context.ts` (`buildAcobotContext`).
  - RBAC Policy Adapter: `backend/wallet/src/services/acobot-rbac.ts` (`checkAcobotIntentPermission`).
  - Response Normalizer: `backend/wallet/src/services/acobot-response.ts` (`formatOfflineContextAnswer`, `normalizeBeverlyResponse`).
  - Audit Storage: `acobot_logs` table in Supabase.
- **Frontend Components & Tokens**:
  - Shared Token Linkifier: `packages/tokens/ai-message.js` (`linkifyBeverlyRoutes`) and `use-assistant-voice.ts`.
  - Widgets: `src/components/acobot/AcobotWidget.vue`, `apps/admin/src/components/acobot/AcobotWidget.vue`, `apps/customer/src/components/acobot/AcobotWidget.vue`, and `apps/vendor/src/components/acobot/AcobotWidget.vue`.
- **Grounded Knowledge & Invariant Policies**:
  1. **Strict Meter Relay Control Prohibition**: Customers and vendors are strictly blocked from turning off, tripping, or controlling meter relays. Relay control is restricted exclusively to authorized operations staff (`super-admin`, `operations-manager`, `support`).
  2. **Zero Tamper Token Generation**: Generation of Tamper Reset / Clear Tamper tokens via AI is strictly prohibited for all roles without exception. Physical inspection is mandatory.
  3. **Zero Telemetry Spoofing**: No synthetic placeholders for battery cells or meter intervals. If telemetry is unavailable, explicit empty states (`null` or `—`) are returned.
  4. **Multi-Model Inference Cascade**: Groq LPU (`openai/gpt-oss-120b` -> `llama-3.3-70b-versatile` -> `llama-3.1-70b-versatile` -> `llama3-70b-8192`) with fallback to NVIDIA NIM (`meta/llama-3.3-70b-instruct`), OpenAI (`gpt-4o-mini`), and local structured offline context answering.
  5. **Discovery & Navigation**: 5-second delayed discovery nudge banner (`beverly-ai:nudge-seen`), route link click interception routing via Vue Router without page refresh, and context-aware quick chips.

---

## 6. PWA Web Push & Background Delivery Architecture (WhatsApp-Grade)

- **WhatsApp-Grade Push Experience**:
  - Heads-up banners on mobile and desktop OS with audible tone (`silent: false`).
  - Distinct rhythmic vibration pattern (`vibrate: [200, 100, 200, 100, 200]`).
  - Persistent interaction (`requireInteraction: true`) preventing automatic premature dismissal.
  - Quick action buttons: `Open` and `Dismiss` (`notificationclick` handles `action: 'dismiss'` by closing the notification immediately).
  - Absolute origin-resolved `icon` and `badge` URLs (`new URL(payload.icon, self.location.origin).href`).
  - Unique per-alert tags (`tag: payload.tag || ('beverly-alert-' + Date.now())`) with `renotify: true` so alerts do not silently overwrite one another.
- **Backend Delivery & Gateway Wake-Up**:
  - `backend/wallet/src/services/push-notifications.ts` (`sendWebPush`):
    - `urgency: 'high'`: Forces push gateways (Google FCM, Apple APNs, Mozilla autopush) to wake the device radio and CPU immediately, bypassing Android Doze mode and OS battery throttles.
    - `TTL: 86400`: Extended 24-hour time-to-live prevents gateways from dropping notifications when devices are locked, in sleep mode, or temporarily off-grid.
- **Background & Unauthenticated Delivery Invariants**:
  - Logging out must **never** call `subscription.unsubscribe()` or destroy database subscription records. Push subscriptions are device-level hardware channels that persist across sessions.
  - `apps/customer/src/stores/auth.ts` and `apps/vendor/src/stores/auth.ts`: `logout()` clears session state and tokens only; `setSession()` automatically syncs/re-associates subscriptions (`sync()`) without user friction.
  - `GET /push/config` in `customer.ts` and `vendor.ts` is public (unauthenticated), allowing PWA home-screen installs to discover VAPID public keys before or independently of login.

