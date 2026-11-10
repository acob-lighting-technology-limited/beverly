export type StaffPresence = 'available' | 'on_call' | 'away' | 'wrap_up';

export interface CallParty {
  id: string;
  name: string;
  phone: string;
  accountId: string;
  meterNumber: string;
  station: string;
  verified: boolean;
  avatar: string;
}

export type CallStatus = 'idle' | 'incoming' | 'connected' | 'on_hold' | 'ended';

export interface CallSession {
  id: string;
  direction: 'inbound' | 'outbound';
  caller: CallParty;
  status: CallStatus;
  startedAt: string;
  durationSeconds: number;
  isMuted: boolean;
  isOnHold: boolean;
  recordingConsentCapturedAt: string;
  caseId: string;
}

export interface QueueItem {
  id: string;
  callerName: string;
  phone: string;
  issue: string;
  priority: 'normal' | 'high' | 'urgent';
  waitSeconds: number;
  queueType: 'voice' | 'callback';
  slaRisk: 'safe' | 'warning' | 'risk';
}

export interface CaseItem {
  id: string;
  reference: string;
  title: string;
  category: 'token_vending' | 'meter_fault' | 'balance_discrepancy' | 'tariff_query' | 'account_service';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'escalated_finance' | 'escalated_field' | 'resolved';
  owner: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  meterNumber: string;
  lastPaymentSummary: string;
  purchaseStatus: string;
  slaRemainingMinutes: number;
  notes: string;
  createdAt: string;
  resolvedAt?: string;
  resolutionCode?: string;
  escalatedTo?: 'Finance' | 'Field Operations';
}

export interface TimelineEvent {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  isLive?: boolean;
  type: 'call' | 'payment' | 'case' | 'meter' | 'system';
}

export interface Customer360 {
  id: string;
  name: string;
  phone: string;
  email: string;
  customerSince: string;
  status: 'Active' | 'Suspended' | 'Pending';
  meter: {
    number: string;
    type: string;
    tariffCategory: string;
    status: string;
    lastTelemetryAt: string;
  };
  walletBalance: number;
  lastPayment: {
    amount: number;
    time: string;
    reference: string;
    status: string;
  };
  serviceArea: string;
  timeline: TimelineEvent[];
}

export interface IncidentItem {
  id: string;
  title: string;
  area: string;
  affectedStations: string[];
  affectedMeters: number;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  owner: string;
  startedAt: string;
  nextUpdate: string;
  customerMessage: string;
}

export interface QualityRecord {
  id: string;
  callId: string;
  agentName: string;
  customerName: string;
  duration: string;
  recordedAt: string;
  score: number;
  evaluated: boolean;
  notes: string;
  checklist: {
    greeting: boolean;
    verification: boolean;
    diagnosis: boolean;
    accuracy: boolean;
    policyCompliance: boolean;
    documentation: boolean;
  };
}

export interface VendCustomer {
  meter: string;
  name: string;
  phone: string;
  addr: string;
  area: string;
  band: 'A' | 'B' | 'C' | 'D' | 'E';
  disco: string;
  debt: number;
  pct: number;
  status: 'Active' | 'Suspended';
  pri: number;
  last: { amt: number; d: string };
  notes: { t: string; txt: string }[];
  flag?: string;
  bal?: number;
  type?: 'customer' | 'vendor' | 'both';
  vid?: string;
  float?: number;
  comm?: number;
  outlets?: number;
}

export interface VendTransaction {
  ref: string;
  meter: string;
  name: string;
  amt: number;
  kwh: number;
  debt: number;
  tok: string;
  t: string;
  ts: number;
  ch: 'transfer' | 'card' | 'ussd' | 'wallet';
  st: 'Success' | 'Pending' | 'Failed';
}

export interface CallQueueItem {
  id: string;
  cust: VendCustomer;
  skill: 'token' | 'outage' | 'billing';
  at: number;
  pri: number;
}

export interface ActiveCall {
  c: CallQueueItem;
  start: number;
  mute: boolean;
  hold: boolean;
  rec: boolean;
  lines: number;
  tr: { w: 'a' | 'c'; t: string }[];
  cap: string;
  sent: number;
  tip: string;
  notes: string;
  tm: any;
  acts: number;
}

export interface WrapCallData {
  c: CallQueueItem;
  at: number;
  dur: number;
  sent: number;
  notes: string;
  disp: string;
  csat: number;
  cb: string;
  acts: number;
}

export interface VendTicket {
  id: string;
  type: string;
  name: string;
  meter: string;
  pri: 'Normal' | 'High' | 'Critical';
  note: string;
  st: 'New' | 'Assigned' | 'In progress' | 'Resolved' | 'Pending approval';
  due: number;
  at: string;
  ts: number;
  crew: string;
  amt: number;
}

export interface CareAgent {
  n: string;
  s: 'available' | 'break' | 'offline' | 'oncall' | 'wrap';
  sk: ('token' | 'outage' | 'billing')[];
  h: number;
  idle: number;
  me?: number;
  busy?: { c: CallQueueItem; start: number; end: number } | null;
}

export interface AudioRecording {
  id: string;
  callId: string;
  name: string;
  meter: string;
  dur: number;
  t: string;
  tr: string[];
  blob?: Blob | null;
  url?: string;
  qa?: number;
}

export interface OutageReport {
  area: string;
  feeder: string;
  eta: string;
  cause: string;
  st: 'Active' | 'Restored';
  sms: number;
}
