<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { toggleTheme } from '@beverly/tokens';
import LanguageSwitcher from '@beverly/tokens/LanguageSwitcher.vue';
import { PORTAL_URLS } from './lib/portals';
import Eyebrow from './components/Eyebrow.vue';
import Reveal from './components/Reveal.vue';
import MaskText from './components/MaskText.vue';
import SpotlightCard from './components/SpotlightCard.vue';
import CountUp from './components/CountUp.vue';
import Stagger from './components/Stagger.vue';
import Ic from './components/Ic.vue';
import LineChart from './components/LineChart.vue';
import BarChart from './components/BarChart.vue';
import DonutChart from './components/DonutChart.vue';
import WalletExportMenu from '@beverly/tokens/WalletExportMenu.vue';
import WalletDataViewSwitch from '@beverly/tokens/WalletDataViewSwitch.vue';
import { useAuthStore, SUPER_ADMIN_IDENTITY, STAFF_PERMISSIONS } from './stores/auth';
import { customerPipeline, VERIFIED_CRM_CUSTOMERS } from './services/customer-pipeline';
import { recordingsPipeline } from './services/recordings-pipeline';
import { analyticsRbacPipeline } from './services/analytics-rbac-pipeline';
import type {
  VendCustomer, VendTransaction, CallQueueItem, ActiveCall,
  WrapCallData, VendTicket, CareAgent, AudioRecording, OutageReport
} from './types';

/* ════════════════════════════════════════════════════════════════════
   Domain Data & Nigerian DisCo Models (AEDC & Bands A–E)
   ════════════════════════════════════════════════════════════════════ */
const TARIFF: Record<string, number> = { A: 209.5, B: 63, C: 50, D: 32, E: 28 };
const VAT = 0.075;

const CUS = reactive<VendCustomer[]>([
  {
    meter: "44120000001",
    name: "Musa Abubakar",
    phone: "+234 801 234 5678",
    addr: "Plot 14 Garki Commercial Area, Abuja",
    area: "Garki",
    band: "A",
    disco: "AEDC",
    debt: 0,
    pct: 0.2,
    status: "Active",
    pri: 1,
    last: { amt: 5000, d: "1 hour ago" },
    notes: [{ t: "Today, 10:30 am", txt: "Account verified in CRM. Meter telemetry healthy." }]
  },
  {
    meter: "44120000002",
    name: "Amina Bello",
    phone: "+234 802 345 6789",
    addr: "18 Adetokunbo Ademola Cres, Wuse II, Abuja",
    area: "Wuse II",
    band: "B",
    disco: "AEDC",
    debt: 0,
    pct: 0.2,
    status: "Active",
    pri: 0,
    last: { amt: 10000, d: "2 days ago" },
    notes: []
  },
  {
    meter: "44120000003",
    name: "Chukwuemeka Obi",
    phone: "+234 903 456 7890",
    addr: "7 Aguiyi Ironsi St, Maitama, Abuja",
    area: "Maitama",
    band: "A",
    disco: "AEDC",
    debt: 12500,
    pct: 0.25,
    status: "Active",
    pri: 1,
    last: { amt: 15000, d: "Yesterday" },
    notes: [{ t: "Yesterday", txt: "Customer verified via phone. Automatic debt repayment active." }]
  },
  {
    meter: "44120000004",
    name: "Tunde Adeyemi",
    phone: "+234 801 122 3344",
    addr: "12 Broad St, Lagos Island",
    area: "Lagos Island",
    band: "A",
    disco: "EKEDC",
    debt: 0,
    pct: 0.2,
    status: "Active",
    pri: 0,
    last: { amt: 25000, d: "4 days ago" },
    notes: []
  },
  {
    meter: "44120000005",
    name: "Ngozi Okafor",
    phone: "+234 909 988 7766",
    addr: "45 Adeola Odeku, Victoria Island",
    area: "Victoria Island",
    band: "A",
    disco: "EKEDC",
    debt: 0,
    pct: 0.2,
    status: "Active",
    pri: 0,
    last: { amt: 50000, d: "3 days ago" },
    notes: []
  },
  {
    meter: "04125544338",
    name: "Halima Yusuf",
    phone: "+234 810 555 0109",
    addr: "21 Aminu Kano Cres, Wuse II, Abuja",
    area: "Wuse II",
    band: "B",
    disco: "AEDC",
    debt: 0,
    pct: 0.2,
    status: "Active",
    pri: 2,
    last: { amt: 20000, d: "1 day ago" },
    notes: [],
    flag: "Medical equipment on supply"
  },
  {
    meter: "04112233445",
    name: "Ngozi Eze",
    phone: "+234 803 555 0142",
    addr: "12 Gimbiya St, Garki, Abuja",
    area: "Garki",
    band: "A",
    disco: "AEDC",
    debt: 12000,
    pct: 0.2,
    status: "Active",
    pri: 1,
    last: { amt: 5000, d: "3 days ago" },
    notes: []
  },
  {
    meter: "04133377219",
    name: "Chidi Okafor",
    phone: "+234 802 555 0133",
    addr: "8 Tafawa Balewa Rd, Maitama, Abuja",
    area: "Maitama",
    band: "A",
    disco: "AEDC",
    debt: 45000,
    pct: 0.3,
    status: "Active",
    pri: 0,
    last: { amt: 15000, d: "12 days ago" },
    notes: []
  },
  {
    meter: "04140099126",
    name: "Zainab Musa",
    phone: "+234 809 555 0188",
    addr: "3 Kubwa Express, Kubwa, Abuja",
    area: "Kubwa",
    band: "D",
    disco: "AEDC",
    debt: 0,
    pct: 0.2,
    status: "Suspended",
    pri: 0,
    last: { amt: 3000, d: "40 days ago" },
    notes: []
  }
]);

// Populate 24 additional realistic Nigerian customers
(function initCustomers() {
  const F = ['Ada', 'Bola', 'Chinedu', 'Dayo', 'Emeka', 'Fatima', 'Goodluck', 'Hauwa', 'Ibrahim', 'Joy', 'Kemi', 'Lanre', 'Musa', 'Nneka', 'Obi', 'Peter', 'Queen', 'Rashida', 'Sade', 'Tolu', 'Usman', 'Vera', 'Wale', 'Yemi'];
  const S = ['Okeke', 'Bello', 'Adeyemi', 'Ibrahim', 'Eze', 'Danjuma', 'Ogunleye', 'Sani', 'Nwankwo', 'Lawal', 'Abubakar', 'Onyeka'];
  const AR: [string, 'A' | 'B' | 'C' | 'D' | 'E'][] = [
    ['Garki', 'A'], ['Wuse II', 'B'], ['Maitama', 'A'], ['Kubwa', 'D'],
    ['Gwarinpa', 'C'], ['Lugbe', 'D'], ['Jabi', 'B'], ['Asokoro', 'A'], ['Nyanya', 'E']
  ];
  for (let i = 0; i < 24; i++) {
    const a = AR[i % AR.length];
    CUS.push({
      meter: String(4150000000 + i * 7919 + 1000).padStart(11, '0'),
      name: `${F[i]} ${S[(i * 5) % S.length]}`,
      phone: `+234 80${(i % 9 + 1)} 555 0${200 + i}`,
      addr: `${i + 3} ${a[0]} Close, Abuja`,
      area: a[0],
      band: a[1],
      disco: 'AEDC',
      debt: i % 4 === 0 ? i * 2500 : 0,
      pct: 0.2,
      status: i % 11 === 7 ? 'Suspended' : 'Active',
      pri: i % 9 === 4 ? 2 : 0,
      last: { amt: [2000, 3000, 5000, 10000][i % 4], d: `${(i % 12 + 1)} days ago` },
      notes: []
    });
  }
  CUS.forEach((c, i) => {
    c.bal = +(4 + ((i * 37) % 58) + 0.5).toFixed(1);
    c.type = i < 5 ? (['customer', 'both', 'customer', 'vendor', 'customer'] as const)[i] : (i % 6 === 2 ? 'vendor' : i % 6 === 4 ? 'both' : 'customer');
    if (c.type !== 'customer') {
      c.vid = `VND-${1000 + i}`;
      c.float = ((i * 37) % 90 + 10) * 1000;
      c.comm = [2.5, 3, 3.5][i % 3];
      c.outlets = (i % 4) + 1;
    }
  });
})();

const SEED: VendTransaction[] = [];
CUS.forEach((c, i) => {
  for (let k = 0; k < 2; k++) {
    const a = [2000, 5000, 10000][(i + k) % 3];
    const g = (m: number, n: number) => String(1000 + ((i * m + k * n) % 9000));
    SEED.push({
      ref: `TX-${700100 + i * 2 + k}`,
      meter: c.meter,
      name: c.name,
      amt: a,
      kwh: +(a * 0.9 / TARIFF[c.band]).toFixed(1),
      debt: 0,
      tok: [g(131, 977), g(251, 313), g(71, 401), g(17, 601), g(997, 53)].join('-'),
      t: `${(k + 1) * 3} days ago`,
      ts: 0,
      ch: (['transfer', 'card', 'ussd'] as const)[(i + k) % 3],
      st: 'Success'
    });
  }
});

const OUT = [
  { area: "Garki", feeder: "Garki 11kV", eta: "4:00 pm today", cause: "Transformer fault" },
  { area: "Kubwa", feeder: "Kubwa 33kV", eta: "Tomorrow, 10:00 am", cause: "Planned maintenance" }
];

const SLA: Record<string, number> = {
  "Token not loading": 4,
  "Meter fault": 48,
  "Billing dispute": 72,
  "Outage report": 8,
  "New connection": 120,
  "Refund request": 72
};

const SCR: Record<string, [string, string, number, string][]> = {
  token: [
    ["c", "I paid but my token is not loading on the meter.", -15, "Check the last vend by meter number."],
    ["a", "Sorry about that. Let me look up your meter.", 0, ""],
    ["c", "The meter number is on my receipt. Card ending 4111 1111 1111 1111.", -5, "Card number shared. Recording masks it. Confirm the last vend and replay the token."],
    ["a", "I can see the vend. I will replay your token now.", 5, ""],
    ["c", "It worked, thank you!", 30, "Offer to resend the token by SMS and close with the survey."]
  ],
  outage: [
    ["c", "There is no light in my area since morning.", -20, "Check the outage board for the caller's area before troubleshooting."],
    ["a", "Thanks for flagging. Which area are you in?", 0, ""],
    ["c", "Our whole street has no power.", -5, "Area fault likely. Log an outage report and share the ETA."],
    ["a", "Engineers are on it. I will log your report.", 5, ""],
    ["c", "Okay, please text me when it is back.", 20, "Enable SMS follow up on the ticket."]
  ],
  billing: [
    ["c", "I was debited twice for one purchase.", -15, "Look for duplicate vends within 2 minutes on the ledger."],
    ["a", "I am sorry. Let me check your transactions.", 0, ""],
    ["c", "Both were 5,000 naira, a minute apart.", -5, "Duplicate found. Raise a refund request. Over 50,000 needs supervisor approval."],
    ["a", "I have raised a refund request for the duplicate.", 5, ""],
    ["c", "Alright, thanks for sorting this.", 30, "Give the ticket ID and the 72 hour SLA."]
  ]
};

const SK: ('token' | 'outage' | 'billing')[] = ["token", "outage", "billing"];
const STEPS = ["Identify", "Verify", "Resolve", "Wrap up"];
const TL: Record<string, string> = { customer: 'Customer', vendor: 'Vendor', both: 'Vendor and customer' };

const KB: [string, string][] = [
  ['Entering a token', 'Key in the 20 digits on the meter keypad, press Enter and wait for Accepted. Units load within seconds.'],
  ['Debt recovery', 'A percentage of each vend repays outstanding debt before units are credited.'],
  ['Refund policy', 'Duplicate debits are refunded within 72 hours. Over 50,000 naira needs supervisor approval.'],
  ['Band tariffs', 'Bands A to E set the price per kWh and the expected hours of supply.'],
  ['Outage escalation', 'Customers on life support equipment are escalated immediately to field operations.'],
  ['Meter error codes', 'Ask the customer to read the display, then log a meter fault ticket with the code.']
];

/* ════════════════════════════════════════════════════════════════════
   State & Helpers
   ════════════════════════════════════════════════════════════════════ */
const nowS = () => Date.now() / 1000;
const money = (n: number | string) => "₦" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmt = (s: number) => {
  s = Math.max(0, Math.floor(s));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
};
const ini = (n: string) => n.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase();
const redact = (t: string) => t.replace(/\b(?:\d[ -]?){13,19}\b/g, "[card redacted]");
const mkTok = () => {
  const g: string[] = [];
  for (let i = 0; i < 5; i++) g.push(String(Math.floor(Math.random() * 9000) + 1000));
  return g.join("-");
};

const T = ref(nowS());
const view = ref<'calls' | 'dir' | 'cust' | 'vend' | 'tix' | 'rec' | 'ins' | 'acc'>('calls');
const queue = ref<CallQueueItem[]>([]);
const cur = ref<ActiveCall | null>(null);
const ring = ref<{ c: CallQueueItem; at: number } | null>(null);
const wrap = ref<WrapCallData | null>(null);
const log = ref<{ t: string; e: string; r: string; p: any }[]>([]);
const stats = reactive({ handled: 0, ans: 0, fast: 0, aht: 0, vends: 0, value: 0 });
const strat = ref<'skills' | 'idle' | 'rr'>('skills');
const seq = ref(1);
const toastT = ref('');
const say = ref('');
const kp = ref(false);
const xf = ref(false);
const help = ref(false);
const level = ref(0);
const micOn = ref(false);

const cust = ref<VendCustomer | null>(null);
const vf = reactive<Record<string, boolean>>({});
const q = ref('');
const ans = ref('');
const tries = ref(0);
const ledger = ref<VendTransaction[]>(SEED.slice());
const tix = ref<VendTicket[]>([]);
const hist = ref<any[]>([]);

const vend = reactive({
  amt: 5000,
  ch: 'transfer' as 'transfer' | 'card' | 'ussd' | 'wallet',
  st: 'idle' as 'idle' | 'proc' | 'ok' | 'pending' | 'fail',
  tx: null as VendTransaction | null,
  dup: false,
  att: 0,
  ref: ''
});
const tf = reactive({
  type: 'Token not loading',
  pri: 'Normal' as 'Normal' | 'High' | 'Critical',
  note: '',
  amt: 0
});

const agents = reactive<CareAgent[]>([
  { n: "You", s: "available", sk: SK, h: 0, idle: nowS(), me: 1, busy: null },
  { n: "Amina Bello", s: "available", sk: ["billing"], h: 11, idle: nowS() - 40, busy: null },
  { n: "David Okon", s: "available", sk: ["outage"], h: 9, idle: nowS() - 90, busy: null },
  { n: "Ruth Danjuma", s: "break", sk: ["token", "billing"], h: 7, idle: nowS(), busy: null },
  { n: "Samuel Ige", s: "available", sk: ["token", "outage"], h: 13, idle: nowS() - 15, busy: null }
]);
const me = agents[0];

const authStore = useAuthStore();

const role = computed<'super-admin' | 'admin' | 'supervisor' | 'agent' | 'auditor'>({
  get: () => authStore.role as any,
  set: (val) => authStore.switchRole(val),
});

/* ════════════════════════════════════════════════════════════════════
   RBAC — Role-Based Access Control & Canonical Auth
   Connected to admin@acoblighting.com super-admin identity & permissions.
   ════════════════════════════════════════════════════════════════════ */
const ROLE_LABELS: Record<string, string> = {
  'super-admin': 'Super-Admin',
  admin: 'Admin',
  supervisor: 'Supervisor',
  auditor: 'Auditor',
  agent: 'Agent',
};

const ROLE_COLOR: Record<string, string> = {
  'super-admin': 'var(--brand-500, #10b981)',
  admin: 'oklch(68% 0.20 25)',
  supervisor: 'oklch(72% 0.13 220)',
  auditor: 'oklch(78% 0.16 75)',
  agent: 'var(--brand-500, #10b981)',
};

const PLIST = [
  ['info',           'View customer info'],
  ['verify',         'Verify customers'],
  ['receipt',        'Check balances and verify receipts'],
  ['ticket',         'Log tickets and refund requests'],
  ['call_queue',     'Answer calls from live queue'],
  ['approve',        'Approve refunds (Supervisor+)'],
  ['monitor',        'Listen to live calls (Supervisor+)'],
  ['recordings',     'Play recordings (Supervisor+)'],
  ['analytics',      'Full team analytics (Supervisor+)'],
  ['outage_manage',  'Manage outage incidents (Supervisor+)'],
  ['audit',          'View audit log (Auditor+)'],
  ['vend',           'Vend tokens (Admin only)'],
  ['admin',          'Admin actions: delete, suspend (Admin only)'],
];

function can(p: string) {
  return authStore.hasPermission(p);
}

function need(p: string) {
  if (can(p)) return true;
  toast(`${ROLE_LABELS[role.value] ?? role.value} role does not have '${p}' permission`);
  emit('access.denied', { perm: p, role: role.value });
  return false;
}

/* User Account Menu / Beverly Navbar */
const userMenuOpen = ref(false);
const accountMenuWrap = ref<HTMLElement | null>(null);
const agentDisplayName = computed(() => authStore.displayName || 'Beverly Admin');
const agentDisplayEmail = computed(() => authStore.displayEmail || 'admin@acoblighting.com');
const agentFirstName = computed(() => agentDisplayName.value.split(' ')[0] || 'Admin');

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value;
}
function closeUserMenu() {
  userMenuOpen.value = false;
}
function handleDocumentPointerDown(event: PointerEvent) {
  if (!accountMenuWrap.value?.contains(event.target as Node)) closeUserMenu();
}

function toggleAppTheme() {
  toggleTheme();
}

/* Audio Recording & IndexedDB */
const recs = ref<AudioRecording[]>([]);
let ac: AudioContext | null = null;
let an: AnalyserNode | null = null;
let ms: MediaStream | null = null;
let lraf = 0;
let mr: MediaRecorder | null = null;
let chunks: Blob[] = [];

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('bv_vc', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('recs', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej();
  });
}

async function loadRecs() {
  try {
    const list = await recordingsPipeline.getAllRecordings();
    if (list && list.length) {
      recs.value = list;
      return;
    }
    const d = await idb();
    d.transaction('recs').objectStore('recs').getAll().onsuccess = (e: any) => {
      recs.value = e.target.result.sort((a: any, b: any) => b.id < a.id ? -1 : 1).map((m: any) => ({
        ...m,
        url: m.blob ? URL.createObjectURL(m.blob) : ''
      }));
    };
  } catch (e) {}
}

async function putRec(m: AudioRecording) {
  try {
    const d = await idb();
    d.transaction('recs', 'readwrite').objectStore('recs').put(m);
    emit('recording.saved', { id: m.id, seconds: m.dur, audio: !!m.blob });
    setTimeout(loadRecs, 200);
  } catch (e) {
    recs.value.unshift({ ...m, url: m.blob ? URL.createObjectURL(m.blob) : '' });
  }
}

async function delRec(m: AudioRecording) {
  if (!need('admin') && !need('recordings.delete')) return;
  if (cfm.value !== m.id) {
    cfm.value = m.id;
    setTimeout(() => { cfm.value = ''; }, 4000);
    return toast('Press Delete again to confirm');
  }
  cfm.value = '';
  try {
    await recordingsPipeline.deleteRecording(m.id);
    const d = await idb();
    d.transaction('recs', 'readwrite').objectStore('recs').delete(m.id);
  } catch (e) {}
  recs.value = recs.value.filter(x => x.id !== m.id);
  emit('recording.deleted', { id: m.id });
  toast('Recording deleted from archive');
}

function exportRec(m: AudioRecording) {
  recordingsPipeline.exportRecordingFile(m);
  toast(`Exporting ${m.id}`);
}

function finishRec(c: ActiveCall) {
  const ch = chunks;
  const meta: AudioRecording = {
    id: `REC-${c.c.id}-${Date.now()}`,
    callId: c.c.id,
    name: c.c.cust.name,
    meter: c.c.cust.meter,
    dur: Math.round(nowS() - c.start),
    t: new Date().toLocaleString(),
    tr: c.tr.map(x => `${x.w === 'a' ? 'Agent: ' : 'Caller: '}${x.t}`),
    blob: null
  };
  if (mr && mr.state !== 'inactive') {
    mr.onstop = () => {
      meta.blob = ch.length ? new Blob(ch, { type: 'audio/webm' }) : null;
      putRec(meta);
    };
    try { mr.stop(); } catch (e) { putRec(meta); }
  } else {
    putRec(meta);
  }
  mr = null;
  chunks = [];
}

/* Logging & Events */
const L: Record<string, Function[]> = {};
function emit(e: string, p?: any) {
  log.value.unshift({ t: new Date().toLocaleTimeString(), e, r: role.value, p: p || {} });
  log.value = log.value.slice(0, 60);
  (L[e] || []).forEach(f => {
    try { f(p); } catch (x) {}
  });
  try {
    parent.postMessage({ source: 'beverly-call-centre', event: e, payload: p || {} }, '*');
  } catch (x) {}
}

function toast(m: string) {
  toastT.value = m;
  clearTimeout((toast as any).x);
  (toast as any).x = setTimeout(() => { toastT.value = ''; }, 2400);
}

function announce(m: string) {
  say.value = '';
  setTimeout(() => { say.value = m; }, 40);
}

/* Routing */
function score(a: CareAgent, c: CallQueueItem) {
  if (a.s !== 'available' || a.busy) return -1;
  let s = 1;
  if (strat.value === 'skills') s += (a.sk.indexOf(c.skill) > -1 ? 100 : 0) + (T.value - a.idle) / 10;
  else if (strat.value === 'idle') s += T.value - a.idle;
  else s += 100 - a.h;
  return s;
}

function routeQueue() {
  if (!queue.value.length || ring.value) return;
  queue.value.sort((a, b) => b.pri - a.pri || a.at - b.at);
  const c = queue.value[0];
  let best: CareAgent | null = null;
  let bs = -1;
  agents.forEach(a => {
    const s = score(a, c);
    if (s > bs) {
      bs = s;
      best = a;
    }
  });
  if (!best) return;
  queue.value.shift();
  if (best.me) {
    ring.value = { c, at: nowS() };
    emit('call.ringing', { id: c.id, meter: c.cust.meter, skill: c.skill });
    announce(`Incoming call from ${c.cust.name}`);
  } else {
    best.busy = { c, start: nowS(), end: nowS() + 30 + Math.random() * 50 };
    best.s = 'oncall';
    stats.ans++;
    if (nowS() - c.at < 20) stats.fast++;
  }
}

function arriveCall() {
  if (queue.value.length >= 8) return;
  const cu = CUS[Math.floor(Math.random() * CUS.length)];
  const sk = SK[Math.floor(Math.random() * 3)];
  const c: CallQueueItem = {
    id: `CL-${2000 + seq.value++}`,
    cust: cu,
    skill: sk,
    at: nowS(),
    pri: Math.max(cu.pri, cu.type === 'customer' ? 0 : 1)
  };
  queue.value.push(c);
  emit('call.queued', { id: c.id, skill: sk, priority: cu.pri });
  routeQueue();
}

/* Microphone & Media */
async function micStart() {
  if (micOn.value) return;
  try {
    ms = await navigator.mediaDevices.getUserMedia({ audio: true });
    ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    an = ac.createAnalyser();
    an.fftSize = 256;
    ac.createMediaStreamSource(ms).connect(an);
    micOn.value = true;
    try {
      chunks = [];
      mr = new MediaRecorder(ms);
      mr.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      mr.start(1000);
    } catch (x) {
      mr = null;
    }
    const d = new Uint8Array(an.frequencyBinCount);
    const loop = () => {
      if (!micOn.value || !an) return;
      an.getByteFrequencyData(d);
      let s = 0;
      for (let i = 0; i < d.length; i++) s += d[i];
      level.value = (cur.value && cur.value.mute) ? 0 : Math.min(100, Math.round(s / d.length * 1.6));
      lraf = requestAnimationFrame(loop);
    };
    lraf = requestAnimationFrame(loop);
  } catch (e) {
    toast("Microphone simulated or blocked.");
  }
}

function micStop() {
  micOn.value = false;
  level.value = 0;
  cancelAnimationFrame(lraf);
  try {
    ms?.getTracks().forEach(t => t.stop());
    ac?.close();
  } catch (e) {}
  ms = null;
}

watch(() => cur.value && cur.value.mute, (v) => {
  if (ms) ms.getAudioTracks().forEach(t => { t.enabled = !v; });
});

/* Telephony Lifecycle */
function acceptCall() {
  if (!ring.value) return;
  const c = ring.value.c;
  stats.ans++;
  if (nowS() - c.at < 20) stats.fast++;
  cur.value = {
    c,
    start: nowS(),
    mute: false,
    hold: false,
    rec: true,
    lines: 0,
    tr: [],
    cap: '',
    sent: 50,
    tip: '',
    notes: '',
    tm: 0,
    acts: 0
  };
  me.s = 'oncall';
  ring.value = null;
  cust.value = c.cust;
  vf[c.cust.meter] = false;
  tries.value = 0;
  ans.value = '';
  rvRes.value = null;
  view.value = 'calls';
  kp.value = xf.value = false;
  emit('recording.consent', { id: c.id });
  emit('call.answered', { id: c.id, meter: c.cust.meter, waited: Math.round(nowS() - c.at) });
  announce(`Connected with ${c.cust.name}`);
  micStart();
  nextScriptLine();
}

function declineCall() {
  if (!ring.value) return;
  const c = ring.value.c;
  c.pri++;
  c.at = nowS();
  queue.value.unshift(c);
  emit('call.declined', { id: c.id });
  ring.value = null;
  routeQueue();
}

function nextScriptLine() {
  const c = cur.value;
  if (!c || c.lines >= SCR[c.c.skill].length) return;
  c.tm = setTimeout(() => {
    const k = cur.value;
    if (!k) return;
    if (k.hold) return nextScriptLine();
    const l = SCR[k.c.skill][k.lines++];
    k.sent = Math.min(100, Math.max(0, k.sent + l[2]));
    if (l[3]) k.tip = l[3];
    k.tr.push({ w: l[0] as 'a' | 'c', t: redact(l[1]) });
    k.cap = redact(l[0] === 'c' ? l[1] : '');
    nextScriptLine();
  }, c.lines === 0 ? 1500 : 3200);
}

function endCall(why?: string) {
  const c = cur.value;
  if (!c) return;
  clearTimeout(c.tm);
  finishRec(c);
  micStop();
  vf[c.c.cust.meter] = false;
  wrap.value = {
    c: c.c,
    at: nowS(),
    dur: nowS() - c.start,
    sent: c.sent,
    notes: c.notes,
    disp: '',
    csat: 0,
    cb: '',
    acts: c.acts
  };
  cur.value = null;
  kp.value = xf.value = false;
  me.s = 'wrap';
  view.value = 'calls';
  emit('call.ended', { id: c.c.id, seconds: Math.round(wrap.value.dur), reason: why || 'agent' });
}

function saveCallWrap() {
  const w = wrap.value;
  if (!w || !w.disp) return toast('Choose an outcome first');
  const r = {
    csat: w.csat || 0,
    id: w.c.id,
    name: w.c.cust.name,
    meter: w.c.cust.meter,
    skill: w.c.skill,
    dur: Math.round(w.dur),
    disp: w.disp,
    notes: w.notes,
    t: new Date().toLocaleString()
  };
  hist.value.unshift(r);
  hist.value = hist.value.slice(0, 40);
  try {
    localStorage.setItem('bv_vc_hist', JSON.stringify(hist.value));
  } catch (e) {}
  w.c.cust.notes.unshift({ t: r.t, txt: w.disp + (w.notes ? `: ${w.notes}` : '') });
  if (w.cb) {
    cbs.value.unshift({ name: w.c.cust.name, phone: w.c.cust.phone, when: w.cb, meter: w.c.cust.meter });
    emit('callback.scheduled', { meter: w.c.cust.meter, when: w.cb });
  }
  stats.handled++;
  stats.aht = (stats.aht * (stats.handled - 1) + w.dur) / stats.handled;
  me.h++;
  me.idle = nowS();
  me.s = 'available';
  emit('crm.updated', { meter: r.meter, outcome: w.disp });
  wrap.value = null;
  toast('Call saved and CRM updated');
}

function toggleRec() {
  const c = cur.value;
  if (!c) return;
  c.rec = !c.rec;
  try {
    if (mr) c.rec ? mr.resume() : mr.pause();
  } catch (e) {}
  emit(c.rec ? 'recording.resumed' : 'recording.paused', { id: c.c.id });
  announce(c.rec ? 'Recording resumed' : 'Recording paused');
}

function doTransfer(target: string) {
  if (!target) return;
  emit('call.transferred', { to: target });
  toast(`Transferred to ${target}`);
  endCall('transfer');
}

/* Customer Lookup & Verification */
function findCustomer() {
  const s = q.value.trim().toLowerCase();
  if (!s) return;
  const c = CUS.find(x => x.meter === s.replace(/\s/g, '') || x.name.toLowerCase().includes(s) || x.phone.replace(/\s/g, '').includes(s.replace(/\s/g, '')));
  if (!c) return toast('No customer found for that meter, name or phone');
  cust.value = c;
  view.value = 'cust';
  emit('customer.lookup', { meter: c.meter });
}

function pickCustomer(c: VendCustomer) {
  cust.value = c;
  tries.value = 0;
  ans.value = '';
  if (view.value === 'calls' && !cur.value && !wrap.value) view.value = 'cust';
}

function verifyCustomer() {
  const c = cust.value;
  if (!c) return;
  if (Number(ans.value) === c.last.amt) {
    vf[c.meter] = true;
    emit('verify.passed', { meter: c.meter });
    toast('Customer verified');
    if (cur.value) cur.value.acts = Math.max(cur.value.acts, 0);
  } else {
    tries.value++;
    emit('verify.failed', { meter: c.meter, tries: tries.value });
    toast(tries.value >= 3 ? 'Locked after 3 failed attempts. Escalate to a supervisor.' : 'Answer does not match');
  }
}

const verified = computed(() => !!(cust.value && vf[cust.value.meter]));
const locked = computed(() => tries.value >= 3);
const areaOutage = computed(() => cust.value && outs.value.find(o => o.area === cust.value?.area && o.st !== 'Restored'));

/* Vending & Billing Calculator */
const calc = computed(() => {
  const c = cust.value;
  const a = Number(vend.amt) || 0;
  if (!c || a <= 0) return { vat: 0, debt: 0, net: 0, kwh: 0 };
  const vat = +(a * VAT / (1 + VAT)).toFixed(2);
  const debt = Math.min(c.debt, +((a - vat) * c.pct).toFixed(2));
  const net = +(a - vat - debt).toFixed(2);
  return { vat, debt, net, kwh: +(net / TARIFF[c.band]).toFixed(2) };
});

function finishVend() {
  const c = cust.value;
  if (!c) return;
  const k = calc.value;
  const t: VendTransaction = {
    ref: vend.ref,
    meter: c.meter,
    name: c.name,
    amt: Number(vend.amt),
    kwh: k.kwh,
    debt: k.debt,
    tok: mkTok(),
    t: new Date().toLocaleString(),
    ts: nowS(),
    ch: vend.ch,
    st: 'Success'
  };
  ledger.value.unshift(t);
  c.debt = +(c.debt - k.debt).toFixed(2);
  c.last = { amt: t.amt, d: 'just now' };
  vend.tx = t;
  vend.st = 'ok';
  stats.vends++;
  stats.value += t.amt;
  if (cur.value) cur.value.acts++;
  emit('vend.success', { ref: t.ref, meter: t.meter, amount: t.amt, kwh: t.kwh });
}

function doVend() {
  if (!need('vend')) return;
  const c = cust.value;
  if (!c) return toast('Select a customer first');
  if (!verified.value) return toast('Verify the customer before vending');
  if (c.status !== 'Active') return toast(`Meter is ${c.status}. Vending is blocked`);
  const a = Number(vend.amt);
  if (!(a >= 500 && a <= 500000)) return toast('Amount must be between ₦500 and ₦500,000');

  const d = ledger.value.find(x => x.meter === c.meter && x.amt === a && nowS() - x.ts < 120);
  if (d && !vend.dup) {
    vend.dup = true;
    return toast('Possible duplicate vend. Press again to confirm');
  }
  vend.dup = false;
  vend.ref = `TX-${700000 + Math.floor(Math.random() * 99999)}`;
  vend.st = 'proc';
  vend.att = 0;
  emit('vend.started', { ref: vend.ref, meter: c.meter, amount: a });

  setTimeout(() => {
    const r = Math.random();
    if (r < 0.8) finishVend();
    else if (r < 0.93) {
      vend.st = 'pending';
      emit('vend.pending', { ref: vend.ref });
    } else {
      vend.st = 'fail';
      emit('vend.failed', { ref: vend.ref });
    }
  }, 1400);
}

function requeryVend() {
  vend.att++;
  vend.st = 'proc';
  setTimeout(() => {
    if (Math.random() < 0.7 || vend.att > 1) finishVend();
    else {
      vend.st = 'pending';
      toast('Gateway still processing. Requery in a moment');
    }
  }, 1000);
}

function retryVend() {
  vend.st = 'proc';
  setTimeout(() => {
    if (Math.random() < 0.7) finishVend();
    else {
      vend.st = 'fail';
      toast('Retry failed. Escalate to payments support');
    }
  }, 1200);
}

function smsToken() {
  if (!vend.tx || !cust.value) return;
  emit('sms.sent', { ref: vend.tx.ref });
  toast(`Token sent by SMS to ${cust.value.phone}`);
}

function replayToken() {
  if (!cust.value) return;
  const t = ledger.value.find(x => x.meter === cust.value?.meter);
  if (!t) return toast('No vend recorded in this session');
  vend.tx = t;
  vend.st = 'ok';
  emit('token.replayed', { ref: t.ref });
}

watch(() => vend.ch, (v) => {
  if (v === 'card' && cur.value && cur.value.rec) {
    toggleRec();
    toast('Recording paused for card details');
  }
});

/* Tickets & Escalations */
function makeTicket() {
  const c = cust.value;
  if (!c) return toast('Select a customer first');
  if (!verified.value && tf.type === 'Refund request') return toast('Verify the customer before a refund request');
  const big = tf.type === 'Refund request' && Number(tf.amt) > 50000;
  const t: VendTicket = {
    id: `TK-${5000 + tix.value.length + 1}`,
    type: tf.type,
    name: c.name,
    meter: c.meter,
    pri: tf.pri,
    note: tf.note,
    st: big ? 'Pending approval' : 'New',
    due: SLA[tf.type] || 24,
    at: new Date().toLocaleString(),
    ts: nowS(),
    crew: '',
    amt: Number(tf.amt) || 0
  };
  tix.value.unshift(t);
  if (cur.value) cur.value.acts++;
  emit('ticket.created', { id: t.id, type: t.type, sla_hours: t.due });
  toast(`${t.id} created, SLA ${t.due}h${big ? ', needs supervisor approval' : ''}`);
  tf.note = '';
  tf.amt = 0;
}

function advanceTicket(t: VendTicket) {
  const o = ['New', 'Assigned', 'In progress', 'Resolved'] as const;
  const i = o.indexOf(t.st as any);
  if (t.st === 'Pending approval') return;
  if (i < 3) {
    t.st = o[i + 1];
    emit('ticket.updated', { id: t.id, status: t.st });
  }
}

function approveRefund(t: VendTicket) {
  if (!need('approve')) return;
  t.st = 'Assigned';
  emit('refund.approved', { id: t.id });
  toast('Approved by supervisor');
}

function setAgentStatus(s: 'available' | 'break' | 'offline' | 'oncall' | 'wrap') {
  me.s = s;
  me.idle = nowS();
  emit('agent.status', { status: s });
}

/* Outage Management */
const outs = ref<OutageReport[]>(OUT.map(o => ({ ...o, st: 'Active', sms: 0 })));
const oa = ref('Garki');
const oc = ref('');
const oe = ref('');
const cbs = ref<{ name: string; phone: string; when: string; meter: string }[]>([]);
const notif = ref(false);
const smsT = ref<'outage' | 'ticket' | 'balance' | 'survey'>('outage');
const AREAS = Array.from(new Set(CUS.map(c => c.area)));

const smsText = computed(() => {
  const c = cust.value;
  if (!c) return '';
  const f = c.name.split(' ')[0];
  const o = outs.value.find(x => x.area === c.area && x.st !== 'Restored');
  return {
    outage: `Beverly: Dear ${f}, ${o ? `we are aware of an outage in ${c.area}. Estimated restoration: ${o.eta}.` : `no outage is currently reported in ${c.area}.`}`,
    ticket: `Beverly: Dear ${f}, we have received your request. You will get an update within the agreed time.`,
    balance: `Beverly: Dear ${f}, your meter has about ${c.bal} kWh left. Buy early to avoid interruption.`,
    survey: `Beverly: Thanks for calling. Rate our service from 1 to 5 by replying to this message.`
  }[smsT.value];
});

function sendSms() {
  if (!need('ticket')) return;
  const c = cust.value;
  if (!c) return;
  c.notes.unshift({ t: new Date().toLocaleString(), txt: `SMS sent (${smsT.value})` });
  emit('sms.sent', { meter: c.meter, template: smsT.value });
  toast(`SMS sent to ${c.phone}`);
}

function notifyOutage(o: OutageReport) {
  if (!need('approve')) return;
  const n = CUS.filter(c => c.area === o.area).length;
  o.sms = n;
  emit('sms.bulk', { area: o.area, count: n });
  toast(`Outage SMS sent to ${n} customers in ${o.area}`);
}

function restoreOutage(o: OutageReport) {
  if (!need('approve')) return;
  o.st = o.st === 'Restored' ? 'Active' : 'Restored';
  emit(`outage.${o.st === 'Restored' ? 'restored' : 'reopened'}`, { area: o.area });
}

function addOutage() {
  if (!need('approve')) return;
  if (!oc.value) return toast('Add the cause of the outage');
  outs.value.unshift({
    area: oa.value,
    feeder: `${oa.value} feeder`,
    eta: oe.value || 'To be confirmed',
    cause: oc.value,
    st: 'Active',
    sms: 0
  });
  emit('outage.declared', { area: oa.value });
  oc.value = '';
  oe.value = '';
}

function slaLeft(t: VendTicket) {
  const s = t.ts + t.due * 3600 - T.value;
  if (t.st === 'Resolved') return 'Done';
  const a = Math.abs(s);
  const h = Math.floor(a / 3600);
  const m = Math.floor((a % 3600) / 60);
  return s < 0 ? `Late ${h}h ${m}m` : `${h}h ${m}m left`;
}

function slaBreach(t: VendTicket) {
  return t.st !== 'Resolved' && t.ts + t.due * 3600 < T.value;
}

async function scoreRecording(r: AudioRecording, n: number) {
  if (!need('monitor')) return;
  r.qa = n;
  try {
    await recordingsPipeline.updateQaScore(r.id, n);
    const d = await idb();
    const m = { ...r };
    delete m.url;
    d.transaction('recs', 'readwrite').objectStore('recs').put(m);
  } catch (e) {}
  toast(`QA score ${n}/5 saved for ${r.id}`);
  emit('qa.scored', { id: r.id, score: n });
}

/* Directory, Analytics, and KPIs */
const dq = ref('');
const dst = ref('');
const dband = ref('');
const dtype = ref('');
const dsort = ref('name');
const dpage = ref(0);
const dirViewMode = ref<'table' | 'grid'>('table');
const rv = ref('');
const rvRes = ref<any>(null);
const kbq = ref('');
const kbo = ref('');
const cfm = ref('');

function resetDirFilters() {
  dq.value = '';
  dst.value = '';
  dband.value = '';
  dtype.value = '';
  dsort.value = 'name';
  dpage.value = 0;
}

const dirExportColumns = [
  { key: 'name', label: 'Customer Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'disco', label: 'DisCo' },
  { key: 'meter', label: 'Meter Number' },
  { key: 'area', label: 'Service Area / Station' },
  { key: 'band', label: 'Tariff Band' },
  { key: 'status', label: 'Status' },
  { key: 'debt', label: 'Debt (₦)' }
];

const dirExportRows = computed(() => {
  return dirAll.value.map(c => ({
    name: c.name,
    phone: c.phone,
    disco: c.disco || 'AEDC',
    meter: c.meter,
    area: c.area,
    band: `Band ${c.band}`,
    status: c.status,
    debt: money(c.debt)
  }));
});

const analyticsExportColumns = [
  { key: 'metric', label: 'KPI Metric' },
  { key: 'value', label: 'Value' },
  { key: 'delta', label: 'Delta / Target' }
];

const analyticsExportRows = computed(() => {
  return kpis.value.map(k => ({
    metric: k.l,
    value: k.v,
    delta: k.d
  }));
});

function verifyReceipt() {
  const k = rv.value.trim().toUpperCase();
  const t = ledger.value.find(x => x.ref === k || x.tok === rv.value.trim());
  emit('receipt.checked', { found: !!t });
  if (!t) rvRes.value = { ok: false, msg: 'No matching receipt found.' };
  else if (t.meter !== cust.value?.meter) rvRes.value = { ok: false, msg: 'This receipt belongs to a different meter.' };
  else rvRes.value = { ok: true, t };
}

function toggleSuspension() {
  if (!need('admin') || !cust.value) return;
  if (cfm.value !== 'susp') {
    cfm.value = 'susp';
    setTimeout(() => { cfm.value = ''; }, 4000);
    return toast('Press again to confirm');
  }
  cfm.value = '';
  const c = cust.value;
  c.status = c.status === 'Active' ? 'Suspended' : 'Active';
  emit('meter.status', { meter: c.meter, status: c.status });
  toast(`Meter ${c.status.toLowerCase()}`);
}

const sla = computed(() => stats.ans ? Math.round(stats.fast / stats.ans * 100) : 100);
const breach = computed(() => queue.value.filter(c => T.value - c.at > 60).length);
const custLedger = computed(() => cust.value ? ledger.value.filter(x => x.meter === cust.value?.meter) : []);
const custTix = computed(() => cust.value ? tix.value.filter(x => x.meter === cust.value?.meter) : []);

const navs = computed(() => {
  const all: [string, string, string, string?][] = [
    ['calls', 'phone',   'Calls',      'call_queue'],
    ['dir',   'user',    'Directory',  'info'],
    ['cust',  'user',    'Customer',   'info'],
    ['vend',  'bolt',    'Billing',    'receipt'],
    ['tix',   'ticket',  'Tickets',    'ticket'],
  ];
  const result = all.filter(n => !n[3] || can(n[3]));
  if (can('recordings')) result.push(['rec', 'mic', 'Recordings']);
  result.push(['ins', 'chart', can('analytics') ? 'Analytics' : 'My stats']);
  if (can('audit')) result.push(['acc', 'shield', 'Access']);
  return result;
});

const HRS = ['8am', '9', '10', '11', '12pm', '1', '2', '3', '4'];
const SC = [12, 19, 27, 31, 24, 22, 29, 26, 18];
const SR = [180, 260, 410, 520, 380, 330, 470, 440, 300];

const chartCalls = computed(() => {
  const a = SC.slice();
  a[8] += stats.handled;
  return a;
});

const chartRev = computed(() => {
  const a = SR.slice();
  a[8] += Math.round(stats.value / 1000);
  return a;
});

const topics = computed(() => {
  const t: Record<string, number> = { token: 42, outage: 25, billing: 33 };
  hist.value.forEach(r => { t[r.skill] = (t[r.skill] || 0) + 1; });
  return [
    { l: 'Token issues', v: t.token },
    { l: 'Outages', v: t.outage },
    { l: 'Billing', v: t.billing }
  ];
});

const agentBars = computed(() => agents.map(a => a.h));
const csatV = computed(() => {
  const r = hist.value.filter(x => x.csat > 0);
  return r.length ? (r.reduce((s, x) => s + x.csat, 0) / r.length).toFixed(1) : '4.4';
});
const fcr = computed(() => {
  const ok = hist.value.filter(x => x.disp === 'Resolved' || x.disp === 'Token vended').length;
  return Math.round((71 * 20 + ok * 100) / (20 + hist.value.length));
});

const kpis = computed(() => [
  { l: 'Calls handled', v: 156 + stats.handled, d: '+8% vs yesterday', u: 1 },
  { l: 'Service level', v: `${sla.value}%`, d: 'Target 80%', u: sla.value >= 80 ? 1 : 0 },
  { l: 'Avg handle time', v: fmt(stats.aht || 214), d: '12s faster than yesterday', u: 1 },
  { l: 'First contact resolution', v: `${fcr.value}%`, d: '+3 pts', u: 1 },
  { l: 'CSAT', v: `${csatV.value} / 5`, d: '+0.1', u: 1 },
  { l: 'Value vended', v: money(1250000 + stats.value), d: '+5%', u: 1 },
  { l: 'Abandon rate', v: '4.2%', d: 'Target under 5%', u: 1 },
  { l: 'Open tickets', v: 14 + tix.value.length, d: `${breach.value} queue breaches`, u: breach.value ? 0 : 1 }
]);

const dirAll = computed(() => {
  const s = dq.value.toLowerCase();
  return CUS.filter(c =>
    (!s || (c.name + c.meter + c.area).toLowerCase().includes(s)) &&
    (!dst.value || c.status === dst.value) &&
    (!dband.value || c.band === dband.value) &&
    (!dtype.value || c.type === dtype.value)
  ).sort((a, b) => dsort.value === 'debt' ? b.debt - a.debt : a.name.localeCompare(b.name));
});

const dirRows = computed(() => dirAll.value.slice(dpage.value * 10, dpage.value * 10 + 10));
const dirPages = computed(() => Math.max(1, Math.ceil(dirAll.value.length / 10)));
const kbList = computed(() => KB.filter(a => (a[0] + a[1]).toLowerCase().includes(kbq.value.toLowerCase())));

const alerts = computed(() => {
  const a: { k: string; t: string; v: 'calls' | 'cust' | 'vend' | 'tix' | 'rec' | 'ins' | 'acc' }[] = [];
  if (breach.value) a.push({ k: 'q', t: `${breach.value} caller(s) waiting over 60 seconds`, v: 'calls' });
  const pa = tix.value.filter(x => x.st === 'Pending approval').length;
  if (pa && can('approve')) a.push({ k: 'p', t: `${pa} refund(s) need approval`, v: 'tix' });
  const sb = tix.value.filter(slaBreach).length;
  if (sb) a.push({ k: 's', t: `${sb} ticket(s) past SLA`, v: 'tix' });
  const ao = outs.value.filter(o => o.st !== 'Restored').length;
  if (ao) a.push({ k: 'o', t: `${ao} active outage(s)`, v: 'ins' });
  if (cbs.value.length) a.push({ k: 'c', t: `${cbs.value.length} callback(s) due`, v: 'calls' });
  return a;
});

const hits = computed(() => {
  const s = q.value.trim().toLowerCase();
  return s.length < 2 ? [] : CUS.filter(c => (c.name + c.meter + c.phone).toLowerCase().includes(s)).slice(0, 5);
});

/* Command Palette (Ctrl K) */
const pal = ref(false);
const pq = ref('');

const palItems = computed(() => {
  const s = pq.value.trim().toLowerCase();
  const a = navs.value.map(n => ({
    l: `Go to ${n[2]}`,
    k: 'Page',
    f: () => { view.value = n[0] as any; }
  }));
  const c = CUS.filter(x => s.length > 1 && (x.name + x.meter).toLowerCase().includes(s)).slice(0, 5).map(x => ({
    l: `${x.name} | ${x.meter}`,
    k: TL[x.type || 'customer'] || 'Customer',
    f: () => { pickCustomer(x); view.value = 'cust'; }
  }));
  return c.concat(a.filter(x => !s || x.l.toLowerCase().includes(s))).slice(0, 8);
});

function runPal(it: { f: Function }) {
  it.f();
  pal.value = false;
  pq.value = '';
}

/* Timers, Listeners & Shortcuts */
const scrolled = ref(false);
let timer1s: any = null;
let timerArrive: any = null;

function handleKeyDown(e: KeyboardEvent) {
  if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName) || e.metaKey || e.ctrlKey || e.altKey) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      pal.value = !pal.value;
      pq.value = '';
      setTimeout(() => {
        document.getElementById('pi')?.focus();
      }, 40);
    }
    return;
  }
  const k = e.key.toLowerCase();
  const c = cur.value;
  if (k === 'escape') {
    kp.value = xf.value = false;
    pal.value = false;
    return;
  }
  if (ring.value) {
    if (k === 'a') acceptCall();
    if (k === 'd') declineCall();
    return;
  }
  if (c) {
    if (k === 'm') {
      c.mute = !c.mute;
      announce(c.mute ? 'Muted' : 'Unmuted');
    } else if (k === 'h') {
      c.hold = !c.hold;
    } else if (k === 'e') {
      endCall();
    } else if (k === 'r') {
      toggleRec();
    }
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown);
  window.addEventListener('keydown', handleKeyDown);

  authStore.hydrate();
  authStore.revalidateSession().catch(() => {});

  // Initialize and sync customer pipeline
  customerPipeline.listCustomers({ stationScope: authStore.stationScope }).then(res => {
    if (res && res.length) {
      for (const row of res) {
        if (!CUS.some(c => c.meter === row.meter)) {
          CUS.push(row);
        }
      }
    }
  }).catch(() => {});

  loadRecs();
  try {
    hist.value = JSON.parse(localStorage.getItem('bv_vc_hist') || '[]');
  } catch (e) {}

  const el = document.getElementById('mn');
  if (el) {
    let raf = 0;
    el.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        scrolled.value = el.scrollTop > 6;
        const m = el.scrollHeight - el.clientHeight;
        el.style.setProperty('--p', String(m > 0 ? el.scrollTop / m : 0));
      });
    }, { passive: true });
  }

  timer1s = setInterval(() => {
    T.value = nowS();
    if (ring.value && T.value - ring.value.at > 20) {
      const c = ring.value.c;
      c.pri++;
      queue.value.unshift(c);
      emit('call.missed', { id: c.id });
      ring.value = null;
      toast('Missed call returned to queue');
    }
    agents.forEach(a => {
      if (a.busy && T.value > a.busy.end) {
        a.busy = null;
        a.s = 'available';
        a.idle = T.value;
        a.h++;
      }
    });
    if (!ring.value) routeQueue();
  }, 1000);

  timerArrive = setInterval(arriveCall, 9000);
  setTimeout(arriveCall, 600);
  setTimeout(arriveCall, 2500);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown);
  window.removeEventListener('keydown', handleKeyDown);
  if (timer1s) clearInterval(timer1s);
  if (timerArrive) clearInterval(timerArrive);
  micStop();
});
</script>

<template>
  <div class="app" :class="{ focus: cur && view === 'calls' }">
    <!-- Top Navigation Bar (Canonical Beverly Brand & Components) -->
    <header class="top">
      <div class="bw-brand-lockup">
        <div class="bw-mark" aria-hidden="true">
          <img src="/brand/beverly-mark.png" alt="Beverly" style="display: none" />
        </div>
        <div class="bw-brand-text">
          <strong>Beverly</strong>
          <span>Vend and Care</span>
        </div>
      </div>

      <!-- Search Bar with Ctrl K and Hit List -->
      <div class="srch">
        <Ic n="search" :s="16" />
        <input
          v-model="q"
          @keyup.enter="findCustomer"
          placeholder="Search customers, or press Ctrl K"
          aria-label="Search customers"
        />
        <div v-if="hits.length" class="sdd" role="listbox">
          <button
            v-for="c in hits"
            :key="c.meter"
            class="li"
            @click="pickCustomer(c); view = 'cust'; q = ''"
          >
            <span class="av">{{ ini(c.name) }}</span>
            <div class="g">
              <b>{{ c.name }}</b>
              <small class="mut mono">{{ c.meter }} | {{ TL[c.type || 'customer'] }}</small>
            </div>
          </button>
        </div>
      </div>

      <!-- Top Actions & Simplified Beverly Controls -->
      <div class="tr">
        <!-- Role badge (compact, always visible) -->
        <span class="role-badge" :style="{ '--rb-color': ROLE_COLOR[role] }">{{ ROLE_LABELS[role] }}</span>

        <!-- Alerts Icon Button with Badge -->
        <button class="btn icon-btn" @click="notif = !notif" title="Alerts" aria-label="Alerts">
          <Ic n="bell" :s="17" />
          <span v-if="alerts.length" class="bdg-dot">{{ alerts.length }}</span>
        </button>

        <!-- Theme Toggle Icon Button -->
        <button class="btn icon-btn" @click="toggleAppTheme" title="Toggle theme" aria-label="Toggle theme">
          <Ic n="moon" :s="16" />
        </button>

        <!-- Beverly Canonical Avatar & Dropdown -->
        <div class="bw-account-menu" ref="accountMenuWrap">
          <button
            type="button"
            class="bw-user-chip bw-user-chip-btn"
            :aria-label="`User menu for ${agentDisplayName}`"
            aria-haspopup="menu"
            :aria-expanded="userMenuOpen"
            @click="toggleUserMenu"
          >
            <div class="bw-avatar green" style="overflow: hidden">
              <span class="bw-user-dropdown-logo bw-avatar-brand-logo" aria-hidden="true"></span>
            </div>
            <div class="bw-user-meta">
              <strong>{{ agentFirstName }}</strong>
              <span :style="{ color: ROLE_COLOR[role] }">{{ ROLE_LABELS[role] }}</span>
            </div>
            <svg class="bw-user-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <transition name="bw-menu">
            <div v-show="userMenuOpen" class="bw-user-dropdown" role="menu" aria-label="Beverly account menu">
              <div class="bw-user-dropdown-brand">
                <span class="bw-user-dropdown-logo" aria-hidden="true"></span>
                <span>
                  <strong>Beverly Vend & Care</strong>
                  <small>{{ agentDisplayName }} · {{ agentDisplayEmail }}</small>
                </span>
              </div>

              <!-- In-Menu Presence Toggle -->
              <div style="padding: 6px 8px;">
                <div class="mut" style="font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Presence Status</div>
                <div class="row" style="gap: 4px;">
                  <button
                    v-for="st in (['available', 'break', 'offline'] as const)"
                    :key="st"
                    type="button"
                    class="btn sm"
                    :class="{ on: me.s === st }"
                    @click="setAgentStatus(st)"
                  >
                    {{ st === 'available' ? 'Available' : st === 'break' ? 'Break' : 'Offline' }}
                  </button>
                </div>
              </div>

              <!-- In-Menu Role Switcher (RBAC) -->
              <div style="padding: 6px 8px;">
                <div class="mut" style="font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Signed In Role</div>
                <div class="row" style="gap: 4px; flex-wrap: wrap;">
                  <button
                    v-for="r in (['super-admin', 'admin', 'supervisor', 'agent', 'auditor'] as const)"
                    :key="r"
                    type="button"
                    class="btn sm"
                    :class="{ on: role === r }"
                    @click="role = r"
                  >
                    {{ ROLE_LABELS[r] }}
                  </button>
                </div>
              </div>

              <div class="bw-user-menu-separator"></div>

              <!-- Language Switcher in Avatar Dropdown -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px;">
                <span style="font-size: 12.5px; font-weight: 500;">Language</span>
                <LanguageSwitcher compact />
              </div>

              <div class="bw-user-menu-separator"></div>

              <button type="button" class="bw-user-menu-item" role="menuitem" @click="toggleAppTheme">
                <svg class="bw-user-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path d="M12 21C7 16 5 11 6 5c6-1 11 1 13 6-4 1-7 4-9 8" />
                  <path d="M6 19c3-5 7-8 13-8" />
                </svg>
                <span>Toggle Theme</span>
              </button>

              <div class="bw-user-menu-separator"></div>

              <a :href="PORTAL_URLS.admin" class="bw-user-menu-item" role="menuitem" @click="closeUserMenu" title="Open Admin Portal">
                <svg class="bw-user-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
                <span>Admin Portal</span>
              </a>

              <a :href="PORTAL_URLS.vendor" class="bw-user-menu-item" role="menuitem" @click="closeUserMenu" title="Open Vendor Portal">
                <svg class="bw-user-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <span>Vendor Portal</span>
              </a>

              <a :href="PORTAL_URLS.customer" class="bw-user-menu-item" role="menuitem" @click="closeUserMenu" title="Open Customer Portal">
                <svg class="bw-user-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                <span>Customer Portal</span>
              </a>

              <a :href="PORTAL_URLS.landing" class="bw-user-menu-item" role="menuitem" @click="closeUserMenu" title="Public Wallet Landing">
                <svg class="bw-user-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                <span>Wallet Landing</span>
              </a>
            </div>
          </transition>
        </div>
      </div>
    </header>

    <!-- App Navigation Rail -->
    <nav class="rail" aria-label="Apps">
      <button
        v-for="n in navs"
        :key="n[0]"
        class="rb"
        :class="{ on: view === n[0] }"
        @click="view = n[0] as any"
      >
        <Ic :n="n[1]" />
        <span>{{ n[2] }}</span>
        <span v-if="n[0] === 'calls' && queue.length" class="bdg">{{ queue.length }}</span>
        <span v-if="n[0] === 'tix' && tix.length" class="bdg">{{ tix.length }}</span>
      </button>
    </nav>

    <!-- Left Panel (Lists, Queues, Customers) -->
    <aside class="lp" aria-label="Lists">
      <template v-if="view === 'calls'">
        <h3>Waiting ({{ queue.length }})</h3>
        <Stagger style="display: grid; gap: 4px">
          <div v-for="c in queue" :key="c.id" class="li">
            <span class="av">{{ ini(c.cust.name) }}</span>
            <div class="g">
              <b>{{ c.cust.name }}</b>
              <small class="mut">
                {{ c.skill }} | {{ c.cust.type === 'customer' ? '' : (c.cust.type === 'both' ? 'V+C | ' : 'Vendor | ') }}{{ fmt(T - c.at) }}
              </small>
            </div>
            <span v-if="T - c.at > 60" class="chip bad">SLA</span>
            <span v-else-if="c.pri > 1" class="chip w">Priority</span>
          </div>
        </Stagger>
        <p v-if="!queue.length" class="mut" style="padding: 6px">No callers waiting.</p>

        <template v-if="cbs.length">
          <h3>Callbacks ({{ cbs.length }})</h3>
          <div v-for="(c, i) in cbs" :key="i" class="li">
            <span class="av">{{ ini(c.name) }}</span>
            <div class="g">
              <b>{{ c.name }}</b>
              <small class="mut">{{ c.when }}</small>
            </div>
            <button class="btn sm" @click="cbs.splice(i, 1); toast('Callback marked done')">Done</button>
          </div>
        </template>

        <h3>Team</h3>
        <div v-for="a in agents" :key="a.n" class="li">
          <span class="av">
            {{ ini(a.n === 'You' ? 'Me' : a.n) }}
            <i class="pres" :class="a.me ? me.s : (a.busy ? 'oncall' : a.s)"></i>
          </span>
          <div class="g">
            <b>{{ a.n }}</b>
            <small class="mut">
              {{ a.me ? (cur ? 'On call' : me.s) : (a.busy ? `On call ${fmt(T - a.busy.start)}` : a.s) }}
            </small>
          </div>
          <button
            v-if="!a.me && a.busy && can('monitor')"
            class="btn sm"
            @click="toast(`Listening to ${a.n} (audit logged)`); emit('call.monitored', { agent: a.n })"
          >
            Listen
          </button>
        </div>
      </template>

      <template v-else>
        <h3>Customers</h3>
        <button
          v-for="c in CUS"
          :key="c.meter"
          class="li"
          :class="{ on: cust && cust.meter === c.meter }"
          @click="pickCustomer(c)"
        >
          <span class="av">{{ ini(c.name) }}</span>
          <div class="g">
            <b>{{ c.name }}</b>
            <small class="mut mono">{{ c.meter }} | {{ TL[c.type || 'customer'] }}</small>
          </div>
          <span v-if="c.status !== 'Active'" class="chip bad">{{ c.status }}</span>
        </button>
      </template>
    </aside>

    <!-- Main Content Area -->
    <main class="main" id="mn" tabindex="-1">
      <!-- Sticky Bar Header -->
      <div class="sbar" :class="{ sh: scrolled }">
        <b>{{ (navs.find(n => n[0] === view) || [0, 0, ''])[2] }}</b>
        <span class="grow"></span>
        <span v-if="cust" class="chip">{{ cust.name }}</span>
        <span v-if="cust" class="chip" :class="'t-' + (cust.type || 'customer')">{{ TL[cust.type || 'customer'] }}</span>
        <span v-if="cust" class="chip" :class="{ bad: !verified }">{{ verified ? 'Verified' : 'Not verified' }}</span>
        <span v-if="cur" class="chip bad"><span class="d2"></span>{{ fmt(T - cur.start) }}</span>
      </div>

      <!-- Banner if navigated away while on call -->
      <div v-if="cur && view !== 'calls'" class="ban">
        <span><b>On call:</b> {{ cur.c.cust.name }} | {{ fmt(T - cur.start) }}</span>
        <button class="btn sm" @click="view = 'calls'">Back to call</button>
      </div>

      <!-- VIEW: CALLS (Live Desk) -->
      <template v-if="view === 'calls'">
        <!-- IDLE STAGE -->
        <div v-if="!cur && !wrap" style="position: relative">
          <div class="amb"></div>
          <div class="rings" aria-hidden="true"><i></i><i></i><i></i></div>
          <Eyebrow>Agent desk</Eyebrow>
          <h1 style="margin: 10px 0">
            <MaskText :text="me.s === 'available' ? 'Ready for vending and care calls' : 'You are not taking calls'" />
          </h1>
          <Reveal :delay="200">
            <p class="mut" style="max-width: 54ch">
              Calls route by topic, priority and wait time. Every vend, refund and token replay needs the caller verified first.
            </p>
          </Reveal>

          <Stagger class="kg" style="margin: 16px 0">
            <div><span class="mut">Handled</span><b><CountUp :to="stats.handled" /></b></div>
            <div><span class="mut">Answered in 20s</span><b><CountUp :to="sla" suffix="%" /></b></div>
            <div><span class="mut">Tokens vended</span><b><CountUp :to="stats.vends" /></b></div>
            <div><span class="mut">Waiting</span><b><CountUp :to="queue.length" /></b></div>
          </Stagger>

          <div class="card" style="margin-bottom: 12px">
            <b>Needs attention</b>
            <p v-if="!alerts.length" class="mut" style="margin: 0">Nothing urgent right now.</p>
            <button
              v-for="a in alerts"
              :key="a.k"
              class="btn sm"
              style="text-align: left; margin: 2px 0;"
              @click="view = a.v"
            >
              {{ a.t }}
            </button>
          </div>

          <SpotlightCard>
            <b>How a call flows</b>
            <div class="steps">
              <div v-for="(s, i) in STEPS" :key="s" class="stp">
                <span class="mono mut">0{{ i + 1 }}</span><br>{{ s }}
              </div>
            </div>
            <span class="mut">
              Identify the meter, verify with the last purchase amount, then vend, replay a token or raise a ticket. Wrap up updates the CRM.
            </span>
          </SpotlightCard>

          <div class="row" style="margin-top: 12px">
            <button class="btn" @click="setAgentStatus('available')" :class="{ on: me.s === 'available' }">Available</button>
            <button class="btn" @click="setAgentStatus('break')" :class="{ on: me.s === 'break' }">On break</button>
            <select v-model="strat" style="width: auto" @change="emit('routing.changed', { strategy: strat })" aria-label="Routing">
              <option value="skills">Skills based routing</option>
              <option value="idle">Longest idle</option>
              <option value="rr">Fair share</option>
            </select>
          </div>
        </div>

        <!-- ACTIVE CALL HERO STAGE -->
        <div v-else-if="cur" class="cwrap">
          <div class="call">
            <div class="who">
              {{ cur.tr.length ? (cur.tr[cur.tr.length - 1].w === 'a' ? 'You' : cur.c.cust.name) + ' speaking' : 'Connecting...' }}
            </div>
            <div class="bigav" :class="{ sp: !cur.hold }">{{ ini(cur.c.cust.name) }}</div>
            <div class="cname">{{ cur.c.cust.name }}</div>
            <div class="csub">{{ cur.c.cust.phone }} | METER {{ cur.c.cust.meter }}</div>
            <div class="row" style="justify-content: center">
              <span class="chip" :class="'t-' + (cur.c.cust.type || 'customer')">{{ TL[cur.c.cust.type || 'customer'] }}</span>
              <span v-if="cur.c.cust.vid" class="chip">{{ cur.c.cust.vid }}</span>
            </div>
            <div class="wave" :class="{ off: cur.hold || cur.mute }">
              <i v-for="n in 28" :key="n" :style="{ animationDelay: `${n * 55}ms` }"></i>
            </div>
            <div class="mood">
              <span>Caller mood</span>
              <i :style="{ width: `${cur.sent}%` }"></i>
            </div>
            <button class="tag" @click="toggleRec" :aria-pressed="cur.rec">
              <span class="d" :style="{ opacity: cur.rec ? 1 : 0.3 }"></span>
              {{ cur.rec ? 'Recording' : 'Paused' }}
            </button>
            <div v-if="cur.hold" class="hold">On hold</div>
            <div v-if="cur.cap && !cur.hold" class="cap" aria-live="polite">{{ cur.cap }}</div>
          </div>
        </div>

        <!-- WRAP UP STAGE -->
        <div v-else-if="wrap" class="card" style="max-width: 560px">
          <Eyebrow>Call ended</Eyebrow>
          <h1><MaskText text="Wrap up this call" /></h1>
          <span class="mut">
            {{ wrap.c.cust.name }} | talk {{ fmt(wrap.dur) }} | wrap-up
            <b :style="{ color: T - wrap.at > 60 ? 'var(--destructive)' : 'inherit' }">{{ fmt(T - wrap.at) }}</b> of 01:00 target
          </span>

          <div class="row">
            <button
              v-for="d in ['Resolved', 'Token vended', 'Ticket raised', 'Refund requested', 'Follow up', 'Escalated']"
              :key="d"
              class="btn sm"
              :class="{ on: wrap.disp === d }"
              @click="wrap.disp = d"
            >
              {{ d }}
            </button>
          </div>

          <div class="row">
            <span class="mut">Schedule callback</span>
            <select v-model="wrap.cb" style="width: auto">
              <option value="">None</option>
              <option>In 30 minutes</option>
              <option>In 2 hours</option>
              <option>Tomorrow 9 am</option>
            </select>
          </div>

          <div class="row">
            <span class="mut">Customer satisfaction</span>
            <button
              v-for="n in 5"
              :key="n"
              class="btn sm"
              :class="{ on: wrap.csat === n }"
              @click="wrap.csat = n"
            >
              {{ n }}
            </button>
          </div>

          <textarea v-model="wrap.notes" placeholder="Notes for the CRM" aria-label="Notes"></textarea>
          <div class="row">
            <button class="btn pr" :disabled="!wrap.disp" @click="saveCallWrap">Save to CRM</button>
          </div>
        </div>
      </template>

      <!-- VIEW: CUSTOMER 360 -->
      <template v-else-if="view === 'cust'">
        <Eyebrow>Customer 360</Eyebrow>
        <h1 style="margin: 8px 0 14px">{{ cust ? cust.name : 'Select a customer' }}</h1>
        <div v-if="cust" class="row" style="margin-bottom: 12px">
          <span class="chip" :class="'t-' + (cust.type || 'customer')">{{ TL[cust.type || 'customer'] }}</span>
          <span v-if="cust.vid" class="chip">{{ cust.vid }}</span>
        </div>
        <p v-if="!cust" class="mut">Search a meter number above or pick a customer from the list.</p>
        <template v-else>
          <div class="kg" style="margin-bottom: 12px">
            <div><span class="mut">Meter</span><b class="mono" style="font-size: 16px">{{ cust.meter }}</b></div>
            <div><span class="mut">Band and tariff</span><b style="font-size: 18px">{{ cust.band }} | {{ money(TARIFF[cust.band]) }}/kWh</b></div>
            <div><span class="mut">Debt</span><b style="font-size: 18px">{{ money(cust.debt) }}</b></div>
            <div><span class="mut">Status</span><b style="font-size: 18px">{{ cust.status }}</b></div>
          </div>

          <div class="row" style="margin: 0 0 12px">
            <button
              class="btn dn"
              :disabled="!can('admin')"
              :title="can('admin') ? '' : 'Admin only'"
              @click="toggleSuspension"
            >
              {{ cfm === 'susp' ? 'Press again to confirm' : (cust.status === 'Active' ? 'Suspend meter' : 'Reactivate meter') }}
            </button>
            <span class="mut">{{ can('admin') ? 'Admin action, logged' : 'Restricted to Admin' }}</span>
          </div>

          <div class="card">
            <b>Interaction history</b>
            <p v-if="!cust.notes.length" class="mut" style="margin: 0">No interactions this session.</p>
            <div v-for="(n, i) in cust.notes" :key="i" class="mut">{{ n.t }}: {{ n.txt }}</div>
          </div>

          <div class="card" style="margin-top: 12px">
            <b>Send SMS</b>
            <select v-model="smsT" aria-label="SMS template">
              <option value="outage">Outage update</option>
              <option value="ticket">Ticket received</option>
              <option value="balance">Low balance reminder</option>
              <option value="survey">Satisfaction survey</option>
            </select>
            <div class="tip">{{ smsText }}</div>
            <div class="row">
              <button class="btn pr" @click="sendSms">Send to {{ cust.phone }}</button>
            </div>
          </div>

          <div class="card sc2" style="margin-top: 12px">
            <b>Vend ledger</b>
            <table v-if="custLedger.length">
              <thead>
                <tr><th>Ref</th><th>Amount</th><th>kWh</th><th>Time</th></tr>
              </thead>
              <tbody>
                <tr v-for="t in custLedger" :key="t.ref">
                  <td class="mono">{{ t.ref }}</td>
                  <td>{{ money(t.amt) }}</td>
                  <td>{{ t.kwh }}</td>
                  <td>{{ t.t }}</td>
                </tr>
              </tbody>
            </table>
            <span v-else class="mut">No vends this session. Last purchase {{ money(cust.last.amt) }}, {{ cust.last.d }}.</span>
          </div>
        </template>
      </template>

      <!-- VIEW: BILLING & VENDING -->
      <template v-else-if="view === 'vend'">
        <Eyebrow>Billing</Eyebrow>
        <h1 style="margin: 8px 0 14px">{{ can('vend') ? 'Balance, receipts and vending' : 'Balance and receipts' }}</h1>
        <div v-if="!cust" class="warnb">Select a customer first from the list or search box.</div>
        <template v-else>
          <div class="warnb" v-if="!verified">
            Verification required. Ask: "What was the amount of your last {{ cust.type === 'vendor' ? 'float top-up' : 'purchase' }}?"
            <div class="row" style="margin-top: 8px">
              <input
                v-model="ans"
                type="number"
                placeholder="Amount in naira"
                style="width: 180px"
                :disabled="locked"
                aria-label="Last purchase amount"
              />
              <button class="btn pr" @click="verifyCustomer" :disabled="locked">Verify</button>
              <span v-if="tries" class="mut">Attempts {{ tries }} of 3</span>
            </div>
          </div>
          <div v-else class="chip" style="width: max-content; margin-bottom: 10px">Verified</div>

          <div v-if="areaOutage" class="warnb" style="margin: 10px 0">
            <b>Known outage in {{ cust.area }}:</b> {{ areaOutage.cause }}, ETA {{ areaOutage.eta }}. A token will load, but supply returns after repair.
          </div>

          <template v-if="verified">
            <div class="kg" style="margin: 10px 0">
              <div><span class="mut">Units remaining</span><b>{{ cust.bal }} kWh</b></div>
              <div><span class="mut">Outstanding debt</span><b>{{ money(cust.debt) }}</b></div>
              <div><span class="mut">Last purchase</span><b style="font-size: 18px">{{ money(cust.last.amt) }}</b></div>
              <div><span class="mut">Meter status</span><b style="font-size: 18px">{{ cust.status }}</b></div>
            </div>

            <div class="card" style="margin-bottom: 12px">
              <b>Verify a receipt</b>
              <div class="row">
                <input
                  v-model="rv"
                  placeholder="Receipt reference, for example TX-700100"
                  aria-label="Receipt reference"
                  style="flex: 1"
                />
                <button class="btn pr" @click="verifyReceipt">Verify</button>
              </div>
              <div v-if="rvRes && rvRes.ok" class="tip">
                <b>Valid receipt</b> {{ rvRes.t.ref }} | {{ money(rvRes.t.amt) }} | {{ rvRes.t.kwh }} kWh | {{ rvRes.t.ch }} | {{ rvRes.t.t }} | token ending {{ rvRes.t.tok.slice(-4) }}
              </div>
              <div v-else-if="rvRes" class="warnb">{{ rvRes.msg }}</div>
            </div>

            <div class="card sc2" style="margin-bottom: 12px">
              <b>Recent transactions</b>
              <table>
                <thead>
                  <tr><th>Ref</th><th>Amount</th><th>kWh</th><th>Channel</th><th>When</th><th>Status</th></tr>
                </thead>
                <tbody>
                  <tr v-for="t in custLedger.slice(0, 8)" :key="t.ref">
                    <td class="mono">{{ t.ref }}</td>
                    <td>{{ money(t.amt) }}</td>
                    <td>{{ t.kwh }}</td>
                    <td>{{ t.ch }}</td>
                    <td>{{ t.t }}</td>
                    <td>{{ t.st }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <template v-if="can('vend')">
            <div class="grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px">
              <div class="card">
                <b>{{ cust.name }} | {{ cust.meter }}</b>
                <label for="am" class="mut">Amount (₦500 to ₦500,000)</label>
                <input id="am" type="number" v-model="vend.amt" />
                <div class="row">
                  <button v-for="a in [1000, 2000, 5000, 10000]" :key="a" class="btn sm" @click="vend.amt = a">{{ money(a) }}</button>
                </div>
                <label for="ch" class="mut">Payment channel</label>
                <select id="ch" v-model="vend.ch">
                  <option value="transfer">Bank transfer</option>
                  <option value="card">Card</option>
                  <option value="ussd">USSD</option>
                  <option value="wallet">Wallet</option>
                </select>
                <button class="btn pr" @click="doVend" :disabled="vend.st === 'proc'">
                  {{ vend.dup ? 'Confirm duplicate vend' : vend.st === 'proc' ? 'Processing...' : 'Vend token' }}
                </button>
              </div>

              <div class="card">
                <b>Breakdown</b>
                <div class="row"><span class="grow mut">VAT 7.5%</span>{{ money(calc.vat) }}</div>
                <div class="row"><span class="grow mut">Debt recovery ({{ cust.pct * 100 }}%)</span>{{ money(calc.debt) }}</div>
                <div class="row"><span class="grow mut">Net for energy</span>{{ money(calc.net) }}</div>
                <div class="row"><b class="grow">Units</b><b>{{ calc.kwh }} kWh</b></div>
                <span class="mut">Sample tariffs. Configure per DisCo and band.</span>
              </div>
            </div>

            <SpotlightCard v-if="vend.st === 'ok' && vend.tx" style="margin-top: 12px">
              <Eyebrow>Token generated</Eyebrow>
              <div class="tok">{{ vend.tx.tok }}</div>
              <span class="mut">{{ vend.tx.ref }} | {{ money(vend.tx.amt) }} | {{ vend.tx.kwh }} kWh</span>
              <div class="row" style="margin-top: 8px">
                <button class="btn pr" @click="smsToken">Send by SMS</button>
              </div>
            </SpotlightCard>

            <div v-if="vend.st === 'pending'" class="warnb" style="margin-top: 12px">
              <b>Pending:</b> the gateway has not confirmed {{ vend.ref }}. Do not vend again.
              <button class="btn sm" @click="requeryVend">Requery</button>
            </div>
            <div v-if="vend.st === 'fail'" class="warnb" style="margin-top: 12px">
              <b>Failed:</b> {{ vend.ref }} was not completed. Retry uses the same reference so the customer is not charged twice.
              <button class="btn sm" @click="retryVend">Retry</button>
            </div>

            <div class="row" style="margin-top: 12px">
              <button class="btn" @click="replayToken">Replay last token</button>
            </div>
          </template>
          <div v-else class="warnb">
            Vending, token replay and refunds are restricted to the Admin role. Agents can check balances, verify receipts and view transactions.
          </div>
        </template>
      </template>

      <!-- VIEW: TICKETS -->
      <template v-else-if="view === 'tix'">
        <Eyebrow>Tickets and refunds</Eyebrow>
        <h1 style="margin: 8px 0 14px">Service tickets</h1>
        <div class="card">
          <div class="row">
            <select v-model="tf.type" style="flex: 1">
              <option v-for="(h, k) in SLA" :key="k">{{ k }}</option>
            </select>
            <select v-model="tf.pri" style="width: 130px">
              <option>Normal</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </div>
          <input
            v-if="tf.type === 'Refund request'"
            type="number"
            v-model="tf.amt"
            placeholder="Refund amount in naira (over ₦50,000 needs approval)"
          />
          <textarea v-model="tf.note" placeholder="Describe the issue" aria-label="Ticket note"></textarea>
          <div class="row">
            <button class="btn pr" @click="makeTicket">Create ticket{{ cust ? ' for ' + cust.name : '' }}</button>
            <span class="mut">SLA {{ SLA[tf.type] }} hours</span>
          </div>
        </div>

        <div class="card sc2 tall" style="margin-top: 12px">
          <table>
            <thead>
              <tr><th>ID</th><th>Type</th><th>Customer</th><th>Status</th><th>SLA</th><th>Crew</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="t in tix" :key="t.id">
                <td class="mono">{{ t.id }}</td>
                <td>{{ t.type }}<br><span class="chip" :class="{ bad: t.pri === 'Critical' }">{{ t.pri }}</span></td>
                <td>{{ t.name }}</td>
                <td>{{ t.st }}</td>
                <td :class="{ dnc: slaBreach(t) }">{{ slaLeft(t) }}</td>
                <td>
                  <select v-if="can('approve')" v-model="t.crew" style="width: auto; padding: 4px" aria-label="Assign crew">
                    <option value="">Unassigned</option>
                    <option>Crew A</option>
                    <option>Crew B</option>
                    <option>Crew C</option>
                  </select>
                  <span v-else class="mut">{{ t.crew || 'Unassigned' }}</span>
                </td>
                <td>
                  <button
                    v-if="t.st === 'Pending approval'"
                    class="btn sm"
                    :disabled="!can('approve')"
                    :title="can('approve') ? '' : 'Supervisor approval required'"
                    @click="approveRefund(t)"
                  >
                    Approve
                  </button>
                  <button v-else-if="t.st !== 'Resolved'" class="btn sm" @click="advanceTicket(t)">Advance</button>
                </td>
              </tr>
            </tbody>
          </table>
          <span v-if="!tix.length" class="mut">No tickets yet.</span>
        </div>
      </template>

      <!-- VIEW: ANALYTICS & STATS -->
      <template v-else-if="view === 'ins'">
        <div class="ph" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap">
          <div>
            <Eyebrow>{{ can('analytics') ? 'Analytics' : 'My stats' }}</Eyebrow>
            <h1 style="margin-top: 8px">{{ can('analytics') ? 'Contact centre performance' : 'Your performance today' }}</h1>
            <p class="mut">Performance metrics, SLA compliance, and agent scorecards synchronized with live telemetry.</p>
          </div>
          <div v-if="can('analytics')" style="display: flex; gap: 8px; align-items: center">
            <WalletExportMenu
              :rows="analyticsExportRows"
              :columns="analyticsExportColumns"
              filename="beverly-support-centre-analytics"
              title="Support Centre Performance"
              subtitle="Contact Centre KPIs and SLA Compliance"
              label="Export KPIs"
            />
          </div>
        </div>

        <Stagger class="kg">
          <div v-for="k in (can('analytics') ? kpis : kpis.slice(0, 3))" :key="k.l" class="kpi">
            <span class="mut">{{ k.l }}</span>
            <b>{{ k.v }}</b>
            <small :class="k.u ? 'up' : 'dnc'">{{ k.d }}</small>
          </div>
        </Stagger>

        <template v-if="can('analytics')">
          <div class="cg" style="margin-top: 12px">
            <div class="card">
              <b>Calls per hour</b>
              <LineChart :d="chartCalls" :labels="HRS" />
            </div>
            <div class="card">
              <b>Value vended (₦ thousand)</b>
              <BarChart :d="chartRev" :labels="HRS" />
            </div>
            <div class="card">
              <b>Calls by topic</b>
              <DonutChart :d="topics" />
            </div>
            <div class="card">
              <b>Calls handled by agent</b>
              <BarChart :d="agentBars" :labels="agents.map(a => a.n === 'You' ? 'Me' : a.n.split(' ')[0])" />
            </div>
          </div>

          <div class="card" style="margin-top: 12px">
            <b>Outage management</b>
            <div v-for="o in outs" :key="o.feeder + o.cause" class="row">
              <span class="chip" :class="{ bad: o.st !== 'Restored' }">{{ o.st }}</span>
              <span class="grow">
                <b>{{ o.area }}</b>: {{ o.cause }} | ETA {{ o.eta }}
                <span v-if="o.sms" class="mut"> | {{ o.sms }} notified</span>
              </span>
              <button class="btn sm" :disabled="!can('approve')" @click="notifyOutage(o)">Notify customers</button>
              <button class="btn sm" :disabled="!can('approve')" @click="restoreOutage(o)">
                {{ o.st === 'Restored' ? 'Reopen' : 'Mark restored' }}
              </button>
            </div>

            <div v-if="can('approve')" class="row" style="margin-top: 8px">
              <select v-model="oa" style="width: auto">
                <option v-for="a in AREAS" :key="a">{{ a }}</option>
              </select>
              <input v-model="oc" placeholder="Cause" style="flex: 1; min-width: 140px" />
              <input v-model="oe" placeholder="ETA" style="width: 130px" />
              <button class="btn pr" @click="addOutage">Declare outage</button>
            </div>
          </div>
        </template>
      </template>

      <!-- VIEW: DIRECTORY -->
      <template v-else-if="view === 'dir'">
        <div class="ph">
          <Eyebrow>Customer directory</Eyebrow>
          <h1 style="margin-top: 8px">{{ dirAll.length }} customers</h1>
          <p class="mut">Calinmeter HES & Beverly Customer Accounts. Search, filter, and inspect customer 360 profile, meter telemetry, and account balance.</p>
        </div>

        <!-- Beverly Filter Bar -->
        <div class="bw-card filter-card" style="margin-bottom: 16px">
          <div class="filter-grid">
            <div class="bw-field">
              <label class="bw-label">Search</label>
              <input
                v-model="dq"
                class="bw-input"
                placeholder="Search name, meter, or area..."
                @input="dpage = 0"
                aria-label="Filter directory"
              />
            </div>
            <div class="bw-field">
              <label class="bw-label">Account Status</label>
              <select v-model="dst" class="bw-select" @change="dpage = 0">
                <option value="">All statuses</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
            <div class="bw-field">
              <label class="bw-label">Tariff Band</label>
              <select v-model="dband" class="bw-select" @change="dpage = 0">
                <option value="">All bands</option>
                <option v-for="b in ['A', 'B', 'C', 'D', 'E']" :key="b" :value="b">Band {{ b }}</option>
              </select>
            </div>
            <div class="bw-field">
              <label class="bw-label">Customer Type</label>
              <select v-model="dtype" class="bw-select" @change="dpage = 0">
                <option value="">All types</option>
                <option value="customer">Customers</option>
                <option value="vendor">Vendors</option>
                <option value="both">Vendor & customer</option>
              </select>
            </div>
            <div class="bw-field">
              <label class="bw-label">Sort Order</label>
              <select v-model="dsort" class="bw-select">
                <option value="name">Name (A–Z)</option>
                <option value="debt">Debt (Highest first)</option>
              </select>
            </div>
            <div class="filter-actions">
              <button class="bw-btn bw-btn-ghost" @click="resetDirFilters">Reset</button>
            </div>
          </div>
        </div>

        <!-- Beverly Admin Table Structure -->
        <div class="bw-card flush bw-data-region" :data-view="dirViewMode">
          <div class="bw-table-head-bar">
            <div class="bw-table-heading">
              <div class="bw-table-title-row">
                <div class="bw-card-title">Customers directory</div>
                <span class="bw-table-count">{{ dirAll.length }}</span>
              </div>
              <div class="bw-card-sub">Calinmeter HES & Beverly Customer Accounts</div>
            </div>
            <div class="bw-table-actions">
              <WalletExportMenu
                :rows="dirExportRows"
                :columns="dirExportColumns"
                filename="beverly-customer-directory"
                title="Customer Directory"
                subtitle="Calinmeter HES & Beverly Accounts"
                label="Export"
              />
              <WalletDataViewSwitch v-model="dirViewMode" label="Customer directory view" />
            </div>
          </div>

          <!-- Table Mode -->
          <div v-show="dirViewMode === 'table'" class="bw-t-wrap">
            <table class="bw-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>DisCo</th>
                  <th>Meter</th>
                  <th>Area / Station</th>
                  <th>Band</th>
                  <th>Status</th>
                  <th style="text-align: right">Debt</th>
                  <th class="actions-col" style="text-align: right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in dirRows" :key="c.meter">
                  <td>
                    <div style="font-weight: 600">{{ c.name }}</div>
                    <div class="bw-muted" style="font-size: 11px">{{ c.addr }}</div>
                  </td>
                  <td class="bw-mono">{{ c.phone }}</td>
                  <td><span class="bw-badge info">{{ c.disco || 'AEDC' }}</span></td>
                  <td class="bw-mono">{{ c.meter }}</td>
                  <td>{{ c.area }}</td>
                  <td><span class="bw-badge neutral">Band {{ c.band }}</span></td>
                  <td>
                    <span class="bw-badge" :class="c.status === 'Active' ? 'success' : 'warn'">
                      {{ c.status }}
                    </span>
                  </td>
                  <td style="text-align: right" class="bw-mono bw-money">{{ money(c.debt) }}</td>
                  <td class="actions-col" style="text-align: right">
                    <button class="bw-btn sm primary" @click="pickCustomer(c); view = 'cust'">View 360°</button>
                  </td>
                </tr>
                <tr v-if="!dirRows.length">
                  <td colspan="9" class="bw-muted" style="text-align: center; padding: 32px">
                    No customers match the current filter criteria.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Grid / Card Mode -->
          <div v-show="dirViewMode === 'grid'" class="c-cards" style="padding: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px">
            <div v-for="c in dirRows" :key="c.meter" class="c-card" style="background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; padding: 14px">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px">
                <div>
                  <div style="font-weight: 700; font-size: 14px">{{ c.name }}</div>
                  <div class="bw-mono bw-muted" style="font-size: 11px">{{ c.phone }}</div>
                </div>
                <span class="bw-badge" :class="c.status === 'Active' ? 'success' : 'warn'">{{ c.status }}</span>
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px">
                <div>{{ c.addr }}</div>
                <div>Meter: <span class="bw-mono">{{ c.meter }}</span> ({{ c.disco || 'AEDC' }})</div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px dashed var(--border)">
                <div>
                  <span class="bw-badge neutral">Band {{ c.band }}</span>
                  <span v-if="c.debt > 0" class="bw-badge warn" style="margin-left: 4px">{{ money(c.debt) }}</span>
                </div>
                <button class="bw-btn sm primary" @click="pickCustomer(c); view = 'cust'">View 360°</button>
              </div>
            </div>
            <div v-if="!dirRows.length" class="bw-muted" style="grid-column: 1 / -1; text-align: center; padding: 32px">
              No customers match the current filter criteria.
            </div>
          </div>

          <!-- Pagination Bar -->
          <div class="bw-pagination-bar" style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border)">
            <div class="bw-muted" style="font-size: 13px">
              Showing {{ dirAll.length ? dpage * 10 + 1 : 0 }}–{{ Math.min((dpage + 1) * 10, dirAll.length) }} of {{ dirAll.length }} customers
            </div>
            <div style="display: flex; gap: 8px; align-items: center">
              <button class="bw-btn sm" :disabled="dpage === 0" @click="dpage--">Previous</button>
              <span class="bw-mono" style="font-size: 12px">Page {{ dpage + 1 }} / {{ dirPages }}</span>
              <button class="bw-btn sm" :disabled="dpage + 1 >= dirPages" @click="dpage++">Next</button>
            </div>
          </div>
        </div>
      </template>

      <!-- VIEW: RECORDINGS -->
      <template v-else-if="view === 'rec'">
        <div class="ph">
          <Eyebrow>Call recordings</Eyebrow>
          <h1 style="margin-top: 8px">Recording library</h1>
          <p class="mut">Calls are recorded from the agent microphone and saved in this browser with the transcript. Playback is logged. Only Admin can delete.</p>
        </div>

        <div v-if="!recs.length" class="card mut">No recordings yet. Answer a call and end it to save one.</div>

        <div v-for="r in recs" :key="r.id" class="card" style="margin-bottom: 10px">
          <div class="row">
            <b>{{ r.name }}</b>
            <span class="mono mut">{{ r.callId }}</span>
            <span class="grow"></span>
            <span class="chip">{{ fmt(r.dur) }}</span>
            <span class="mut">{{ r.t }}</span>
            <button class="btn sm" @click="exportRec(r)" title="Export audio or transcript">Export</button>
            <button v-if="can('admin')" class="btn sm dn" @click="delRec(r)">
              {{ cfm === r.id ? 'Confirm delete' : 'Delete' }}
            </button>
          </div>

          <audio v-if="r.url" :src="r.url" controls @play="emit('recording.played', { id: r.id })" style="width: 100%"></audio>
          <span v-else class="mut">Transcript only (microphone was unavailable).</span>

          <div class="row" v-if="can('monitor')" style="margin-top: 6px">
            <span class="mut">QA score</span>
            <button v-for="n in 5" :key="n" class="btn sm" :class="{ on: r.qa === n }" @click="scoreRecording(r, n)">{{ n }}</button>
          </div>
          <span v-else-if="r.qa" class="chip">QA {{ r.qa }}/5</span>

          <details style="margin-top: 6px">
            <summary style="cursor: pointer; font-size: 12.5px; font-weight: 500">Transcript</summary>
            <div v-for="(l, i) in r.tr" :key="i" class="mut" style="margin: 4px 0">{{ l }}</div>
          </details>
        </div>
      </template>

      <!-- VIEW: ACCESS & AUDIT -->
      <template v-else-if="view === 'acc'">
        <div class="ph">
          <Eyebrow>Access control</Eyebrow>
          <h1 style="margin-top: 8px">Roles, permissions and audit</h1>
          <p class="mut">You are signed in as {{ role }}. Switch role in the top bar to preview each experience.</p>
        </div>

        <div class="card sc2">
          <table>
            <thead>
              <tr><th>Permission</th><th>Agent</th><th>Supervisor</th><th>Auditor</th><th>Admin</th></tr>
            </thead>
            <tbody>
              <tr v-for="p in PLIST" :key="p[0]">
                <td>{{ p[1] }}</td>
                <td v-for="r in ['agent', 'supervisor', 'auditor', 'admin']" :key="r">
                  {{ PERMS[r].indexOf(p[0]) > -1 ? '✓ Yes' : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card" style="margin-top: 12px">
          <b>Audit trail</b>
          <div v-for="r in log.slice(0, 25)" :key="r.t + r.e" class="mut" style="margin: 3px 0">
            <span class="mono">{{ r.t }}</span> <span class="chip">{{ r.r }}</span> {{ r.e }}
          </div>
        </div>
      </template>

      <!-- FLOATING CALL CONTROLS PILL -->
      <div v-if="cur" class="ctl">
        <button class="cb" :class="{ on: cur.mute }" @click="cur.mute = !cur.mute" :aria-label="cur.mute ? 'Unmute' : 'Mute'">
          <Ic :n="cur.mute ? 'micoff' : 'mic'" />
        </button>
        <button class="cb" :class="{ on: cur.hold }" @click="cur.hold = !cur.hold" :aria-label="cur.hold ? 'Resume' : 'Hold'">
          <Ic :n="cur.hold ? 'play' : 'pause'" />
        </button>
        <button class="cb" :class="{ on: kp }" @click="kp = !kp; xf = false" aria-label="Keypad">
          <Ic n="grid" />
        </button>
        <button class="cb" :class="{ on: xf }" @click="xf = !xf; kp = false" aria-label="Transfer">
          <Ic n="swap" />
        </button>
        <button class="cb end" @click="endCall()" aria-label="End call">
          <Ic n="end" />
        </button>
      </div>

      <!-- KEYPAD POPUP -->
      <div v-if="kp && cur" class="pop">
        <div class="pad">
          <button v-for="k in '123456789*0#'.split('')" :key="k">{{ k }}</button>
        </div>
      </div>

      <!-- TRANSFER POPUP -->
      <div v-if="xf && cur" class="pop">
        <b>Transfer to</b>
        <button v-for="a in agents.filter(x => !x.me)" :key="a.n" class="btn sm" @click="doTransfer(a.n)">
          {{ a.n }}
        </button>
        <button class="btn sm" @click="doTransfer('Payments support')">Payments support</button>
        <button class="btn sm" @click="doTransfer('Field operations')">Field operations</button>
      </div>
    </main>

    <!-- Right Panel (Customer Context & Knowledge Base) -->
    <aside class="rp" aria-label="Customer context">
      <template v-if="cust">
        <SpotlightCard>
          <div class="row">
            <span class="av">{{ ini(cust.name) }}</span>
            <div>
              <b>{{ cust.name }}</b>
              <div class="mut">{{ cust.phone }}</div>
            </div>
          </div>
          <div class="row" style="margin-top: 6px">
            <span class="chip" :class="'t-' + (cust.type || 'customer')">{{ TL[cust.type || 'customer'] }}</span>
            <span class="chip" :class="{ bad: !verified }">{{ verified ? 'Verified' : 'Not verified' }}</span>
            <span class="chip">Band {{ cust.band }}</span>
            <span class="chip" :class="{ bad: cust.status !== 'Active' }">{{ cust.status }}</span>
          </div>
          <span class="mut" style="display: block; margin-top: 6px">
            {{ cust.addr }}<br>Meter <span class="mono">{{ cust.meter }}</span> | {{ cust.disco }}
          </span>
        </SpotlightCard>

        <div v-if="cust.flag" class="warnb">
          <b>Priority:</b> {{ cust.flag }}. Escalate outages immediately.
        </div>
        <div v-if="areaOutage" class="warnb">
          <b>Outage in {{ cust.area }}</b><br>{{ areaOutage.cause }}. ETA {{ areaOutage.eta }}
        </div>

        <div class="card">
          <b>Account</b>
          <div class="row"><span class="grow mut">Outstanding debt</span>{{ money(cust.debt) }}</div>
          <div class="row"><span class="grow mut">Last purchase</span>{{ money(cust.last.amt) }}</div>
          <div class="row"><span class="grow mut">Open tickets</span>{{ custTix.length }}</div>
        </div>

        <div v-if="cust.type !== 'customer'" class="card">
          <b>Vendor account</b>
          <div class="row"><span class="grow mut">Vendor ID</span><span class="mono">{{ cust.vid }}</span></div>
          <div class="row"><span class="grow mut">Float balance</span>{{ money(cust.float || 0) }}</div>
          <div class="row"><span class="grow mut">Commission</span>{{ cust.comm }}%</div>
          <div class="row"><span class="grow mut">Outlets</span>{{ cust.outlets }}</div>
        </div>

        <div v-if="cur" class="card">
          <b>Call notes</b>
          <textarea v-model="cur.notes" aria-label="Call notes"></textarea>
        </div>
      </template>

      <p v-else class="mut">Customer details appear here when a call connects or you search a meter number.</p>

      <div class="card">
        <b>Knowledge base</b>
        <input v-model="kbq" placeholder="Search articles" aria-label="Search knowledge base" />
        <div v-for="a in kbList" :key="a[0]" style="margin-top: 4px">
          <button class="btn sm" style="width: 100%; text-align: left; justify-content: flex-start;" @click="kbo = kbo === a[0] ? '' : a[0]">
            {{ a[0] }}
          </button>
          <p v-if="kbo === a[0]" class="mut" style="margin: 4px 2px 8px; font-size: 12px">{{ a[1] }}</p>
        </div>
      </div>
    </aside>

    <!-- INCOMING CALL SCREEN-POP (AFRICA'S TALKING DID DIALOG) -->
    <div v-if="ring" class="inc" role="alertdialog" aria-label="Incoming call">
      <div class="row">
        <span class="av">{{ ini(ring.c.cust.name) }}</span>
        <div>
          <b>{{ ring.c.cust.name }}</b>
          <span class="chip" :class="'t-' + (ring.c.cust.type || 'customer')" style="margin-left: 4px">
            {{ TL[ring.c.cust.type || 'customer'] }}
          </span>
          <div class="mut">{{ ring.c.skill }} | {{ ring.c.cust.area }}</div>
        </div>
      </div>
      <span v-if="ring.c.cust.flag" class="chip bad">{{ ring.c.cust.flag }}</span>
      <div class="row">
        <button class="btn pr grow" @click="acceptCall">Answer</button>
        <button class="btn grow" @click="declineCall">Decline</button>
      </div>
      <small class="mut">{{ Math.max(0, 20 - Math.floor(T - ring.at)) }}s left</small>
    </div>

    <!-- COMMAND PALETTE (CTRL K) -->
    <div v-if="pal" class="pal" @click.self="pal = false" role="dialog" aria-label="Command palette">
      <div>
        <input
          id="pi"
          v-model="pq"
          placeholder="Jump to a page or find a customer..."
          @keyup.enter="palItems.length && runPal(palItems[0])"
          @keyup.esc="pal = false"
          aria-label="Command palette"
        />
        <button v-for="it in palItems" :key="it.l" class="li" @click="runPal(it)">
          <div class="g"><b>{{ it.l }}</b></div>
          <span class="chip">{{ it.k }}</span>
        </button>
      </div>
    </div>

    <!-- ALERTS DIALOG -->
    <div v-if="notif" class="inc" role="dialog" aria-label="Alerts" style="right: 12px; top: 56px">
      <b>Alerts</b>
      <p v-if="!alerts.length" class="mut" style="margin: 0">All clear.</p>
      <button
        v-for="a in alerts"
        :key="a.k"
        class="btn sm"
        style="text-align: left; margin: 2px 0"
        @click="view = a.v; notif = false"
      >
        {{ a.t }}
      </button>
      <button class="btn" @click="notif = false">Close</button>
    </div>

    <!-- TOAST NOTIFICATION -->
    <div v-if="toastT" class="toast" role="status">{{ toastT }}</div>
  </div>
</template>
