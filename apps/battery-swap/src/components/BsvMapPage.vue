<template>
  <section class="bsv-map-page" aria-label="Live GPS Tracker">

    <!-- ── Fleet KPI Cards Header ────────────────────────── -->
    <header class="bsv-topbar" aria-label="Fleet KPI Summary">
      <div class="bsv-kpi-grid">
        <article class="bw-kpi bsv-kpi featured">
          <div class="bw-kpi-row">
            <span class="bw-kpi-label">TOTAL BIKES</span>
            <span class="bw-kpi-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 9l3-4h3l2 4"/><path d="M19 17.5V14l-4-4"/>
              </svg>
            </span>
          </div>
          <strong class="bw-kpi-value">{{ fleetStore.totalBikes }}</strong>
          <span class="bw-kpi-note">Active EV Fleet</span>
        </article>

        <article class="bw-kpi bsv-kpi info-tone">
          <div class="bw-kpi-row">
            <span class="bw-kpi-label">GPS ONLINE</span>
            <span class="bw-kpi-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
              </svg>
            </span>
          </div>
          <strong class="bw-kpi-value text-success">{{ fleetStore.onlineBikesCount }}</strong>
          <span class="bw-kpi-note">Live Telemetry Transmitting</span>
        </article>

        <article class="bw-kpi bsv-kpi danger-tone">
          <div class="bw-kpi-row">
            <span class="bw-kpi-label">NEEDS SWAP</span>
            <span class="bw-kpi-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/>
                <line x1="7" y1="12" x2="13" y2="12"/>
              </svg>
            </span>
          </div>
          <strong class="bw-kpi-value text-danger">{{ fleetStore.lowBatteryCount }}</strong>
          <span class="bw-kpi-note">&lt;20% Charge Remaining</span>
        </article>

        <article class="bw-kpi bsv-kpi warn-tone">
          <div class="bw-kpi-row">
            <span class="bw-kpi-label">AVG CHARGE</span>
            <span class="bw-kpi-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </span>
          </div>
          <strong class="bw-kpi-value text-warning">{{ fleetStore.averageSoc }}%</strong>
          <span class="bw-kpi-note">Network Fleet Average</span>
        </article>
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
          :stations="fleetStore.stations"
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
      :initial-bike-id="targetSwapBikeId || fleetStore.selectedBikeId"
      :initial-station-id="targetSwapStationId"
      :stations="fleetStore.stations"
      :bikes="fleetStore.bikes"
      @close="closeSwapModal"
      @execute-swap="handleExecuteSwap"
    />
  </section>
</template>

<script>
import { useBatteryFleetStore } from "../stores/battery-fleet-store.js";
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
      targetSwapBikeId: "",
      targetSwapStationId: "",
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
    openSwap(bikeId) {
      this.targetSwapBikeId = bikeId || this.fleetStore.selectedBikeId || (this.fleetStore.bikes[0]?.id);
      this.targetSwapStationId = this.fleetStore.stations[0]?.id || "";
      this.swapModalOpen = true;
    },
    closeSwapModal() {
      this.swapModalOpen = false;
      this.targetSwapBikeId = "";
      this.targetSwapStationId = "";
    },
    handleExecuteSwap(payload) {
      if (payload && this.fleetStore) {
        this.fleetStore.executeSwap(payload);
      }
    },
    async syncTelemetry() {
      await this.fleetStore.syncLiveYunheTelemetry();
    },
    async handleTogglePower(bikeId, newState) {
      if (this.fleetStore && typeof this.fleetStore.toggleBikeMotorPower === "function") {
        await this.fleetStore.toggleBikeMotorPower(bikeId, newState);
      }
    },
    handleOpenCrm(customerId) {
      if (this.$router && this.$route && this.$route.path) {
        this.$router.push("/crm");
      } else {
        window.location.hash = "#/battery-swap/crm";
      }
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
   TOP BAR - FLEET KPI CARDS
   ──────────────────────────────────────────────────── */
.bsv-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: var(--acob-surface);
  border-bottom: 1px solid var(--acob-line);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  z-index: 10;
}

.bsv-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  width: 100%;
}

.bw-kpi.bsv-kpi {
  background: var(--acob-surface, rgba(10, 22, 15, 0.96));
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: var(--acob-radius-md, 10px);
  padding: 8px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.15s ease;
}

.bw-kpi.bsv-kpi:hover {
  border-color: var(--acob-line-strong, rgba(125, 252, 154, 0.28));
  transform: translateY(-1px);
}

.bw-kpi-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.bw-kpi-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
}

.bw-kpi-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  color: var(--acob-muted);
}

.bw-kpi.featured .bw-kpi-icon {
  background: rgba(34, 197, 94, 0.15);
  color: var(--acob-brand-mint);
}

.bw-kpi.info-tone .bw-kpi-icon {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.bw-kpi.danger-tone .bw-kpi-icon {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.bw-kpi.warn-tone .bw-kpi-icon {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.bw-kpi-value {
  font-size: 1.35rem;
  font-weight: 800;
  font-family: var(--acob-font-mono, monospace);
  line-height: 1.1;
  color: var(--acob-text, #f2f7f3);
}

.text-success { color: var(--color-success, #22c55e) !important; }
.text-danger { color: var(--color-danger, #ef4444) !important; }
.text-warning { color: var(--color-warning, #f59e0b) !important; }

.bw-kpi-note {
  font-size: 0.65rem;
  color: var(--acob-subtle, rgba(242, 247, 243, 0.45));
}

@media (max-width: 900px) {
  .bsv-kpi-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
}

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
