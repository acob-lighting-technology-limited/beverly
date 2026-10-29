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
6. **Avatar-Only Placement**: The Guide entrypoint is strictly placed within the user avatar dropdown menu in both shells. It must NEVER be added to sidebar navigation groups or topbar quick-utility rows.
7. **Flow Pixels Humanizer Engine Standard**: Zero AI marketing clichés or corporate tropes. Write in grounded, operator-facing language describing real grid hardware, STS standards, double-entry ledgers, and power quality metrics.

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
--muted-foreground: oklch(0.46 0.01 75);   /* Crisp readable muted copy */
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

## 5. Avatar-Only Navigation Architecture

The Guide must be accessible ONLY from the staff avatar dropdown menu:

1. **Admin Portal (`apps/admin/src/components/AppShell.vue`)**:
   - Located inside `.bw-user-dropdown` as `<RouterLink to="/guide" class="bw-user-menu-item" role="menuitem" @click="closeUserMenu">`.
   - FORBIDDEN from `standardNavGroups` in sidebar navigation.
   - FORBIDDEN from topbar quick-utility action buttons.
2. **CRM Shell (`src/App.vue` & `src/data/route-manifest.js`)**:
   - Located inside `.bw-user-dropdown` as `<BaseButton variant="quiet" class="bw-user-menu-item" role="menuitem" @click="openGuide">`.
   - Hidden from sidebar navigation via `hideFromSidebar: true` on `#/guide` and filtered out in `routeGroups()`.
   - Direct hash routing `#/guide` remains functional when clicked from avatar menu or internal links.

---

## 6. Flow Pixels Humanizer Engine Voice Specification

All guide copy across Admin (`content.ts`) and CRM (`guide-content.js`) must strictly adhere to the Flow Pixels Humanizer Engine standard.

### Prohibited AI Marketing Clichés
The following words, phrases, and corporate buzzwords are strictly forbidden in Beverly Guide content:
- `operational nervous system`
- `seamless` / `seamlessly`
- `delve` / `delve into`
- `supercharge`
- `unleash`
- `mission-critical`
- `tapestry`
- `testament to`
- `game-changer`
- `cutting-edge`
- `holistic`
- `meticulous`
- `things people ask`
- `total visibility`

### Mandatory Voice Attributes
- **Grounded & Concrete**: Name real hardware, standards, and protocols (e.g., Calinmeter STS IEC 62055-41, SparkMeter Koios v1/v2, Key Change Tokens KCT, double-entry general ledger, NDPA compliance).
- **Field-Tested Operations**: Address rural mini-grid realities like weak 2G GSM cellular networks, offline token generation, manual tamper resets, and daily interval telemetry reconciliation.
- **Operator-First**: Use clear, concise action words ("issue tokens", "reconcile ledgers", "monitor power quality") instead of speculative marketing hype.

---

## 7. Guide Structure & Content Hierarchy

The Beverly Guide page is organized into 7 distinct sections:

1. **Hero**:
   - Eyebrow: `Field Guide` or `Welcome, {firstName}`.
   - Headline: `Prepayment vending, live telemetry, and energy wallets.`
   - Subtitle: Clear summary of daily operational workflows, STS token vending, power quality monitoring, and wallet reconciliations.
   - Quick CTAs: `#first-week` ("First-week checklist") and `#modules` ("Browse tools").
2. **Headline Stat Band**:
   - `14+` Operational tools
   - `100%` Audit coverage
   - `24/7` Grid telemetry
   - `0` Paper scratch cards
3. **Transformation Story ("From paper logbooks to live meter controls")**:
   - `Past`: Scratch paper vouchers, delayed SMS tokens, and unlinked spreadsheets.
   - `Transition`: Standardized STS prepaid vending and cloud IoT smart grid telemetry.
   - `Today`: Real-time interval readings, automated ledger audits, and zero paper trail.
4. **Module Directory ("Operational modules")**:
   - **Smart Metering & STS Vending**: Credit Token Generation, Token Audit Records, Remote Meter Commands, Station Onboarding Studio.
   - **Energy Wallets & Finance**: Wallet Ledger & Balances, Funding Approvals, Station Collections & Settlement, Refund & Dispute Processing, Vending Health Monitor.
   - **Grid Telemetry & Data**: Daily Interval Readings, Station Power Quality, Demand Curves & Peak Load, Tamper Alarms & Theft Audit, Remote Disconnect & Reconnect.
   - **Governance & Security**: Staff Access & Roles, Operational Audit Trail, KYC Verification, Data Protection & Privacy.
5. **Deep Dive Highlights ("Engineered for remote sites and weak networks")**:
   - Three large narrative cards with subtle oversized background watermarks:
     - Card 1: *Prepaid STS Vending Engine* (IEC 62055-41 20-digit tokens, offline vending key servers).
     - Card 2: *IoT Smart Grid Telemetry & Remote Disconnect* (15-min intervals, voltage fluctuations, relay control).
     - Card 3: *Double-Entry Energy Wallet & Audit Trail* (immutable ledger, Paystack settlement, audit coverage).
6. **First-Week Walkthrough ("Getting started on station operations")**:
   - 4 step onboarding milestones:
     - Step 1: Confirm station topology and feeder assignments.
     - Step 2: Issue a test credit token.
     - Step 3: Check live interval data and power quality.
     - Step 4: Reconcile daily collections and ledger entries.
7. **Interactive FAQ & Support CTA ("Frequently asked questions")**:
   - Topic-tabbed accordion (Account & Roles, Vending & Tokens, Smart Grid & Meters, Security & Compliance).
   - "Secured by design" banner with security tags, link to Support Desk (`/support`), and back-to-dashboard shortcut.

---

## 8. Testing & Quality Gates

Every change touching the Beverly Guide must pass:
1. `node tests/wallet-app-route-contract.test.cjs`
2. `node tests/creative-implementation-flow.test.cjs`
3. `node tests/guide-contract.test.cjs`
4. `npm run test:contracts`
5. `corepack pnpm --filter @beverly/admin-app build`
