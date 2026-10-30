<script setup lang="ts">
/**
 * Customer detail (super-admin).
 *
 * Tabs: Overview · Wallet (+ledger) · Purchases · Funding
 * Action: suspend / reactivate (ConfirmDialog + reason, audit-logged).
 *
 * Endpoints:
 *   GET   /api/v1/admin/customers/:id
 *   GET   /api/v1/admin/customers/:id/wallet
 *   GET   /api/v1/admin/customers/:id/purchases
 *   GET   /api/v1/admin/customers/:id/funding
 *   PATCH /api/v1/admin/customers/:id/status
 */
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import WalletExportMenu from '@beverly/tokens/WalletExportMenu.vue';
import type { WalletExportColumn } from '@beverly/tokens/wallet-export';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import MobileActionMenu from '../components/MobileActionMenu.vue';
import { api, naira, shortDate, ApiError } from '../lib/api';
import { stationDisplayLabel } from '@beverly/tokens/station-identity';

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;

type Tab = 'overview' | 'meters' | 'wallet' | 'purchases' | 'funding';
const tab = ref<Tab>('overview');
const overviewView = ref<'grid' | 'table'>('grid');

const detail = ref<any>(null);
const loading = ref(true);
const banner = ref<{ tone: 'success' | 'error'; text: string } | null>(null);

// Lazy per-tab data
const wallet = ref<any>(null);
const purchases = ref<any[]>([]);
interface MeterLink { id: string; meter_id: string; station_id?: string | null; status: string; nickname?: string | null; alias?: string | null; meter_name?: string | null; meter_type?: string | null }
const meters = ref<MeterLink[]>([]);
const metersLoading = ref(true);
const metersError = ref('');
const purchasesLoaded = ref(false);
const purchasesError = ref('');
const purchasesLoading = ref(false);
const purchaseScope = ref<'linked' | 'account'>('linked');
let purchaseRequest = 0;
const selectedMeter = ref('all');
const funding = ref<any[]>([]);
const tabLoading = ref(false);
const walletQuery = ref('');
const walletDirection = ref<'all' | 'credit' | 'debit'>('all');
const purchaseQuery = ref('');
const purchaseStatus = ref('all');
const fundingQuery = ref('');
const fundingChannel = ref<'all' | 'paystack' | 'bank_transfer'>('all');

async function loadDetail() {
    loading.value = true;
    try {
        detail.value = await api.get<any>(`/api/v1/admin/customers/${id}`);
    } catch (e: any) {
        banner.value = { tone: 'error', text: e?.message ?? 'Could not load customer.' };
    } finally { loading.value = false; }
}

async function loadMeters() {
    metersLoading.value = true;
    metersError.value = '';
    try {
        const result = await api.get<{ meters: MeterLink[] }>(`/api/v1/admin/customers/${id}/meters`);
        if (!Array.isArray(result.meters)) throw new Error('Meter links are unavailable.');
        meters.value = result.meters;
        if (selectedMeter.value !== 'all' && !meters.value.some((meter) => meter.status === 'approved' && meter.meter_id === selectedMeter.value)) selectedMeter.value = 'all';
        if (purchasesLoaded.value && purchaseScope.value === 'linked') {
            purchases.value = [];
            purchasesLoaded.value = false;
            if (tab.value === 'purchases') void switchTab('purchases');
        }
    } catch (e: any) {
        meters.value = [];
        metersError.value = e?.message ?? 'Could not load linked meters.';
    } finally { metersLoading.value = false; }
}

async function switchTab(t: Tab) {
    tab.value = t;
    if (t === 'wallet' && !wallet.value) {
        tabLoading.value = true;
        try { wallet.value = await loadAllCustomerHistory(`/api/v1/admin/customers/${id}/wallet`, 'entries'); }
        catch (e: any) { banner.value = { tone: 'error', text: e?.message ?? 'Could not load wallet history.' }; }
        finally { tabLoading.value = false; }
    }
    if (t === 'purchases' && !purchasesLoaded.value && !purchasesLoading.value) await loadPurchases();
    if (t === 'funding' && !funding.value.length) {
        tabLoading.value = true;
        try { funding.value = (await loadAllCustomerHistory(`/api/v1/admin/customers/${id}/funding`, 'funding')).funding; }
        catch (e: any) { banner.value = { tone: 'error', text: e?.message ?? 'Could not load funding history.' }; }
        finally { tabLoading.value = false; }
    }
}

async function loadPurchases() {
    const request = ++purchaseRequest;
    purchasesLoading.value = true;
    purchasesError.value = '';
    try {
        const scope = purchaseScope.value === 'linked' ? '?scope=linked' : '';
        const result = await loadAllCustomerHistory(`/api/v1/admin/customers/${id}/purchases${scope}`, 'purchases');
        if (request !== purchaseRequest) return;
        purchases.value = result.purchases;
        purchasesLoaded.value = true;
    } catch (e: any) {
        if (request === purchaseRequest) purchasesError.value = e?.message ?? 'Could not load purchase history.';
    } finally {
        if (request === purchaseRequest) purchasesLoading.value = false;
    }
}

function changePurchaseScope() {
    selectedMeter.value = 'all';
    purchases.value = [];
    purchasesLoaded.value = false;
    void loadPurchases();
}

async function loadAllCustomerHistory(path: string, key: string) {
    let cursor: string | null = null;
    let first: any = null;
    const rows: any[] = [];
    const seen = new Set<string>();
    do {
        const params = new URLSearchParams({ limit: '200' });
        if (cursor) params.set('cursor', cursor);
        const page: any = await api.get(`${path}${path.includes('?') ? '&' : '?'}${params}`);
        if (!Array.isArray(page[key])) throw new Error('History data is unavailable.');
        first ??= page;
        rows.push(...(page[key] ?? []));
        cursor = page.nextCursor ?? null;
        if (cursor && seen.has(cursor)) throw new Error('History pagination repeated a page.');
        if (cursor) seen.add(cursor);
    } while (cursor);
    return { ...(first ?? {}), [key]: rows, nextCursor: null };
}

// ─ Status action ──────────────────────────────────────────────
const statusOpen = ref(false);
const statusTarget = ref<'active' | 'suspended' | 'closed'>('suspended');
const statusReason = ref('');
const statusBusy = ref(false);

const statusTone = computed<'brand' | 'danger' | 'warn'>(() =>
    statusTarget.value === 'suspended' ? 'warn' : statusTarget.value === 'closed' ? 'danger' : 'brand',
);
const statusLabel = computed(() => ({ active: 'Reactivate customer', suspended: 'Suspend customer', closed: 'Close account' }[statusTarget.value]));
const reasonValid = computed(() => statusTarget.value === 'active' || statusReason.value.trim().length >= 4);

function askStatus(next: 'active' | 'suspended' | 'closed') {
    statusTarget.value = next;
    statusReason.value = '';
    statusOpen.value = true;
}

async function doStatus() {
    if (!reasonValid.value) return;
    statusBusy.value = true;
    banner.value = null;
    try {
        const body: Record<string, unknown> = { status: statusTarget.value };
        if (statusReason.value.trim()) body.reason = statusReason.value.trim();
        await api.patch(`/api/v1/admin/customers/${id}/status`, body);
        statusOpen.value = false;
        banner.value = { tone: 'success', text: `Customer → ${statusTarget.value}.` };
        await loadDetail();
    } catch (e: any) {
        const msg = e instanceof ApiError ? `${e.message} (${e.code})` : e?.message ?? 'Update failed.';
        banner.value = { tone: 'error', text: msg };
        statusOpen.value = false;
    } finally { statusBusy.value = false; }
}

// ─ Helpers ───────────────────────────────────────────────────
function statusBadge(s: string) { return ({ active: 'success', suspended: 'warn', closed: 'danger' } as Record<string, string>)[s] ?? 'neutral'; }
function tierBadge(t: number) { return t >= 2 ? 'success' : t === 1 ? 'info' : 'neutral'; }
function purchaseBadge(s: string) {
    return ({ delivered: 'success', completed: 'success', token_issued: 'success', failed: 'danger', refunded: 'info' } as Record<string, string>)[s] ?? 'neutral';
}
function fundingBadge(s: string) {
    return ({ success: 'success', succeeded: 'success', approved: 'success', initiated: 'warn', pending: 'warn', proof_uploaded: 'warn', under_review: 'warn', failed: 'danger', rejected: 'danger', abandoned: 'neutral' } as Record<string, string>)[s] ?? 'neutral';
}
function dirSign(d: string) { return d === 'credit' ? '+' : '−'; }
function normalizedFundingChannel(row: any) { return row.gateway ?? row.channel ?? '—'; }
function normalizedFundingReference(row: any) { return row.gateway_reference ?? row.funding_reference ?? '—'; }
const filteredWalletEntries = computed(() => (wallet.value?.entries ?? []).filter((entry: any) => {
  const query = walletQuery.value.trim().toLowerCase();
  return (!query || [entry.entry_type, entry.reference_id, entry.description].filter(Boolean).join(' ').toLowerCase().includes(query))
    && (walletDirection.value === 'all' || entry.direction === walletDirection.value);
}));
const approvedMeters = computed(() => meters.value.filter((meter) => meter.status === 'approved'));
const missingMeterStations = computed(() => approvedMeters.value.some((meter) => !meter.station_id));
const meterPurchases = computed(() => purchases.value.filter((purchase: any) => selectedMeter.value === 'all' || purchase.meter_id === selectedMeter.value));
const purchaseAnalytics = computed(() => {
  const completed = meterPurchases.value.filter((purchase: any) => ['delivered', 'completed'].includes(purchase.status));
  return {
    count: meterPurchases.value.length,
    completedCount: completed.length,
    completedValue: completed.reduce((sum: number, purchase: any) => sum + Number(purchase.amount_minor || 0), 0),
  };
});
const filteredPurchases = computed(() => meterPurchases.value.filter((purchase: any) => {
  const query = purchaseQuery.value.trim().toLowerCase();
  return (!query || [purchase.meter_id, purchase.station_id, stationDisplayLabel(purchase.station_id), purchase.id].filter(Boolean).join(' ').toLowerCase().includes(query))
    && (purchaseStatus.value === 'all' || purchase.status === purchaseStatus.value);
}));
const filteredFunding = computed(() => funding.value.filter((row: any) => {
  const query = fundingQuery.value.trim().toLowerCase();
  const channel = normalizedFundingChannel(row);
  return (!query || [normalizedFundingReference(row), channel, row.status].join(' ').toLowerCase().includes(query))
    && (fundingChannel.value === 'all' || channel === fundingChannel.value);
}));

const overviewFields = computed(() => detail.value ? [
    { label: 'Customer ID', value: detail.value.customer.id, mono: true },
    { label: 'Auth user', value: detail.value.customer.auth_user_id || '—', mono: true },
    { label: 'Phone', value: detail.value.customer.phone || '—', mono: true },
    { label: 'Email', value: detail.value.customer.email || '—', mono: true },
    { label: 'KYC tier', value: `Tier ${detail.value.customer.kyc_tier} (${detail.value.customer.kyc_status})` },
    { label: 'Account status', value: detail.value.customer.status },
    { label: 'Wallet', value: detail.value.wallet?.id || 'not provisioned', mono: true },
    { label: 'Joined', value: new Date(detail.value.customer.created_at).toLocaleString() },
] : []);

const detailExportRows = computed<any[]>(() => {
  if (tab.value === 'overview') return overviewFields.value;
  if (tab.value === 'wallet') return filteredWalletEntries.value;
  if (tab.value === 'purchases') return filteredPurchases.value;
  if (tab.value === 'funding') return filteredFunding.value;
  return [];
});
const detailStatusOptions = computed(() => {
  const source: any[] = tab.value === 'wallet' ? wallet.value?.entries ?? []
    : tab.value === 'purchases' ? purchases.value : tab.value === 'funding' ? funding.value : [];
  return [...new Set(source.map((row: any) => String(tab.value === 'wallet' ? row.entry_type ?? '' : row.status ?? '')).filter(Boolean))]
    .map((value) => ({ value, label: value.replace(/_/g, ' ') }));
});
const detailExportColumns = computed<WalletExportColumn<any>[]>(() => {
  if (tab.value === 'overview') return [
    { key: 'label', header: 'Field', value: (row) => row.label },
    { key: 'value', header: 'Value', value: (row) => row.value },
  ];
  if (tab.value === 'wallet') return [
    { key: 'created_at', header: 'When', value: (row) => shortDate(row.created_at) },
    { key: 'entry_type', header: 'Type', value: (row) => row.entry_type?.replace(/_/g, ' ') },
    { key: 'direction', header: 'Direction', value: (row) => row.direction },
    { key: 'amount_minor', header: 'Amount', value: (row) => naira(row.amount_minor) },
    { key: 'balance_after_minor', header: 'Balance', value: (row) => naira(row.balance_after_minor) },
  ];
  if (tab.value === 'purchases') return [
    { key: 'created_at', header: 'When', value: (row) => shortDate(row.created_at) },
    { key: 'meter_id', header: 'Meter', value: (row) => row.meter_id },
    { key: 'station_id', header: 'Station', value: (row) => stationDisplayLabel(row.station_id) },
    { key: 'actor_type', header: 'Purchased by', value: (row) => row.actor_type || '—' },
    ...(purchaseScope.value === 'linked' ? [{ key: 'match_basis', header: 'Match basis', value: (row: any) => row.match_basis === 'meter_station_installation' ? 'Meter, station and installation' : 'Meter and station' }] : []),
    { key: 'amount_minor', header: 'Paid', value: (row) => naira(row.amount_minor) },
    { key: 'energy_amount_minor', header: 'Energy value', value: (row) => row.energy_amount_minor == null ? '—' : naira(row.energy_amount_minor) },
    { key: 'vat_amount_minor', header: 'VAT', value: (row) => row.vat_amount_minor == null ? '—' : naira(row.vat_amount_minor) },
    { key: 'status', header: 'Status', value: (row) => row.status },
  ];
  return [
    { key: 'created_at', header: 'When', value: (row) => shortDate(row.created_at) },
    { key: 'gateway_reference', header: 'Reference', value: normalizedFundingReference },
    { key: 'gateway', header: 'Channel', value: normalizedFundingChannel },
    { key: 'amount_minor', header: 'Amount', value: (row) => naira(row.amount_minor) },
    { key: 'status', header: 'Status', value: (row) => row.status },
  ];
});

function viewMeterPurchases(meter: MeterLink) {
    selectedMeter.value = meter.meter_id;
    void switchTab('purchases');
}

onMounted(() => { void loadDetail(); void loadMeters(); });
</script>

<template>
  <AppShell title="Customer">
    <div class="back-row">
      <button class="bw-btn sm" @click="router.push('/customers')">← Customers</button>
    </div>

    <transition name="banner">
      <div v-if="banner" :class="['bw-banner', banner.tone]" role="status">
        {{ banner.text }}
        <button class="bw-banner-x" @click="banner = null" aria-label="Dismiss">×</button>
      </div>
    </transition>

    <div v-if="loading" class="bw-card empty">Loading…</div>

    <template v-else-if="detail">
      <!-- Header card -->
      <div class="bw-card head-card">
        <div class="head-main">
          <div class="avatar">{{ (detail.customer.full_name ?? '?')[0]?.toUpperCase() }}</div>
          <div>
            <h1 class="head-name">{{ detail.customer.full_name || 'Unnamed customer' }}</h1>
            <p class="head-meta bw-mono">{{ detail.customer.phone }} · {{ detail.customer.email || 'no email' }}</p>
            <div class="head-badges">
              <span class="bw-badge info bw-mono">Station{{ detail.customer.station_ids?.length === 1 ? '' : 's' }} · {{ detail.customer.station_ids?.map(stationDisplayLabel).join(', ') || 'Unassigned' }}</span>
              <span :class="['bw-badge', statusBadge(detail.customer.status)]">{{ detail.customer.status }}</span>
              <span :class="['bw-badge', tierBadge(detail.customer.kyc_tier)]">KYC Tier {{ detail.customer.kyc_tier }}</span>
              <span class="bw-badge neutral">{{ detail.customer.kyc_status }}</span>
            </div>
          </div>
        </div>
        <div class="head-actions">
          <div class="head-action-buttons">
            <button v-if="detail.customer.status === 'active'" class="bw-btn" @click="askStatus('suspended')">Suspend</button>
            <button v-if="detail.customer.status === 'suspended'" class="bw-btn primary" @click="askStatus('active')">Reactivate</button>
            <button v-if="detail.customer.status !== 'closed'" class="bw-btn danger" @click="askStatus('closed')">Close</button>
          </div>
          <MobileActionMenu label="Customer actions">
            <button v-if="detail.customer.status === 'active'" class="mobile-action-item" @click="askStatus('suspended')">Suspend</button>
            <button v-if="detail.customer.status === 'suspended'" class="mobile-action-item primary" @click="askStatus('active')">Reactivate</button>
            <button v-if="detail.customer.status !== 'closed'" class="mobile-action-item danger" @click="askStatus('closed')">Close</button>
          </MobileActionMenu>
        </div>
      </div>

      <!-- Stat tiles -->
      <div class="stat-grid bw-mobile-kpi-grid">
        <div class="stat-tile brand">
          <p class="stat-label">Wallet balance</p>
          <p class="stat-value">{{ naira(detail.balance_minor) }}</p>
          <p class="stat-sub">Available {{ naira(detail.available_minor) }}</p>
        </div>
        <div class="stat-tile">
          <p class="stat-label">Total funded</p>
          <p class="stat-value">{{ naira(detail.stats.fundingValueMinor) }}</p>
          <p class="stat-sub">{{ detail.stats.fundingCount }} top-ups</p>
        </div>
        <div class="stat-tile">
          <p class="stat-label">Total spent</p>
          <p class="stat-value">{{ naira(detail.stats.purchaseValueMinor) }}</p>
          <p class="stat-sub">{{ detail.stats.purchaseCount }} customer purchases</p>
        </div>
        <button type="button" class="stat-tile meter-tile" @click="switchTab('meters')">
          <p class="stat-label">Linked meters</p>
          <p class="stat-value">{{ detail.stats.meterCount }}</p>
          <p class="stat-sub">View meter links →</p>
        </button>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button v-for="t in (['overview','meters','wallet','purchases','funding'] as const)" :key="t"
                :class="['tab', { active: tab === t }]" @click="switchTab(t)">
          {{ t }}
        </button>
        <WalletExportMenu
          v-if="tab !== 'meters'"
          :rows="detailExportRows"
          :columns="detailExportColumns"
          :filename="`beverly-admin-customer-${tab}`"
          :title="`Customer ${tab}`"
          :subtitle="detail?.full_name || detail?.email || 'Customer record'"
          :loading="loading || tabLoading || purchasesLoading"
          :date-value="tab === 'overview' ? undefined : (row: any) => row.created_at"
          :status-options="detailStatusOptions"
          :status-label="tab === 'wallet' ? 'Entry type' : 'Status'"
          :status-value="(row: any) => tab === 'wallet' ? row.entry_type : row.status"
          :allow-daily-csv-archive="tab !== 'overview'"
        />
      </div>

      <!-- Overview -->
      <div v-if="tab === 'overview'" class="bw-card overview-card">
        <div class="overview-head">
          <h2>Account details</h2>
          <div class="overview-view-toggle" aria-label="Account details layout">
            <button type="button" :class="{ active: overviewView === 'grid' }" :aria-pressed="overviewView === 'grid'" aria-label="Grid view" title="Grid view" @click="overviewView = 'grid'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button type="button" :class="{ active: overviewView === 'table' }" :aria-pressed="overviewView === 'table'" aria-label="Table view" title="Table view" @click="overviewView = 'table'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="1" /><path d="M3 9h18M9 4v16" />
              </svg>
            </button>
          </div>
        </div>
        <dl :class="['ov-dl', `ov-dl--${overviewView}`]">
          <div v-for="field in overviewFields" :key="field.label" class="ov-item">
            <dt>{{ field.label }}</dt>
            <dd :class="{ 'bw-mono': field.mono }">{{ field.value }}</dd>
          </div>
        </dl>
      </div>

      <section v-else-if="tab === 'meters'" class="bw-card meter-list" aria-labelledby="meter-links-title">
        <div class="meter-list-heading">
          <div><h2 id="meter-links-title">Meter links</h2><p>Approved meters provide purchase histories.</p></div>
          <button type="button" class="bw-btn sm" :disabled="metersLoading" @click="loadMeters">Refresh</button>
        </div>
        <p v-if="metersLoading" role="status">Loading meter links…</p>
        <div v-else-if="metersError" class="bw-alert danger" role="alert">{{ metersError }}</div>
        <p v-else-if="!meters.length" class="bw-muted">No meter links found.</p>
        <ul v-else class="meter-links">
          <li v-for="meter in meters" :key="meter.id" class="meter-link">
            <div><strong class="bw-mono">{{ meter.meter_id }}</strong><p>{{ meter.nickname || meter.alias || meter.meter_name || 'Meter' }} · {{ meter.station_id || 'Station unavailable' }}</p></div>
            <div class="meter-link-actions"><span :class="['bw-badge', meter.status === 'approved' ? 'success' : 'neutral']">{{ meter.status }}</span><button type="button" class="bw-btn sm" :disabled="meter.status !== 'approved'" @click="viewMeterPurchases(meter)">View purchases</button></div>
          </li>
        </ul>
      </section>

      <!-- Wallet -->
      <div v-else-if="tab === 'wallet'" class="bw-card flush">
        <div v-if="tabLoading" class="empty bw-muted">Loading…</div>
        <template v-else-if="wallet">
          <div class="wallet-head">
            <div>
              <p class="stat-label">Balance</p>
              <p class="wallet-bal">{{ naira(wallet.balance_minor) }}</p>
              <p class="stat-sub">Available {{ naira(wallet.available_minor) }} · Holds {{ naira(wallet.holds_minor) }}</p>
            </div>
            <router-link :to="`/wallets`" class="bw-btn sm" style="text-decoration: none">All wallets →</router-link>
          </div>
          <div class="detail-filter-row">
            <input v-model="walletQuery" class="bw-input" placeholder="Search wallet entries" aria-label="Search wallet entries" />
            <select v-model="walletDirection" class="bw-select" aria-label="Filter wallet direction">
              <option value="all">All movements</option><option value="credit">Credits</option><option value="debit">Debits</option>
            </select>
          </div>
          <ul class="ledger-list">
            <li v-for="e in filteredWalletEntries" :key="e.id" class="ledger-row">
              <span class="bw-mono ledger-when">{{ shortDate(e.created_at) }}</span>
              <span class="bw-mono ledger-type">{{ e.entry_type.replace(/_/g, ' ') }}</span>
              <span class="bw-money ledger-amt" :class="e.direction">{{ dirSign(e.direction) }}{{ naira(e.amount_minor) }}</span>
              <span class="bw-money bw-muted ledger-bal">{{ naira(e.balance_after_minor) }}</span>
            </li>
            <li v-if="!filteredWalletEntries.length" class="bw-muted empty">No wallet entries match these filters.</li>
          </ul>
        </template>
        <div v-else class="empty bw-muted">No wallet provisioned for this customer.</div>
      </div>

      <!-- Purchases -->
      <div v-else-if="tab === 'purchases'" class="bw-card flush">
        <div v-if="purchasesLoading" class="empty bw-muted">Loading…</div>
        <div v-else-if="purchasesError" class="purchase-error" role="alert">{{ purchasesError }} <button type="button" class="bw-btn sm" @click="switchTab('purchases')">Retry</button></div>
        <div v-else-if="metersLoading" class="empty bw-muted" role="status">Loading meter links…</div>
        <div v-else-if="metersError" class="purchase-error" role="alert">{{ metersError }} <button type="button" class="bw-btn sm" @click="loadMeters">Retry</button></div>
        <div v-else>
          <div class="meter-purchase-summary">
            <label for="purchase-scope">Purchase scope</label>
            <select id="purchase-scope" v-model="purchaseScope" class="bw-select" aria-label="Purchase scope" @change="changePurchaseScope">
              <option value="linked">Linked meter purchases</option>
              <option value="account">Customer account purchases</option>
            </select>
            <label for="purchase-meter">Select meter</label>
            <select id="purchase-meter" v-model="selectedMeter" class="bw-select" aria-label="Select meter">
              <option value="all">{{ purchaseScope === 'linked' ? 'All approved meters' : 'All account purchases' }}</option>
              <option v-for="meter in approvedMeters" :key="meter.id" :value="meter.meter_id">{{ meter.meter_id }}{{ meter.nickname ? ` · ${meter.nickname}` : '' }}</option>
            </select>
            <p v-if="purchaseScope === 'linked'">Matched by meter and station. Purchases may predate this link.</p>
            <p v-else>Purchases made by this customer account.</p>
            <p>Completed totals use delivered or completed orders.</p>
            <p v-if="purchaseScope === 'linked' && missingMeterStations" role="status">Meters without stations cannot be matched.</p>
            <div class="purchase-analytics" aria-label="Purchase analytics">
              <div><span>Recorded purchases</span><strong>{{ purchaseAnalytics.count }}</strong></div>
              <div><span>Completed purchases</span><strong>{{ purchaseAnalytics.completedCount }}</strong></div>
              <div><span>Completed value</span><strong>{{ naira(purchaseAnalytics.completedValue) }}</strong></div>
            </div>
          </div>
          <div class="detail-filter-row">
            <input v-model="purchaseQuery" class="bw-input" placeholder="Meter, station, or order" aria-label="Search purchases" />
            <select v-model="purchaseStatus" class="bw-select" aria-label="Filter purchase status">
              <option value="all">All statuses</option><option value="delivered">Delivered</option><option value="completed">Completed</option><option value="token_issued">Token issued</option><option value="failed">Failed</option><option value="refunded">Refunded</option>
            </select>
          </div>
        <div class="bw-t-wrap">
          <table class="bw-table">
            <thead><tr><th>When</th><th>Meter</th><th>Station</th><th>Purchased by</th><th v-if="purchaseScope === 'linked'">Match basis</th><th style="text-align:right">Paid</th><th style="text-align:right">Energy value</th><th style="text-align:right">VAT</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="p in filteredPurchases" :key="p.id">
                <td class="bw-mono bw-muted" style="font-size: var(--t-xs)">{{ shortDate(p.created_at) }}</td>
                <td class="bw-mono">{{ p.meter_id }}</td>
                <td class="bw-mono bw-muted">{{ stationDisplayLabel(p.station_id) || '—' }}</td>
                <td>{{ p.actor_type || '—' }}</td>
                <td v-if="purchaseScope === 'linked'">{{ p.match_basis === 'meter_station_installation' ? 'Meter, station and installation' : 'Meter and station' }}</td>
                <td class="bw-money" style="text-align: right">{{ naira(p.amount_minor) }}</td>
                <td class="bw-money" style="text-align: right">{{ p.energy_amount_minor == null ? '—' : naira(p.energy_amount_minor) }}</td>
                <td class="bw-money" style="text-align: right">{{ p.vat_amount_minor == null ? '—' : naira(p.vat_amount_minor) }}</td>
                <td><span :class="['bw-badge', purchaseBadge(p.status)]">{{ p.status }}</span></td>
              </tr>
              <tr v-if="!filteredPurchases.length"><td :colspan="purchaseScope === 'linked' ? 9 : 8" class="bw-muted empty">No purchases match these filters.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      </div>

      <!-- Funding -->
      <div v-else-if="tab === 'funding'" class="bw-card flush">
        <div v-if="tabLoading" class="empty bw-muted">Loading…</div>
        <div v-else>
          <div class="detail-filter-row">
            <input v-model="fundingQuery" class="bw-input" placeholder="Reference or status" aria-label="Search funding" />
            <select v-model="fundingChannel" class="bw-select" aria-label="Filter funding channel">
              <option value="all">All channels</option><option value="paystack">Paystack</option><option value="bank_transfer">Bank transfer</option>
            </select>
          </div>
        <div class="bw-t-wrap">
          <table class="bw-table">
            <thead><tr><th>When</th><th>Reference</th><th>Channel</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="f in filteredFunding" :key="f.id">
                <td class="bw-mono bw-muted" style="font-size: var(--t-xs)">{{ shortDate(f.created_at) }}</td>
                <td class="bw-mono" style="font-size: var(--t-xs)">{{ normalizedFundingReference(f) }}</td>
                <td><span class="bw-badge neutral">{{ normalizedFundingChannel(f) }}</span></td>
                <td class="bw-money" style="text-align: right">{{ naira(f.amount_minor) }}</td>
                <td><span :class="['bw-badge', fundingBadge(f.status)]">{{ f.status }}</span></td>
              </tr>
              <tr v-if="!filteredFunding.length"><td colspan="5" class="bw-muted empty">No funding records match these filters.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </template>

    <!-- Status confirm -->
    <ConfirmDialog
      v-model:open="statusOpen"
      :title="statusLabel"
      :description="detail ? `Change ${detail.customer.full_name || 'this customer'} → ${statusTarget}. Audit-logged.` : ''"
      :confirm-label="statusLabel"
      :tone="statusTone"
      :loading="statusBusy"
      :disable-confirm="!reasonValid"
      @confirm="doStatus"
    >
      <template v-if="statusTarget !== 'active'">
        <label class="cd-input-label">Reason *</label>
        <textarea v-model="statusReason" rows="3" class="cd-input" placeholder="e.g. Repeated chargeback fraud." />
        <p class="cd-input-hint">Minimum 4 characters.</p>
      </template>
    </ConfirmDialog>

  </AppShell>
</template>

<style scoped>
.back-row { margin-bottom: var(--s-3); }
.bw-banner { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); padding: var(--s-3) var(--s-4); border-radius: var(--r-md); margin-bottom: var(--s-3); font-size: var(--t-sm); border: 1px solid; }
.bw-banner.success { background: oklch(from var(--brand) l c h / 0.08); border-color: oklch(from var(--brand) l c h / 0.30); color: var(--brand); }
.bw-banner.error { background: oklch(from var(--danger) l c h / 0.08); border-color: oklch(from var(--danger) l c h / 0.30); color: var(--danger); }
.bw-banner-x { background: transparent; border: none; color: inherit; cursor: pointer; font-size: 18px; padding: 2px 8px; opacity: 0.7; }
.banner-enter-active, .banner-leave-active { transition: all 0.20s var(--ease-out); }
.banner-enter-from { opacity: 0; transform: translateY(-4px); }
.empty { text-align: center; padding: var(--s-6); }

.head-card { display: flex; justify-content: space-between; align-items: start; gap: var(--s-4); flex-wrap: wrap; margin-bottom: var(--s-3); }
.head-main { display: flex; gap: var(--s-4); align-items: center; }
.avatar { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, var(--brand-300), var(--brand-600)); display: grid; place-items: center; font-size: 24px; font-weight: 700; color: oklch(8% 0.04 145); flex-shrink: 0; }
.head-name { margin: 0 0 4px; font-size: var(--t-xl); }
.head-meta { font-size: var(--t-sm); color: var(--text-muted); margin: 0 0 var(--s-2); }
.head-badges { display: flex; gap: var(--s-2); flex-wrap: wrap; }
.head-actions { display: flex; gap: var(--s-2); align-items: center; }
.head-action-buttons { display: flex; gap: var(--s-2); align-items: center; }

.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--s-3); margin-bottom: var(--s-3); }
.stat-tile { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: var(--r-lg); padding: var(--s-4); position: relative; overflow: hidden; backdrop-filter: blur(16px) saturate(150%); -webkit-backdrop-filter: blur(16px) saturate(150%); box-shadow: var(--glass-shine), var(--glass-shadow-card); }
.stat-tile.brand { background: linear-gradient(135deg, oklch(from var(--brand) l c h / 0.08), transparent); border-color: oklch(from var(--brand) l c h / 0.25); }
.stat-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin: 0 0 6px; }
.stat-value { font-family: var(--font-mono); font-weight: 700; font-size: var(--t-lg); margin: 0; }
.stat-tile.brand .stat-value { color: var(--brand); }
.stat-sub { font-size: var(--t-xs); color: var(--text-muted); margin: 4px 0 0; }
.meter-tile { width: 100%; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.meter-tile:focus-visible { outline: 2px solid var(--brand); outline-offset: 3px; }
.meter-list-heading { display: flex; justify-content: space-between; align-items: start; gap: var(--s-3); }
.meter-list-heading h2 { margin: 0; font-size: var(--t-lg); }
.meter-list-heading p, .meter-link p, .meter-purchase-summary p { margin: var(--s-1) 0 0; color: var(--text-muted); font-size: var(--t-sm); }
.meter-links { list-style: none; margin: var(--s-4) 0 0; padding: 0; display: grid; gap: var(--s-2); }
.meter-link { display: flex; justify-content: space-between; align-items: center; gap: var(--s-3); padding: var(--s-3); border: 1px solid var(--border); border-radius: var(--r-md); }
.meter-link-actions { display: flex; align-items: center; gap: var(--s-2); }
.meter-purchase-summary { padding: var(--s-4); border-bottom: 1px solid var(--border); }
.meter-purchase-summary label { display: block; margin-bottom: var(--s-1); font-weight: 700; }
.meter-purchase-summary label:not(:first-child) { margin-top: var(--s-3); }
.meter-purchase-summary select { max-width: 28rem; }
.purchase-analytics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s-3); margin-top: var(--s-4); }
.purchase-analytics div { display: grid; gap: var(--s-1); min-width: 0; }
.purchase-analytics span { color: var(--text-muted); font-size: var(--t-xs); }
.purchase-analytics strong { overflow-wrap: anywhere; }
.purchase-error { padding: var(--s-4); color: var(--danger); }

.tabs { display: flex; flex-wrap: wrap; gap: var(--s-2); margin-bottom: var(--s-3); border-bottom: 1px solid var(--border); }
.tab { background: transparent; border: none; padding: 10px 16px; color: var(--text-muted); font-weight: 600; font-size: var(--t-sm); cursor: pointer; border-bottom: 2px solid transparent; text-transform: capitalize; }
.tab:hover { color: var(--text); }
.tab.active { color: var(--brand); border-bottom-color: var(--brand); }

.overview-head { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); margin-bottom: var(--s-4); }
.overview-head h2 { margin: 0; font-size: var(--t-lg); }
.overview-view-toggle { display: inline-flex; gap: 2px; padding: 3px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); }
.overview-view-toggle button { width: 36px; height: 34px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--text-muted); cursor: pointer; }
.overview-view-toggle button:hover { color: var(--text); }
.overview-view-toggle button.active { background: var(--brand-glow); color: var(--brand); }
.overview-view-toggle svg { width: 17px; height: 17px; }
.ov-dl { margin: 0; font-size: var(--t-sm); }
.ov-dl--grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--s-5); }
.ov-dl--table .ov-item { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: var(--s-3); }
.ov-item { min-width: 0; padding: var(--s-3) 0; border-bottom: 1px solid var(--border); }
.ov-item dt { color: var(--text-muted); }
.ov-item dd { min-width: 0; margin: 4px 0 0; overflow-wrap: anywhere; }
.ov-dl--table .ov-item dd { margin-top: 0; }

.wallet-head { display: flex; justify-content: space-between; align-items: start; padding: var(--s-4); border-bottom: 1px solid var(--border); }
.detail-filter-row { display: flex; gap: var(--s-2); padding: var(--s-3) var(--s-4); border-bottom: 1px solid var(--border); }
.detail-filter-row .bw-input { min-width: 0; flex: 1; }
.detail-filter-row .bw-select { width: min(190px, 45%); }
.wallet-bal { font-family: var(--font-mono); font-weight: 700; font-size: var(--t-2xl); color: var(--brand); margin: 4px 0 6px; }

.ledger-list { list-style: none; margin: 0; padding: var(--s-2) var(--s-4) var(--s-4); }
.ledger-row { display: grid; grid-template-columns: 90px 1fr auto auto; gap: var(--s-3); align-items: center; padding: 8px 0; border-top: 1px solid var(--border); font-size: var(--t-xs); }
.ledger-when { color: var(--text-muted); }
.ledger-type { font-weight: 600; }
.ledger-amt { font-weight: 700; }
.ledger-amt.credit { color: var(--brand); }
.ledger-amt.debit { color: var(--text); }
.ledger-bal { font-size: 10px; }

:deep(.cd-body) .cd-input-label { display: block; font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; }
:deep(.cd-body) .cd-input { width: 100%; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 10px 12px; color: var(--text); font-size: var(--t-sm); font-family: inherit; resize: vertical; }
:deep(.cd-body) .cd-input:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-glow); }
:deep(.cd-body) .cd-input-hint { font-size: var(--t-xs); color: var(--text-muted); margin: 6px 0 0; }

@media (max-width: 640px) {
  .head-card { flex-direction: column; }
  .head-actions { width: 100%; justify-content: flex-end; }
  .head-action-buttons { display: none; }
  .ov-dl--table .ov-item { grid-template-columns: 110px minmax(0, 1fr); gap: var(--s-3); }
  .ledger-row { grid-template-columns: 1fr auto; }
  .detail-filter-row { flex-direction: column; }
  .detail-filter-row .bw-select { width: 100%; }
  .meter-link { align-items: flex-start; flex-direction: column; }
  .meter-link-actions { width: 100%; justify-content: space-between; }
  .purchase-analytics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ledger-when, .ledger-bal { grid-column: 1 / -1; opacity: 0.7; }
}
</style>
