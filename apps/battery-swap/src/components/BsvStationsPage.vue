<template>
  <section class="bsv-stations-page" aria-label="Battery Swap Stations">
    <!-- ── Top Header ────────────────────────────────────────── -->
    <header class="bsv-stations-header">
      <div class="bsv-header-title-block">
        <h1 class="bsv-stations-title">Swap Stations &amp; Racks</h1>
        <p class="bsv-stations-subtitle">
          12 Network Hubs &bull; Lagos, Abuja, Ibadan &amp; Akure
        </p>
      </div>

      <div class="bsv-stations-header-actions">
        <button class="bsv-btn bsv-btn--ghost" :disabled="fleetStore.loading" @click="refresh">
          <span :class="{ 'bsv-spin': fleetStore.loading }">↻</span>
          <span>{{ fleetStore.loading ? 'Updating…' : 'Sync Hubs' }}</span>
        </button>
        <button class="bsv-btn bsv-btn--primary" @click="openSwapModal(null)">
          <span>⚡ Record Swap</span>
        </button>
      </div>
    </header>

    <!-- ── Plain Language 3-Step Guide Banner ─────────────────── -->
    <StationGuideBanner />

    <!-- ── Live Status Strip (KPIs in plain words) ───────────── -->
    <StationKpiStrip
      :station-count="fleetStore.stations.length"
      :total-ready="totalReady"
      :total-charging="totalCharging"
      :total-empty-lockers="totalEmptyLockers"
    />

    <!-- ── Search & Filter Controls ──────────────────────────── -->
    <div class="bsv-toolbar">
      <div class="bsv-search-box">
        <span class="bsv-search-icon">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search station by name, address, or city (e.g. Ikeja, Lekki, Bodija, Wuse)..."
          class="bsv-search-input"
          aria-label="Search stations"
        />
        <button v-if="searchQuery" class="bsv-clear-btn" @click="searchQuery = ''">✕</button>
      </div>

      <div class="bsv-filter-chips">
        <button
          v-for="f in filterOptions"
          :key="f.id"
          class="bsv-filter-chip"
          :class="{ 'bsv-filter-chip--active': activeFilter === f.id }"
          @click="activeFilter = f.id"
        >
          {{ f.label }}
          <span v-if="f.count !== undefined" class="bsv-chip-count">{{ f.count }}</span>
        </button>
      </div>

      <div class="bsv-view-switch">
        <button
          class="bsv-view-btn"
          :class="{ 'bsv-view-btn--active': viewMode === 'cabinet' }"
          title="Interactive Locker Cabinet View"
          @click="viewMode = 'cabinet'"
        >
          🚪 Locker Doors View
        </button>
        <button
          class="bsv-view-btn"
          :class="{ 'bsv-view-btn--active': viewMode === 'table' }"
          title="Battery List Table View"
          @click="viewMode = 'table'"
        >
          📋 Battery Table View
        </button>
      </div>
    </div>

    <!-- ── Main Stations Grid ────────────────────────────────── -->
    <div class="bsv-stations-body">
      <div v-if="filteredStations.length === 0" class="bsv-empty-stations">
        <span class="bsv-empty-icon">📍</span>
        <h3>No stations match your search</h3>
        <p>Try searching for a different area like Ikeja, Lekki, Yaba, or Abuja.</p>
        <button class="bsv-btn bsv-btn--ghost" @click="resetFilters">Show All Stations</button>
      </div>

      <div v-else class="bsv-stations-grid">
        <StationCard
          v-for="station in filteredStations"
          :key="station.id"
          :station="station"
          :view-mode="viewMode"
          @select-battery="handleSelectBattery"
          @open-swap="openSwapModal"
          @door-click="onLockerClick"
        />
      </div>

      <!-- ── Recent Swap Activity History Log ──────────────────── -->
      <StationSwapHistory :swaps="recentSwaps" />
    </div>

    <!-- ── Interactive Swap Modal ────────────────────────────── -->
    <BatterySwapStationModal
      v-if="modalVisible"
      :initial-station-id="selectedStationIdForModal"
      :station-id="selectedStationIdForModal"
      :preset-replacement-sn="presetBatterySn"
      :stations="fleetStore.stations"
      :bikes="fleetStore.bikes"
      @execute-swap="handleExecuteSwap"
      @close="closeSwapModal"
    />
  </section>
</template>

<script>
import { useBatteryFleetStore } from "../stores/battery-fleet-store.js";
import BatterySwapStationModal from "./BatterySwapStationModal.vue";
import StationGuideBanner from "./station/StationGuideBanner.vue";
import StationKpiStrip from "./station/StationKpiStrip.vue";
import StationCard from "./station/StationCard.vue";
import StationSwapHistory from "./station/StationSwapHistory.vue";
import {
  readyBatteries,
  chargingBatteries,
  getEmptySlotsCount,
  getLockerSlots,
  getChargeColor,
  getMapDirectionsUrl,
  formatTimestamp,
  fmtNaira,
  filterStations
} from "../composables/useStationManager.js";

export default {
  name: "BsvStationsPage",
  components: {
    BatterySwapStationModal,
    StationGuideBanner,
    StationKpiStrip,
    StationCard,
    StationSwapHistory
  },
  props: {
    route: { type: Object, default: () => ({}) }
  },
  setup() {
    const fleetStore = useBatteryFleetStore();
    return { fleetStore };
  },
  data() {
    return {
      modalVisible: false,
      selectedStationIdForModal: null,
      presetBatterySn: "",
      searchQuery: "",
      activeFilter: "all",
      viewMode: "cabinet" // "cabinet" | "table"
    };
  },
  computed: {
    filterOptions() {
      const all = this.fleetStore.stations || [];
      const readyCount = all.filter(s => (s.activeBatteries || []).some(b => b.status === "ready")).length;
      const lagosCount = all.filter(s => (s.city || "").toLowerCase().includes("lagos")).length;
      const abujaCount = all.filter(s => (s.city || "").toLowerCase().includes("abuja")).length;
      return [
        { id: "all", label: "All Hubs", count: all.length },
        { id: "ready", label: "Ready to Swap Now", count: readyCount },
        { id: "lagos", label: "Lagos Hubs", count: lagosCount },
        { id: "abuja", label: "Abuja Hubs", count: abujaCount }
      ];
    },
    totalReady() {
      return (this.fleetStore.stations || []).reduce((acc, s) =>
        acc + (s.activeBatteries || []).filter(b => b.status === "ready").length, 0);
    },
    totalCharging() {
      return (this.fleetStore.stations || []).reduce((acc, s) =>
        acc + (s.activeBatteries || []).filter(b => b.status === "charging").length, 0);
    },
    totalEmptyLockers() {
      return (this.fleetStore.stations || []).reduce((acc, s) => {
        const occupied = (s.activeBatteries || []).length;
        const total = s.totalSlots || 8;
        return acc + Math.max(0, total - occupied);
      }, 0);
    },
    filteredStations() {
      return filterStations(this.fleetStore.stations || [], this.searchQuery, this.activeFilter);
    },
    recentSwaps() {
      return [...(this.fleetStore.swaps || [])]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 20);
    }
  },
  methods: {
    readyBatteries,
    chargingBatteries,
    getEmptySlotsCount,
    getLockerSlots,
    getChargeColor,
    getMapDirectionsUrl,
    formatTimestamp,
    fmtNaira,
    openSwapModal(stationId) {
      this.selectedStationIdForModal = stationId;
      this.presetBatterySn = "";
      this.modalVisible = true;
    },
    openSwapWithBattery(stationId, batterySn) {
      this.selectedStationIdForModal = stationId;
      this.presetBatterySn = batterySn;
      this.modalVisible = true;
    },
    handleSelectBattery({ stationId, batterySn }) {
      this.openSwapWithBattery(stationId, batterySn);
    },
    onLockerClick({ station, slot }) {
      if (slot.status === "ready" && slot.battery) {
        this.openSwapWithBattery(station.id, slot.battery.sn);
      } else if (slot.status === "empty") {
        this.openSwapModal(station.id);
      }
    },
    closeSwapModal() {
      this.modalVisible = false;
      this.selectedStationIdForModal = null;
      this.presetBatterySn = "";
    },
    resetFilters() {
      this.searchQuery = "";
      this.activeFilter = "all";
    },
    async refresh() {
      await this.fleetStore.syncLiveYunheTelemetry();
    },
    handleExecuteSwap(swapPayload) {
      if (this.fleetStore && typeof this.fleetStore.executeSwap === "function") {
        this.fleetStore.executeSwap(swapPayload);
      }
    }
  }
};
</script>

<style scoped>
@import "../styles/station-components.css";
</style>
