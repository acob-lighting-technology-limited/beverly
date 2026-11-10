<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSupportCentreStore } from '../stores/support-centre';
import type { CaseItem } from '../types';
import ResolveCaseModal from '../components/ResolveCaseModal.vue';
import EscalateModal from '../components/EscalateModal.vue';
import WalletExportMenu from '@beverly/tokens/WalletExportMenu.vue';
import type { WalletExportColumn } from '@beverly/tokens/wallet-export';

const store = useSupportCentreStore();

const statusFilter = ref<'all' | 'open' | 'escalated' | 'resolved'>('all');
const categoryFilter = ref('');
const searchQuery = ref('');

const selectedCase = ref<CaseItem | null>(null);
const showResolveModal = ref(false);
const showEscalateModal = ref(false);

const caseExportColumns: WalletExportColumn<CaseItem>[] = [
  { key: 'reference', header: 'Reference', value: (c) => `#${c.reference}` },
  { key: 'customer', header: 'Customer', value: (c) => c.customerName },
  { key: 'phone', header: 'Phone', value: (c) => c.customerPhone },
  { key: 'meter', header: 'Meter', value: (c) => c.meterNumber },
  { key: 'title', header: 'Summary', value: (c) => c.title },
  { key: 'category', header: 'Category', value: (c) => c.category.replace('_', ' ') },
  { key: 'priority', header: 'Priority', value: (c) => c.priority },
  { key: 'status', header: 'Status', value: (c) => c.status.replace('_', ' ') },
  { key: 'owner', header: 'Owner', value: (c) => c.owner },
  { key: 'lastPayment', header: 'Last Payment', value: (c) => c.lastPaymentSummary },
  { key: 'createdAt', header: 'Created', value: (c) => formatDate(c.createdAt) },
];

const filteredCases = computed(() => {
  return store.cases.filter((c) => {
    if (statusFilter.value === 'open' && c.status !== 'open' && c.status !== 'in_progress') return false;
    if (statusFilter.value === 'escalated' && !c.status.startsWith('escalated')) return false;
    if (statusFilter.value === 'resolved' && c.status !== 'resolved') return false;
    if (categoryFilter.value && c.category !== categoryFilter.value) return false;
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      return (
        c.reference.toLowerCase().includes(q) ||
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.includes(q) ||
        c.meterNumber.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q)
      );
    }
    return true;
  });
});

function openCaseDetail(c: CaseItem) {
  selectedCase.value = c;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div class="cases-page">
    <div class="page-head">
      <div>
        <h1>Cases & Investigations</h1>
        <p>Cross-department support tickets, SLA tracking and resolution governance.</p>
      </div>

      <div class="head-actions">
        <!-- Beverly Wallet Shared Export Wizard Menu -->
        <WalletExportMenu
          filename="beverly-support-cases"
          title="Beverly Support Cases"
          subtitle="Export of active and resolved customer cases"
          :rows="filteredCases"
          :columns="caseExportColumns"
        />
      </div>
    </div>

    <!-- Filters -->
    <div class="panel">
      <div class="panel-toolbar">
        <div class="filter-chips">
          <button :class="{ active: statusFilter === 'all' }" @click="statusFilter = 'all'">
            All Cases ({{ store.cases.length }})
          </button>
          <button :class="{ active: statusFilter === 'open' }" @click="statusFilter = 'open'">
            Open / Active
          </button>
          <button :class="{ active: statusFilter === 'escalated' }" @click="statusFilter = 'escalated'">
            Escalated (Finance/Field)
          </button>
          <button :class="{ active: statusFilter === 'resolved' }" @click="statusFilter = 'resolved'">
            Resolved
          </button>
        </div>

        <div class="search-filters">
          <select v-model="categoryFilter" class="category-select">
            <option value="">All Categories</option>
            <option value="token_vending">Token & Vending</option>
            <option value="meter_fault">Meter Fault & Hardware</option>
            <option value="balance_discrepancy">Balance & Wallet Deduction</option>
            <option value="tariff_query">Tariff & Billing Tier</option>
          </select>

          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search case #, customer, meter..."
            class="search-input"
          />
        </div>
      </div>

      <div class="table-responsive">
        <table class="cases-table">
          <thead>
            <tr>
              <th>Case ID</th>
              <th>Customer</th>
              <th>Issue Summary</th>
              <th>Category</th>
              <th>Priority</th>
              <th>SLA</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in filteredCases"
              :key="c.id"
              :class="{ highlighted: selectedCase?.id === c.id }"
              @click="openCaseDetail(c)"
            >
              <td>
                <b class="case-ref">#{{ c.reference }}</b>
              </td>
              <td>
                <div class="customer-cell">
                  <strong>{{ c.customerName }}</strong>
                  <small>{{ c.customerPhone }} · Meter {{ c.meterNumber }}</small>
                </div>
              </td>
              <td class="title-cell">
                <strong>{{ c.title }}</strong>
                <small class="truncate-notes">{{ c.notes }}</small>
              </td>
              <td>
                <span class="category-pill">{{ c.category.replace('_', ' ') }}</span>
              </td>
              <td>
                <span class="badge" :class="c.priority">{{ c.priority }}</span>
              </td>
              <td>
                <span v-if="c.status !== 'resolved'" class="sla-badge" :class="{ overdue: c.slaRemainingMinutes <= 15 }">
                  {{ c.slaRemainingMinutes }}m left
                </span>
                <span v-else class="sla-met">Met SLA</span>
              </td>
              <td>
                <span class="status-pill" :class="c.status">
                  {{ c.status.replace('_', ' ') }}
                </span>
              </td>
              <td>
                <small class="mono-date">{{ formatDate(c.createdAt) }}</small>
              </td>
              <td class="text-right" @click.stop>
                <button class="btn btn-view" @click="openCaseDetail(c)">
                  Inspect ↗
                </button>
              </td>
            </tr>
            <tr v-if="filteredCases.length === 0">
              <td colspan="9" class="empty-cell">
                No cases found for the selected criteria.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Case Details Drawer / Modal -->
    <div v-if="selectedCase" class="case-drawer-overlay" @click.self="selectedCase = null">
      <div class="case-drawer">
        <div class="drawer-header">
          <div>
            <div class="drawer-kicker">CASE FILE · #{{ selectedCase.reference }}</div>
            <h2>{{ selectedCase.title }}</h2>
          </div>
          <button class="btn-close" @click="selectedCase = null">✕</button>
        </div>

        <div class="drawer-body">
          <div class="drawer-grid">
            <div class="drawer-field">
              <label>Customer</label>
              <b>{{ selectedCase.customerName }} ({{ selectedCase.customerPhone }})</b>
            </div>
            <div class="drawer-field">
              <label>Meter Number</label>
              <b>{{ selectedCase.meterNumber }}</b>
            </div>
            <div class="drawer-field">
              <label>Category</label>
              <b>{{ selectedCase.category.replace('_', ' ').toUpperCase() }}</b>
            </div>
            <div class="drawer-field">
              <label>Case Owner</label>
              <b>{{ selectedCase.owner }}</b>
            </div>
            <div class="drawer-field">
              <label>Last Payment Evidence</label>
              <b>{{ selectedCase.lastPaymentSummary }}</b>
            </div>
            <div class="drawer-field">
              <label>Purchase Delivery Status</label>
              <b>{{ selectedCase.purchaseStatus }}</b>
            </div>
          </div>

          <div class="drawer-notes">
            <label>Case Log & Agent Notes</label>
            <div class="notes-content">
              {{ selectedCase.notes }}
            </div>
          </div>

          <div v-if="selectedCase.resolutionCode" class="resolution-banner">
            <strong>Resolved: {{ selectedCase.resolutionCode }}</strong>
            <small>Resolved at {{ formatDate(selectedCase.resolvedAt || selectedCase.createdAt) }}</small>
          </div>
        </div>

        <div class="drawer-footer">
          <button class="btn btn-cancel" @click="selectedCase = null">Close</button>
          <button
            v-if="selectedCase.status !== 'resolved'"
            class="btn btn-escalate-action"
            @click="showEscalateModal = true"
          >
            Escalate to Department
          </button>
          <button
            v-if="selectedCase.status !== 'resolved'"
            class="btn btn-resolve-action"
            @click="showResolveModal = true"
          >
            Resolve Case ✓
          </button>
        </div>
      </div>
    </div>

    <ResolveCaseModal v-if="showResolveModal" @close="showResolveModal = false; selectedCase = null" />
    <EscalateModal v-if="showEscalateModal" @close="showEscalateModal = false; selectedCase = null" />
  </div>
</template>

<style scoped>
.cases-page {
  padding: 24px 30px 40px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 20px;
}

.head-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.page-head h1 {
  font-family: var(--display);
  font-size: 24px;
  margin: 0;
  color: var(--ink);
  letter-spacing: -0.6px;
}

.page-head p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.panel {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--r);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.panel-toolbar {
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-chips {
  display: flex;
  gap: 8px;
}

.filter-chips button {
  padding: 6px 12px;
  border-radius: var(--r-sm);
  border: 1px solid var(--line);
  background: var(--card);
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-chips button.active {
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-color: var(--brand);
}

.search-filters {
  display: flex;
  gap: 10px;
}

.category-select,
.search-input {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-sm);
  font-size: 12px;
  background: var(--card);
  color: var(--ink);
}

.table-responsive {
  overflow-x: auto;
}

.cases-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}

.cases-table th {
  padding: 12px 18px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
  background: var(--card-subtle);
}

.cases-table td {
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
  cursor: pointer;
}

.cases-table tr:hover {
  background: var(--card-subtle);
}

.cases-table tr.highlighted {
  background: var(--brand-soft);
}

.case-ref {
  font-family: var(--mono);
  color: var(--brand-deep);
}

.customer-cell strong {
  display: block;
}

.customer-cell small {
  color: var(--muted);
}

.title-cell strong {
  display: block;
}

.truncate-notes {
  display: block;
  color: var(--muted);
  font-size: 11px;
  max-width: 280px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-pill {
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
  background: var(--card-subtle);
  padding: 2px 8px;
  border-radius: 4px;
}

.badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  text-transform: capitalize;
}

.badge.urgent, .badge.high {
  background: var(--red-soft);
  color: var(--red);
}

.badge.normal, .badge.low {
  background: var(--card-subtle);
  color: var(--muted);
}

.sla-badge {
  font-size: 11px;
  font-weight: 700;
  font-family: var(--mono);
  color: var(--amber-text);
  background: var(--amber-soft);
  padding: 2px 6px;
  border-radius: 4px;
}

.sla-badge.overdue {
  color: var(--red);
  background: var(--red-soft);
}

.sla-met {
  font-size: 11px;
  font-weight: 700;
  color: var(--brand-deep);
}

.status-pill {
  font-size: 11px;
  font-weight: 700;
  text-transform: capitalize;
  padding: 3px 8px;
  border-radius: 4px;
}

.status-pill.open {
  background: var(--blue-soft);
  color: var(--blue);
}

.status-pill.escalated_finance, .status-pill.escalated_field {
  background: var(--amber-soft);
  color: var(--amber-text);
}

.status-pill.resolved {
  background: var(--brand-soft);
  color: var(--brand-deep);
}

.mono-date {
  font-family: var(--mono);
  color: var(--muted);
}

.btn-view {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--line-strong);
  background: var(--card);
  border-radius: var(--r-sm);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.text-right {
  text-align: right;
}

.empty-cell {
  text-align: center;
  padding: 40px;
  color: var(--muted);
}

/* ════════════ Case Drawer ════════════ */
.case-drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  justify-content: flex-end;
}

.case-drawer {
  width: 100%;
  max-width: 540px;
  background: var(--card);
  height: 100vh;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.drawer-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.drawer-kicker {
  font: 11px var(--mono);
  color: var(--brand-deep);
  font-weight: 700;
}

.drawer-header h2 {
  margin: 4px 0 0;
  font-size: 18px;
  color: var(--ink);
}

.btn-close {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--muted);
  cursor: pointer;
}

.drawer-body {
  padding: 24px;
  flex: 1;
}

.drawer-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.drawer-field label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin-bottom: 4px;
}

.drawer-field b {
  font-size: 13px;
  color: var(--ink);
}

.drawer-notes label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin-bottom: 8px;
}

.notes-content {
  background: var(--card-subtle);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 14px;
  font-size: 13px;
  color: var(--ink);
  line-height: 1.5;
  white-space: pre-wrap;
}

.resolution-banner {
  margin-top: 20px;
  padding: 14px;
  border-radius: 6px;
  background: var(--brand-soft);
  border: 1px solid var(--brand);
}

.resolution-banner strong {
  display: block;
  color: var(--brand-deep);
  font-size: 13px;
}

.resolution-banner small {
  display: block;
  color: var(--muted);
  margin-top: 4px;
}

.drawer-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--line);
  background: var(--canvas);
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn {
  height: 38px;
  padding: 0 16px;
  border-radius: var(--r-sm);
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
}

.btn-cancel {
  background: var(--card);
  border: 1px solid var(--line-strong);
  color: var(--ink);
}

.btn-escalate-action {
  background: var(--card);
  border: 1px solid var(--amber);
  color: var(--amber-text);
}

.btn-resolve-action {
  background: var(--brand);
  border: 1px solid var(--brand);
  color: oklch(18% 0.02 145);
}
</style>
