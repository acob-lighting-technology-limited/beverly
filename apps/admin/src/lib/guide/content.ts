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
  { value: 'Wallets', label: 'Balances and funding' },
  { value: 'Meters', label: 'Orders and approvals' },
  { value: 'Purchases', label: 'Vending activity' },
  { value: 'Support', label: 'Tickets and disputes' },
];

export const guideStory: GuideStoryItem[] = [
  { kicker: 'Find', title: 'Find the account', body: 'Search customers, vendors or meters to see their details.' },
  { kicker: 'Review', title: 'Check the records', body: 'Review purchases, funding and support cases before taking action.' },
  { kicker: 'Follow up', title: 'Keep work moving', body: 'Use the available tools to respond and track the next step.' },
];

export const guideModuleGroups: GuideModuleGroup[] = [
  { key: 'people', label: 'Customers and vendors', modules: [
    { name: 'Customers', href: '/customers', icon: 'customers', summary: 'Find accounts, linked meters and purchase history.' },
    { name: 'Vendors', href: '/vendors', icon: 'vendors', summary: 'Find vendor accounts and review their details.' },
    { name: 'Vendor applications', href: '/applications', icon: 'applications', summary: 'Review applications from prospective vendors.' },
    { name: 'Meter approvals', href: '/meter-approvals', icon: 'meter-approvals', summary: 'Review customer meter link requests.' },
    { name: 'Meter orders', href: '/meter-orders', icon: 'meter-orders', summary: 'Track meter orders and their progress.' },
  ] },
  { key: 'money', label: 'Wallets and purchases', modules: [
    { name: 'Wallets', href: '/wallets', icon: 'wallets', summary: 'Review wallet balances and account activity.' },
    { name: 'Funding', href: '/funding', icon: 'funding', summary: 'Review funding requests and payment records.' },
    { name: 'Vendor transfers', href: '/vendor-transfers', icon: 'vendor-transfers', summary: 'Review and manage vendor transfers.' },
    { name: 'Purchases', href: '/purchases', icon: 'purchases', summary: 'Find purchase records and their status.' },
    { name: 'Vending monitor', href: '/vending', icon: 'credit-token', summary: 'Monitor vending activity and follow up on issues.' },
    { name: 'Refunds', href: '/refunds', icon: 'refunds', summary: 'Review refund requests and approvals.' },
    { name: 'Settlement', href: '/settlement', icon: 'settlement', summary: 'Review settlement records.' },
    { name: 'Reconciliation', href: '/reconciliation', icon: 'reconciliation', summary: 'Review reconciliation runs and results.' },
  ] },
  { key: 'operations', label: 'Reports and support', modules: [
    { name: 'Reports', href: '/reports', icon: 'reports', summary: 'Open available operational reports.' },
    { name: 'Consumption', href: '/consumption', icon: 'consumption', summary: 'Review available meter consumption data.' },
    { name: 'Disputes', href: '/disputes', icon: 'disputes', summary: 'Review cases and reply to customers or vendors.' },
    { name: 'Support desk', href: '/support', icon: 'support', summary: 'Manage support tickets, chats and FAQs.' },
    { name: 'Announcements', href: '/announcements', icon: 'announcements', summary: 'Manage notices for portal users.' },
  ] },
  { key: 'access', label: 'Access and oversight', modules: [
    { name: 'KYC reviews', href: '/kyc-reviews', icon: 'kyc', summary: 'Review customer and vendor verification requests.' },
    { name: 'Fraud review', href: '/fraud', icon: 'fraud', summary: 'Review flagged activity.' },
    { name: 'Audit log', href: '/audit', icon: 'audit', summary: 'Review recorded staff actions.' },
    { name: 'Roles and team', href: '/roles', icon: 'roles-permissions', summary: 'Manage staff roles and access.' },
    { name: 'Privacy', href: '/privacy', icon: 'privacy', summary: 'Review privacy requests and records.' },
  ] },
];

export const guideHighlights: GuideHighlight[] = [
  { tag: 'Purchases', title: 'Find a transaction', body: 'Search purchase records and check their current status.', icon: 'purchases', href: '/purchases' },
  { tag: 'Meters', title: 'Review meter activity', body: 'Check linked meters, orders and available consumption data.', icon: 'consumption', href: '/consumption' },
  { tag: 'Support', title: 'Follow up on a case', body: 'Open a dispute or support ticket to review the conversation.', icon: 'disputes', href: '/disputes' },
];

export const firstWeekSteps: GuideStep[] = [
  { title: 'Open your dashboard', body: 'Check the latest wallet activity and queues.', href: '/', cta: 'View dashboard' },
  { title: 'Find a customer', body: 'Search for an account and review its linked meters.', href: '/customers', cta: 'Open customers' },
  { title: 'Review purchases', body: 'Find transactions and check their status.', href: '/purchases', cta: 'Open purchases' },
  { title: 'Find support', body: 'Review tickets, chats and disputes when you need to follow up.', href: '/support', cta: 'Open support' },
];

export const guideFaqGroups: GuideFaqGroup[] = [
  { id: 'account', title: 'Account and access', items: [
    { q: 'Why can’t I open a page?', a: 'Pages depend on your staff permissions. Ask an administrator if you need access.' },
    { q: 'Where can I manage my account security?', a: 'Open Security from your account menu.' },
  ] },
  { id: 'purchases', title: 'Purchases and meters', items: [
    { q: 'Where can I find a purchase?', a: 'Open Purchases and search the available records. Check the status before taking action.' },
    { q: 'Where can I find linked meters?', a: 'Open a customer account and select Meters.' },
    { q: 'How are refunds handled?', a: 'Refund requests are reviewed in Refunds. Check the request and its approval status before confirming payment.' },
  ] },
  { id: 'support', title: 'Support', items: [
    { q: 'Where can I review a dispute?', a: 'Open Disputes to review the case and its conversation.' },
    { q: 'Where can I get help?', a: 'Open Support to review tickets and chats, or contact your operations team.' },
  ] },
];

export const securityPoints = ['Staff permissions', 'Account security', 'Review workflows', 'Audit log'];
