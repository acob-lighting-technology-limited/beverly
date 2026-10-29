export const guideStats = [
  { value: 14, suffix: '+', label: 'Operational tools' },
  { value: 100, suffix: '%', label: 'Audit trail coverage' },
  { value: '24/7', label: 'Field telemetry' },
  { value: 0, label: 'Paper scratch cards' },
];

export const guideStory = [
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

export const guideModuleGroups = [
  {
    key: 'metering',
    label: 'Smart Metering & STS Vending',
    modules: [
      {
        name: 'Credit Token Vending',
        href: '#/token-generate/credit-token',
        summary: 'Generate 20-digit STS credit tokens with encrypted keypad sequences and printable customer receipts.',
      },
      {
        name: 'Meter Key Change (KCT)',
        href: '#/token-generate/change-meter-key',
        summary: 'Update Supply Group Codes (SGC) and tariff rates on installed meters with two-part sequential tokens.',
      },
      {
        name: 'Token Records & Receipts',
        href: '#/token-record/credit-token-record',
        summary: 'Complete register of generated credit tokens, clear tamper tokens, and power limit adjustments.',
      },
      {
        name: 'Station Onboarding Studio',
        href: '#/system/station-onboarding-studio',
        summary: 'Provision new mini-grid stations, bulk meters, tariffs, and customer accounts in one setup wizard.',
      },
      {
        name: 'Daily Interval Data',
        href: '#/prepay-report/daily-data-meter',
        summary: 'Export 15-minute load curves, peak demand figures, and power quality readings to Excel.',
      },
      {
        name: 'Abnormal Alarms & Tamper',
        href: '#/prepay-report/abnormal-alarm',
        summary: 'Flag zero-consumption anomalies, reverse energy flow, and unauthorized physical meter openings.',
      },
    ],
  },
  {
    key: 'telemetry',
    label: 'Smart Grid Telemetry & Remote Control',
    modules: [
      {
        name: 'Power Quality Feed',
        href: '#/telemetry/power-quality',
        summary: 'Continuous phase-level tracking of voltage, current, power factor, and line frequency.',
      },
      {
        name: 'Demand Curves',
        href: '#/telemetry/demand-curves',
        summary: '15-minute load demand curves, peak kW tracking, and feeder load profiles.',
      },
      {
        name: 'Remote Relay & Load Limiting',
        href: '#/grid-control/remote-relay',
        summary: 'Send remote connect or disconnect commands and configure maximum station load limits.',
      },
      {
        name: 'Energy Balance & Theft Audit',
        href: '#/analytics/energy-audit',
        summary: 'Feeder-level energy audits comparing bulk station meters with the sum of customer meters to locate line losses.',
      },
      {
        name: 'Mesh Network & Gateways',
        href: '#/mesh/gateways',
        summary: 'Monitor gateway health, repeater signal strengths, and offline mesh node alerts.',
      },
    ],
  },
  {
    key: 'wallet',
    label: 'Energy Wallet & Financial Ledger',
    modules: [
      {
        name: 'Energy Wallets & Ledger',
        href: '/wallet-admin/wallets',
        summary: 'Double-entry energy ledger tracking master station balances, vendor floats, and commission fees.',
      },
      {
        name: 'Wallet Funding Approvals',
        href: '/wallet-admin/funding',
        summary: 'Review bank transfer proofs and Paystack deposits before crediting merchant vending balances.',
      },
      {
        name: 'Vendor Transfers',
        href: '/wallet-admin/vendor-transfers',
        summary: 'Disburse vending float balances to verified retail merchants and station cashiers.',
      },
      {
        name: 'Vending Purchases Monitor',
        href: '/wallet-admin/purchases',
        summary: 'Review token purchase records, payment channels, and vending timestamps across all stations.',
      },
      {
        name: 'Settlement & Reconciliation',
        href: '/wallet-admin/reconciliation',
        summary: 'Daily delta checks comparing energy consumed on field meters with vending revenue.',
      },
    ],
  },
  {
    key: 'governance',
    label: 'System Administration & Governance',
    modules: [
      {
        name: 'User & Role Management',
        href: '#/admin/user',
        summary: 'Manage staff accounts, assign stations, and enforce role-based access policies.',
      },
      {
        name: 'System Audit Log',
        href: '#/admin/log',
        summary: 'Chronological log of staff actions, balance adjustments, and permission updates.',
      },
      {
        name: 'Automation Command Center',
        href: '#/system/automation-command',
        summary: 'Send service notices, planned outage warnings, and tariff adjustment announcements to portal users.',
      },
      {
        name: 'Archive Reports',
        href: '#/prepay-report/archive-reports',
        summary: 'Multi-report historical bundles and cold-storage consumption downloads.',
      },
    ],
  },
];

export const guideHighlights = [
  {
    tag: 'Prepayment Vending',
    title: 'Offline-resilient STS token generation.',
    body: 'Standard Transfer Specification (STS IEC 62055-41) tokens vend without internet dependence at the field meter. Credit tokens, key changes (KCT), and tamper resets use established 20-digit cryptographic sequences.',
    icon: 'credit-token',
    href: '#/token-generate/credit-token',
  },
  {
    tag: 'Smart Grid Telemetry',
    title: 'Feeder telemetry and remote relay control.',
    body: 'Continuous power quality tracking (voltage, current, power factor) and 15-minute interval demand curves. Where smart meters support internal disconnects, operators dispatch disconnect or power-limiting commands remotely.',
    icon: 'telemetry',
    href: '#/telemetry/power-quality',
  },
  {
    tag: 'Financial Integrity',
    title: 'Double-entry energy ledger.',
    body: 'Every vending transaction records matching debits and credits. Vendor floats, customer token purchases, payment processing fees, and daily reconciliations balance with clear audit evidence.',
    icon: 'wallets',
    href: '/wallet-admin/wallets',
  },
];

export const firstWeekSteps = [
  {
    title: 'Review your assigned stations',
    body: 'Open the Dashboard to check active feeder lines, bulk meter readings, and customer totals for your station.',
    href: '#/dashboard',
    cta: 'View Dashboard',
  },
  {
    title: 'Vend a test credit token',
    body: 'Open Credit Token Vending, find a test customer account, enter the required units, and confirm the 20-digit token receipt prints or displays correctly.',
    href: '#/token-generate/credit-token',
    cta: 'Open Vending',
  },
  {
    title: 'Check feeder telemetry and alarms',
    body: 'Open Power Quality and Interval Data to inspect load curves, abnormal alarm flags, and potential bypass incidents across feeders.',
    href: '#/telemetry/power-quality',
    cta: 'Inspect Telemetry',
  },
  {
    title: 'Reconcile daily float and token sales',
    body: 'Open the Wallet Admin ledger to verify that merchant float balances match cash collected and bank deposits for the day.',
    href: '/wallet-admin/wallets',
    cta: 'View Wallets',
  },
];

export const guideFaqGroups = [
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
        a: 'Click your name in the top right corner and open Profile or Settings to manage your security credentials.',
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
        a: 'Use the built-in assistant in the bottom corner for quick navigation help or contact operational support.',
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
