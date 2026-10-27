export const guideStats = [
  { value: 24, suffix: '+', label: 'Connected modules' },
  { value: 1, label: 'Unified energy grid' },
  { value: 100, suffix: '%', label: 'Paperless & auditable' },
  { value: 'Live', label: 'Across all mini-grid stations' },
];

export const guideStory = [
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

export const guideModuleGroups = [
  {
    key: 'metering',
    label: 'Smart Metering & STS Vending',
    modules: [
      {
        name: 'Credit Token Vending',
        href: '#/token-generate/credit-token',
        summary: 'STS-compliant credit token generation with instant 20-digit token output and audit receipts.',
      },
      {
        name: 'Meter Key Change (KCT)',
        href: '#/token-generate/change-meter-key',
        summary: 'Re-key STS meters to accept new tariff groups, supply group codes, or transfer authority.',
      },
      {
        name: 'Token Records & Receipts',
        href: '#/token-record/credit-token-record',
        summary: 'Complete audit register of all generated credit, clear tamper, and power limit tokens.',
      },
      {
        name: 'Station Onboarding Studio',
        href: '#/system/station-onboarding-studio',
        summary: 'Automate mini-grid gateway, meter, customer, and tariff bundle provisioning.',
      },
      {
        name: 'Daily Interval Data',
        href: '#/prepay-report/daily-data-meter',
        summary: 'High-resolution interval readings, daily usage curves, and styled Excel exports.',
      },
      {
        name: 'Abnormal Alarms & Tamper',
        href: '#/prepay-report/abnormal-alarm',
        summary: 'Detect potential meter bypass, unmetered loads, and zero-consumption anomalies.',
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
        summary: 'Real-time voltage, current, power factor, and frequency measurements across phases.',
      },
      {
        name: 'Demand Curves',
        href: '#/telemetry/demand-curves',
        summary: '15-minute load demand curves, peak kW tracking, and feeder load profiles.',
      },
      {
        name: 'Remote Relay & Load Limiting',
        href: '#/grid-control/remote-relay',
        summary: 'Dispatch over-the-air connect/disconnect commands and configure maximum load limits.',
      },
      {
        name: 'Energy Balance & Theft Audit',
        href: '#/analytics/energy-audit',
        summary: 'Compare feeder bulk supply vs. aggregated customer meters to identify distribution losses.',
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
        summary: 'Double-entry ledger managing master station accounts, floats, and Paystack transactions.',
      },
      {
        name: 'Wallet Funding Approvals',
        href: '/wallet-admin/funding',
        summary: 'Review and approve vendor funding deposits with instant balance crediting.',
      },
      {
        name: 'Vendor Transfers',
        href: '/wallet-admin/vendor-transfers',
        summary: 'Transfer vending credits between stations and authorized distribution merchants.',
      },
      {
        name: 'Vending Purchases Monitor',
        href: '/wallet-admin/purchases',
        summary: 'Live feed of customer token purchases, payment methods, and vending channels.',
      },
      {
        name: 'Settlement & Reconciliation',
        href: '/wallet-admin/reconciliation',
        summary: 'Automated end-of-day reconciliation comparing token sales against bank settlements.',
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
        summary: 'Immutable chronological trace of all vending, operational, and system configuration events.',
      },
      {
        name: 'Automation Command Center',
        href: '#/system/automation-command',
        summary: 'Configure automated SMS receipts, low-balance warnings, and tamper notifications.',
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
    tag: 'Prepaid Engine',
    title: 'STS token generation without downtime.',
    body: 'Standard Transfer Specification (STS IEC 62055-41) tokens generated instantly. Handles credit recharge, key changes (KCT), tamper clearing, and power limit adjustments with offline cryptographic assurance.',
    icon: 'credit-token',
    href: '#/token-generate/credit-token',
  },
  {
    tag: 'Grid Intelligence',
    title: 'Live IoT telemetry and remote relay control.',
    body: 'Continuous power quality tracking (voltage, current, power factor) and 15-minute interval demand curves. Operators dispatch over-the-air relay reconnect/disconnect without physical site visits.',
    icon: 'telemetry',
    href: '#/telemetry/power-quality',
  },
  {
    tag: 'Accountable Money',
    title: 'Double-entry ledger with instant Paystack sync.',
    body: 'Every vending kobo is locked to an immutable double-entry ledger. Vendor funding, customer token sales, fees, and daily station reconciliations balance to the penny with full audit trace.',
    icon: 'wallets',
    href: '/wallet-admin/wallets',
  },
];

export const firstWeekSteps = [
  {
    title: 'Tour your station topology',
    body: 'Check the Dashboard and Station Overview to verify your assigned mini-grid feeds, bulk meter status, and customer counts.',
    href: '#/dashboard',
    cta: 'View Dashboard',
  },
  {
    title: 'Issue your first STS credit token',
    body: 'Open the Credit Token module, select a customer account or meter number, input kWh units, and generate an instant 20-digit STS token receipt.',
    href: '#/token-generate/credit-token',
    cta: 'Open Vending',
  },
  {
    title: 'Monitor live telemetry & alarms',
    body: 'Visit Power Quality and Interval Data to inspect load curves, abnormal alarm flags, and potential bypass incidents across feeders.',
    href: '#/telemetry/power-quality',
    cta: 'Inspect Telemetry',
  },
  {
    title: 'Review financial reconciliation',
    body: 'Check the Wallet Admin ledger to confirm daily vending totals match bank settlement and vendor floating accounts.',
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
        q: 'How do permissions work in Beverly?',
        a: 'Beverly implements granular Role-Based Access Control (RBAC). Super Admins have complete visibility, while Operations Managers, Account Managers, and Field Engineers receive scoped capabilities strictly aligned with their operational duties.',
      },
      {
        q: 'Can a staff member manage multiple stations?',
        a: 'Yes. Staff profiles can be scoped to a single station (e.g. Ruwan Jema) or granted multi-station access across regional clusters.',
      },
      {
        q: 'How do I reset my password or update MFA?',
        a: 'Click your name in the top right corner and open Profile or Settings to manage your security credentials.',
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
        a: 'Chat directly with the built-in AcoBot assistant in the bottom-right corner for quick navigation assistance or contact operational support.',
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
