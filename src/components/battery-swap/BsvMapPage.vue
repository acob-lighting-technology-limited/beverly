<template>
  <section class="bsv-map-page" aria-label="Live GPS Tracker">

    <!-- ── Top bar ──────────────────────────────────────────── -->
    <header class="bsv-topbar">
      <div class="bsv-topbar-left">
        <span class="bsv-topbar-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </span>
        <div>
          <h1 class="bsv-topbar-title">Live GPS Tracker</h1>
          <p class="bsv-topbar-sub">
            {{ fleetStore.totalBikes }} EV Bikes
            &bull; Yunhe IoT
            &bull; Last synced: {{ fleetStore.lastSyncTime }}
          </p>
        </div>
      </div>

      <div class="bsv-topbar-stats">
        <div class="bsv-kpi">
          <span class="bsv-kpi-label">TOTAL</span>
          <span class="bsv-kpi-val">{{ fleetStore.totalBikes }}</span>
        </div>
        <div class="bsv-kpi bsv-kpi--green">
          <span class="bsv-kpi-label">GPS ONLINE</span>
          <span class="bsv-kpi-val">{{ fleetStore.onlineBikesCount }}</span>
        </div>
        <div class="bsv-kpi bsv-kpi--red">
          <span class="bsv-kpi-label">NEEDS SWAP</span>
          <span class="bsv-kpi-val">{{ fleetStore.lowBatteryCount }}</span>
        </div>
        <div class="bsv-kpi bsv-kpi--amber">
          <span class="bsv-kpi-label">AVG CHARGE</span>
          <span class="bsv-kpi-val">{{ fleetStore.averageSoc }}%</span>
        </div>
        <button class="bsv-refresh-btn" :disabled="fleetStore.loading" @click="syncTelemetry">
          <span :class="{ 'bsv-spin': fleetStore.loading }">&#8635;</span>
          {{ fleetStore.loading ? 'Checking...' : 'Refresh GPS' }}
        </button>
      </div>
    </header>

    <!-- ── Main body: sidebar + map ──────────────────────────── -->
    <div class="bsv-body">

      <!-- Left panel: bike list -->
      <aside class="bsv-panel">
        <!-- Filter pills -->
        <div class="bsv-pills">
          <button
            v-for="f in filters"
            :key="f.key"
            class="bsv-pill"
            :class="{ 'bsv-pill--active': activeFilter === f.key }"
            @click="activeFilter = f.key"
          >
            {{ f.label }}
            <span class="bsv-pill-count">{{ filterCount(f.key) }}</span>
          </button>
        </div>

        <!-- Search -->
        <div class="bsv-search-wrap">
          <svg class="bsv-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
            <circle cx="9" cy="9" r="5.5"/>
            <path d="M13.5 13.5L17 17" stroke-linecap="round"/>
          </svg>
          <input
            v-model="bikeSearch"
            class="bsv-search-input"
            placeholder="Search bike or rider..."
            type="search"
            aria-label="Search bikes"
          />
          <button v-if="bikeSearch" class="bsv-search-clear" @click="bikeSearch = ''" aria-label="Clear search">✕</button>
        </div>

        <!-- Bike list -->
        <div class="bsv-list" role="listbox" aria-label="Battery fleet">
          <div
            v-for="bike in panelBikes"
            :key="bike.id"
            class="bsv-bike-row"
            :class="{
              'bsv-bike-row--selected': fleetStore.selectedBikeId === bike.id,
              'bsv-bike-row--low':      bike.telemetry.soc < 20,
              'bsv-bike-row--offline':  !bike.telemetry.online
            }"
            role="option"
            :aria-selected="fleetStore.selectedBikeId === bike.id"
            tabindex="0"
            @click="selectBike(bike.id)"
            @keydown.enter="selectBike(bike.id)"
          >
            <div class="bsv-row-top">
              <span class="bsv-row-id">{{ bike.id }}</span>
              <span class="bsv-row-soc" :style="{ color: socColor(bike.telemetry.soc) }">
                {{ bike.telemetry.soc }}%
              </span>
            </div>
            <div class="bsv-row-rider">{{ bike.riderName }}</div>
            <!-- SOC bar -->
            <div class="bsv-soc-track">
              <div
                class="bsv-soc-fill"
                :style="{ width: bike.telemetry.soc + '%', background: socColor(bike.telemetry.soc) }"
              />
            </div>
            <div class="bsv-row-meta">
              <span class="bsv-row-city">{{ bike.telemetry.city }}</span>
              <span v-if="bike.telemetry.online" class="bsv-dot bsv-dot--green">● Online</span>
              <span v-else class="bsv-dot bsv-dot--muted">● Offline</span>
            </div>
          </div>
          <p v-if="panelBikes.length === 0" class="bsv-empty">No bikes match this filter.</p>
        </div>
      </aside>

      <!-- Map canvas -->
      <div class="bsv-map-canvas">
        <BatteryGprsMap
          :bikes="panelBikes"
          :selected-bike-id="fleetStore.selectedBikeId"
          class="bsv-gprs-map"
          @select-bike="selectBike"
          @toggle-power="handleTogglePower"
          @open-crm="handleOpenCrm"
          @swap-battery="openSwap"
        />
      </div>
    </div>

    <!-- Swap modal -->
    <BatterySwapStationModal
      v-if="swapModalOpen"
      :bike-id="fleetStore.selectedBikeId"
      @close="swapModalOpen = false"
    />
  </section>
</template>

<script>
import { useBatteryFleetStore } from "../../stores/battery-fleet-store.js";
import BatteryGprsMap from "./BatteryGprsMap.vue";
import BatterySwapStationModal from "./BatterySwapStationModal.vue";

export default {
  name: "BsvMapPage",
  components: { BatteryGprsMap, BatterySwapStationModal },
  props: {
    route: { type: Object, default: () => ({}) }
  },
  setup() {
    const fleetStore = useBatteryFleetStore();
    return { fleetStore };
  },
  data() {
    return {
      activeFilter: "all",
      bikeSearch:   "",
      swapModalOpen: false,
      filters: [
        { key: "all",     label: "All"        },
        { key: "moving",  label: "Moving"     },
        { key: "low",     label: "Low Charge" },
        { key: "offline", label: "Offline"    }
      ]
    };
  },
  computed: {
    selectedBike() {
      return this.fleetStore.selectedBike;
    },
    panelBikes() {
      let list = this.fleetStore.bikes;
      if (this.activeFilter === "moving")  list = list.filter(b => b.telemetry.speed > 0);
      else if (this.activeFilter === "low")     list = list.filter(b => b.telemetry.soc < 20);
      else if (this.activeFilter === "offline") list = list.filter(b => !b.telemetry.online);

      if (this.bikeSearch.trim()) {
        const q = this.bikeSearch.toLowerCase();
        list = list.filter(b =>
          b.id.toLowerCase().includes(q) ||
          b.riderName.toLowerCase().includes(q) ||
          b.batterySn.toLowerCase().includes(q) ||
          (b.plateNumber || "").toLowerCase().includes(q)
        );
      }
      // Sort: critical (low SOC) first, then offline, then rest
      return [...list].sort((a, b) => {
        const scoreA = (a.telemetry.soc < 20 ? 0 : a.telemetry.online ? 2 : 1);
        const scoreB = (b.telemetry.soc < 20 ? 0 : b.telemetry.online ? 2 : 1);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.telemetry.soc - b.telemetry.soc;
      });
    }
  },
  mounted() {
    // Kick off background GPS sync on page load
    if (!this.fleetStore.lastSyncTime || this.fleetStore.bikes.length === 0) {
      this.fleetStore.syncLiveYunheTelemetry();
    }
  },
  methods: {
    filterCount(key) {
      const bikes = this.fleetStore.bikes;
      if (key === "all")     return bikes.length;
      if (key === "moving")  return bikes.filter(b => b.telemetry.speed > 0).length;
      if (key === "low")     return bikes.filter(b => b.telemetry.soc < 20).length;
      if (key === "offline") return bikes.filter(b => !b.telemetry.online).length;
      return 0;
    },
    selectBike(id) {
      this.fleetStore.selectBike(id);
    },
    clearSelected() {
      this.fleetStore.selectBike("");
    },
    socColor(soc) {
      if (soc > 60) return "var(--color-success, #22c55e)";
      if (soc >= 20) return "var(--color-warning, #f59e0b)";
      return "var(--color-danger, #ef4444)";
    },
    openSwap() {
      this.swapModalOpen = true;
    },
    async syncTelemetry() {
      await this.fleetStore.syncLiveYunheTelemetry();
    },
    handleTogglePower(bikeId, newState) {
      const bike = this.fleetStore.bikes.find(b => b.id === bikeId);
      if (bike) bike.telemetry.d_fet = newState;
    },
    handleOpenCrm(customerId) {
      // Navigate to CRM page — beverly hash router
      window.location.hash = "#/battery-swap/crm";
    }
  }
};
</script>

<style scoped>
/* ────────────────────────────────────────────────────
   PAGE SHELL
   ──────────────────────────────────────────────────── */
.bsv-map-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--acob-bg);
  color: var(--acob-text);
  font-family: var(--acob-font-sans);
}

/* ────────────────────────────────────────────────────
   TOP BAR
   ──────────────────────────────────────────────────── */
.bsv-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 20px;
  height: 60px;
  background: var(--acob-surface);
  border-bottom: 1px solid var(--acob-line);
  backdrop-filter: blur(16px);
  z-index: 10;
}

.bsv-topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bsv-topbar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--bev-radius-sm, 8px);
  background: rgba(0,128,0,0.10);
  color: var(--acob-brand);
  flex-shrink: 0;
}
.bsv-topbar-icon svg { width: 18px; height: 18px; }

.bsv-topbar-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--acob-text);
  line-height: 1.2;
}
.bsv-topbar-sub {
  margin: 0;
  font-size: 11px;
  color: var(--acob-muted);
}

.bsv-topbar-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* KPI chips */
.bsv-kpi {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 12px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: var(--bev-radius-sm, 8px);
  min-width: 62px;
}
.bsv-kpi-label {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--acob-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.bsv-kpi-val {
  font-size: 17px;
  font-weight: 800;
  color: var(--acob-text);
  line-height: 1.25;
}
.bsv-kpi--green .bsv-kpi-val { color: var(--acob-brand-bright); }
.bsv-kpi--red   .bsv-kpi-val { color: var(--color-danger); }
.bsv-kpi--amber .bsv-kpi-val { color: var(--acob-gold); }

/* Refresh button */
.bsv-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: transparent;
  border: 1px solid rgba(0,128,0,0.35);
  border-radius: var(--bev-radius-sm, 8px);
  color: var(--acob-brand);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--bev-motion-fast, 0.12s ease);
  white-space: nowrap;
}
.bsv-refresh-btn:hover { background: rgba(0,128,0,0.09); }
.bsv-refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.bsv-spin { display: inline-block; animation: bsv-spin 0.75s linear infinite; }
@keyframes bsv-spin { to { transform: rotate(360deg); } }

/* ────────────────────────────────────────────────────
   BODY
   ──────────────────────────────────────────────────── */
.bsv-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

/* ────────────────────────────────────────────────────
   LEFT PANEL
   ──────────────────────────────────────────────────── */
.bsv-panel {
  flex-shrink: 0;
  width: 288px;
  display: flex;
  flex-direction: column;
  background: var(--acob-surface);
  border-right: 1px solid var(--acob-line);
  overflow: hidden;
}

/* Filter pills */
.bsv-pills {
  display: flex;
  gap: 5px;
  padding: 10px 12px 6px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.bsv-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: var(--bev-radius-pill, 999px);
  color: var(--acob-muted);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--bev-motion-fast, 0.12s ease);
}
.bsv-pill:hover { color: var(--acob-text); }
.bsv-pill--active {
  background: rgba(0,128,0,0.10);
  border-color: rgba(0,128,0,0.30);
  color: var(--acob-brand);
  font-weight: 700;
}
.bsv-pill-count {
  font-size: 10px;
  opacity: 0.7;
}

/* Search */
.bsv-search-wrap {
  position: relative;
  padding: 4px 12px 8px;
  flex-shrink: 0;
}
.bsv-search-icon {
  position: absolute;
  left: 21px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: var(--acob-muted);
  pointer-events: none;
}
.bsv-search-input {
  width: 100%;
  height: 34px;
  padding: 0 30px 0 32px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: var(--bev-radius-sm, 8px);
  color: var(--acob-text);
  font-size: 12.5px;
  outline: none;
  transition: border-color var(--bev-motion-fast, 0.12s ease);
  box-sizing: border-box;
}
.bsv-search-input:focus {
  border-color: rgba(0,128,0,0.40);
}
.bsv-search-input::placeholder { color: var(--color-text-faint, #475569); }
.bsv-search-clear {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--acob-muted);
  cursor: pointer;
  font-size: 11px;
  padding: 2px;
}

/* Bike list */
.bsv-list {
  flex: 1;
  overflow-y: auto;
  padding: 2px 8px 12px;
  scrollbar-width: thin;
  scrollbar-color: rgba(21,128,61,0.30) transparent;
}
.bsv-list::-webkit-scrollbar { width: 4px; }
.bsv-list::-webkit-scrollbar-thumb {
  background: rgba(21,128,61,0.30);
  border-radius: 2px;
}

.bsv-bike-row {
  padding: 9px 10px 7px;
  margin-bottom: 3px;
  border-radius: var(--bev-radius-sm, 8px);
  border: 1px solid var(--acob-line);
  border-left: 3px solid transparent;
  background: var(--acob-chip);
  cursor: pointer;
  transition: all var(--bev-motion-fast, 0.12s ease);
}
.bsv-bike-row:hover {
  background: var(--acob-surface-hover);
  border-color: var(--acob-line-strong);
}
.bsv-bike-row--selected {
  background: rgba(0,128,0,0.06);
  border-color: rgba(0,128,0,0.18);
  border-left-color: var(--acob-brand);
}
.bsv-bike-row--low { border-left-color: var(--color-danger); }
.bsv-bike-row--offline { opacity: 0.55; }

.bsv-row-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.bsv-row-id {
  font-size: 12px;
  font-weight: 700;
  color: var(--acob-text);
  font-family: var(--acob-font-mono);
}
.bsv-row-soc { font-size: 12px; font-weight: 700; }
.bsv-row-rider { font-size: 11px; color: var(--acob-muted); margin: 2px 0 5px; }

.bsv-soc-track {
  height: 3px;
  background: var(--acob-line);
  border-radius: 2px;
  margin-bottom: 5px;
  overflow: hidden;
}
.bsv-soc-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.bsv-row-meta {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--acob-muted);
}
.bsv-row-city { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px; }
.bsv-dot { font-size: 10px; white-space: nowrap; }
.bsv-dot--green { color: var(--acob-brand-bright); }
.bsv-dot--muted { color: var(--acob-muted); }

.bsv-empty {
  text-align: center;
  color: var(--acob-muted);
  font-size: 12.5px;
  padding: 28px 12px;
}

/* ────────────────────────────────────────────────────
   MAP CANVAS
   ──────────────────────────────────────────────────── */
.bsv-map-canvas {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--acob-bg);
}

/* BatteryGprsMap fills the entire canvas */
.bsv-gprs-map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* ────────────────────────────────────────────────────
   RESPONSIVE
   ──────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .bsv-topbar { flex-direction: column; height: auto; padding: 10px 14px; gap: 8px; }
  .bsv-body   { flex-direction: column; }
  .bsv-panel  { width: 100%; height: 220px; border-right: none; border-bottom: 1px solid var(--acob-line); }
  .bsv-topbar-stats { flex-wrap: wrap; justify-content: center; }
}
</style>
