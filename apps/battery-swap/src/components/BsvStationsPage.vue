<template>
  <section class="bsv-stations-page" aria-label="Battery Swap Stations">
    <!-- ── Top Header ────────────────────────────────────────── -->
    <header class="bsv-stations-header">
      <div class="bsv-header-title-block">
        <div class="bsv-badge-row">
          <span class="bsv-pill bsv-pill--live">
            <span class="bsv-pulse-dot" /> Live Network
          </span>
          <span class="bsv-pill bsv-pill--info">Operating Hours: 6:00 AM – 10:00 PM</span>
        </div>
        <h1 class="bsv-stations-title">Battery Swap Stations</h1>
        <p class="bsv-stations-subtitle">
          Find a nearby Beverly hub, check fully charged batteries in real time, and swap your EV battery in under 60 seconds.
        </p>
      </div>

      <div class="bsv-stations-header-actions">
        <button class="bsv-btn bsv-btn--ghost" :disabled="fleetStore.loading" @click="refresh">
          <span :class="{ 'bsv-spin': fleetStore.loading }">↻</span>
          <span>{{ fleetStore.loading ? 'Updating…' : 'Refresh Hubs' }}</span>
        </button>
        <button class="bsv-btn bsv-btn--primary" @click="openSwapModal(null)">
          <span>⚡ Swap Battery Now</span>
        </button>
      </div>
    </header>

    <!-- ── Plain Language 3-Step Guide Banner ─────────────────── -->
    <div class="bsv-guide-banner">
      <div class="bsv-guide-card">
        <div class="bsv-guide-num">1</div>
        <div class="bsv-guide-text">
          <strong>Pull Up to Any Hub</strong>
          <span>Park your bike at any open station bay.</span>
        </div>
      </div>
      <div class="bsv-guide-card">
        <div class="bsv-guide-num">2</div>
        <div class="bsv-guide-text">
          <strong>Drop Off Low Battery</strong>
          <span>Deposit your depleted pack into the open locker.</span>
        </div>
      </div>
      <div class="bsv-guide-card">
        <div class="bsv-guide-num">3</div>
        <div class="bsv-guide-text">
          <strong>Take 100% Fresh Pack</strong>
          <span>Lockers dispense a tested, full battery instantly.</span>
        </div>
      </div>
      <div class="bsv-guide-price-chip">
        <span class="bsv-chip-label">Standard Swap Price</span>
        <strong class="bsv-chip-val">₦800</strong>
        <span class="bsv-chip-sub">Direct from Beverly Wallet</span>
      </div>
    </div>

    <!-- ── Live Status Strip (KPIs in plain words) ───────────── -->
    <div class="bsv-stations-kpis">
      <div class="bsv-kpi-card">
        <span class="bsv-kpi-icon" aria-hidden="true">🏪</span>
        <div class="bsv-kpi-details">
          <span class="bsv-kpi-val">{{ fleetStore.stations.length }}</span>
          <span class="bsv-kpi-lbl">Active Stations Open</span>
          <span class="bsv-kpi-hint">Across Lagos, Abuja &amp; Ibadan</span>
        </div>
      </div>

      <div class="bsv-kpi-card bsv-kpi-card--green">
        <span class="bsv-kpi-icon" aria-hidden="true">🔋</span>
        <div class="bsv-kpi-details">
          <span class="bsv-kpi-val bsv-kpi-val--green">{{ totalReady }}</span>
          <span class="bsv-kpi-lbl">Ready for Pickup</span>
          <span class="bsv-kpi-hint">Charged &ge; 85% &bull; Ready to ride</span>
        </div>
      </div>

      <div class="bsv-kpi-card bsv-kpi-card--amber">
        <span class="bsv-kpi-icon" aria-hidden="true">⚡</span>
        <div class="bsv-kpi-details">
          <span class="bsv-kpi-val bsv-kpi-val--amber">{{ totalCharging }}</span>
          <span class="bsv-kpi-lbl">Charging Now</span>
          <span class="bsv-kpi-hint">Fast charging in rack bays</span>
        </div>
      </div>

      <div class="bsv-kpi-card bsv-kpi-card--blue">
        <span class="bsv-kpi-icon" aria-hidden="true">🔓</span>
        <div class="bsv-kpi-details">
          <span class="bsv-kpi-val bsv-kpi-val--blue">{{ totalEmptyLockers }}</span>
          <span class="bsv-kpi-lbl">Open Drop-Off Lockers</span>
          <span class="bsv-kpi-hint">Available for incoming packs</span>
        </div>
      </div>
    </div>

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
        <article
          v-for="station in filteredStations"
          :key="station.id"
          class="bsv-station-card"
        >
          <!-- Station Header -->
          <div class="bsv-sc-header">
            <div class="bsv-sc-title-row">
              <div class="bsv-station-name-wrap">
                <h2 class="bsv-sc-name">{{ station.name }}</h2>
                <span class="bsv-city-badge">{{ station.city }}</span>
              </div>
              <span class="bsv-status-badge bsv-status-badge--open">
                <span class="bsv-dot" /> Open &bull; Attendant on Duty
              </span>
            </div>

            <!-- Address & Directions -->
            <div class="bsv-sc-meta-row">
              <div class="bsv-sc-address">
                <span class="bsv-icon">📍</span>
                <span>{{ station.address }}</span>
              </div>
              <a
                :href="getMapDirectionsUrl(station)"
                target="_blank"
                rel="noopener noreferrer"
                class="bsv-directions-link"
                title="Get GPS driving directions to this station"
              >
                <span>Get Directions &rarr;</span>
              </a>
            </div>

            <!-- Attendant Contact Info -->
            <div class="bsv-sc-operator">
              <span class="bsv-operator-label">Station Attendant:</span>
              <strong class="bsv-operator-name">{{ station.operatorName }}</strong>
              <span class="bsv-sep">&bull;</span>
              <a :href="'tel:' + station.operatorPhone" class="bsv-phone-link" title="Call station attendant directly">
                📞 {{ station.operatorPhone }}
              </a>
            </div>
          </div>

          <!-- Plain Language Locker Availability Bar -->
          <div class="bsv-sc-capacity">
            <div class="bsv-cap-labels">
              <span class="bsv-cap-title">Locker Availability</span>
              <div class="bsv-cap-breakdown">
                <span class="bsv-stat-tag bsv-stat-tag--green">
                  <strong>{{ readyBatteries(station).length }}</strong> ready to take
                </span>
                <span class="bsv-stat-tag bsv-stat-tag--amber">
                  <strong>{{ chargingBatteries(station).length }}</strong> charging up
                </span>
                <span class="bsv-stat-tag bsv-stat-tag--blue">
                  <strong>{{ getEmptySlotsCount(station) }}</strong> open drop-off lockers
                </span>
              </div>
            </div>

            <div class="bsv-cap-bar-wrap" :aria-label="`Station has ${readyBatteries(station).length} ready packs out of ${station.totalSlots} total bays`">
              <div
                class="bsv-cap-bar bsv-cap-bar--ready"
                :style="{ width: (readyBatteries(station).length / station.totalSlots * 100) + '%' }"
                title="Ready for immediate swap"
              />
              <div
                class="bsv-cap-bar bsv-cap-bar--charging"
                :style="{ width: (chargingBatteries(station).length / station.totalSlots * 100) + '%' }"
                title="Charging up"
              />
            </div>
          </div>

          <!-- ── View Mode 1: Interactive Physical Locker Cabinet ── -->
          <div v-if="viewMode === 'cabinet'" class="bsv-cabinet-view">
            <div class="bsv-cabinet-header">
              <span class="bsv-cab-title">Charging Cabinet Lockers ({{ station.totalSlots }} Bays)</span>
              <span class="bsv-cab-hint">Tap any ready green door to swap that pack</span>
            </div>

            <div class="bsv-locker-grid">
              <div
                v-for="(slot, idx) in getLockerSlots(station)"
                :key="slot.doorNumber"
                class="bsv-locker-door"
                :class="{
                  'bsv-locker-door--ready': slot.status === 'ready',
                  'bsv-locker-door--charging': slot.status === 'charging',
                  'bsv-locker-door--empty': slot.status === 'empty'
                }"
                @click="onLockerClick(station, slot)"
              >
                <div class="bsv-door-top">
                  <span class="bsv-door-num">Door {{ slot.doorNumber }}</span>
                  <span class="bsv-door-indicator" />
                </div>

                <div v-if="slot.status === 'ready'" class="bsv-door-content">
                  <span class="bsv-charge-big">{{ slot.battery.soc }}%</span>
                  <span class="bsv-door-status-lbl">Ready to Take</span>
                  <span class="bsv-door-volt">{{ slot.battery.v }}V &bull; {{ slot.battery.temp }}°C</span>
                  <button class="bsv-door-take-btn" @click.stop="openSwapWithBattery(station.id, slot.battery.sn)">
                    Select Pack
                  </button>
                </div>

                <div v-else-if="slot.status === 'charging'" class="bsv-door-content">
                  <span class="bsv-charge-big bsv-charge-big--amber">{{ slot.battery.soc }}%</span>
                  <span class="bsv-door-status-lbl">Charging Up</span>
                  <span class="bsv-door-est">~{{ Math.max(10, Math.round((100 - slot.battery.soc) * 0.8)) }}m left</span>
                </div>

                <div v-else class="bsv-door-content bsv-door-content--empty">
                  <span class="bsv-empty-icon">📥</span>
                  <span class="bsv-door-status-lbl">Open Locker</span>
                  <span class="bsv-door-drop-hint">Place depleted battery here</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── View Mode 2: Detailed Battery Table ── -->
          <div v-else class="bsv-sc-rack">
            <div class="bsv-table-responsive">
              <table class="bsv-rack-table">
                <thead>
                  <tr>
                    <th>Battery Pack</th>
                    <th>Charge Level</th>
                    <th class="bsv-td-center">Power (Volts)</th>
                    <th class="bsv-td-center">Temperature</th>
                    <th>Readiness Status</th>
                    <th class="bsv-td-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="bat in station.activeBatteries" :key="bat.sn">
                    <td>
                      <div class="bsv-bat-id-cell">
                        <span class="bsv-mono bsv-sn-sm">#{{ bat.sn.slice(-6) }}</span>
                        <span class="bsv-sub-sn">{{ bat.sn }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="bsv-mini-soc">
                        <div class="bsv-mini-soc-wrap">
                          <div
                            class="bsv-mini-soc-fill"
                            :style="{ width: bat.soc + '%', background: getChargeColor(bat.soc) }"
                          />
                        </div>
                        <span class="bsv-soc-number" :style="{ color: getChargeColor(bat.soc) }">
                          {{ bat.soc }}%
                        </span>
                      </div>
                    </td>
                    <td class="bsv-td-center font-mono">{{ bat.v }}V</td>
                    <td class="bsv-td-center">
                      <span :class="bat.temp > 35 ? 'text-amber' : 'text-normal'">
                        {{ bat.temp }}°C ({{ bat.temp > 35 ? 'Warm' : 'Normal' }})
                      </span>
                    </td>
                    <td>
                      <span
                        class="bsv-bat-status"
                        :class="bat.status === 'ready' ? 'bsv-bat-status--ready' : 'bsv-bat-status--charging'"
                      >
                        {{ bat.status === 'ready' ? '✓ Ready to Ride' : '↻ Charging Up' }}
                      </span>
                    </td>
                    <td class="bsv-td-right">
                      <button
                        v-if="bat.status === 'ready'"
                        class="bsv-btn-take-pack"
                        @click="openSwapWithBattery(station.id, bat.sn)"
                      >
                        Select
                      </button>
                      <span v-else class="bsv-charging-hint">Waiting</span>
                    </td>
                  </tr>
                  <tr v-if="!station.activeBatteries || station.activeBatteries.length === 0">
                    <td colspan="6" class="bsv-table-empty">
                      No battery packs currently in this cabinet rack.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Station Footer Action -->
          <div class="bsv-sc-footer">
            <div class="bsv-footer-info">
              <span class="bsv-fee-note">Fixed swap fee: <strong>₦800</strong></span>
              <span class="bsv-time-note">&bull; Takes &lt; 60 seconds</span>
            </div>
            <button
              class="bsv-btn-swap-here"
              :disabled="readyBatteries(station).length === 0"
              @click="openSwapModal(station.id)"
            >
              <span v-if="readyBatteries(station).length > 0">⚡ Swap Battery at This Station</span>
              <span v-else>⚠️ No Ready Batteries at This Hub</span>
            </button>
          </div>
        </article>
      </div>

      <!-- ── Recent Swap Activity History Log ──────────────────── -->
      <section class="bsv-swap-log" aria-labelledby="swap-log-heading">
        <div class="bsv-swap-log-header">
          <div>
            <h2 id="swap-log-heading" class="bsv-swap-log-title">Recent Battery Swap History</h2>
            <p class="bsv-swap-log-sub">Transparent record of real-time battery exchanges completed across all hubs</p>
          </div>
          <span class="bsv-badge-count">{{ recentSwaps.length }} Recorded Swaps</span>
        </div>

        <div class="bsv-swap-log-table-wrap">
          <table class="bsv-swap-log-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>EV Bike</th>
                <th>Rider Name</th>
                <th>Returned Low Battery</th>
                <th>New Battery Received</th>
                <th>Station Hub</th>
                <th>Fee Paid</th>
                <th>Attendant</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="swap in recentSwaps" :key="swap.id">
                <td class="bsv-td-ts">{{ formatTimestamp(swap.timestamp) }}</td>
                <td>
                  <span class="bsv-mono bsv-bike-tag">{{ swap.bikeId }}</span>
                </td>
                <td class="bsv-rider-name">{{ swap.riderName }}</td>
                <td>
                  <div class="bsv-pack-exchange-cell">
                    <span class="bsv-mono bsv-sn-sm">#{{ (swap.batteryInSn || '').slice(-6) }}</span>
                    <span class="bsv-soc-tag bsv-soc-tag--low">{{ swap.batteryInSoc }}% Depleted</span>
                  </div>
                </td>
                <td>
                  <div class="bsv-pack-exchange-cell">
                    <span class="bsv-mono bsv-sn-sm">#{{ (swap.batteryOutSn || '').slice(-6) }}</span>
                    <span class="bsv-soc-tag bsv-soc-tag--high">{{ swap.batteryOutSoc }}% Fresh</span>
                  </div>
                </td>
                <td class="bsv-td-station">
                  <strong>{{ swap.stationName }}</strong>
                </td>
                <td class="bsv-td-fee">
                  <span class="bsv-fee-badge">{{ fmtNaira(swap.feeMinor) }}</span>
                </td>
                <td class="bsv-td-operator">{{ swap.operatorName }}</td>
              </tr>
              <tr v-if="recentSwaps.length === 0">
                <td colspan="8" class="bsv-table-empty">
                  No swaps recorded yet. Use the "Swap Battery Now" button above to perform your first swap.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- ── Interactive Swap Modal ────────────────────────────── -->
    <BatterySwapStationModal
      v-if="modalVisible"
      :station-id="selectedStationIdForModal"
      :preset-replacement-sn="presetBatterySn"
      @close="closeSwapModal"
    />
  </section>
</template>

<script>
import { useBatteryFleetStore } from "../stores/battery-fleet-store.js";
import BatterySwapStationModal from "./BatterySwapStationModal.vue";

export default {
  name: "BsvStationsPage",
  components: { BatterySwapStationModal },
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
      const all = this.fleetStore.stations;
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
      return this.fleetStore.stations.reduce((acc, s) =>
        acc + (s.activeBatteries || []).filter(b => b.status === "ready").length, 0);
    },
    totalCharging() {
      return this.fleetStore.stations.reduce((acc, s) =>
        acc + (s.activeBatteries || []).filter(b => b.status === "charging").length, 0);
    },
    totalEmptyLockers() {
      return this.fleetStore.stations.reduce((acc, s) => {
        const occupied = (s.activeBatteries || []).length;
        const total = s.totalSlots || 8;
        return acc + Math.max(0, total - occupied);
      }, 0);
    },
    filteredStations() {
      let list = this.fleetStore.stations || [];

      // Filter by chip category
      if (this.activeFilter === "ready") {
        list = list.filter(s => (s.activeBatteries || []).some(b => b.status === "ready"));
      } else if (this.activeFilter === "lagos") {
        list = list.filter(s => (s.city || "").toLowerCase().includes("lagos"));
      } else if (this.activeFilter === "abuja") {
        list = list.filter(s => (s.city || "").toLowerCase().includes("abuja"));
      }

      // Filter by text search
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase().trim();
        list = list.filter(s =>
          (s.name || "").toLowerCase().includes(q) ||
          (s.address || "").toLowerCase().includes(q) ||
          (s.city || "").toLowerCase().includes(q) ||
          (s.operatorName || "").toLowerCase().includes(q)
        );
      }

      return list;
    },
    recentSwaps() {
      return [...(this.fleetStore.swaps || [])]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 20);
    }
  },
  methods: {
    readyBatteries(station) {
      return (station.activeBatteries || []).filter(b => b.status === "ready");
    },
    chargingBatteries(station) {
      return (station.activeBatteries || []).filter(b => b.status === "charging");
    },
    getEmptySlotsCount(station) {
      const occupied = (station.activeBatteries || []).length;
      return Math.max(0, (station.totalSlots || 8) - occupied);
    },
    getLockerSlots(station) {
      const total = station.totalSlots || 8;
      const batteries = station.activeBatteries || [];
      const slots = [];

      for (let i = 1; i <= total; i++) {
        const bat = batteries[i - 1];
        if (bat) {
          slots.push({
            doorNumber: i,
            status: bat.status, // "ready" | "charging"
            battery: bat
          });
        } else {
          slots.push({
            doorNumber: i,
            status: "empty",
            battery: null
          });
        }
      }
      return slots;
    },
    getChargeColor(soc) {
      if (soc >= 80) return "var(--brand, #22c55e)";
      if (soc >= 40) return "#f59e0b";
      return "#ef4444";
    },
    getMapDirectionsUrl(station) {
      if (station.lat && station.lng) {
        return `https://www.google.com/maps/search/?api=1&query=${station.lat},${station.lng}`;
      }
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.address || station.name)}`;
    },
    formatTimestamp(ts) {
      if (!ts) return "Just now";
      try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return ts;
        return d.toLocaleDateString("en-NG", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
      } catch {
        return ts;
      }
    },
    fmtNaira(minor) {
      const n = (Number(minor) || 0) / 100;
      return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
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
    onLockerClick(station, slot) {
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
    }
  }
};
</script>

<style scoped>
/* ─────────────────────────────────────────────────────────────
   BEVERLY WALLET DESIGN TOKENS & RESPONSIVE LAYOUT
   ───────────────────────────────────────────────────────────── */
.bsv-stations-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--canvas, var(--acob-bg, #0a0e14));
  color: var(--text, var(--acob-text, #ffffff));
  font-family: var(--font-sans, var(--acob-font-sans));
  padding: 1.5rem;
  box-sizing: border-box;
  gap: 1.5rem;
}

/* ── Top Header ────────────────────────────────────────────── */
.bsv-stations-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.bsv-badge-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.bsv-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.65rem;
  border-radius: var(--r-full, 9999px);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.bsv-pill--live {
  background: rgba(34, 197, 94, 0.12);
  color: var(--brand, #22c55e);
  border: 1px solid rgba(34, 197, 94, 0.28);
}

.bsv-pill--info {
  background: var(--surface-2, rgba(255, 255, 255, 0.05));
  color: var(--text-dim, #94a3b8);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}

.bsv-pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand, #22c55e);
  box-shadow: 0 0 8px var(--brand, #22c55e);
  animation: bsv-pulse 1.8s infinite;
}

@keyframes bsv-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.bsv-stations-title {
  margin: 0;
  font-family: var(--font-display, var(--acob-font-sans));
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text, #ffffff);
  letter-spacing: -0.02em;
}

.bsv-stations-subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.88rem;
  color: var(--text-dim, #94a3b8);
  max-width: 640px;
  line-height: 1.45;
}

.bsv-stations-header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* Buttons */
.bsv-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1.15rem;
  border-radius: var(--r-md, 8px);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
  min-height: 42px;
  border: 1px solid transparent;
}

.bsv-btn--primary {
  background: var(--brand, #22c55e);
  color: #05160b;
  box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3);
}

.bsv-btn--primary:hover {
  background: #16a34a;
  transform: translateY(-1px);
}

.bsv-btn--ghost {
  background: var(--surface, rgba(255, 255, 255, 0.05));
  color: var(--text, #ffffff);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}

.bsv-btn--ghost:hover {
  background: var(--surface-2, rgba(255, 255, 255, 0.08));
  border-color: var(--brand, #22c55e);
}

.bsv-spin {
  display: inline-block;
  animation: bsv-spin 1s linear infinite;
}

@keyframes bsv-spin {
  to { transform: rotate(360deg); }
}

/* ── 3-Step Guide Banner ───────────────────────────────────── */
.bsv-guide-banner {
  display: grid;
  grid-template-columns: repeat(3, 1fr) auto;
  gap: 1rem;
  padding: 1.15rem 1.25rem;
  background: var(--surface, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.1));
  border-radius: var(--r-xl, 14px);
  backdrop-filter: blur(12px);
  align-items: center;
}

.bsv-guide-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.bsv-guide-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(34, 197, 94, 0.15);
  color: var(--brand, #22c55e);
  font-weight: 800;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid rgba(34, 197, 94, 0.35);
}

.bsv-guide-text {
  display: flex;
  flex-direction: column;
}

.bsv-guide-text strong {
  font-size: 0.82rem;
  color: var(--text, #ffffff);
}

.bsv-guide-text span {
  font-size: 0.74rem;
  color: var(--text-dim, #94a3b8);
}

.bsv-guide-price-chip {
  padding: 0.5rem 1rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.25);
  border-radius: var(--r-lg, 10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.bsv-chip-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-muted, #94a3b8);
  text-transform: uppercase;
}

.bsv-chip-val {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--brand, #22c55e);
  line-height: 1.1;
}

.bsv-chip-sub {
  font-size: 0.65rem;
  color: var(--text-dim, #94a3b8);
}

/* ── Live KPI Summary Strip ────────────────────────────────── */
.bsv-stations-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.bsv-kpi-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem;
  background: var(--surface, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: var(--r-xl, 14px);
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.bsv-kpi-card:hover {
  border-color: var(--border-bright, rgba(255, 255, 255, 0.18));
  transform: translateY(-2px);
}

.bsv-kpi-icon {
  font-size: 1.75rem;
  flex-shrink: 0;
}

.bsv-kpi-details {
  display: flex;
  flex-direction: column;
}

.bsv-kpi-val {
  font-family: var(--font-display, var(--acob-font-sans));
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text, #ffffff);
  line-height: 1.1;
}

.bsv-kpi-lbl {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-dim, #94a3b8);
}

.bsv-kpi-hint {
  font-size: 0.68rem;
  color: var(--text-muted, #64748b);
  margin-top: 0.2rem;
}

.bsv-kpi-val--green { color: var(--brand, #22c55e); }
.bsv-kpi-val--amber { color: #f59e0b; }
.bsv-kpi-val--blue { color: #38bdf8; }

/* ── Search & Filter Toolbar ───────────────────────────────── */
.bsv-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.bsv-search-box {
  position: relative;
  flex: 1;
  min-width: 280px;
}

.bsv-search-icon {
  position: absolute;
  left: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.85rem;
  pointer-events: none;
  opacity: 0.6;
}

.bsv-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.65rem 2.2rem 0.65rem 2.4rem;
  background: var(--surface, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: var(--r-md, 8px);
  color: var(--text, #ffffff);
  font-size: 0.84rem;
  font-family: var(--font-sans);
  outline: none;
  transition: border-color 0.15s ease;
}

.bsv-search-input:focus {
  border-color: var(--brand, #22c55e);
  background: var(--surface-2, rgba(255, 255, 255, 0.07));
}

.bsv-clear-btn {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-dim, #94a3b8);
  font-size: 0.8rem;
  cursor: pointer;
}

.bsv-filter-chips {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 2px;
}

.bsv-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  border-radius: var(--r-full, 9999px);
  background: var(--surface, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  color: var(--text-dim, #94a3b8);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.bsv-filter-chip:hover {
  background: var(--surface-2, rgba(255, 255, 255, 0.08));
  color: var(--text, #ffffff);
}

.bsv-filter-chip--active {
  background: rgba(34, 197, 94, 0.15);
  border-color: var(--brand, #22c55e);
  color: var(--brand, #22c55e);
}

.bsv-chip-count {
  font-size: 0.7rem;
  padding: 0.1rem 0.35rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.1);
}

.bsv-view-switch {
  display: flex;
  background: var(--surface, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: var(--r-md, 8px);
  padding: 2px;
  gap: 2px;
}

.bsv-view-btn {
  padding: 0.45rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-dim, #94a3b8);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.bsv-view-btn--active {
  background: var(--surface-2, rgba(255, 255, 255, 0.12));
  color: var(--text, #ffffff);
}

/* ── Stations Cards Grid ───────────────────────────────────── */
.bsv-stations-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.bsv-station-card {
  display: flex;
  flex-direction: column;
  background: var(--surface, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: var(--r-2xl, 18px);
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  transition: border-color 0.18s ease, transform 0.18s ease;
}

.bsv-station-card:hover {
  border-color: rgba(34, 197, 94, 0.35);
  transform: translateY(-2px);
}

/* Card Header */
.bsv-sc-header {
  padding: 1.25rem 1.25rem 0.9rem;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.bsv-sc-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.bsv-station-name-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.bsv-sc-name {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text, #ffffff);
}

.bsv-city-badge {
  padding: 0.2rem 0.5rem;
  border-radius: var(--r-sm, 6px);
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(34, 197, 94, 0.12);
  color: var(--brand, #22c55e);
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.bsv-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
}

.bsv-status-badge--open {
  background: rgba(34, 197, 94, 0.1);
  color: var(--brand, #22c55e);
}

.bsv-status-badge .bsv-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand, #22c55e);
}

.bsv-sc-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.bsv-sc-address {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--text-dim, #94a3b8);
}

.bsv-directions-link {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--brand, #22c55e);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  white-space: nowrap;
}

.bsv-directions-link:hover {
  text-decoration: underline;
}

.bsv-sc-operator {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.76rem;
  color: var(--text-muted, #64748b);
  flex-wrap: wrap;
}

.bsv-operator-name {
  color: var(--text, #ffffff);
}

.bsv-phone-link {
  color: var(--brand, #22c55e);
  text-decoration: none;
  font-weight: 600;
}

.bsv-phone-link:hover {
  text-decoration: underline;
}

/* Card Capacity Gauge */
.bsv-sc-capacity {
  padding: 0.9rem 1.25rem;
  background: rgba(255, 255, 255, 0.015);
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.06));
}

.bsv-cap-labels {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.bsv-cap-title {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted, #94a3b8);
}

.bsv-cap-breakdown {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.bsv-stat-tag {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: var(--r-sm, 6px);
}

.bsv-stat-tag--green {
  background: rgba(34, 197, 94, 0.12);
  color: var(--brand, #22c55e);
}

.bsv-stat-tag--amber {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.bsv-stat-tag--blue {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
}

.bsv-cap-bar-wrap {
  height: 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 9999px;
  overflow: hidden;
  display: flex;
}

.bsv-cap-bar--ready {
  background: var(--brand, #22c55e);
  height: 100%;
  transition: width 0.3s ease;
}

.bsv-cap-bar--charging {
  background: #f59e0b;
  height: 100%;
  transition: width 0.3s ease;
}

/* ── Locker Cabinet View (Tactile Doors) ───────────────────── */
.bsv-cabinet-view {
  padding: 1rem 1.25rem;
  flex: 1;
}

.bsv-cabinet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.bsv-cab-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text, #ffffff);
}

.bsv-cab-hint {
  font-size: 0.68rem;
  color: var(--text-dim, #94a3b8);
}

.bsv-locker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.65rem;
}

.bsv-locker-door {
  padding: 0.65rem;
  border-radius: var(--r-lg, 10px);
  background: var(--surface-2, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 100px;
  position: relative;
}

.bsv-locker-door:hover {
  transform: translateY(-2px);
}

.bsv-locker-door--ready {
  background: rgba(34, 197, 94, 0.06);
  border-color: rgba(34, 197, 94, 0.35);
}

.bsv-locker-door--ready:hover {
  border-color: var(--brand, #22c55e);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
}

.bsv-locker-door--charging {
  background: rgba(245, 158, 11, 0.05);
  border-color: rgba(245, 158, 11, 0.25);
}

.bsv-locker-door--empty {
  border-style: dashed;
  border-color: rgba(56, 189, 248, 0.3);
  background: rgba(56, 189, 248, 0.03);
}

.bsv-door-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bsv-door-num {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted, #94a3b8);
}

.bsv-door-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #64748b;
}

.bsv-locker-door--ready .bsv-door-indicator {
  background: var(--brand, #22c55e);
  box-shadow: 0 0 6px var(--brand, #22c55e);
}

.bsv-locker-door--charging .bsv-door-indicator {
  background: #f59e0b;
}

.bsv-locker-door--empty .bsv-door-indicator {
  background: #38bdf8;
}

.bsv-door-content {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.bsv-charge-big {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--brand, #22c55e);
  line-height: 1;
}

.bsv-charge-big--amber {
  color: #f59e0b;
}

.bsv-door-status-lbl {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text, #ffffff);
}

.bsv-door-volt, .bsv-door-est, .bsv-door-drop-hint {
  font-size: 0.62rem;
  color: var(--text-dim, #94a3b8);
}

.bsv-door-take-btn {
  margin-top: 0.35rem;
  padding: 0.25rem 0.45rem;
  border-radius: 4px;
  background: var(--brand, #22c55e);
  color: #041208;
  font-size: 0.65rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  text-align: center;
}

.bsv-door-take-btn:hover {
  background: #16a34a;
}

/* ── Table View ────────────────────────────────────────────── */
.bsv-sc-rack {
  padding: 0.75rem 1.25rem;
  flex: 1;
}

.bsv-table-responsive {
  overflow-x: auto;
}

.bsv-rack-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.bsv-rack-table th {
  text-align: left;
  padding: 0.5rem 0.6rem;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted, #94a3b8);
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}

.bsv-rack-table td {
  padding: 0.55rem 0.6rem;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.04));
  color: var(--text, #ffffff);
}

.bsv-td-center { text-align: center; }
.bsv-td-right { text-align: right; }

.bsv-bat-id-cell {
  display: flex;
  flex-direction: column;
}

.bsv-sub-sn {
  font-size: 0.62rem;
  color: var(--text-muted, #64748b);
}

.bsv-mono {
  font-family: var(--font-mono, monospace);
  font-weight: 600;
}

.bsv-mini-soc {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bsv-mini-soc-wrap {
  width: 50px;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  overflow: hidden;
}

.bsv-mini-soc-fill {
  height: 100%;
  border-radius: 9999px;
}

.bsv-soc-number {
  font-size: 0.74rem;
  font-weight: 700;
  font-family: var(--font-mono);
}

.bsv-bat-status {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.68rem;
  font-weight: 600;
}

.bsv-bat-status--ready {
  background: rgba(34, 197, 94, 0.12);
  color: var(--brand, #22c55e);
}

.bsv-bat-status--charging {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.bsv-btn-take-pack {
  padding: 0.25rem 0.65rem;
  border-radius: 4px;
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: var(--brand, #22c55e);
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
}

.bsv-btn-take-pack:hover {
  background: var(--brand, #22c55e);
  color: #041208;
}

.bsv-charging-hint {
  font-size: 0.68rem;
  color: var(--text-muted, #64748b);
}

.bsv-table-empty {
  text-align: center;
  padding: 1.5rem;
  color: var(--text-dim, #94a3b8);
  font-style: italic;
}

/* Card Footer */
.bsv-sc-footer {
  padding: 1rem 1.25rem;
  background: var(--surface-2, rgba(255, 255, 255, 0.02));
  border-top: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.bsv-footer-info {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.76rem;
  color: var(--text-dim, #94a3b8);
}

.bsv-footer-info strong {
  color: var(--brand, #22c55e);
}

.bsv-btn-swap-here {
  padding: 0.65rem 1.25rem;
  border-radius: var(--r-md, 8px);
  background: var(--brand, #22c55e);
  color: #041308;
  font-size: 0.82rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 40px;
}

.bsv-btn-swap-here:hover:not(:disabled) {
  background: #16a34a;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.bsv-btn-swap-here:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-dim, #94a3b8);
}

/* ── Recent Swaps History Log ──────────────────────────────── */
.bsv-swap-log {
  background: var(--surface, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: var(--r-2xl, 18px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.bsv-swap-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.bsv-swap-log-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text, #ffffff);
}

.bsv-swap-log-sub {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  color: var(--text-dim, #94a3b8);
}

.bsv-badge-count {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.25rem 0.65rem;
  border-radius: var(--r-full, 9999px);
  background: rgba(34, 197, 94, 0.12);
  color: var(--brand, #22c55e);
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.bsv-swap-log-table-wrap {
  overflow-x: auto;
}

.bsv-swap-log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.bsv-swap-log-table th {
  text-align: left;
  padding: 0.65rem 0.75rem;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted, #94a3b8);
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  white-space: nowrap;
}

.bsv-swap-log-table td {
  padding: 0.7rem 0.75rem;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.04));
  color: var(--text, #ffffff);
}

.bsv-td-ts {
  color: var(--text-dim, #94a3b8);
  white-space: nowrap;
}

.bsv-bike-tag {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text, #ffffff);
}

.bsv-rider-name {
  font-weight: 600;
}

.bsv-pack-exchange-cell {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.bsv-soc-tag {
  padding: 0.1rem 0.45rem;
  border-radius: 9999px;
  font-size: 0.68rem;
  font-weight: 700;
}

.bsv-soc-tag--low {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.bsv-soc-tag--high {
  background: rgba(34, 197, 94, 0.15);
  color: var(--brand, #22c55e);
}

.bsv-fee-badge {
  font-weight: 700;
  color: var(--brand, #22c55e);
  font-family: var(--font-mono);
}

/* ── Enhanced Responsiveness Across Breakpoints ─────────────── */

/* Large Tablets & Small Laptops (<= 1100px) */
@media (max-width: 1100px) {
  .bsv-guide-banner {
    grid-template-columns: repeat(3, 1fr);
  }
  .bsv-guide-price-chip {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: space-between;
    padding: 0.6rem 1rem;
  }
  .bsv-stations-kpis {
    grid-template-columns: repeat(2, 1fr);
  }
  .bsv-locker-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Tablets (<= 850px) */
@media (max-width: 850px) {
  .bsv-stations-grid {
    grid-template-columns: 1fr;
  }
  .bsv-locker-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Mobile Devices (<= 640px) */
@media (max-width: 640px) {
  .bsv-stations-page {
    padding: 1rem;
    gap: 1rem;
  }
  .bsv-stations-header {
    flex-direction: column;
    align-items: stretch;
  }
  .bsv-stations-header-actions {
    width: 100%;
  }
  .bsv-stations-header-actions .bsv-btn {
    flex: 1;
  }
  .bsv-guide-banner {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  .bsv-stations-kpis {
    grid-template-columns: 1fr;
  }
  .bsv-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .bsv-search-box {
    width: 100%;
  }
  .bsv-locker-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .bsv-sc-footer {
    flex-direction: column;
    align-items: stretch;
  }
  .bsv-btn-swap-here {
    width: 100%;
  }
}
</style>
