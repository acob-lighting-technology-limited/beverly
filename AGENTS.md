# Repository Agent Standards — Beverly Platform

> **Repository**: `acob-lighting-technology-limited/beverly`  
> **Active Working Branch**: `feat/battery-swap-operations`  
> **Runtime Engine**: Node 24.x (`volta.node: 24.13.1`) | Package Manager: `pnpm 10.28.0`  
> **Authority**: Single source of truth across all AI agents (Claude, Codex, Cursor, Antigravity, etc.).

This file defines the mandatory engineering standards that AI agents must follow when working in this repository. These rules prevent lint debt, weak typing, build regressions, security vulnerabilities, financial discrepancies, and physical hardware/telemetry spoofing.

---

## 1. Delivery Standard

Do not treat a task as complete until all required checks pass. Run them on the files and packages you changed:

```powershell
# 1. Typecheck across root and workspace packages
npm run typecheck

# 2. Production hardening audit
npm run hardening:audit

# 3. Targeted package build (fast check during iterations)
corepack pnpm --filter @beverly/battery-swap-app build
corepack pnpm --filter @beverly/wallet-backend build

# 4. Relevant domain test suite(s):
npm run test:wallet           # wallet ledger, vending, quota circuits
npm run test:security         # RLS, authz, secret boundaries
npm run test:oem              # SparkMeter Koios v2, Calinmeter, OEM contracts
npm run test:smart-metering   # AMR ingestion, consumption reconciliation
npm run test:browser          # Playwright E2E browser tests
```

- **Full monorepo build**: `npm run build` compiles all 5 monorepo applications, backend, and root Vite. Use targeted package builds during development; run `npm run build` or `npm test` before concluding major multi-package initiatives.
- **Commit only when the user says a piece is done.** Leave changes uncommitted while the user is reviewing or asking for tweaks. When they say a feature or request is done, make one commit for it, following the [Commit Grouping Strategy](#6-commit-grouping-strategy--mandatory-before-any-commit). Do **not** commit each tweak as it lands, half-done work, exploratory edits, or "WIP".
- **Database Migration Execution**: If any `.sql` migrations were created or modified under `supabase/migrations/`:
  - **Always run `npx supabase migration list` to determine actual deployment status.** This is the sole source of truth — not `git status`.
  - A migration file that is untracked or unstaged in git is **not** automatically pending. Check the output of `migration list`: if the `remote` column is populated for that version, it has already been applied. Only flag a migration as pending if its `remote` field is empty.
  - If any migration has an empty `remote` field, **show the user which migration(s) will be applied and what they change, and wait for an explicit yes** before pushing — there is no staging database, so every push hits production. Then push: `npx supabase db push --include-all --yes`. Never apply migrations through ad-hoc MCP tools without user consent.
  - If a migration cannot be pushed automatically or is intentionally held back, **always explicitly state and remind the user that the SQL migration is pending and has not been pushed to the live database**.

If a change cannot satisfy all checks or if migrations remain unapplied without explicit user consent, report the blocker/pending status clearly instead of claiming completion.

---

## 2. Technical Honesty — Do Not Default to Agreement

Agreeing with a proposal you believe is wrong is a failure, not politeness. When the user suggests an approach — in a question, a "right?", or a direct instruction — judge it on the merits and say what you actually think **before** acting.

- If the suggestion is not the right call, or departs from industry standard or an established convention in this repo, **say so plainly and give the reason**. Cite the concrete cost: the bug it invites, the telemetry loss it risks, the financial drift it causes, the a11y or contrast rule it breaks, the standard in `AGENTS.md` it contradicts, or the maintenance burden it adds.
- A question phrased as "should we…?" or "…right?" is a request for your judgement, not for confirmation. Answer it, don't echo it.
- Never validate a decision you would not have made yourself. Do not soften a real objection into "that could work too."
- Be equally direct about your own work: if you overstated a claim, got a fact wrong, or a check failed, correct it and report the failure rather than glossing it.
- Concede specifically when the user is right — including when they are right about part of a point you disagree with overall. Partial agreement stated precisely is more useful than blanket agreement or blanket resistance.
- Offer the better alternative, not just the objection. "No, because X — do Y instead" is the useful shape.

**After the objection has been made and the user reaffirms their choice, it is their call.** State the trade-off once, then implement what they asked, fully and well. Do not re-litigate it, do not quietly implement a different thing, and do not sandbag the work.

### This file can be wrong too

The same honesty applies to `AGENTS.md`. It is written by people and agents, and parts of it go stale as the code moves on. Following a rule you believe is wrong is the same failure as agreeing with a user you believe is wrong.

- When a rule here contradicts the code, produces a worse result for the user, or departs from industry standard without a stated reason, **say so plainly**. Name the rule, what is wrong with it, and what it should say instead.
- Do not silently ignore the rule, and do not silently follow it. Raise it in your response before or alongside the work, and propose the exact edit to this file.
- Check first. Search git history (`git log -S`) and any rationale next to the rule; a rule that looks odd often exists because of a past incident. If you still think it is wrong after that, raise it.
- Once the user decides, update this file in the same change so the next agent does not hit the same contradiction.

---

## 3. Engineering Practices — Mandatory for Beverly

### Monorepo Boundaries & File Organization
The Beverly repository is organized as a pnpm monorepo:
- `apps/admin/` (`@beverly/admin-app`): Vue 3 operations and CRM back-office.
- `apps/battery-swap/` (`@beverly/battery-swap-app`): **Beverly PUE** portal. Sign-in lands on the PUE Hub (`/hub`), which opens Battery Swap Stations (Yunhe OEM battery operations, 15S cell telemetry inspector, locker cabinet controllers, site inventory, CRM IoT immobilizer) or Electronic Appliances (not built yet). Directory and package names keep `battery-swap` so build and deploy paths stay stable.
- `apps/customer/` (`@beverly/customer-app`): Customer self-service portal.
- Beverly Call (call centre) is a separate project in its own folder, not part of this monorepo. It signs staff in against the shared Supabase `users` table and must honour `users.portal_access` (`call`).
- `apps/vendor/` (`@beverly/vendor-app`): Vendor vending, STS tokens, and wallet workflows.
- `apps/wallet-landing/` (`@beverly/landing-app`): Public portal routing and authentication landing.
- `packages/oem-contracts/` (`@beverly/oem-contracts`): Shared canonical OEM gateway types and runtime schema validation.
- `packages/tokens/` (`@beverly/tokens`): Design tokens and CSS custom properties.
- `backend/wallet/` (`@beverly/wallet-backend`): Canonical TypeScript wallet engine (routes, services, queue workers, adapters).
- `backend/src/`: Core background services (interval export, gateway health, tariff snapshots, wallet ledger).
- `src/`: Root Vue 3 SPA (legacy/reference shell, TablePage, DailyDataMeterPage, StationConsumptionPage).
- `api/`: Vercel Serverless Functions (`api/reference.js` proxying `/api/v1/*`, lowercase routing).

### Reuse Before You Write
- **Search first.** Before writing a helper, service, or component, search the codebase:
  - Tokens: `@beverly/tokens` and `src/styles/tokens.css`.
  - Services: `src/services/` (auth, wallet, funding, purchase, consumption, fraud-engine).
  - UI Primitives: `src/components/base/`.
  - Adapters: `backend/wallet/src/adapters/` (SparkMeter Koios v2, Calinmeter v1).
  - Backend Services: `backend/wallet/src/services/` and `backend/src/services/`.
- **One screen, one component.** Do not clone a view to make another role's version. Share the component and gate actions via capability contracts.
- **No local copies of shared helpers.** Do not define local date formatters, currency formatters, or token decoders inside component files. Import the shared service.

### State Management: Pinia is Canonical
- **Pinia is the target state layer.** All new state stores must be built using Pinia (`defineStore`).
- **Legacy Vuex is frozen.** Never introduce new state, mutations, or actions into legacy Vuex stores.

### Fix the Cause, Not the Symptom
- A wrong colour is fixed in the **design token** (`@beverly/tokens` or `src/styles/tokens.css`), not with ad-hoc hex values or arbitrary CSS classes.
- A lint or type error is fixed, not silenced. Never use `@ts-nocheck` or suppress `eslint` rules without documented inline justification.
- Missing database columns or tables are bugs to fix via versioned migrations in `supabase/migrations/` — never swallow database errors (`42P01`, `42703`).
- Temporary test fixtures, debug logs, or scratch files must never be committed to repository history.

### Backend / API & Serverless Gateway
- **All mutating writes happen server-side.** Client-side code never executes raw mutations directly against Supabase tables holding financial, user, or telemetry records.
- **Vercel Serverless Gateway**: `api/reference.js` fronts backend routes and proxies `/api/v1/*`. Maintain lowercase routing conventions (`/api/wallet/*`, `/api/vendor/*`).
- **Route path comparisons**: Fastify reports `req.routeOptions.url` with its plugin prefix (`/api/v1/admin/account-setup`). Never compare it to a bare path; use `adminRelativePath()` from `backend/wallet/src/services/admin-route-path.ts`. Tests for guards must register routes under the production prefix, or they pass while production fails.
- **Response Headers**: Canonical gateway responses must set `Cache-Control: no-store` on installation inventory, wallet mutations, and error payloads.
- **Never expose raw database errors to the client.** Log full error objects server-side; return structured JSON error payloads with sanitized codes and safe messages.

### Live-Write Runtime Control Guard
- Mutating writes against live environments are governed by `/api/system/live-write-control` and `docs/LIVE_WRITE_APPROVAL_RUNBOOK.md`.
- Staging and preview smoke runners must respect this control and default to read-only mode unless live-write approval is explicitly validated.

---

## 4. Anti-Hallucination & Telemetry Invariants (Non-Negotiable)

1. **No Measurement or Telemetry Spoofing**:
   - Never replace unknown meter telemetry, energy consumption counters, or battery cell voltages with constants or synthetic placeholders.
   - If a meter or 15S cell reading is missing or pending, display explicit empty / loading states (`null` or `—`), never a fabricated number.
2. **No Unsupported Physical-Control Success**:
   - Never display or emit success confirmations for physical IoT actions (e.g. vehicle battery immobilizer lock/unlock, locker cabinet door release, or remote meter relay disconnect) without verified backend acknowledgement and confirmed provider receipt.
3. **Quarantine Unmatched Telemetry**:
   - In accordance with `supabase/migrations/20261021120000_oem_telemetry_ownership_quarantine.sql`, incoming provider telemetry rows that do not match an exact active installation/site/meter/customer tuple must be quarantined. They must never be forced into downstream production telemetry tables.
4. **Advisory Credit Assessments**:
   - Provider credit calculations (e.g. SparkMeter Koios) are advisory only. They must never authorize financial ledger balance updates or simulate offline relay status without certified adapter reconciliation.

---

## 5. Financial Ledger & Vending Invariants

1. **Append-Only Ledger**:
   - Wallet ledger entries in `@beverly/wallet-backend` and `backend/src/services/wallet-ledger-service.js` are strictly append-only.
   - Never execute `UPDATE` or `DELETE` on historical financial ledger rows. Corrections must be recorded as distinct compensating transactions with audit metadata.
2. **Mandatory Transaction Idempotency**:
   - Every financial mutation (wallet credits, debits, STS token vending, remote credit transfers) must require an idempotency key.
   - Idempotency checks must occur before balance deduction or token dispatch.
3. **No Automatic Payment Resubmission**:
   - If an external provider payment outcome is ambiguous, the system must reconcile by Beverly command ID (`external_id`). Never resend an unconfirmed payment automatically.

---

## 6. Commit Grouping Strategy — Mandatory Before Any Commit

**Never commit all uncommitted changes in a single `git add -A && git commit`.** Always follow this workflow:

### Step 1 — Analyze Before Staging
Run `git diff --stat HEAD` and `git status -s` to inspect all modified and untracked files. Do **not** stage blindly.

### Step 2 — Group by Feature Domain
- Files that belong to a single feature domain must be committed together (e.g. battery swap components, service helper, and test trace in one commit).
- A database migration in `supabase/migrations/` must be in the **same commit** as the application code that relies on it.
- Shared infrastructure or token updates (`@beverly/tokens`, `tokens.css`) affecting multiple apps should be batched into an explicit `chore:` or `refactor:` commit.
- Never mix unrelated features or separate apps into a single commit.

### Step 3 — Stage and Commit Specifically
Stage specifically using `git add <file1> <file2>` — never `git add -A` or `git add .` for the entire monorepo at once.

### Hard Prohibitions
- ❌ `git add -A` or `git add .` across unrelated apps or packages
- ❌ Committing half-done work or "WIP"
- ❌ Splitting a migration into a separate commit from the feature code using it
- ❌ Committing temporary screenshots, export dumps (`.xlsx`, `.csv`), or local cache artifacts
- ❌ Adding a `Co-Authored-By` trailer

---

## 7. Commit Message Standard

- Format commits as `type: description` (or `type(scope): description`).
- Use single-line, lowercase subject lines (72 characters maximum, no trailing period).
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`.
- Optional body: leave a blank line after subject; wrap body lines at 100 characters.

**Examples:**
- `feat(battery-swap): implement 15S cell inspector and cabinet locker controls`
- `fix(wallet): enforce idempotency key on remote vending dispatch`
- `chore(tokens): synchronize status badge color tokens across monorepo`

---

## 8. TypeScript, Linting & Type Safety

- Do not add `@ts-nocheck`.
- Do not add `@ts-ignore` unless there is no practical alternative, and document the reason inline.
- Eliminate `any` — use `unknown`, narrow interfaces, discriminated unions, or explicit DTOs.
- **Nullability Discipline**:
  - Do not pass `string | null | undefined` to functions expecting `string`.
  - Guard required values early: `if (!value) throw new Error(...)` or return early.
  - Normalize nullable values before use: `const status = row.status || "pending"`.

---

## 9. Database Security Standard — RLS, Grants & Functions (Mandatory)

**Core Principle:** The Supabase `anon` key is public. PostgREST exposes every table and RPC directly to the internet at `/rest/v1/*` and `/rest/v1/rpc/*`. App-layer authorization does not protect this path. The **only** server-side boundary on the direct path is database Row-Level Security (RLS) and function `EXECUTE` grants. Treat every table and `SECURITY DEFINER` function as internet-facing.

1. **Every new table enables RLS in the migration that creates it**, with at least one explicit policy. A `CREATE TABLE` without `ENABLE ROW LEVEL SECURITY` is world-readable and world-writable via the anon key.
2. **Never write a permissive policy for untrusted roles.** No `USING (true)` on non-public tables. Scope policies `TO authenticated` and gate with tenant memberships (`oem_tenant_memberships`) and actor grants (`oem_actor_installation_access`).
3. **Never disable RLS on a production table to "fix" a query.** Empty results or `permission denied` mean the policy is wrong or the wrong client was used. Fix the policy or execute via the service role in a server route.
4. **`SECURITY DEFINER` Functions**:
   - Always **`REVOKE EXECUTE ON FUNCTION ... FROM anon, PUBLIC`** in the migration that creates it. Then `GRANT EXECUTE` explicitly to `authenticated` and/or `service_role`.
   - Never trust caller-supplied user IDs without verifying `auth.uid() = p_user_id` or ensuring service-role invocation.
5. **No Direct Production DDL**:
   - Schema modifications must be versioned migrations in `supabase/migrations/`. Never edit production schemas via the Supabase Dashboard SQL editor.
6. **Mandatory Remote Push & Sync Verification**:
   - Run `npx supabase migration list` to verify remote status. A migration is only applied if its `remote` column is populated.
   - If an unapplied migration exists, show the user the diff and obtain an explicit confirmation before running `npx supabase db push`.
7. **Database Capacity & Connection Pooling**:
   - Batch high-throughput telemetry writes (AMR meters and battery swap telemetry) to protect transaction pooler limits per `docs/DATABASE_CAPACITY_STATUS_2026-10-25.md`.

---

## 10. UI, Design Tokens & Accessibility Standards

### Stable `data-testid` Selectors
Every form field, submit button, modal, tab, and table row action must include a stable `data-testid` attribute for reliable automated testing (e.g. `data-testid="input-battery-sn"`, `data-testid="btn-swap-confirm"`). Never rely on volatile CSS class selectors for test automation.

### Design Tokens & Typography
- **Design primitives belong in `@beverly/tokens`** and `src/styles/tokens.css`. Never write ad-hoc hex colors or arbitrary class names in components.
- **Minimum text size is `text-xs` (12px).** Never use `text-[10px]` or `text-[11px]`.
- **WCAG AA Contrast**: Maintain compliant contrast ratios across light and dark themes for all text and interactive icons.
- **Icon Buttons**: Every icon-only button must have an accessible name (`aria-label`) and tooltip.

### Table Page Standard
List and data pages must adhere to the standard table architecture:
- Muted sticky table headers.
- Search input with 300ms debounce.
- Skeletons for loading states — never full-page blocking spinners.
- Responsive design: tables scroll horizontally or collapse into mobile card/sheet views on viewports below `md`.
- Mobile row clicks open a detail side sheet, never a desktop-sized modal directly.

---

## 11. Multi-Channel Notification Parity

- Automated notifications must maintain parity across channels: if an event generates an external email/SMS, it must also record an in-app notification entry for the recipient.
- Outgoing transactional emails must use the dark-mode-locked branded ACOB shell (`background-image: linear-gradient(#000000,#000000) !important`) to prevent Gmail/Outlook dark mode inversions.
- Never hardcode an individual's name as an automated signatory; use departmental signatures ("Admin & Operations", "Customer Support").
