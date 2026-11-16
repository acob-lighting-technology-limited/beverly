# Beverly Call: Architecture

Standalone, publicly deployed call-centre portal. Beverly (the CRM and wallet monorepo) is the parent system for staff identity, customers, meters and vending. Beverly Call owns only calls, tickets, callbacks, recordings and the audit log, stored in the shared Supabase project's `call_centre` schema.

## Tech stack
| Layer | Choice |
|---|---|
| Web | Vue 3, TypeScript, Pinia, Vue Router, Vite. Own design tokens (not `@beverly/tokens`). |
| API | Node 24, Fastify 5, TypeScript, zod validation, `pg`, `jose` (session JWT). |
| Shared | `packages/shared`: zod schemas and inferred types used by web and API. |
| Data | Supabase Postgres, `call_centre` schema, login role `beverly_call_api` (migrations live in the Beverly repo). |
| Telephony | Africa's Talking behind a provider adapter (not built yet). |
| Tests | Vitest (unit and API integration), Playwright for end-to-end (not added yet). |
| Tooling | pnpm workspaces, `vue-tsc`, `tsc --strict`. |

## Layout
```
apps/web/            Vue SPA (public)
  src/views/         one file per screen, PascalCase.vue
  src/components/    shared UI (Icon.vue)
  src/stores/        Pinia: session (identity from API), settings (UI prefs only)
  src/router/        route table and role guard (UX only)
  src/lib/           pure helpers: roles, sla, mask, api client
  src/styles/        tokens.css (colour, theme, palettes) and app.css (components)
  tests/             Vitest
apps/api/            Fastify API (public)
  src/config/        env.ts: zod-validated environment
  src/auth/          session-token.ts (JWT), guards.ts (requireRole)
  src/beverly/       beverly-auth.ts: staff sign-on and portal_access check
  src/audit/         audit-log.ts: hash-chained append-only log
  src/routes/        health, auth, cases, callbacks, calls
  tests/             Vitest, including API tests with an injected fake pool
packages/shared/     DTO schemas and types
docs/reference/      original HTML prototype (visual reference only)
```
Naming: `.ts` files kebab-case, components PascalCase, functions camelCase, no implicit `any`.

## Rules that must hold
1. **Server decides access.** Roles come from Beverly staff sign-on, are written into an httpOnly, SameSite=Strict, signed session cookie, and enforced by `requireRole` on every route. The web router guard is convenience only.
2. **The Beverly bearer token stays server-side**, inside the signed session. The browser never sees it.
3. **No CRM data copy.** Customers and agents are referenced by Beverly id with no foreign keys.
4. **Every sensitive action is audited** (login, logout, case resolve, callback start, call wrap-up, and later STS token reveal) through `appendAudit`.
5. **No money movement.** Anything touching wallets or vending is escalated to Tier 2 in Beverly.
6. **No mock data in production builds.** Views read the API only.
7. **Secrets only in environment variables** (see `.env.example`). `DATABASE_URL` uses the `beverly_call_api` role, never the service role.

## Public deployment
- Web: static build (`apps/web/dist`) on Vercel; `vercel.json` sets security headers and a CSP.
- API: container (`apps/api/Dockerfile`) on any host with TLS. Health check: `GET /api/health`.
- The browser calls `/api/*` on its own origin; Vercel rewrites it to the API host so the session cookie is first-party. Set the destination in `vercel.json`.
- Public exposure means: strict origin check on writes, per-IP rate limits (8 logins per minute), helmet headers, no stack traces to clients, redacted logs.

## Done in this version
- All eight screens are ported; comments, settings (alert limits, call flow), retention proof, recording playback (signed URLs, audited), customer history (masked tokens) and staff names are implemented.
- Africa's Talking voice webhook (`POST /api/webhooks/at/voice`, secret-authenticated, exempt from the browser Origin check).
- Daily retention job: `pnpm --filter @beverly-call/api exec tsx src/jobs/run-purge.ts` (schedule it daily). Logs to `call_centre.retention_runs`.
- Local development: `pnpm dev:mock` (in-memory API, sample data) plus `pnpm dev`. End-to-end tests: `pnpm e2e`.

## Needs action outside this repo
- Apply `supabase/migrations/20261116110000_call_centre_extensions.sql (copied into the Beverly repo, uncommitted)` in the Beverly repo (supervisor role, ticket comments, amount, settings, retention log). Until then, comments, settings and the retention panel will fail against a real database.
- Provide `AT_WEBHOOK_SECRET` and the recordings storage key; create the `call-recordings` bucket.
- Confirm with the Beverly team: RLS lets staff read their own `public.users` row; the field names of `/api/v1/admin/customers`, `/customers/:id/purchases` and `/staff` (all isolated in single mappers, marked TODO(debt)).
- Replace `REPLACE_WITH_API_HOST` in `vercel.json`.

## Known debt
- The webhook registers recordings with a placeholder storage key; an ingest worker must copy the carrier-hosted file into the bucket.
- Inbound calls get a hold message only; real queue routing and agent dialling are not built, so `/calls/active` stays empty until calls are assigned to agents.
- Playwright runs on installed Edge locally. CI does not run e2e yet (needs a Chromium install step).
- Sign-in has no lockout beyond the per-IP rate limit.
- The audit chain is verified in tests; there is no scheduled verification job yet.

## Current status (supersedes the older "Done" and "Known debt" lists above)

Full design, flows and roadmap: [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md).

- **Built and tested:** all API domains, jobs (ingest, sweep, purge, verify-audit), real-Postgres integration tests (48), web unit tests (10), Playwright e2e (8), all eight screens, notifications (real events only), settings, search, handover, replies, KPI trend modals, card and table views.
- **Run locally:** `pnpm dev:mock` (API on in-memory Postgres with the real migrations) and `pnpm dev`. Tests: `pnpm test`, `pnpm e2e`, `pnpm typecheck`.
- **Needs outside inputs (Phase 5):** apply the Beverly migration; carrier secrets; verify Africa's Talking on the sandbox (IVR, dial, SMS, WebRTC token, conferencing); confirm Beverly field names and RLS; supervisor role assignment; `call-recordings` bucket.
- **Not built:** browser softphone binding to the carrier SDK; supervisor media bridge (listen, whisper, barge are recorded and audited only); CI e2e step; load test and security review.
- **Run jobs:** `pnpm --filter @beverly-call/api job <purge|ingest|sweep|verify-audit>` on a scheduler (ingest and sweep every minute, purge and verify-audit daily).

## Web design system (layers)
`apps/web/src/styles/`: `tokens.css` (colour ramps, palettes, light/dark) < `design-tokens.css` (spacing, radius, type, elevation, motion, z-index, focus ring, semantic colour aliases such as `--surface`, `--text`, `--accent`) < `app.css` (components). New styles read the semantic layer, not raw colours or pixel literals. The glass surface is driven by `--gl-*` variables; the solid fallbacks (no backdrop-filter, reduced transparency, more contrast, forced colours, high-contrast setting) only override those variables.
Web shell: `components/shell/` holds `AppNav.vue` (rail, bottom bar, sub-navigation) and `SessionLock.vue`; shared building blocks are `PageHeader.vue` and `Pill.vue`. `App.vue` provides a skip link and a `<main id="main">` landmark; the router sets `document.title` per screen. Keyboard: Ctrl K search, Alt 1 to 9 jump to a main section, `?` lists shortcuts.

## Alignment with Beverly (audit result)

Where Beverly Call now follows what Beverly already does, instead of its own vocabulary:

- **Data access.** Beverly's customers, meters, staff, roles, role permissions, wallets (with live balances) and purchases are read straight from the shared database through read-only views in the `call_centre_read` schema (migration `20261116120000`, applied). Only an explicit column list is exposed: no PIN hashes, KYC data, raw payloads or session ids, and the raw STS token is reachable only through `reveal_purchase_token(id)`, one purchase at a time, after an audit entry. `BEVERLY_READ_MODE=db` (default) uses the views; `api` calls Beverly's admin API with the agent's token. Beverly's station scoping is kept: admins see everything, everyone else only customers with a meter at one of their stations, and no assigned station means no access.
- **Roles.** Beverly has many staff roles. A role can work the desk when Beverly gives it both `wallet.customers.view` and `wallet.support.manage` (operations officers, operations managers, call-centre roles). Names with "manager" or "supervisor" lead the desk; `super-admin` is admin. Account, finance, read-only, vendor and developer roles stay out.
- **Support tickets.** Beverly's `support_tickets` (statuses open, pending, awaiting_customer, resolved, closed; priorities low, normal, high, urgent) are worked inside Beverly Call through Beverly's own admin API with the staff member's token, so its customer notices and logging still run. Every change is also audited here. Escalation priorities (CRITICAL, HIGH, MEDIUM, LOW in the call_centre schema) are shown in Beverly's words (urgent, high, normal, low).
- **Languages.** The interface offers exactly Beverly's four locales (English, Yorùbá, Hausa, Igbo) with native names and `en-NG`-style formats, stored under Beverly's `beverly.locale` key. Pidgin is a spoken language only (phone menu, agent skills, routing), as in Beverly's own call schema.
- **Time.** Everything uses Nigerian time (Africa/Lagos): "today", hourly and weekday buckets, calendars and message times, never UTC.
- **Statuses.** Purchase statuses use Beverly's: delivered is good, failed and reversed are bad, the rest in progress.

Local checks: `pnpm dev:mock` seeds Beverly's tables in memory and reads them through the same views. `pnpm e2e` starts its own servers on ports 5199 and 8799 so it never touches a dev server already running.
