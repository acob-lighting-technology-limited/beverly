/**
 * Beverly Guide Content Model & Copy
 * Humanized for field operations: STS prepayment tokens, mini-grid telemetry, and energy wallets.
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
  { value: 14, suffix: '+', label: 'Operational tools' },
  { value: 100, suffix: '%', label: 'Audit trail coverage' },
  { value: '24/7', label: 'Field telemetry' },
  { value: 0, label: 'Paper scratch cards' },
];

export const guideStory: GuideStoryItem[] = [
  {
    kicker: 'Past',
    title: 'Paper records and lost revenue',
    body: 'Station staff relied on paper notebooks, scratch cards, and unverified bank slips. Tamper flags went unnoticed, and power losses were only discovered at month-end.',
  },
  {
    kicker: 'Transition',
    title: 'Direct digital controls',
    body: 'Calinmeter and SparkMeter equipment integrated with a single ledger. Prepayment tokens, meter key changes, and feeder telemetry operate through verified role-based access.',
  },
  {
    kicker: 'Today',
    title: 'Clear balances and real-time alerts',
    body: 'Station managers monitor token purchases, feeder loads, tamper alarms, and customer consumption as they happen—with bank deposits matching meter ledgers.',
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
        summary: 'Generate 20-digit STS credit tokens with encrypted keypad sequences and printable customer receipts.',
      },
      {
        name: 'Meter Key Change (KCT)',
        href: '/vending',
        icon: 'key-change',
        summary: 'Update Supply Group Codes (SGC) and tariff rates on installed meters with two-part sequential tokens.',
      },
      {
        name: 'Meter Orders & Staging',
        href: '/meter-orders',
        icon: 'meter-orders',
        summary: 'Track meter inventory, allocate batches to field technicians, and approve commissioning.',
      },
      {
        name: 'Meter Approvals Pipeline',
        href: '/meter-approvals',
        icon: 'meter-approvals',
        summary: 'Require two-person maker-checker approval before activating new smart meters on the grid.',
      },
      {
        name: 'Station Onboarding Studio',
        href: '/vending',
        icon: 'station-studio',
        summary: 'Provision new mini-grid stations, bulk meters, tariffs, and customer accounts in one setup wizard.',
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
        summary: 'Double-entry energy ledger tracking master station balances, vendor floats, and commission fees.',
      },
      {
        name: 'Wallet Funding Approvals',
        href: '/funding',
        icon: 'funding',
        summary: 'Review bank transfer proofs and Paystack deposits before crediting merchant vending balances.',
      },
      {
        name: 'Vendor Float Transfers',
        href: '/vendor-transfers',
        icon: 'vendor-transfers',
        summary: 'Disburse vending float balances to verified retail merchants and station cashiers.',
      },
      {
        name: 'Vending Purchases Monitor',
        href: '/purchases',
        icon: 'purchases',
        summary: 'Review token purchase records, payment channels, and vending timestamps across all stations.',
      },
      {
        name: 'Customer Refund Engine',
        href: '/refunds',
        icon: 'refunds',
        summary: 'Process transaction reversals with audit validation against the double-entry ledger.',
      },
      {
        name: 'Disputes & Escrow',
        href: '/disputes',
        icon: 'disputes',
        summary: 'Investigate disputed bank payments, chargebacks, and station ledger discrepancies.',
      },
      {
        name: 'Vendor Settlement',
        href: '/settlement',
        icon: 'settlement',
        summary: 'Calculate monthly vendor commissions and reconcile payout balances against bank accounts.',
      },
      {
        name: 'End-of-Day Reconciliation',
        href: '/reconciliation',
        icon: 'reconciliation',
        summary: 'Daily delta checks comparing energy consumed on field meters with vending revenue.',
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
        summary: 'Download station revenue, customer usage, and tariff collection reports in structured formats.',
      },
      {
        name: 'Customer Consumption Feed',
        href: '/consumption',
        icon: 'consumption',
        summary: 'Hourly and daily consumption profiles from IoT gateways and bulk meters.',
      },
      {
        name: 'Station Daily Interval Data',
        href: '/reports',
        icon: 'interval-data',
        summary: 'Export 15-minute load curves, peak demand figures, and power quality readings to Excel.',
      },
      {
        name: 'Abnormal Alarms & Tamper',
        href: '/reports',
        icon: 'abnormal-alarms',
        summary: 'Flag zero-consumption anomalies, reverse energy flow, and unauthorized physical meter openings.',
      },
      {
        name: 'Station Site Energy Audit',
        href: '/reports',
        icon: 'energy-audit',
        summary: 'Feeder-level energy audits comparing bulk station meters with the sum of customer meters to locate line losses.',
      },
      {
        name: 'Broadcast Announcements',
        href: '/announcements',
        icon: 'announcements',
        summary: 'Send service notices, planned outage warnings, and tariff adjustment announcements to portal users.',
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
        summary: 'Register authorized retail vending points, set credit thresholds, and assign station boundaries.',
      },
      {
        name: 'Vendor Applications',
        href: '/applications',
        icon: 'applications',
        summary: 'Review merchant applications, identity documents, and station operating permissions.',
      },
      {
        name: 'Customer Directory',
        href: '/customers',
        icon: 'customers',
        summary: 'Directory of customer accounts, assigned meter serials, addresses, and purchase histories.',
      },
      {
        name: 'KYC Reviews',
        href: '/kyc-reviews',
        icon: 'kyc',
        summary: 'Review identity documents and proof of address against regulatory compliance tiers.',
      },
      {
        name: 'Fraud & Risk Engine',
        href: '/fraud',
        icon: 'fraud',
        summary: 'Flag sudden velocity spikes, rapid off-hours token purchases, and suspicious account access.',
      },
      {
        name: 'Audit Trail',
        href: '/audit',
        icon: 'audit',
        summary: 'Chronological log of staff actions, balance adjustments, and permission updates.',
      },
      {
        name: 'Roles & Staff Permissions',
        href: '/roles-permissions',
        icon: 'roles-permissions',
        summary: 'Control staff access rights to ensure financial and relay commands require proper authorization.',
      },
      {
        name: 'NDPR Privacy Compliance',
        href: '/privacy',
        icon: 'privacy',
        summary: 'Manage customer data protection records in compliance with the Nigeria Data Protection Act.',
      },
    ],
  },
];

export const guideHighlights: GuideHighlight[] = [
  {
    tag: 'Prepayment Vending',
    title: 'Offline-resilient STS token generation.',
    body: 'Standard Transfer Specification (STS IEC 62055-41) tokens vend without internet dependence at the field meter. Credit tokens, key changes (KCT), and tamper resets use established 20-digit cryptographic sequences.',
    icon: 'credit-token',
    href: '/vending',
  },
  {
    tag: 'Smart Grid Telemetry',
    title: 'Feeder telemetry and remote relay control.',
    body: 'Continuous power quality tracking (voltage, current, power factor) and 15-minute interval demand curves. Where smart meters support internal disconnects, operators dispatch disconnect or power-limiting commands remotely.',
    icon: 'telemetry',
    href: '/reports',
  },
  {
    tag: 'Financial Integrity',
    title: 'Double-entry energy ledger.',
    body: 'Every vending transaction records matching debits and credits. Vendor floats, customer token purchases, payment processing fees, and daily reconciliations balance with clear audit evidence.',
    icon: 'wallets',
    href: '/wallets',
  },
];

export const firstWeekSteps: GuideStep[] = [
  {
    title: 'Review your assigned stations',
    body: 'Open the Dashboard to check active feeder lines, bulk meter readings, and customer totals for your station.',
    href: '/dashboard',
    cta: 'View Dashboard',
  },
  {
    title: 'Vend a test credit token',
    body: 'Open Vending, find a test customer account, enter the required units, and confirm the 20-digit token receipt prints or displays correctly.',
    href: '/vending',
    cta: 'Open Vending',
  },
  {
    title: 'Check feeder telemetry and alarms',
    body: 'Open Reports to inspect 15-minute demand curves and review whether any tamper or zero-consumption flags require investigation.',
    href: '/reports',
    cta: 'Inspect Reports',
  },
  {
    title: 'Reconcile daily float and token sales',
    body: 'Open Wallets & Ledger to verify that merchant float balances match cash collected and bank deposits for the day.',
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
        q: 'How do user permissions work in Beverly?',
        a: 'Beverly enforces Role-Based Access Control (RBAC). Super Administrators manage system-wide settings, while Operations Managers, Accounts Officers, and Field Technicians receive permissions strictly scoped to their operational duties.',
      },
      {
        q: 'Can a staff member manage multiple mini-grid stations?',
        a: 'Yes. Staff profiles can be restricted to a single site (such as Ruwan Jema) or granted multi-station access across an entire operational cluster.',
      },
      {
        q: 'How do I reset my password or configure two-factor authentication?',
        a: 'Open Security Settings (/security) from the user menu to update your account password or configure two-factor authentication.',
      },
    ],
  },
  {
    id: 'vending',
    title: 'Vending & Tokens',
    items: [
      {
        q: 'What is an STS prepayment token?',
        a: 'STS (Standard Transfer Specification) is the international standard (IEC 62055-41) for prepaid electricity metering. It produces an encrypted 20-digit numeric token that the customer enters directly on their meter keypad.',
      },
      {
        q: 'What is a Key Change Token (KCT)?',
        a: 'A Key Change Token reconfigures the encryption keys on a meter to update its Supply Group Code (SGC) or tariff index. Two 20-digit tokens are generated and entered sequentially into the meter before new credit tokens can be accepted.',
      },
      {
        q: 'What should an operator do if a customer loses their token receipt?',
        a: 'Every generated token remains permanently logged in Token Records. Operators can look up the meter number, retrieve the token, and reprint or re-send the receipt without charging the customer again.',
      },
      {
        q: 'How are mistaken token purchases reversed?',
        a: 'Tokens can be reversed through the Refunds module (/refunds) if an incorrect meter number was entered, provided the reversal is verified against the double-entry station ledger.',
      },
    ],
  },
  {
    id: 'grid',
    title: 'Smart Grid & Telemetry',
    items: [
      {
        q: 'How frequently do smart meters transmit telemetry?',
        a: 'Meters transmit load readings at intervals configured on the station gateway (typically hourly or daily). The overnight reconciliation job processes and aggregates readings at midnight UTC.',
      },
      {
        q: 'What triggers an abnormal alarm?',
        a: 'An abnormal alarm is flagged when an active customer shows zero consumption over extended periods despite a live supply connection, or when demand exceeds the configured power threshold, pointing to potential bypass.',
      },
      {
        q: 'Can field meters be disconnected remotely?',
        a: 'Yes. On smart meters equipped with internal motorized switches (such as SparkMeter or GPRS-enabled units), authorized operators can send remote disconnect or power-limiting commands from the portal.',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security & Compliance',
    items: [
      {
        q: 'How is customer information protected under NDPA/NDPR?',
        a: 'Beverly adheres to the Nigeria Data Protection Act. Customer records are restricted, telemetry data is encrypted at rest, and all staff access events are recorded in the audit log.',
      },
      {
        q: 'Where can operators get help during an outage or system fault?',
        a: 'Open Support (/support) to submit a tracked issue, or use the built-in assistant in the bottom corner for quick navigation help.',
      },
    ],
  },
];

export const securityPoints = [
  'STS Standard Compliant',
  'AES-GCM Key Encryption',
  'Double-Entry Energy Ledger',
  'Role-Based Access Control',
  'Maker-Checker Verification',
  'NDPA/NDPR Data Protection',
  'Multi-Tenant Station Isolation',
  'Complete Audit Logging',
];
