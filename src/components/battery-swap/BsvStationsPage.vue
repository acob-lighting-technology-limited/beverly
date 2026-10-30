<template>
  <section class="bsv-stations-page" aria-label="Swap Stations & Racks">
    <!-- Header -->
    <header class="bsv-stations-header">
      <div>
        <h1 class="bsv-stations-title">Swap Stations &amp; Racks</h1>
        <p class="bsv-stations-subtitle">Battery inventory across all charging hubs</p>
      </div>
      <div class="bsv-stations-header-actions">
        <button class="bsv-btn bsv-btn--ghost" :disabled="fleetStore.loading" @click="refresh">
          <span v-if="fleetStore.loading" class="bsv-spin">↻</span>
          <span v-else>↻</span>
          Refresh
        </button>
      </div>
    </header>

    <!-- Summary KPIs -->
    <div class="bsv-stations-kpis">
      <div class="bsv-kpi-card">
        <span class="bsv-kpi-icon">🏪</span>
        <div>
          <span class="bsv-kpi-val">{{ fleetStore.stations.length }}</span>
          <span class="bsv-kpi-lbl">Total Stations</span>
        </div>
      </div>
      <div class="bsv-kpi-card bsv-kpi-card--green">
        <span class="bsv-kpi-icon">✅</span>
        <div>
          <span class="bsv-kpi-val bsv-kpi-val--green">{{ totalReady }}</span>
          <span class="bsv-kpi-lbl">Batteries Ready</span>
        </div>
      </div>
      <div class="bsv-kpi-card bsv-kpi-card--amber">
        <span class="bsv-kpi-icon">⚡</span>
        <div>
          <span class="bsv-kpi-val bsv-kpi-val--amber">{{ totalCharging }}</span>
          <span class="bsv-kpi-lbl">Charging Now</span>
        </div>
      </div>
    </div>

    <!-- Scrollable content area -->
    <div class="bsv-stations-body">
      <!-- Station cards grid -->
      <div class="bsv-stations-grid">
        <div
          v-for="station in fleetStore.stations"
          :key="station.id"
          class="bsv-station-card"
        >
          <!-- Card header -->
          <div class="bsv-sc-header">
            <div class="bsv-sc-name-row">
              <h2 class="bsv-sc-name">{{ station.name }}</h2>
              <span class="bsv-city-badge">{{ station.city }}</span>
            </div>
            <div class="bsv-sc-address">
              <span class="bsv-pin-icon">📍</span>
              {{ station.address }}
            </div>
            <div class="bsv-sc-operator">
              Operator: <strong>{{ station.operatorName }}</strong>
              &nbsp;&bull;&nbsp;
              <a :href="'tel:' + station.operatorPhone" class="bsv-phone-link">{{ station.operatorPhone }}</a>
            </div>
          </div>

          <!-- Capacity gauge -->
          <div class="bsv-sc-capacity">
            <div class="bsv-cap-labels">
              <span class="bsv-cap-lbl">Rack Capacity</span>
              <span class="bsv-cap-nums">
                <span class="bsv-cap-ready">{{ readyBatteries(station).length }} ready</span>
                &nbsp;&bull;&nbsp;
                <span class="bsv-cap-charging">{{ chargingBatteries(station).length }} charging</span>
                &nbsp;&bull;&nbsp;
                <span class="bsv-cap-total">{{ station.totalSlots }} total slots</span>
              </span>
            </div>
            <div class="bsv-cap-bar-wrap">
              <div
                class="bsv-cap-bar bsv-cap-bar--ready"
                :style="{ width: (readyBatteries(station).length / station.totalSlots * 100) + '%' }"
              ></div>
              <div
                class="bsv-cap-bar bsv-cap-bar--charging"
                :style="{ width: (chargingBatteries(station).length / station.totalSlots * 100) + '%' }"
              ></div>
            </div>
          </div>

          <!-- Battery rack table -->
          <div class="bsv-sc-rack">
            <table class="bsv-rack-table">
              <thead>
                <tr>
                  <th>Battery SN</th>
                  <th>Charge</th>
                  <th>Voltage</th>
                  <th>Temp</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="bat in station.activeBatteries"
                  :key="bat.sn"
                >
                  <td><span class="bsv-mono bsv-sn-sm">{{ bat.sn }}</span></td>
                  <td>
                    <div class="bsv-mini-soc">
                      <div class="bsv-mini-soc-wrap">
                        <div
                          class="bsv-mini-soc-fill"
                          :style="{ width: bat.soc + '%', background: socColor(bat.soc) }"
                        ></div>
                      </div>
                      <span :style="{ color: socColor(bat.soc) }">{{ bat.soc }}%</span>
                    </div>
                  </td>
                  <td class="bsv-td-center">{{ bat.v }}V</td>
                  <td class="bsv-td-center">{{ bat.temp }}°C</td>
                  <td>
                    <span
                      class="bsv-bat-status"
                      :class="bat.status === 'ready' ? 'bsv-bat-status--ready' : 'bsv-bat-status--charging'"
                    >
                      {{ bat.status === 'ready' ? '✓ Ready' : '↻ Charging' }}
                    </span>
                  </td>
                </tr>
                <tr v-if="!station.activeBatteries || station.activeBatteries.length === 0">
                  <td colspan="5" class="bsv-table-empty">No batteries in rack</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Card footer action -->
          <div class="bsv-sc-footer">
            <button class="bsv-btn-swap-here" @click="openSwap(station.id)">
              ⚡ Record Swap at This Station
            </button>
          </div>
        </div>
      </div>

      <!-- Swap history log -->
      <div class="bsv-swap-log">
        <h2 class="bsv-swap-log-title">Recent Swap Log</h2>
        <div class="bsv-swap-log-table-wrap">
          <table class="bsv-swap-log-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Bike</th>
                <th>Rider</th>
                <th>Battery In (SN / SOC)</th>
                <th>Battery Out (SN / SOC)</th>
                <th>Station</th>
                <th>Fee</th>
                <th>Operator</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="swap in recentSwaps" :key="swap.id">
                <td class="bsv-td-ts">{{ swap.timestamp }}</td>
                <td><span class="bsv-mono">{{ swap.bikeId }}</span></td>
                <td>{{ swap.riderName }}</td>
                <td>
                  <span class="bsv-mono bsv-sn-sm">{{ swap.batteryInSn }}</span>
                  <span class="bsv-soc-tag bsv-soc-tag--low">{{ swap.batteryInSoc }}%</span>
                </td>
                <td>
                  <span class="bsv-mono bsv-sn-sm">{{ swap.batteryOutSn }}</span>
                  <span class="bsv-soc-tag bsv-soc-tag--high">{{ swap.batteryOutSoc }}%</span>
                </td>
                <td class="bsv-td-station">{{ swap.stationName }}</td>
                <td class="bsv-td-fee">{{ fmtNaira(swap.feeMinor) }}</td>
                <td>{{ swap.operatorName }}</td>
              </tr>
              <tr v-if="recentSwaps.length === 0">
                <td colspan="8" class="bsv-table-empty">No swaps recorded yet</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Swap modal -->
    <BatterySwapStationModal
      v-if="swapStationId !== null"
      :bike-id="defaultBikeId"
      @close="swapStationId = null"
    />
  </section>
</template>

<script>
import { useBatteryFleetStore } from "../../stores/battery-fleet-store.js";
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
      swapStationId: null
    };
  },
  computed: {
    totalReady() {
      return this.fleetStore.stations.reduce((acc, s) =>
        acc + (s.activeBatteries || []).filter(b => b.status === "ready").length, 0);
    },
    totalCharging() {
      return this.fleetStore.stations.reduce((acc, s) =>
        acc + (s.activeBatteries || []).filter(b => b.status === "charging").length, 0);
    },
    recentSwaps() {
      return [...this.fleetStore.swaps]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 20);
    },
    defaultBikeId() {
      return this.fleetStore.bikes[0]?.id || "EVB-001";
    }
  },
  methods: {
    readyBatteries(station) {
      return (station.activeBatteries || []).filter(b => b.status === "ready");
    },
    chargingBatteries(station) {
      return (station.activeBatteries || []).filter(b => b.status === "charging");
    },
    socColor(soc) {
      if (soc > 60) return "#22c55e";
      if (soc >= 20) return "#f59e0b";
      return "#ef4444";
    },
    openSwap(stationId) {
      this.swapStationId = stationId;
    },
    fmtNaira(minor) {
      return "₦" + (minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },
    async refresh() {
      await this.fleetStore.syncLiveYunheTelemetry();
    }
  }
};
</script>

<style scoped>
.bsv-stations-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--acob-bg);
  color: var(--acob-text);
  font-family: var(--acob-font-sans);
}

/* Header */
.bsv-stations-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px 0;
  flex-shrink: 0;
}
.bsv-stations-title { font-size: 20px; font-weight: 800; color: var(--acob-text); margin: 0 0 4px; }
.bsv-stations-subtitle { font-size: 12.5px; color: var(--acob-muted); margin: 0; }
.bsv-stations-header-actions { display: flex; gap: 8px; }
.bsv-btn {
  display: flex;
  align-items: center;
  gap: 6px;
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
.bsv-btn--ghost:disabled { opacity: 0.5; cursor: not-allowed; }
.bsv-spin { display: inline-block; animation: bsv-spin 0.8s linear infinite; }
@keyframes bsv-spin { to { transform: rotate(360deg); } }

/* KPIs */
.bsv-stations-kpis {
  display: flex;
  gap: 12px;
  padding: 16px 24px 0;
  flex-shrink: 0;
}
.bsv-kpi-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 12px;
  min-width: 160px;
}
.bsv-kpi-icon { font-size: 22px; }
.bsv-kpi-val { display: block; font-size: 26px; font-weight: 800; color: var(--acob-text); line-height: 1.2; }
.bsv-kpi-val--green { color: var(--acob-brand-bright); }
.bsv-kpi-val--amber { color: var(--acob-gold); }
.bsv-kpi-lbl { display: block; font-size: 11.5px; color: var(--acob-muted); margin-top: 2px; }

/* Body (scrollable) */
.bsv-stations-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 24px;
}
.bsv-stations-body::-webkit-scrollbar { width: 4px; }
.bsv-stations-body::-webkit-scrollbar-thumb { background: rgba(21,128,61,0.30); border-radius: 2px; }

/* Station cards grid */
.bsv-stations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}
.bsv-station-card {
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 14px;
  border-top: 3px solid var(--acob-brand);
  overflow: hidden;
}

/* Card header */
.bsv-sc-header {
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--acob-line);
}
.bsv-sc-name-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.bsv-sc-name { font-size: 14px; font-weight: 800; color: var(--acob-text); margin: 0; flex: 1; }
.bsv-city-badge {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 8px;
  background: rgba(0,128,0,0.12);
  color: var(--acob-brand);
  border-radius: 20px;
  white-space: nowrap;
}
.bsv-sc-address { font-size: 12px; color: var(--acob-muted); margin-bottom: 4px; }
.bsv-pin-icon { margin-right: 4px; }
.bsv-sc-operator { font-size: 11.5px; color: var(--acob-muted); }
.bsv-phone-link { color: var(--acob-accent); text-decoration: none; }
.bsv-phone-link:hover { text-decoration: underline; }

/* Capacity gauge */
.bsv-sc-capacity {
  padding: 12px 18px;
  border-bottom: 1px solid var(--acob-line);
}
.bsv-cap-labels { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.bsv-cap-lbl { font-size: 11px; color: var(--acob-muted); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
.bsv-cap-nums { font-size: 11px; }
.bsv-cap-ready { color: var(--acob-brand-bright); font-weight: 700; }
.bsv-cap-charging { color: var(--acob-gold); font-weight: 700; }
.bsv-cap-total { color: var(--acob-muted); }
.bsv-cap-bar-wrap {
  display: flex;
  height: 6px;
  background: var(--acob-line);
  border-radius: 4px;
  overflow: hidden;
}
.bsv-cap-bar { height: 100%; transition: width 0.4s; }
.bsv-cap-bar--ready { background: var(--acob-brand-bright); }
.bsv-cap-bar--charging { background: var(--acob-gold); }

/* Rack table */
.bsv-sc-rack { padding: 0 18px 0; }
.bsv-rack-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.bsv-rack-table thead th {
  padding: 8px 8px 6px;
  color: var(--acob-muted);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: left;
  border-bottom: 1px solid var(--acob-line);
}
.bsv-rack-table tbody td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--acob-line);
  vertical-align: middle;
}
.bsv-mono { font-family: var(--acob-font-mono); }
.bsv-sn-sm { font-size: 10.5px; color: var(--acob-muted); }
.bsv-mini-soc { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; }
.bsv-mini-soc-wrap { width: 50px; height: 4px; background: var(--acob-line); border-radius: 2px; overflow: hidden; }
.bsv-mini-soc-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
.bsv-td-center { text-align: center; color: var(--acob-muted); }
.bsv-bat-status {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 20px;
  font-size: 10.5px;
  font-weight: 700;
}
.bsv-bat-status--ready { background: rgba(34,197,94,0.12); color: var(--acob-brand-bright); }
.bsv-bat-status--charging {
  background: rgba(245,158,11,0.12);
  color: var(--acob-gold);
  animation: bsv-pulse 2s ease-in-out infinite;
}
@keyframes bsv-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

/* Card footer */
.bsv-sc-footer {
  padding: 12px 18px;
  background: rgba(0,0,0,0.15);
}
.bsv-btn-swap-here {
  width: 100%;
  padding: 9px;
  background: rgba(0,128,0,0.10);
  border: 1px solid rgba(0,128,0,0.35);
  border-radius: 8px;
  color: var(--acob-brand);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.bsv-btn-swap-here:hover { background: rgba(0,128,0,0.18); }

/* Swap log */
.bsv-swap-log {}
.bsv-swap-log-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--acob-text);
  margin: 0 0 12px;
}
.bsv-swap-log-table-wrap { overflow-x: auto; }
.bsv-swap-log-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
  background: var(--acob-surface);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--acob-line);
}
.bsv-swap-log-table thead th {
  padding: 10px 12px;
  background: var(--acob-panel);
  color: var(--acob-muted);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: left;
  border-bottom: 1px solid var(--acob-line);
  white-space: nowrap;
}
.bsv-swap-log-table tbody td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--acob-line);
  color: var(--acob-muted);
  vertical-align: middle;
}
.bsv-swap-log-table tbody tr:last-child td { border-bottom: none; }
.bsv-swap-log-table tbody tr:hover { background: var(--acob-surface-hover); }
.bsv-td-ts { white-space: nowrap; color: var(--acob-muted); font-size: 11px; }
.bsv-td-station { font-size: 11px; color: var(--acob-muted); max-width: 160px; }
.bsv-td-fee { color: var(--acob-brand); font-weight: 700; }
.bsv-soc-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 700;
  margin-left: 4px;
}
.bsv-soc-tag--low { background: rgba(239,68,68,0.12); color: var(--color-danger); }
.bsv-soc-tag--high { background: rgba(34,197,94,0.12); color: var(--acob-brand-bright); }
.bsv-table-empty { text-align: center; padding: 24px; color: var(--color-text-faint); }

@media (max-width: 768px) {
  .bsv-stations-grid { grid-template-columns: 1fr; }
  .bsv-stations-kpis { flex-wrap: wrap; }
}
</style>
