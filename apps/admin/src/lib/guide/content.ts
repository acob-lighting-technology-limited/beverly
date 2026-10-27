/**
 * Beverly Guide Content Model & Copy
 * Modeled after the Matrix Guide (https://matrix.acoblighting.com/guide) and
 * adapted for Beverly's smart metering, STS tokens, telemetry, and energy wallet.
 */

export interface GuideModule {
  name: string;
  href: string;
  icon: string;
  summary: string;
  external?: boolean;
}

export interface GuideModuleGroup {
  key: string;
  label: string;
  modules: GuideModule[];
}

export interface GuideStat {
  value: number | string;
  suffix?: string;
  label: string;
}

export interface GuideStoryItem {
  kicker: string;
  title: string;
  body: string;
}

export interface GuideHighlight {
  tag: string;
  title: string;
  body: string;
  icon: string;
  href?: string;
}

export interface GuideStep {
  title: string;
  body: string;
  href?: string;
  cta?: string;
}

export interface GuideFaq {
  q: string;
  a: string;
}

export interface GuideFaqGroup {
  id: string;
  title: string;
  items: GuideFaq[];
}

export const guideStats: GuideStat[] = [
  { value: 24, suffix: '+', label: 'Connected modules' },
  { value: 1, label: 'Unified energy grid' },
  { value: 100, suffix: '%', label: 'Paperless & auditable' },
  { value: 'Live', label: 'Across all mini-grid stations' },
];

export const guideStory: GuideStoryItem[] = [
  {
    kicker: 'Before',
    title: 'Fragmented systems & manual tokens',
    body: 'Manual STS token generation, unlinked scratch cards, scattered spreadsheets, and zero real-time visibility into station consumption or power quality.',
  },
  {
    kicker: 'The shift',
    title: 'One unified smart energy platform',
    body: 'Calinmeter STS protocols, SparkMeter Koios v1/v2 telemetry, and digital wallet ledgers unified under an accountable, role-protected control plane.',
  },
  {
    kicker: 'Now',
    title: 'Total grid & revenue visibility',
    body: 'Leadership, operations, and field teams see vending transactions, station balance, tamper alarms, and customer consumption live, at a glance.',
  },
];

export const guideModuleGroups: GuideModuleGroup[] = [
  {
    key: 'metering',
    label: 'Smart Metering & STS Vending',
    modules: [
      {
        name: 'Credit Token Vending',
        href: '/vending',
        icon: 'credit-token',
        summary: 'STS-compliant credit token generation with instant 20-digit token output and audit receipts.',
      },
      {
        name: 'Meter Key Change (KCT)',
        href: '/vending',
        icon: 'key-change',
        summary: 'Re-key STS meters to accept new tariff groups, supply group codes, or transfer authority.',
      },
      {
        name: 'Meter Orders & Staging',
        href: '/meter-orders',
        icon: 'meter-orders',
        summary: 'Manage inventory, serial ranges, field technician allocations, and staging approvals.',
      },
      {
        name: 'Meter Approvals Pipeline',
        href: '/meter-approvals',
        icon: 'meter-approvals',
        summary: 'Dual-authorized maker-checker review for newly commissioned smart meters.',
      },
      {
        name: 'Station Onboarding Studio',
        href: '/vending',
        icon: 'station-studio',
        summary: 'Automate mini-grid gateway, meter, customer, and tariff bundle provisioning.',
      },
    ],
  },
  {
    key: 'wallet',
    label: 'Energy Wallet & Ledger Operations',
    modules: [
      {
        name: 'Wallets & Balance Ledger',
        href: '/wallets',
        icon: 'wallets',
        summary: 'Double-entry energy ledger tracking master station balances, vendor floats, and fees.',
      },
      {
        name: 'Wallet Funding Approvals',
        href: '/funding',
        icon: 'funding',
        summary: 'Review and approve Paystack, bank transfer, and manual merchant wallet funding requests.',
      },
      {
        name: 'Vendor Float Transfers',
        href: '/vendor-transfers',
        icon: 'vendor-transfers',
        summary: 'Disburse energy vending credit to authorized station vendors and retail points.',
      },
      {
        name: 'Vending Purchases Monitor',
        href: '/purchases',
        icon: 'purchases',
        summary: 'Live feed of all customer STS token purchases across all distribution feeds.',
      },
      {
        name: 'Customer Refund Engine',
        href: '/refunds',
        icon: 'refunds',
        summary: 'Process reversal and refund workflows with ledger-backed trace integrity.',
      },
      {
        name: 'Disputes & Escrow',
        href: '/disputes',
        icon: 'disputes',
        summary: 'Resolve failed bank transactions, card chargebacks, and station ledger discrepancies.',
      },
      {
        name: 'Vendor Settlement',
        href: '/settlement',
        icon: 'settlement',
        summary: 'Weekly and monthly vendor payout reconciliation and automated commission calculations.',
      },
      {
        name: 'End-of-Day Reconciliation',
        href: '/reconciliation',
        icon: 'reconciliation',
        summary: 'Automated delta reconciliation comparing telemetry consumption with token revenue.',
      },
    ],
  },
  {
    key: 'telemetry',
    label: 'Grid Telemetry & Data Reports',
    modules: [
      {
        name: 'Reports & Analytics Centre',
        href: '/reports',
        icon: 'reports',
        summary: 'Generate audited station revenue, consumption trend, and tariff performance reports.',
      },
      {
        name: 'Customer Consumption Feed',
        href: '/consumption',
        icon: 'consumption',
        summary: 'Hourly and daily consumption profiles aggregated across IoT gateways.',
      },
      {
        name: 'Station Daily Interval Data',
        href: '/reports',
        icon: 'interval-data',
        summary: 'High-resolution interval readings, daily usage curves, and styled Excel exports.',
      },
      {
        name: 'Abnormal Alarms & Tamper',
        href: '/reports',
        icon: 'abnormal-alarms',
        summary: 'Detect potential meter bypass, unmetered loads, and zero-consumption anomalies.',
      },
      {
        name: 'Station Site Energy Audit',
        href: '/reports',
        icon: 'energy-audit',
        summary: 'Mini-grid feeder balancing comparing station bulk meters against sum of customer meters.',
      },
      {
        name: 'Broadcast Announcements',
        href: '/announcements',
        icon: 'announcements',
        summary: 'Broadcast operational maintenance alerts, tariff changes, and holiday schedules to portals.',
      },
    ],
  },
  {
    key: 'governance',
    label: 'Governance & Compliance',
    modules: [
      {
        name: 'Vendors Register',
        href: '/vendors',
        icon: 'vendors',
        summary: 'Manage authorized retail energy vendors, operating stations, and vending quotas.',
      },
      {
        name: 'Vendor Applications',
        href: '/applications',
        icon: 'applications',
        summary: 'Review and approve new vendor onboarding submissions, KYC documents, and station grants.',
      },
      {
        name: 'Customer Directory',
        href: '/customers',
        icon: 'customers',
        summary: 'Customer account directory, assigned meters, KYC tier status, and vending history.',
      },
      {
        name: 'KYC Reviews',
        href: '/kyc-reviews',
        icon: 'kyc',
        summary: 'Verify identity documents, address proof, and regulatory compliance for vendors and customers.',
      },
      {
        name: 'Fraud & Risk Engine',
        href: '/fraud',
        icon: 'fraud',
        summary: 'Monitor vending velocity anomalies, abnormal consumption drop-offs, and suspicious logins.',
      },
      {
        name: 'Audit Trail',
        href: '/audit',
        icon: 'audit',
        summary: 'Immutable chronological log of all administrator, operator, and vending actions.',
      },
      {
        name: 'Roles & Staff Permissions',
        href: '/roles-permissions',
        icon: 'roles-permissions',
        summary: 'Granular role-based access control protecting critical financial and relay commands.',
      },
      {
        name: 'NDPR Privacy Compliance',
        href: '/privacy',
        icon: 'privacy',
        summary: 'Manage data protection, subject access requests, and customer consent records.',
      },
    ],
  },
];

export const guideHighlights: GuideHighlight[] = [
  {
    tag: 'Prepaid Engine',
    title: 'STS token generation without downtime.',
    body: 'Standard Transfer Specification (STS IEC 62055-41) tokens generated instantly. Handles credit recharge, key changes (KCT), tamper clearing, and power limit adjustments with offline cryptographic assurance.',
    icon: 'credit-token',
    href: '/vending',
  },
  {
    tag: 'Grid Intelligence',
    title: 'Live IoT telemetry and remote relay control.',
    body: 'Continuous power quality tracking (voltage, current, power factor) and 15-minute interval demand curves. Operators dispatch over-the-air relay reconnect/disconnect without physical site visits.',
    icon: 'telemetry',
    href: '/reports',
  },
  {
    tag: 'Accountable Money',
    title: 'Double-entry ledger with instant Paystack sync.',
    body: 'Every vending kobo is locked to an immutable double-entry ledger. Vendor funding, customer token sales, fees, and daily station reconciliations balance to the penny with full audit trace.',
    icon: 'wallets',
    href: '/wallets',
  },
];

export const firstWeekSteps: GuideStep[] = [
  {
    title: 'Tour your station topology',
    body: 'Check the Dashboard and Station Overview to verify your assigned mini-grid feeds, bulk meter status, and customer counts.',
    href: '/dashboard',
    cta: 'View Dashboard',
  },
  {
    title: 'Issue your first STS credit token',
    body: 'Open the Vending module, select a customer account or meter number, input kWh units, and generate an instant 20-digit STS token receipt.',
    href: '/vending',
    cta: 'Open Vending',
  },
  {
    title: 'Monitor live telemetry & alarms',
    body: 'Visit the Reports Centre to inspect interval usage curves, abnormal alarm flags, and potential bypass incidents across distribution feeders.',
    href: '/reports',
    cta: 'Inspect Reports',
  },
  {
    title: 'Review financial reconciliation',
    body: 'Check the Wallets & Ledger module to confirm daily vending totals match bank settlement and vendor floating accounts.',
    href: '/wallets',
    cta: 'View Wallets',
  },
];

export const guideFaqGroups: GuideFaqGroup[] = [
  {
    id: 'account',
    title: 'Account & Roles',
    items: [
      {
        q: 'How do permissions work in Beverly?',
        a: 'Beverly implements granular Role-Based Access Control (RBAC). Super Admins have complete visibility, while Operations Managers, Account Managers, and Field Engineers receive scoped capabilities strictly aligned with their operational duties.',
      },
      {
        q: 'Can a staff member manage multiple stations?',
        a: 'Yes. Staff profiles can be scoped to a single station (e.g. Ruwan Jema) or granted multi-station access across regional clusters.',
      },
      {
        q: 'How do I reset my password or update MFA?',
        a: 'Navigate to Security Settings (/security) from the user profile menu to update your password or configure multi-factor authentication.',
      },
    ],
  },
  {
    id: 'vending',
    title: 'Vending & Tokens',
    items: [
      {
        q: 'What is an STS Token?',
        a: 'STS (Standard Transfer Specification) is the international standard (IEC 62055-41) for prepaid electricity metering. It generates an encrypted 20-digit numeric token that customers enter into their keypad.',
      },
      {
        q: 'What is a Key Change Token (KCT)?',
        a: 'A Key Change Token re-keys the meter to update its Supply Group Code (SGC) or Tariff index. Two 20-digit tokens are generated and entered sequentially into the meter before new credit tokens can be loaded.',
      },
      {
        q: 'What happens if a token is lost or damaged?',
        a: 'Every generated token is logged permanently in Token Records. Operators can retrieve, re-print, or SMS the token receipt at any time without re-charging the customer.',
      },
      {
        q: 'Can tokens be refunded?',
        a: 'Tokens can be reversed through the Refunds Engine (/refunds) if the meter was entered incorrectly, provided the reversal is verified against the double-entry ledger.',
      },
    ],
  },
  {
    id: 'grid',
    title: 'Smart Grid & Telemetry',
    items: [
      {
        q: 'How often does telemetry sync from field meters?',
        a: 'Smart meters transmit telemetry periodically based on gateway configuration (typically hourly or daily). The daily governance cron reconciles and aggregates readings every UTC midnight.',
      },
      {
        q: 'What is an Abnormal Alarm?',
        a: 'An Abnormal Alarm triggers when an active customer shows continuous zero consumption despite connected load, or when power draw exceeds the assigned maximum power limit, signaling potential bypass.',
      },
      {
        q: 'Can meters be disconnected remotely?',
        a: 'Yes, for smart meters equipped with internal relays (such as SparkMeter or GPRS-enabled meters), authorized operators can dispatch over-the-air relay disconnect or load limiting commands.',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security & Compliance',
    items: [
      {
        q: 'How does Beverly comply with NDPR?',
        a: 'Beverly adheres strictly to the Nigeria Data Protection Regulation. Customer contact details are minimized, telemetry data is encrypted at rest, and all staff access is audited.',
      },
      {
        q: 'Where do I find help when something fails?',
        a: 'Open the Support Desk (/support) to raise a tracked support ticket, or chat directly with the built-in AcoBot assistant in the bottom-right corner for quick navigation assistance.',
      },
    ],
  },
];

export const securityPoints = [
  'STS Standard Compliant',
  'AES-GCM Keyring Encryption',
  'Immutable Double-Entry Ledger',
  'Role-Based Access Control',
  'Maker-Checker Verification',
  'NDPR Data Protection',
  'Multi-Tenant Data Isolation',
  'Full Audit Logging',
];
