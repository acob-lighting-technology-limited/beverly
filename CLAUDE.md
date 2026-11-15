# Claude Code Rules — Beverly Platform

All engineering standards, architectural boundaries, and UI patterns for this codebase are defined in
**`AGENTS.md`** at the project root. That file is the single source of truth shared across all AI agents
(Claude, Codex, Cursor, Antigravity, etc.). If this file and `AGENTS.md` ever disagree, fix the
disagreement — do not pick one silently.

Read `AGENTS.md` fully before starting any task. Every rule there is mandatory.
The sections that matter most day to day:

> **Engineering Practices** — reuse before you write, Pinia for all new state (Vuex is frozen),
> all mutating writes server-side, check live-write status, fix the cause not the symptom.
>
> **Anti-Hallucination & Telemetry Truth** — never replace unknown meter or battery cell measurements
> with constants; never claim physical IoT, locker, or relay control success without confirmed provider receipt.
>
> **Financial Ledger Invariants** — append-only ledgers, mandatory idempotency keys, never auto-resubmit
> ambiguous provider payments without verified reconciliation.
>
> **Database Security Standard** — Supabase RLS, tenant memberships, actor installation grants,
> `SECURITY DEFINER` lockdown, remote migration verification via `npx supabase migration list`.
>
> **Table Page & Accessibility Standard** — stable `data-testid` selectors on all interactive controls,
> design tokens from `@beverly/tokens`, minimum text size `text-xs` (12px), WCAG AA contrast.

---

## Verification Workflow — Fast Checks First

A full `npm run build` runs builds across all 6 monorepo apps plus the wallet backend and root bundler.
Running the full build for trivial edits can be slow. For quick turn verification, run the fast targeted checks:

```powershell
# Typecheck across root and monorepo packages
npm run typecheck

# Production hardening audit
npm run hardening:audit

# Targeted sub-app build (e.g. battery swap app or backend)
corepack pnpm --filter @beverly/battery-swap-app build
corepack pnpm --filter @beverly/wallet-backend build

# Target domain test suite for the area you touched:
npm run test:wallet           # wallet ledger, vending, payments
npm run test:security         # RLS, authz, secret boundaries
npm run test:oem              # SparkMeter, Calinmeter, OEM contracts
npm run test:smart-metering   # AMR ingestion, consumption reconciliation
npm run test:support-centre   # Call centre, dispute pipeline
npm run test:browser          # Playwright E2E browser tests
```

Run the full `npm run build` or `npm test` before declaring major multi-package initiatives complete.

---

## Commit Only When the User Says a Piece Is Done

Leave changes uncommitted while the user is still reviewing or asking for tweaks. When the user says
a feature or request is done, make one commit for it, after the fast checks pass.
- Group commits by feature domain as described in `AGENTS.md`.
- Stage only your own paths (`git add <specific files>`) — never run blanket `git add -A` or `git add .`.
- Never add a `Co-Authored-By` trailer.
- Do not commit WIP, scratch files, or half-done work, and do not push unless asked.

---

## Production Changes Need an Explicit Yes

There is no loose staging database. Before pushing a migration (`npx supabase db push`), executing
writes against live Supabase environments, changing runtime live-write control, or mutating external
telemetry / payment providers, show the user exactly what will change and wait for an explicit confirmation.
