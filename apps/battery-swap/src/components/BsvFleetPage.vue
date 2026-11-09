<template>
  <section class="bsv-fleet-page" aria-label="Bike & Battery Registry">
    <!-- Page header -->
    <header class="bsv-fleet-header">
      <div class="bsv-fleet-header-left">
        <h1 class="bsv-fleet-title">Bike &amp; Battery Registry</h1>
        <p class="bsv-fleet-subtitle">{{ fleetStore.totalBikes }} EV Bikes tracked via Yunhe IoT GPS</p>
      </div>
      <div class="bsv-fleet-header-actions">
        <button class="bsv-btn bsv-btn--ghost" @click="exportCsv">↓ Export CSV</button>
        <button class="bsv-btn bsv-btn--primary" @click="openSwap(null)">⚡ Record Swap</button>
      </div>
    </header>

    <!-- Swap Notification Toast -->
    <div v-if="swapToast" class="bsv-swap-toast" role="status" aria-live="polite">
      <span class="bsv-toast-text">{{ swapToast }}</span>
      <button class="bsv-toast-close" aria-label="Dismiss message" @click="swapToast = null">✕</button>
    </div>

    <!-- ── Beverly Wallet Standard Fleet KPIs ────────────────── -->
    <section class="bw-kpi-grid bsv-fleet-kpi-grid" aria-label="Fleet Summary KPIs">
      <article class="bw-kpi featured">
        <div class="bw-kpi-row">
          <span class="bw-kpi-label">TOTAL FLEET</span>
          <span class="bw-kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 9l3-4h3l2 4"/><path d="M19 17.5V14l-4-4"/>
            </svg>
          </span>
        </div>
        <strong class="bw-kpi-value">{{ fleetStore.totalBikes }}</strong>
        <span class="bw-kpi-note">Active EV Fleet in Registry</span>
      </article>

      <article class="bw-kpi info-tone">
        <div class="bw-kpi-row">
          <span class="bw-kpi-label">ON THE ROAD</span>
          <span class="bw-kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>
            </svg>
          </span>
        </div>
        <strong class="bw-kpi-value text-success">{{ onlineCount }}</strong>
        <span class="bw-kpi-note">Transmitting Live Telemetry</span>
      </article>

      <article class="bw-kpi warn-tone">
        <div class="bw-kpi-row">
          <span class="bw-kpi-label">IDLE / PARKED</span>
          <span class="bw-kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </span>
        </div>
        <strong class="bw-kpi-value text-warning">{{ idleCount }}</strong>
        <span class="bw-kpi-note">Stationary or Off-Shift</span>
      </article>

      <article class="bw-kpi danger-tone">
        <div class="bw-kpi-row">
          <span class="bw-kpi-label">IMPOUNDED</span>
          <span class="bw-kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M12 9v4M12 17h.01"/><path d="M10.3 3.3L2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"/>
            </svg>
          </span>
        </div>
        <strong class="bw-kpi-value text-danger">{{ impoundedCount }}</strong>
        <span class="bw-kpi-note">Security Hold / Arrears</span>
      </article>
    </section>

    <!-- Filters toolbar -->
    <div class="bsv-fleet-toolbar">
      <input
        v-model="search"
        class="bsv-toolbar-search"
        placeholder="Search bike, rider, plate or battery SN..."
        type="search"
      />
      <select v-model="filterStatus" class="bsv-toolbar-select">
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="idle">Idle</option>
        <option value="impounded">Impounded</option>
      </select>
      <select v-model="filterSoc" class="bsv-toolbar-select">
        <option value="all">All Charge Levels</option>
        <option value="low">Low (&lt;20%)</option>
        <option value="medium">Medium (20–60%)</option>
        <option value="high">High (&gt;60%)</option>
      </select>
      <button
        class="bsv-pill-filter"
        :class="{ 'bsv-pill-filter--active': filterSoc === 'low' }"
        @click="filterSoc = filterSoc === 'low' ? 'all' : 'low'"
      >⚡ Needs Swap (&lt;20%)</button>
      <span class="bsv-fleet-count">{{ filteredBikes.length }} bikes</span>
    </div>

    <!-- Table -->
    <div class="bsv-fleet-table-wrap">
      <table class="bsv-fleet-table" aria-label="Bike registry">
        <thead>
          <tr>
            <th>Bike &amp; Model</th>
            <th>Assigned Rider</th>
            <th>Battery SN</th>
            <th>Charge Level</th>
            <th>Voltage</th>
            <th>Speed / Odo</th>
            <th>Location</th>
            <th>Motor</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="bike in pageBikes"
            :key="bike.id"
            :class="{
              'bsv-row--low': bike.telemetry.soc < 20,
              'bsv-row--impounded': bike.status === 'impounded'
            }"
          >
            <td>
              <div class="bsv-bike-id-cell">
                <span class="bsv-bike-id">{{ bike.id }}</span>
                <span class="bsv-bike-model">{{ bike.model }}</span>
              </div>
            </td>
            <td>
              <div class="bsv-rider-cell">
                <span class="bsv-rider-name">{{ bike.riderName }}</span>
                <span class="bsv-rider-phone">{{ bike.riderPhone }}</span>
              </div>
            </td>
            <td><span class="bsv-mono bsv-sn">{{ bike.batterySn }}</span></td>
            <td>
              <div class="bsv-soc-cell">
                <div class="bsv-soc-bar-wrap">
                  <div
                    class="bsv-soc-bar"
                    :style="{
                      width: bike.telemetry.soc + '%',
                      background: socGradient(bike.telemetry.soc)
                    }"
                  ></div>
                </div>
                <span class="bsv-soc-pct" :style="{ color: socColor(bike.telemetry.soc) }">
                  {{ bike.telemetry.soc }}%
                </span>
              </div>
            </td>
            <td class="bsv-td-center">{{ bike.telemetry.voltage }}V</td>
            <td class="bsv-td-center">
              <span v-if="bike.telemetry.speed > 0">{{ bike.telemetry.speed }} km/h</span>
              <span v-else class="bsv-muted">Parked</span>
              <span class="bsv-odo"> · {{ bike.telemetry.mileage.toFixed(0) }}km</span>
            </td>
            <td>
              <span class="bsv-location">{{ bike.telemetry.city }}</span>
              <span v-if="!bike.telemetry.online" class="bsv-offline-tag">offline</span>
            </td>
            <td>
              <span class="bsv-motor-badge" :class="bike.telemetry.d_fet ? 'bsv-motor-badge--on' : 'bsv-motor-badge--off'">
                {{ bike.telemetry.d_fet ? 'Enabled' : 'Disabled' }}
              </span>
            </td>
            <td>
              <div class="bsv-row-actions">
                <button class="bsv-action-btn" @click="openCrm(bike)">View Rider</button>
                <button class="bsv-action-btn bsv-action-btn--primary" @click="openSwap(bike)">Swap</button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredBikes.length === 0">
            <td colspan="9" class="bsv-table-empty">No bikes match your filters</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="bsv-pagination" v-if="totalPages > 1">
      <button class="bsv-page-btn" :disabled="page === 1" @click="page--">‹ Prev</button>
      <span class="bsv-page-info">Page {{ page }} of {{ totalPages }}</span>
      <button class="bsv-page-btn" :disabled="page === totalPages" @click="page++">Next ›</button>
    </div>

    <!-- Modals -->
    <BikeCustomerCrmModal
      v-if="crmBikeId"
      :bike-id="crmBikeId"
      @close="crmBikeId = null"
      @record-payment="handleRecordPayment"
    />
    <BatterySwapStationModal
      v-if="swapBikeId !== undefined"
      :initial-bike-id="swapBikeId"
      :bike-id="swapBikeId"
      :stations="fleetStore.stations"
      :bikes="fleetStore.bikes"
      @close="swapBikeId = undefined"
      @execute-swap="handleExecuteSwap"
    />
  </section>
</template>

<script>
import { useBatteryFleetStore } from "../stores/battery-fleet-store.js";
import BikeCustomerCrmModal from "./BikeCustomerCrmModal.vue";
import BatterySwapStationModal from "./BatterySwapStationModal.vue";

const PAGE_SIZE = 50;

export default {
  name: "BsvFleetPage",
  components: { BikeCustomerCrmModal, BatterySwapStationModal },
  props: {
    route: { type: Object, default: () => ({}) }
  },
  setup() {
    const fleetStore = useBatteryFleetStore();
    return { fleetStore };
  },
  data() {
    return {
      search: "",
      filterStatus: "all",
      filterSoc: "all",
      page: 1,
      crmBikeId: null,
      swapBikeId: undefined,
      swapToast: null
    };
  },
  computed: {
    onlineCount() {
      return this.fleetStore.bikes.filter(b => b.telemetry.online).length;
    },
    idleCount() {
      return this.fleetStore.bikes.filter(b => b.status === "idle").length;
    },
    impoundedCount() {
      return this.fleetStore.bikes.filter(b => b.status === "impounded").length;
    },
    filteredBikes() {
      let list = this.fleetStore.bikes;
      if (this.filterStatus !== "all") list = list.filter(b => b.status === this.filterStatus);
      if (this.filterSoc === "low") list = list.filter(b => b.telemetry.soc < 20);
      else if (this.filterSoc === "medium") list = list.filter(b => b.telemetry.soc >= 20 && b.telemetry.soc <= 60);
      else if (this.filterSoc === "high") list = list.filter(b => b.telemetry.soc > 60);
      if (this.search.trim()) {
        const q = this.search.toLowerCase();
        list = list.filter(b =>
          b.id.toLowerCase().includes(q) ||
          b.plateNumber.toLowerCase().includes(q) ||
          b.riderName.toLowerCase().includes(q) ||
          b.batterySn.toLowerCase().includes(q) ||
          b.telemetry.city.toLowerCase().includes(q)
        );
      }
      return list;
    },
    totalPages() {
      return Math.max(1, Math.ceil(this.filteredBikes.length / PAGE_SIZE));
    },
    pageBikes() {
      const start = (this.page - 1) * PAGE_SIZE;
      return this.filteredBikes.slice(start, start + PAGE_SIZE);
    }
  },
  watch: {
    filteredBikes() { this.page = 1; }
  },
  methods: {
    socColor(soc) {
      if (soc > 60) return "#22c55e";
      if (soc >= 20) return "#f59e0b";
      return "#ef4444";
    },
    socGradient(soc) {
      const c = this.socColor(soc);
      return c;
    },
    openCrm(bike) {
      this.crmBikeId = bike.id;
    },
    openSwap(bike) {
      this.swapBikeId = bike ? bike.id : (this.fleetStore.selectedBikeId || this.fleetStore.bikes[0]?.id || "");
    },
    handleExecuteSwap(swap) {
      const bikeId = swap?.bikeId || this.swapBikeId || "Bike";
      const packSn = swap?.batteryOutSn ? `#${swap.batteryOutSn.slice(-6)}` : "Fresh pack";
      this.swapToast = `⚡ Swap recorded successfully for ${bikeId}! Battery ${packSn} (100% full) is active.`;
      setTimeout(() => {
        if (this.swapToast?.includes(bikeId)) {
          this.swapToast = null;
        }
      }, 5000);
    },
    handleRecordPayment(payment) {
      const amt = payment?.amountMinor ? (payment.amountMinor / 100).toLocaleString() : "0";
      this.swapToast = `✅ Payment of ₦${amt} recorded successfully.`;
      setTimeout(() => {
        this.swapToast = null;
      }, 4000);
    },
    exportCsv() {
      const headers = ["Bike ID", "Model", "Plate", "Rider", "Battery SN", "SOC%", "Voltage", "Speed", "Mileage", "City", "Motor", "Status"];
      const rows = this.filteredBikes.map(b => [
        b.id, b.model, b.plateNumber, b.riderName, b.batterySn,
        b.telemetry.soc, b.telemetry.voltage, b.telemetry.speed,
        b.telemetry.mileage, b.telemetry.city,
        b.telemetry.d_fet ? "Enabled" : "Disabled", b.status
      ]);
      const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
      const a = document.createElement("a");
      a.href = "data:text/csv," + encodeURIComponent(csv);
      a.download = "beverly-fleet-" + new Date().toISOString().slice(0,10) + ".csv";
      a.click();
    }
  }
};
</script>

<style scoped>
.bsv-fleet-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--acob-bg);
  color: var(--acob-text);
  font-family: var(--acob-font-sans);
}

/* Header */
.bsv-fleet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
  flex-shrink: 0;
}
.bsv-fleet-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--acob-text);
  margin: 0 0 4px;
}
.bsv-fleet-subtitle {
  font-size: 12.5px;
  color: var(--acob-muted);
  margin: 0;
}
.bsv-fleet-header-actions { display: flex; gap: 8px; }

.bsv-swap-toast {
  margin: 12px 24px 0;
  padding: 10px 16px;
  border-radius: var(--acob-radius-md, 8px);
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.35);
  color: var(--acob-brand-mint, #7dfc9a);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.82rem;
  font-weight: 600;
  animation: slide-in 0.25s ease;
}

.bsv-toast-close {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0 4px;
  opacity: 0.75;
}
.bsv-toast-close:hover { opacity: 1; }

@keyframes slide-in {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
.bsv-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.bsv-btn--ghost {
  background: transparent;
  border: 1px solid var(--acob-line);
  color: var(--acob-muted);
}
.bsv-btn--ghost:hover { background: var(--acob-chip); color: var(--acob-text); }
.bsv-btn--primary {
  background: rgba(0,128,0,0.10);
  border: 1px solid rgba(0,128,0,0.35);
  color: var(--acob-brand);
}
.bsv-btn--primary:hover { background: rgba(0,128,0,0.18); }

/* Fleet KPI Grid */
.bsv-fleet-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px 24px 0;
  flex-shrink: 0;
}

.bsv-fleet-kpi-grid .bw-kpi {
  background: var(--acob-surface, rgba(10, 22, 15, 0.96));
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: var(--acob-radius-lg, 12px);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 108px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.bsv-fleet-kpi-grid .bw-kpi:hover {
  border-color: var(--acob-line-strong, rgba(125, 252, 154, 0.28));
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.bsv-fleet-kpi-grid .bw-kpi.featured {
  border-color: rgba(34, 197, 94, 0.35);
  background: radial-gradient(120% 80% at 0% 0%, rgba(34, 197, 94, 0.10), transparent 50%), var(--acob-surface, rgba(10, 22, 15, 0.96));
}

.bsv-fleet-kpi-grid .bw-kpi-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.bsv-fleet-kpi-grid .bw-kpi-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
}

.bsv-fleet-kpi-grid .bw-kpi-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
}

.bsv-fleet-kpi-grid .bw-kpi.featured .bw-kpi-icon {
  background: rgba(34, 197, 94, 0.16);
  color: var(--acob-brand-mint, #7dfc9a);
}

.bsv-fleet-kpi-grid .bw-kpi.info-tone .bw-kpi-icon {
  background: rgba(34, 197, 94, 0.16);
  color: #22c55e;
}

.bsv-fleet-kpi-grid .bw-kpi.warn-tone .bw-kpi-icon {
  background: rgba(245, 158, 11, 0.16);
  color: #f59e0b;
}

.bsv-fleet-kpi-grid .bw-kpi.danger-tone .bw-kpi-icon {
  background: rgba(239, 68, 68, 0.16);
  color: #ef4444;
}

.bsv-fleet-kpi-grid .bw-kpi-value {
  font-size: 1.65rem;
  font-weight: 800;
  font-family: var(--acob-font-mono, monospace);
  line-height: 1.1;
  color: var(--acob-text, #f2f7f3);
}

.bsv-fleet-kpi-grid .text-success { color: var(--color-success, #22c55e) !important; }
.bsv-fleet-kpi-grid .text-warning { color: var(--color-warning, #f59e0b) !important; }
.bsv-fleet-kpi-grid .text-danger { color: var(--color-danger, #ef4444) !important; }

.bsv-fleet-kpi-grid .bw-kpi-note {
  font-size: 0.72rem;
  color: var(--acob-subtle, rgba(242, 247, 243, 0.45));
}
.bsv-tile {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 12px;
}
.bsv-tile-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}
.bsv-tile-icon svg { width: 20px; height: 20px; }
.bsv-tile-icon--blue { background: rgba(0,128,0,0.12); color: var(--acob-brand); }
.bsv-tile-icon--green { background: rgba(34,197,94,0.12); color: var(--acob-brand-bright); }
.bsv-tile-icon--amber { background: rgba(245,158,11,0.12); color: var(--acob-gold); }
.bsv-tile-icon--red { background: rgba(239,68,68,0.12); color: var(--color-danger); }
.bsv-tile-body { display: flex; flex-direction: column; }
.bsv-tile-value { font-size: 24px; font-weight: 800; color: var(--acob-text); line-height: 1.2; }
.bsv-tile-value--green { color: var(--acob-brand-bright); }
.bsv-tile-value--amber { color: var(--acob-gold); }
.bsv-tile-value--red { color: var(--color-danger); }
.bsv-tile-label { font-size: 11.5px; color: var(--acob-muted); margin-top: 2px; }

/* Toolbar */
.bsv-fleet-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.bsv-toolbar-search {
  flex: 1;
  min-width: 220px;
  padding: 8px 12px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 8px;
  color: var(--acob-text);
  font-size: 13px;
  outline: none;
}
.bsv-toolbar-search:focus { border-color: rgba(0,128,0,0.4); }
.bsv-toolbar-search::placeholder { color: var(--color-text-faint); }
.bsv-toolbar-select {
  padding: 8px 10px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 8px;
  color: var(--acob-text);
  font-size: 12.5px;
  outline: none;
  cursor: pointer;
}
.bsv-toolbar-select option { background: var(--acob-panel); }
.bsv-pill-filter {
  padding: 7px 12px;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 20px;
  color: var(--color-danger);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.bsv-pill-filter--active { background: rgba(239,68,68,0.18); border-color: rgba(239,68,68,0.5); }
.bsv-fleet-count { font-size: 12px; color: var(--acob-muted); margin-left: 4px; white-space: nowrap; }

/* Table */
.bsv-fleet-table-wrap {
  flex: 1;
  overflow: auto;
  padding: 0 24px;
}
.bsv-fleet-table-wrap::-webkit-scrollbar { height: 4px; width: 4px; }
.bsv-fleet-table-wrap::-webkit-scrollbar-track { background: transparent; }
.bsv-fleet-table-wrap::-webkit-scrollbar-thumb { background: rgba(21,128,61,0.30); border-radius: 2px; }

.bsv-fleet-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12.5px;
}
.bsv-fleet-table thead th {
  position: sticky;
  top: 0;
  padding: 10px 12px;
  background: var(--acob-panel);
  color: var(--acob-muted);
  text-align: left;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--acob-line);
  white-space: nowrap;
  z-index: 1;
}
.bsv-fleet-table tbody tr {
  border-bottom: 1px solid var(--acob-line);
  transition: background 0.12s;
}
.bsv-fleet-table tbody tr:hover { background: var(--acob-surface-hover); }
.bsv-fleet-table tbody td {
  padding: 10px 12px;
  vertical-align: middle;
  border-bottom: 1px solid var(--acob-line);
}
.bsv-row--low { border-left: 3px solid rgba(239,68,68,0.6); }
.bsv-row--low td:first-child { padding-left: 9px; }
.bsv-row--impounded { opacity: 0.65; }

.bsv-bike-id-cell { display: flex; flex-direction: column; gap: 2px; }
.bsv-bike-id { font-weight: 700; color: var(--acob-text); }
.bsv-bike-model { font-size: 11px; color: var(--acob-muted); }
.bsv-rider-cell { display: flex; flex-direction: column; gap: 2px; }
.bsv-rider-name { font-weight: 600; color: var(--acob-text); }
.bsv-rider-phone { font-size: 11px; color: var(--acob-muted); }
.bsv-mono { font-family: var(--acob-font-mono); }
.bsv-sn { font-size: 11px; color: var(--acob-muted); }

.bsv-soc-cell { display: flex; align-items: center; gap: 8px; min-width: 100px; }
.bsv-soc-bar-wrap { flex: 1; height: 5px; background: var(--acob-line); border-radius: 3px; overflow: hidden; }
.bsv-soc-bar { height: 100%; border-radius: 3px; transition: width 0.3s; }
.bsv-soc-pct { font-size: 12px; font-weight: 700; min-width: 32px; text-align: right; }

.bsv-td-center { text-align: center; color: var(--acob-muted); }
.bsv-muted { color: var(--color-text-faint); }
.bsv-odo { font-size: 10.5px; color: var(--acob-muted); }
.bsv-location { font-size: 12px; color: var(--acob-muted); display: block; }
.bsv-offline-tag {
  font-size: 10px;
  color: var(--color-text-faint);
  background: var(--acob-chip);
  border-radius: 4px;
  padding: 1px 5px;
  display: inline-block;
  margin-top: 2px;
}

.bsv-motor-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}
.bsv-motor-badge--on { background: rgba(34,197,94,0.12); color: var(--acob-brand-bright); }
.bsv-motor-badge--off { background: rgba(239,68,68,0.12); color: var(--color-danger); }

.bsv-row-actions { display: flex; gap: 6px; }
.bsv-action-btn {
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  color: var(--acob-muted);
  transition: all 0.15s;
}
.bsv-action-btn:hover { background: var(--acob-surface-hover); color: var(--acob-text); }
.bsv-action-btn--primary {
  background: rgba(0,128,0,0.10);
  border-color: rgba(0,128,0,0.35);
  color: var(--acob-brand);
}
.bsv-action-btn--primary:hover { background: rgba(0,128,0,0.18); }

.bsv-table-empty { text-align: center; padding: 40px; color: var(--color-text-faint); }

/* Pagination */
.bsv-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 24px;
  flex-shrink: 0;
  border-top: 1px solid var(--acob-line);
}
.bsv-page-btn {
  padding: 6px 14px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 7px;
  color: var(--acob-muted);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s;
}
.bsv-page-btn:hover:not(:disabled) { background: var(--acob-surface-hover); color: var(--acob-text); }
.bsv-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.bsv-page-info { font-size: 12.5px; color: var(--acob-muted); }
</style>
