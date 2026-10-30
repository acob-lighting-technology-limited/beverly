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

    <!-- Stat tiles -->
    <div class="bsv-stat-tiles">
      <div class="bsv-tile">
        <div class="bsv-tile-icon bsv-tile-icon--blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 8 0v2"/></svg>
        </div>
        <div class="bsv-tile-body">
          <span class="bsv-tile-value">{{ fleetStore.totalBikes }}</span>
          <span class="bsv-tile-label">Total Bikes</span>
        </div>
      </div>
      <div class="bsv-tile">
        <div class="bsv-tile-icon bsv-tile-icon--green">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>
        </div>
        <div class="bsv-tile-body">
          <span class="bsv-tile-value bsv-tile-value--green">{{ onlineCount }}</span>
          <span class="bsv-tile-label">Active on Road</span>
        </div>
      </div>
      <div class="bsv-tile">
        <div class="bsv-tile-icon bsv-tile-icon--amber">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div class="bsv-tile-body">
          <span class="bsv-tile-value bsv-tile-value--amber">{{ idleCount }}</span>
          <span class="bsv-tile-label">Idle / Parked</span>
        </div>
      </div>
      <div class="bsv-tile">
        <div class="bsv-tile-icon bsv-tile-icon--red">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.3L2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"/></svg>
        </div>
        <div class="bsv-tile-body">
          <span class="bsv-tile-value bsv-tile-value--red">{{ impoundedCount }}</span>
          <span class="bsv-tile-label">Impounded</span>
        </div>
      </div>
    </div>

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
    />
    <BatterySwapStationModal
      v-if="swapBikeId !== undefined"
      :bike-id="swapBikeId"
      @close="swapBikeId = undefined"
    />
  </section>
</template>

<script>
import { useBatteryFleetStore } from "../../stores/battery-fleet-store.js";
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
      swapBikeId: undefined
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
      this.swapBikeId = bike ? bike.id : (this.fleetStore.bikes[0]?.id);
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

/* Stat tiles */
.bsv-stat-tiles {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px 24px 0;
  flex-shrink: 0;
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
