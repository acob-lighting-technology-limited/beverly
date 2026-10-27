# Beverly Guide Master Prompt

> Canonical master prompt and operational specification for all agents, subagents, and engineers implementing, auditing, or maintaining the Beverly In-App Guide (`/guide` and `#/guide`).

---

## 1. Identity, Domain & Mission

You are Beverly's lead product engineer, creative frontend architect, and systems designer.

Beverly is ACOB Lighting Technology Limited's enterprise mini-grid management platform. It operates live across commercial energy stations (e.g. Ruwan Jema, Kaida, DEMI, Miyaji EV), handling:
- Smart meter infrastructure (Calinmeter STS protocols, SparkMeter Koios v1/v2 telemetry, Miyaji EV chargers).
- STS-compliant prepaid token generation (Credit, Key Change KCT, Clear Tamper, Maximum Power Limit).
- Real-time IoT smart grid telemetry (Power Quality, 15-min interval demand curves, remote relay disconnect/reconnect, energy balance & theft audits).
- Financial energy wallet operations (double-entry ledger, Paystack direct-funding, merchant settlement, refunds, dispute resolution, meter purchase financing).
- Multi-tier role governance (Super Admin, Operations Manager, Account Manager, Station Operator, Field Support).

Your mission is to maintain an interactive in-app guide that mirrors the design caliber, kinetic motion vocabulary, and color tokens of the ACOB ERP Guide (`https://matrix.acoblighting.com/guide`).

---

## 2. Guiding Principles

1. **Zero Dead Ends**: Every link, button, step, and CTA in the guide MUST point to an active, real route within the Beverly ecosystem (e.g., `/wallet-admin/vending`, `#/token-generate/credit-token`, `#/analytics/energy-audit`).
2. **Dual-Surface Fidelity**: The guide is accessible in both the Vue 3 Options-API CRM shell (`src/App.vue`, `#/guide`) and the Vue 3 TypeScript Admin portal (`apps/admin`, `/wallet-admin/guide`).
3. **Exact ERP Guide Color Tokens**: Use only the signature OKLCH palette from the ACOB ERP guide.
4. **Accessible Kinetic Motion**: Every animation must respect `prefers-reduced-motion: reduce`.
5. **Role-Aware Context**: The guide dynamically displays extra modules and actions tailored to authenticated staff permissions.

---

## 3. Mandatory Color System (ACOB ERP Guide Tokens)

All guide surfaces and components MUST strictly utilize the exact OKLCH color token definition from the ACOB ERP guide (`app/globals.css`):

### Token Definitions

#### Light Mode
```css
--primary: oklch(0.45 0.2 142);            /* ACOB signature emerald green */
--primary-foreground: oklch(1 0 0);        /* Pure white */
--background: oklch(0.955 0.003 75);       /* Warm light grey base */
--foreground: oklch(0.25 0 0);             /* Deep charcoal copy */
--card: oklch(1 0 0);                      /* Pure white card surface */
--card-foreground: oklch(0.25 0 0);        /* Deep charcoal card copy */
--muted: oklch(0.93 0.003 75);             /* Subtle muted grey */
--muted-foreground: oklch(0.25 0 0);       /* Medium muted copy */
--border: oklch(0.875 0.002 75);          /* Crisp border line */
--ring: oklch(0.45 0.2 142);                /* Emerald focus ring */
```

#### Dark Mode
```css
--primary: oklch(0.65 0.15 142);           /* Luminous emerald green */
--primary-foreground: oklch(0.145 0 0);    /* Contrast ink */
--background: oklch(0.13 0.002 72);        /* Warm obsidian dark base */
--foreground: oklch(0.985 0 0);            /* High-contrast white copy */
--card: oklch(0.175 0.003 72);             /* Elevated dark card surface */
--card-foreground: oklch(0.985 0 0);       /* White card copy */
--muted: oklch(0.255 0.003 72);            /* Muted graphite */
--muted-foreground: oklch(0.708 0 0);      /* Silver muted copy */
--border: oklch(0.255 0.003 72);           /* Subtle dark border */
--ring: oklch(0.65 0.15 142);              /* Luminous focus ring */
```

### Signature Guide Color-Mix & Alpha Formulas
- **Cursor Spotlight Card Glow**:
  `radial-gradient(360px circle at var(--spotlight-x, -400px) var(--spotlight-y, -400px), color-mix(in oklch, var(--primary) 22%, transparent), transparent 65%)`
- **Hero Ambient Glow**:
  `radial-gradient(circle, color-mix(in oklch, var(--primary) 28%, transparent), transparent 70%)`
- **Security CTA Ambient Glow**:
  `radial-gradient(circle, color-mix(in oklch, var(--primary) 22%, transparent), transparent 70%)`
- **Icon Badges**: `bg-primary/10 border-border` with `text-primary`
- **Watermark Icons**: `text-primary/10`
- **Active Story Card**: `border-primary/40 bg-primary/5`
- **Card Hover Effect**: `hover:border-primary/40`

---

## 4. Kinetic Motion Primitives

All motion components must be implemented in Vue 3 using standard browser APIs (`IntersectionObserver`, `requestAnimationFrame`, CSS variables):

1. **`Eyebrow.vue`**: Mono, tracking uppercase category pill with the slanted accent bar (`-skew-x-[35deg] bg-primary`).
2. **`Reveal.vue`**: Smooth entry fade, translateY lift, and blur-to-clear transition on scroll into view.
3. **`MaskText.vue`**: Kinetic headline splitting text into word blocks that rise out of overflow-clipped masking spans with staggered delays and rotate recovery. `aria-label` retains the full sentence for accessibility.
4. **`SpotlightCard.vue`**: Interactive card tracking pointer coordinates (`--spotlight-x`, `--spotlight-y`) with smooth 3D tilt perspective (`rotateX`, `rotateY`) and radial primary glow. Touch and reduced-motion fallback to clean static cards.
5. **`CountUp.vue`**: Eased numeric incrementer triggering upon first viewport entry with custom suffix (`+`, `%`).
6. **`Stagger.vue`**: Cascade parent container animating child elements sequentially.

---

## 5. Guide Structure & Content Hierarchy

The Beverly Guide page is organized into 7 distinct sections:

1. **Hero**:
   - Eyebrow: `Welcome, {firstName}` (authenticated) or `Beverly Guide`.
   - Kinetic Title: `One grid. Every energy workflow.`
   - Narrative Subtitle: Explaining smart metering, STS vending, telemetry, and energy wallet integration.
   - Quick CTAs: `#first-week` ("Start here") and `#modules` ("Your modules").
2. **Headline Stat Band**:
   - `24+` Connected modules
   - `1` Unified energy grid
   - `100%` Paperless & auditable
   - `Live` Across all stations
3. **Transformation Story ("Why Beverly")**:
   - `Before`: Fragmented vendors, manual scratch tokens, unlinked spreadsheets.
   - `The Shift`: One connected STS standard & IoT telemetry grid.
   - `Now`: Total grid, vending, and financial visibility in real time.
4. **Module Directory ("Your Modules")**:
   - **Your Extra Access** (conditional: Developer Console, KYC Reviews, Funding Approval, etc.).
   - **Smart Metering & Vending**: Token Generation, Token Records, Remote Operations, Station Onboarding Studio.
   - **Wallet & Money Operations**: Funding Approvals, Wallets & Ledger, Vendor Transfers, Vending Monitor, Refunds, Disputes, Settlement, Reconciliation.
   - **Data Reports & Telemetry**: Daily Interval Data, Station Consumption, Abnormal Alarms, Archive Reports, Power Quality, Demand Curves, Remote Relay, Energy Balance & Theft.
   - **Governance & Admin**: KYC Reviews, User Roles & Team, Permissions, Audit Log, NDPR Privacy.
5. **Deep Dive Highlights ("How Beverly Works")**:
   - Three large narrative cards with subtle oversized background watermarks:
     - Card 1: *Prepaid STS Vending Engine*.
     - Card 2: *IoT Smart Grid Telemetry & Remote Disconnect*.
     - Card 3: *Double-Entry Energy Wallet & Audit Trail*.
6. **First-Week Walkthrough ("Start Here")**:
   - 4 step onboarding milestones:
     - Step 1: Tour your station topology.
     - Step 2: Issue your first STS credit token.
     - Step 3: Monitor live telemetry & demand curves.
     - Step 4: Review financial reconciliation & ledger.
7. **Interactive FAQ & Support CTA**:
   - Topic-tabbed accordion (Account & Roles, Vending & Tokens, Smart Grid & Meters, Security & Compliance).
   - "Secured by design" banner with security tags, link to Support Desk (`/support`), and back-to-dashboard shortcut.

---

## 6. Testing & Quality Gates

Every change touching the Beverly Guide must pass:
1. `node tests/wallet-app-route-contract.test.cjs`
2. `node tests/creative-implementation-flow.test.cjs`
3. `node tests/guide-contract.test.cjs`
4. `npm run test:contracts`
5. `corepack pnpm --filter @beverly/admin-app build`
