<template>
  <AppShell title="Settlement Batches">
    <div class="bw-filter-bar">
      <WalletExportWizard
        :rows="filteredBatches"
        :columns="exportColumns"
        filename="settlement-batches"
        title="Settlement Batches"
        :subtitle="searchQ ? `Vendor search: ${searchQ}` : 'All vendor settlement batches'"
        :loading="loading"
        :status-options="[{ value: 'pending', label: 'Pending' }, { value: 'settled', label: 'Settled' }, { value: 'failed', label: 'Failed' }]"
        :date-value="(row: any) => row.created_at"
        :resolve-rows="resolveExportRows"
        allow-daily-csv-archive
      />
      <input v-model="search" class="bw-input bw-input-sm bw-mono" placeholder="Search vendor org…" @keyup.enter="applySearch" />
      <button class="bw-btn bw-btn-ghost bw-btn-sm" @click="applySearch">Search</button>
    </div>

    <div v-if="loading" class="bw-loading">Loadingâ€¦</div>
    <div v-else-if="error" class="bw-error-banner">{{ error }}</div>

    <div v-else>
      <div class="bw-table-wrapper">
        <table class="bw-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Vendor Org</th>
              <th>Period</th>
              <th>Gross</th>
              <th>Fee</th>
              <th>Net</th>
              <th>Status</th>
              <th>Created</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in filteredBatches" :key="b.id">
              <td class="bw-mono bw-text-sm">{{ b.id?.slice(0, 8) }}</td>
              <td class="bw-text-sm">{{ b.vendor_organizations?.trading_name || b.vendor_organizations?.legal_name || b.vendor_organization_id?.slice(0, 8) || 'â€”' }}</td>
              <td class="bw-text-sm">{{ fmtPeriod(b.period_start, b.period_end) }}</td>
              <td>{{ naira(b.gross_amount_minor) }}</td>
              <td>{{ naira(b.fee_minor) }}</td>
              <td :style="netStyle(b.net_amount_minor)"><strong>{{ naira(b.net_amount_minor) }}</strong></td>
              <td><span :class="statusClass(b.status)" class="bw-badge">{{ b.status }}</span></td>
              <td class="bw-text-sm">{{ fmtDate(b.created_at) }}</td>
              <td>
                <div class="receipt-actions">
                  <button class="bw-btn bw-btn-sm" @click="viewSettlementReceipt(b)">View</button>
                  <button class="bw-btn bw-btn-sm" @click="printSettlementReceipt(b)">Print</button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredBatches.length">
              <td colspan="9" class="bw-empty">No settlement batches found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards (â‰¤640px) -->
      <div class="bw-t-cards">
        <div v-if="!filteredBatches.length" class="bw-empty">No settlement batches found.</div>
        <div v-for="b in filteredBatches" :key="b.id" class="bw-tc">
          <div class="bw-tc-head">
            <span class="bw-mono" style="font-size:var(--t-sm)">{{ b.id?.slice(0, 8) }}</span>
            <span :class="statusClass(b.status)" class="bw-badge">{{ b.status }}</span>
          </div>
          <div class="bw-tc-mid">
            <div class="bw-tc-pair"><span class="bw-tc-pair-label">Vendor</span><span class="bw-tc-pair-val">{{ b.vendor_organizations?.legal_name || 'â€”' }}</span></div>
            <div class="bw-tc-pair"><span class="bw-tc-pair-label">Net</span><span class="bw-tc-pair-val" :style="netStyle(b.net_amount_minor)">{{ naira(b.net_amount_minor) }}</span></div>
            <div class="bw-tc-pair"><span class="bw-tc-pair-label">Period</span><span class="bw-tc-pair-val">{{ fmtPeriod(b.period_start, b.period_end) }}</span></div>
            <div class="bw-tc-pair"><span class="bw-tc-pair-label">Receipt</span><span class="receipt-actions"><button class="bw-btn bw-btn-sm" @click="viewSettlementReceipt(b)">View</button><button class="bw-btn bw-btn-sm" @click="printSettlementReceipt(b)">Print</button></span></div>
          </div>
        </div>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api, naira } from '../lib/api';
import AppShell from '../components/AppShell.vue';
import WalletExportWizard from '@beverly/tokens/WalletExportWizard.vue';
import type { WalletExportColumn } from '@beverly/tokens/wallet-export';
import type { WalletExportSelection } from '@beverly/tokens/wallet-export-wizard';
import { printReceipt, settlementReceipt, viewReceipt } from '../lib/receipts';

const allBatches = ref<any[]>([]);
const loading    = ref(false);
const error      = ref('');
const search     = ref('');
const searchQ    = ref('');

const filteredBatches = computed(() => {
  const q = searchQ.value.toLowerCase();
  return q
    ? allBatches.value.filter(b =>
        (b.vendor_organizations?.legal_name || '').toLowerCase().includes(q) ||
        (b.vendor_organizations?.trading_name || '').toLowerCase().includes(q) ||
        (b.vendor_organization_id || '').toLowerCase().includes(q)
      )
    : allBatches.value;
});

function applySearch() { searchQ.value = search.value; }

async function load() {
  loading.value = true;
  error.value   = '';
  try {
    const res = await api.get<{ batches?: any[] }>('/api/v1/admin/settlement');
    allBatches.value = res.batches ?? [];
  } catch (e: any) {
    error.value = e.message ?? 'Failed to load settlement batches';
  } finally {
    loading.value = false;
  }
}

function statusClass(s: string) {
  return {
    settled: 'bw-badge-success',
    pending: 'bw-badge-warning',
    failed:  'bw-badge-error',
  }[s] ?? 'bw-badge-neutral';
}

function netStyle(minor: number) {
  if (!minor) return '';
  return minor >= 0 ? 'color:var(--green)' : 'color:var(--red)';
}

function fmtPeriod(start: string, end: string) {
  if (!start && !end) return 'â€”';
  const fmt = (s: string) => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
  return start ? `${fmt(start)} â†’ ${fmt(end)}` : fmt(end);
}

function fmtDate(s: string) { return s ? new Date(s).toLocaleString() : 'â€”'; }

function vendorName(b: any) {
  return b.vendor_organizations?.trading_name || b.vendor_organizations?.legal_name || b.vendor_organization_id?.slice(0, 8) || 'â€”';
}

function viewSettlementReceipt(b: any) { viewReceipt(settlementReceipt(b)); }

function printSettlementReceipt(b: any) { printReceipt(settlementReceipt(b)); }

const exportColumns: WalletExportColumn<any>[] = [
    { key: 'id', header: 'Batch ID', value: (b) => b.id },
    { key: 'vendor', header: 'Vendor Org', value: vendorName },
    { key: 'period_start', header: 'Period Start', value: (b) => b.period_start },
    { key: 'period_end', header: 'Period End', value: (b) => b.period_end },
    { key: 'gross', header: 'Gross (â‚¦)', value: (b) => (b.gross_amount_minor ?? 0) / 100 },
    { key: 'fee', header: 'Fee (â‚¦)', value: (b) => (b.fee_minor ?? 0) / 100 },
    { key: 'net', header: 'Net (â‚¦)', value: (b) => (b.net_amount_minor ?? 0) / 100 },
    { key: 'status', header: 'Status', value: (b) => b.status },
    { key: 'created_at', header: 'Created', value: (b) => b.created_at },
  ];

async function resolveExportRows(selection: WalletExportSelection): Promise<any[]> {
  const rows: any[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  while (true) {
    const params = new URLSearchParams({ limit: '200' });
    if (cursor) params.set('cursor', cursor);
    const result: { batches: any[]; nextCursor: string | null } = await api.get(`/api/v1/admin/settlement?${params}`);
    rows.push(...(result.batches ?? []));
    cursor = result.nextCursor;
    if (!cursor) break;
    if (seenCursors.has(cursor)) throw new Error('Export pagination stalled. No partial file was created.');
    seenCursors.add(cursor);
  }
  const searchTerm = searchQ.value.trim().toLowerCase();
  const since = selection.since ? new Date(`${selection.since}T00:00:00`).getTime() : -Infinity;
  const until = selection.until ? new Date(`${selection.until}T23:59:59.999`).getTime() : Infinity;
  return rows.filter((row) => {
    const created = new Date(row.created_at).getTime();
    return (!searchTerm || [row.vendor_organizations?.legal_name, row.vendor_organizations?.trading_name, row.vendor_organization_id]
      .some((value) => String(value ?? '').toLowerCase().includes(searchTerm)))
      && (!selection.status || row.status === selection.status)
      && created >= since && created <= until;
  });
}

onMounted(load);
</script>

<style scoped>
.bw-filter-bar { display: flex; gap: .75rem; margin-bottom: 1rem; flex-wrap: wrap; }
.receipt-actions { display: inline-flex; gap: 4px; white-space: nowrap; }
</style>


