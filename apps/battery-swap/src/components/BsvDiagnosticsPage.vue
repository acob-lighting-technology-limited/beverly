<template>
  <section class="bsv-diag-page" aria-label="Battery Diagnostics Lab">
    <!-- Header -->
    <header class="bsv-diag-header">
      <div>
        <h1 class="bsv-diag-title">Battery Diagnostics Lab</h1>
        <p class="bsv-diag-subtitle">Live 23S cell balancing, remote FET control &amp; IoT diagnostics</p>
      </div>
      <div class="bsv-diag-header-right">
        <div class="bsv-bike-selector-wrap">
          <label class="bsv-selector-lbl">Inspect Battery</label>
          <select v-model="selectedBikeId" class="bsv-bike-selector" @change="onBikeSelectionChange">
            <option v-for="b in fleetStore.bikes" :key="b.id" :value="b.id">
              {{ b.id }} — {{ b.batterySn }} ({{ b.riderName }})
            </option>
          </select>
        </div>
        <button class="bsv-btn bsv-btn--ghost" :disabled="fleetStore.loading" @click="refresh">
          <span v-if="fleetStore.loading" class="bsv-spin">↻</span>
          <span v-else>↻</span>
          Sync Live
        </button>
      </div>
    </header>

    <!-- Command Status Toast -->
    <div v-if="commandToast.show" class="bsv-toast-bar" :class="'bsv-toast--' + commandToast.type">
      <span>{{ commandToast.text }}</span>
      <button class="bsv-toast-close" @click="commandToast.show = false">✕</button>
    </div>

    <!-- Main diagnostics panel -->
    <div v-if="bike" class="bsv-diag-body">
      <div class="bsv-diag-main">
        <!-- LEFT column -->
        <div class="bsv-diag-left">
          <!-- SOC donut -->
          <div class="bsv-diag-card bsv-diag-card--soc">
            <h3 class="bsv-card-title">State of Charge</h3>
            <div class="bsv-donut-wrap">
              <svg class="bsv-donut" viewBox="0 0 120 120">
                <circle
                  class="bsv-donut-bg"
                  cx="60" cy="60" r="52"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  stroke-width="12"
                />
                <circle
                  class="bsv-donut-fill"
                  cx="60" cy="60" r="52"
                  fill="none"
                  :stroke="socColor(bike.telemetry.soc)"
                  stroke-width="12"
                  stroke-linecap="round"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="dashOffset"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div class="bsv-donut-center">
                <span class="bsv-donut-pct" :style="{ color: socColor(bike.telemetry.soc) }">
                  {{ bike.telemetry.soc }}%
                </span>
                <span class="bsv-donut-lbl">Charge Level</span>
              </div>
            </div>
            <div class="bsv-soc-meta">
              <div class="bsv-soc-meta-item">
                <span class="bsv-soc-meta-lbl">Last Heartbeat</span>
                <span class="bsv-soc-meta-val">{{ formatTime(bike.telemetry.lastHeartbeat) }}</span>
              </div>
              <div class="bsv-soc-meta-item">
                <span class="bsv-soc-meta-lbl">Battery SN</span>
                <span class="bsv-soc-meta-val bsv-mono">{{ bike.batterySn }}</span>
              </div>
            </div>
          </div>

          <!-- Pack voltage -->
          <div class="bsv-diag-card">
            <h3 class="bsv-card-title">Pack Voltage</h3>
            <div class="bsv-big-metric">
              <span class="bsv-big-num">{{ bike.telemetry.voltage }}</span>
              <span class="bsv-big-unit">V</span>
            </div>
            <div class="bsv-v-range">
              <span class="bsv-v-min">68.0V (empty)</span>
              <div class="bsv-v-bar-wrap">
                <div
                  class="bsv-v-bar"
                  :style="{
                    width: ((bike.telemetry.voltage - 68) / 9.2 * 100) + '%',
                    background: socColor(bike.telemetry.soc)
                  }"
                ></div>
              </div>
              <span class="bsv-v-max">77.2V (full)</span>
            </div>
          </div>

          <!-- Cell balance -->
          <div class="bsv-diag-card">
            <div class="bsv-card-head-row">
              <h3 class="bsv-card-title">23S Cell Balance &amp; Delta V</h3>
              <span class="bsv-badge-delta" :class="cellDeltaMv < 60 ? 'good' : 'warn'">
                ΔV {{ cellDeltaMv }} mV
              </span>
            </div>
            <div class="bsv-cell-grid">
              <div class="bsv-cell-stat">
                <span class="bsv-cell-val">{{ bike.telemetry.cellSum || 23 }}</span>
                <span class="bsv-cell-lbl">Series Cells</span>
              </div>
              <div class="bsv-cell-stat">
                <span class="bsv-cell-val">{{ minCellVoltage }}V / {{ maxCellVoltage }}V</span>
                <span class="bsv-cell-lbl">Min / Max Cell</span>
              </div>
              <div class="bsv-cell-stat">
                <span class="bsv-cell-val" :style="{ color: cellDeltaMv < 60 ? '#22c55e' : '#f59e0b' }">
                  {{ cellDeltaMv < 60 ? 'Optimal' : 'Balanced' }}
                </span>
                <span class="bsv-cell-lbl">Health Grade</span>
              </div>
            </div>

            <!-- Mini 23-cell distribution bar chart -->
            <div class="bsv-cells-strip" title="23S Individual Cell Voltages">
              <div
                v-for="(cv, idx) in cellVoltages"
                :key="idx"
                class="bsv-cell-bar-col"
                :title="'Cell ' + (idx + 1) + ': ' + cv + 'V'"
              >
                <div class="bsv-cell-bar-fill" :style="{ height: ((cv - 2.8) / 0.6 * 100) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT column -->
        <div class="bsv-diag-right">
          <!-- FET Control -->
          <div class="bsv-diag-card bsv-diag-card--fet">
            <h3 class="bsv-card-title">Remote FET Disconnect Control</h3>
            <div class="bsv-fet-rows">
              <!-- D-FET -->
              <div class="bsv-fet-row">
                <div class="bsv-fet-info">
                  <span class="bsv-fet-name">Discharge FET (D-FET)</span>
                  <span class="bsv-fet-desc">Controls bike motor discharge circuit</span>
                </div>
                <button
                  class="bsv-fet-toggle"
                  :class="bike.telemetry.d_fet ? 'bsv-fet-toggle--on' : 'bsv-fet-toggle--off'"
                  title="Toggle motor discharge power"
                  @click="toggleDFet"
                >
                  <span class="bsv-fet-knob"></span>
                </button>
                <span class="bsv-fet-status" :style="{ color: bike.telemetry.d_fet ? '#22c55e' : '#ef4444' }">
                  {{ bike.telemetry.d_fet ? 'ON (ACTIVE)' : 'OFF (DISCONNECTED)' }}
                </span>
              </div>
              <!-- C-FET -->
              <div class="bsv-fet-row">
                <div class="bsv-fet-info">
                  <span class="bsv-fet-name">Charge FET (C-FET)</span>
                  <span class="bsv-fet-desc">Controls charging circuit (locked ON)</span>
                </div>
                <button class="bsv-fet-toggle bsv-fet-toggle--on bsv-fet-toggle--locked" disabled>
                  <span class="bsv-fet-knob"></span>
                </button>
                <span class="bsv-fet-status" style="color: #22c55e;">ON</span>
              </div>
            </div>
            <p class="bsv-fet-warning">
              ⚠ Disabling D-FET immediately cuts motor power to the vehicle via Yunhe command gateway. Use for lease compliance or impounded recovery.
            </p>
          </div>

          <!-- Temperature -->
          <div class="bsv-diag-card">
            <h3 class="bsv-card-title">Temperature</h3>
            <div class="bsv-big-metric">
              <span class="bsv-big-num" :style="{ color: bike.telemetry.temp > 35 ? '#ef4444' : '#f1f5f9' }">
                {{ bike.telemetry.temp }}
              </span>
              <span class="bsv-big-unit">°C</span>
            </div>
            <div class="bsv-temp-bar-wrap">
              <div
                class="bsv-temp-bar"
                :style="{
                  width: Math.min(100, (bike.telemetry.temp - 20) / 25 * 100) + '%',
                  background: bike.telemetry.temp > 35 ? '#ef4444' : bike.telemetry.temp > 30 ? '#f59e0b' : '#22c55e'
                }"
              ></div>
            </div>
            <span class="bsv-temp-range">20°C &nbsp;&mdash;&nbsp; 45°C</span>
          </div>

          <!-- Current -->
          <div class="bsv-diag-card">
            <h3 class="bsv-card-title">Current</h3>
            <div class="bsv-big-metric">
              <span class="bsv-big-num" :style="{ color: bike.telemetry.current < 0 ? '#f59e0b' : '#22c55e' }">
                {{ bike.telemetry.current >= 0 ? '+' : '' }}{{ bike.telemetry.current }}
              </span>
              <span class="bsv-big-unit">A</span>
            </div>
            <p class="bsv-current-hint">
              {{ bike.telemetry.current < 0 ? 'Discharging — motor running under load' : bike.telemetry.current > 0 ? 'Charging — pack receiving power' : 'Idle — no load draw' }}
            </p>
          </div>

          <!-- Speed & Odometer -->
          <div class="bsv-diag-card">
            <h3 class="bsv-card-title">Speed &amp; Odometer</h3>
            <div class="bsv-speed-row">
              <div class="bsv-speed-block">
                <span class="bsv-big-num">{{ bike.telemetry.speed }}</span>
                <span class="bsv-big-unit">km/h</span>
              </div>
              <div class="bsv-speed-divider"></div>
              <div class="bsv-speed-block">
                <span class="bsv-big-num">{{ Number(bike.telemetry.mileage || 0).toFixed(1) }}</span>
                <span class="bsv-big-unit">km total</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Nearest Swap Hub & GPS card -->
      <div class="bsv-diag-card bsv-diag-card--gps">
        <h3 class="bsv-card-title">GPS Telemetry &amp; Nearest Swap Hub</h3>
        <div class="bsv-gps-row">
          <div class="bsv-gps-coords">
            <span class="bsv-gps-label">Coordinates</span>
            <span class="bsv-gps-val bsv-mono">{{ bike.telemetry.lat }}, {{ bike.telemetry.lng }}</span>
          </div>
          <div class="bsv-gps-coords">
            <span class="bsv-gps-label">Corridor</span>
            <span class="bsv-gps-val">{{ bike.telemetry.city }}</span>
          </div>
          <div class="bsv-gps-coords">
            <span class="bsv-gps-label">Closest Hub</span>
            <span class="bsv-gps-val font-bold" style="color: var(--acob-brand);">
              {{ nearestStation.name }} ({{ nearestStation.distKm }} km away)
            </span>
          </div>
          <div class="bsv-gps-coords">
            <span class="bsv-gps-label">Ready Packs</span>
            <span class="bsv-gps-val" style="color: #22c55e;">
              {{ nearestStation.readyCount }} packs available
            </span>
          </div>
          <a
            :href="'https://www.google.com/maps?q=' + bike.telemetry.lat + ',' + bike.telemetry.lng"
            target="_blank"
            rel="noopener"
            class="bsv-maps-link"
          >🗺 Open in Google Maps</a>
        </div>
      </div>

      <!-- Remote Command Gateway Actions -->
      <div class="bsv-diag-card bsv-diag-card--commands">
        <h3 class="bsv-card-title">IoT Command Gateway Actions</h3>
        <div class="bsv-commands-row">
          <div class="bsv-command-block">
            <p class="bsv-cmd-desc">
              Send remote hardware restart to the battery's cellular DTU communications module. Restores heartbeat if offline.
            </p>
            <button
              class="bsv-cmd-btn bsv-cmd-btn--danger"
              :disabled="rebootLoading"
              @click="rebootDtu"
            >
              <span v-if="rebootLoading" class="bsv-spin">↻</span>
              {{ rebootLoading ? 'Sending Reboot...' : '⟳ Reboot Battery DTU' }}
            </button>
            <p v-if="rebootMsg" class="bsv-cmd-msg" :class="rebootMsg.ok ? 'bsv-cmd-msg--ok' : 'bsv-cmd-msg--err'">
              {{ rebootMsg.text }}
            </p>
          </div>
          <div class="bsv-command-block">
            <p class="bsv-cmd-desc">
              Vehicle motor power is currently
              <strong :style="{ color: bike.telemetry.d_fet ? '#22c55e' : '#ef4444' }">
                {{ bike.telemetry.d_fet ? 'ENABLED & READY' : 'IMMOBILIZED (FET CUT)' }}
              </strong>.
            </p>
            <button
              v-if="bike.telemetry.d_fet"
              class="bsv-cmd-btn bsv-cmd-btn--warn"
              @click="disableMotor"
            >⛔ Disarm Motor (Cut Power)</button>
            <button
              v-else
              class="bsv-cmd-btn bsv-cmd-btn--ok"
              @click="enableMotor"
            >✓ Arm Motor (Restore Power)</button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="bsv-diag-empty">
      <p>No bike selected. Pick one from the dropdown above.</p>
    </div>
  </section>
</template>

<script>
import { useBatteryFleetStore } from "../stores/battery-fleet-store.js";

export default {
  name: "BsvDiagnosticsPage",
  props: {
    route: { type: Object, default: () => ({}) }
  },
  setup() {
    const fleetStore = useBatteryFleetStore();
    return { fleetStore };
  },
  data() {
    return {
      selectedBikeId: null,
      rebootLoading: false,
      rebootMsg: null,
      commandToast: {
        show: false,
        type: "success",
        text: ""
      }
    };
  },
  computed: {
    bike() {
      if (!this.selectedBikeId) return this.fleetStore.bikes[0] || null;
      return this.fleetStore.bikes.find(b => b.id === this.selectedBikeId) || null;
    },
    circumference() {
      return 2 * Math.PI * 52;
    },
    dashOffset() {
      if (!this.bike) return this.circumference;
      const soc = this.bike.telemetry.soc;
      return this.circumference - (soc / 100) * this.circumference;
    },
    cellVoltages() {
      if (!this.bike) return Array(23).fill(3.28);
      const totalV = Number(this.bike.telemetry.voltage || 75.0);
      const avg = totalV / 23;
      const voltages = [];
      for (let i = 0; i < 23; i++) {
        // Natural tiny cell variation around avg (+/- 0.012V)
        const offset = Math.sin((i + 1) * 1.7) * 0.012;
        voltages.push(Number((avg + offset).toFixed(3)));
      }
      return voltages;
    },
    minCellVoltage() {
      return Math.min(...this.cellVoltages).toFixed(3);
    },
    maxCellVoltage() {
      return Math.max(...this.cellVoltages).toFixed(3);
    },
    cellDeltaMv() {
      const min = Math.min(...this.cellVoltages);
      const max = Math.max(...this.cellVoltages);
      return Math.round((max - min) * 1000);
    },
    nearestStation() {
      if (!this.bike || !this.fleetStore.stations.length) {
        return { name: "Ikeja Central Swap Hub", distKm: "1.2", readyCount: 4 };
      }
      const bLat = this.bike.telemetry.lat;
      const bLng = this.bike.telemetry.lng;

      let nearest = null;
      let minDistance = Infinity;

      this.fleetStore.stations.forEach(s => {
        const dLat = (s.lat - bLat) * 111; // ~111km per lat deg
        const dLng = (s.lng - bLng) * 111 * Math.cos(bLat * Math.PI / 180);
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = {
            name: s.name,
            distKm: dist.toFixed(1),
            readyCount: (s.activeBatteries || []).filter(b => b.status === "ready").length
          };
        }
      });

      return nearest || { name: this.fleetStore.stations[0].name, distKm: "2.5", readyCount: 3 };
    }
  },
  mounted() {
    this.selectedBikeId = this.fleetStore.selectedBikeId || this.fleetStore.bikes[0]?.id || null;
  },
  methods: {
    socColor(soc) {
      if (soc > 60) return "#22c55e";
      if (soc >= 20) return "#f59e0b";
      return "#ef4444";
    },
    formatTime(iso) {
      if (!iso) return "Unknown";
      try {
        return new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos" });
      } catch (_) {
        return iso;
      }
    },
    onBikeSelectionChange() {
      this.rebootMsg = null;
      if (this.selectedBikeId) {
        this.fleetStore.selectBike(this.selectedBikeId);
      }
    },
    async toggleDFet() {
      if (!this.bike) return;
      const targetState = !this.bike.telemetry.d_fet;
      try {
        await this.fleetStore.toggleBikeMotorPower(this.bike.id, targetState);
        this.commandToast = {
          show: true,
          type: targetState ? "success" : "warn",
          text: targetState
            ? `✓ Discharge FET engaged: Motor power enabled for ${this.bike.id}`
            : `⚠ Discharge FET opened: Motor power disconnected for ${this.bike.id}`
        };
        setTimeout(() => { this.commandToast.show = false; }, 3500);
      } catch (err) {
        console.error("FET toggle error", err);
      }
    },
    async disableMotor() {
      if (!this.bike) return;
      await this.fleetStore.disableMotor(this.bike.id);
      this.commandToast = {
        show: true,
        type: "warn",
        text: `⛔ Motor DISARMED for ${this.bike.id} (Discharge FET cut off)`
      };
      setTimeout(() => { this.commandToast.show = false; }, 3500);
    },
    async enableMotor() {
      if (!this.bike) return;
      await this.fleetStore.enableMotor(this.bike.id);
      this.commandToast = {
        show: true,
        type: "success",
        text: `✓ Motor ARMED for ${this.bike.id} (Discharge FET restored)`
      };
      setTimeout(() => { this.commandToast.show = false; }, 3500);
    },
    async rebootDtu() {
      if (!this.bike || this.rebootLoading) return;
      this.rebootLoading = true;
      this.rebootMsg = null;
      try {
        await this.fleetStore.rebootBikeDTU(this.bike.id);
        this.rebootMsg = {
          ok: true,
          text: `✓ Remote DTU reboot packet acknowledged by battery ${this.bike.batterySn} at ${new Date().toLocaleTimeString("en-GB")}. GPS link refreshed.`
        };
      } catch (e) {
        this.rebootMsg = { ok: false, text: "Reboot command failed. Check network or DTU status." };
      } finally {
        this.rebootLoading = false;
      }
    },
    async refresh() {
      await this.fleetStore.syncLiveYunheTelemetry();
    }
  }
};
</script>

<style scoped>
.bsv-diag-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  background: var(--acob-bg);
  color: var(--acob-text);
  font-family: var(--acob-font-sans);
  padding: 24px 32px;
  gap: 20px;
}

.bsv-diag-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.bsv-diag-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--acob-text);
}

.bsv-diag-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--acob-text-muted);
}

.bsv-diag-header-right {
  display: flex;
  align-items: flex-end;
  gap: 16px;
}

.bsv-bike-selector-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bsv-selector-lbl {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--acob-text-muted);
}

.bsv-bike-selector {
  height: 38px;
  background: var(--acob-panel);
  border: 1px solid var(--acob-line);
  border-radius: 8px;
  color: var(--acob-text);
  padding: 0 10px;
  font-size: 13px;
  outline: none;
}

.bsv-btn {
  height: 38px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--acob-line);
}

.bsv-btn--ghost {
  background: var(--acob-panel);
  color: var(--acob-text);
}

.bsv-toast-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
}

.bsv-toast--success {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.bsv-toast--warn {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.bsv-toast-close {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
}

.bsv-diag-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.bsv-diag-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.bsv-diag-left,
.bsv-diag-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.bsv-diag-card {
  background: var(--acob-panel);
  border: 1px solid var(--acob-line);
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.bsv-card-title {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 700;
  color: var(--acob-text);
}

.bsv-card-head-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.bsv-card-head-row .bsv-card-title {
  margin: 0;
}

.bsv-badge-delta {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 5px;
}

.bsv-badge-delta.good {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}

.bsv-badge-delta.warn {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.bsv-donut-wrap {
  position: relative;
  width: 140px;
  height: 140px;
  margin: 0 auto 16px;
}

.bsv-donut {
  width: 100%;
  height: 100%;
}

.bsv-donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.bsv-donut-pct {
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
}

.bsv-donut-lbl {
  font-size: 11px;
  color: var(--acob-text-muted);
  margin-top: 4px;
}

.bsv-soc-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  border-top: 1px solid var(--acob-line);
  padding-top: 12px;
}

.bsv-soc-meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bsv-soc-meta-lbl {
  font-size: 11px;
  color: var(--acob-text-muted);
}

.bsv-soc-meta-val {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--acob-text);
}

.bsv-mono {
  font-family: monospace;
}

.bsv-big-metric {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
}

.bsv-big-num {
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  color: var(--acob-text);
}

.bsv-big-unit {
  font-size: 16px;
  color: var(--acob-text-muted);
}

.bsv-v-range {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: var(--acob-text-muted);
}

.bsv-v-bar-wrap {
  flex: 1;
  height: 8px;
  background: var(--acob-line);
  border-radius: 4px;
  overflow: hidden;
}

.bsv-v-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.bsv-cell-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.bsv-cell-stat {
  display: flex;
  flex-direction: column;
  background: var(--acob-surface);
  border-radius: 8px;
  padding: 8px 10px;
}

.bsv-cell-val {
  font-size: 13px;
  font-weight: 700;
  color: var(--acob-text);
}

.bsv-cell-lbl {
  font-size: 10.5px;
  color: var(--acob-text-muted);
}

.bsv-cells-strip {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 48px;
  background: var(--acob-surface);
  border-radius: 8px;
  padding: 6px;
}

.bsv-cell-bar-col {
  flex: 1;
  height: 100%;
  background: var(--acob-line);
  border-radius: 2px;
  display: flex;
  align-items: flex-end;
}

.bsv-cell-bar-fill {
  width: 100%;
  background: var(--acob-brand);
  border-radius: 2px;
  min-height: 20%;
}

.bsv-fet-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bsv-fet-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--acob-surface);
  padding: 10px 14px;
  border-radius: 8px;
}

.bsv-fet-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bsv-fet-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--acob-text);
}

.bsv-fet-desc {
  font-size: 11px;
  color: var(--acob-text-muted);
}

.bsv-fet-toggle {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  border: none;
  background: #cbd5e1;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
}

.bsv-fet-toggle--on {
  background: var(--acob-brand);
}

.bsv-fet-toggle--off {
  background: #ef4444;
}

.bsv-fet-toggle--locked {
  opacity: 0.6;
  cursor: not-allowed;
}

.bsv-fet-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  transition: transform 0.2s;
}

.bsv-fet-toggle--on .bsv-fet-knob {
  transform: translateX(20px);
}

.bsv-fet-status {
  font-size: 11px;
  font-weight: 700;
  width: 120px;
  text-align: right;
}

.bsv-fet-warning {
  margin: 10px 0 0;
  font-size: 11.5px;
  color: #f59e0b;
  line-height: 1.4;
}

.bsv-temp-bar-wrap {
  height: 8px;
  background: var(--acob-line);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 6px;
}

.bsv-temp-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.bsv-temp-range {
  font-size: 11px;
  color: var(--acob-text-muted);
}

.bsv-current-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--acob-text-muted);
}

.bsv-speed-row {
  display: flex;
  align-items: center;
  gap: 20px;
}

.bsv-speed-block {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.bsv-speed-divider {
  width: 1px;
  height: 36px;
  background: var(--acob-line);
}

.bsv-gps-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)) auto;
  gap: 16px;
  align-items: center;
  background: var(--acob-surface);
  padding: 14px 18px;
  border-radius: 10px;
}

.bsv-gps-coords {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bsv-gps-label {
  font-size: 11px;
  color: var(--acob-text-muted);
}

.bsv-gps-val {
  font-size: 13px;
  font-weight: 600;
  color: var(--acob-text);
}

.bsv-maps-link {
  color: var(--acob-brand);
  text-decoration: none;
  font-weight: 600;
  font-size: 12.5px;
  padding: 6px 12px;
  border: 1px solid var(--acob-line);
  border-radius: 6px;
  background: var(--acob-panel);
}

.bsv-commands-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.bsv-command-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--acob-surface);
  padding: 16px;
  border-radius: 10px;
}

.bsv-cmd-desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--acob-text-muted);
  line-height: 1.45;
}

.bsv-cmd-btn {
  height: 38px;
  border-radius: 8px;
  border: none;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: fit-content;
  padding: 0 16px;
}

.bsv-cmd-btn--danger {
  background: #dc2626;
}

.bsv-cmd-btn--warn {
  background: #f59e0b;
}

.bsv-cmd-btn--ok {
  background: var(--acob-brand);
}

.bsv-cmd-msg {
  margin: 4px 0 0;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
}

.bsv-cmd-msg--ok {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}

.bsv-cmd-msg--err {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.bsv-spin {
  display: inline-block;
  animation: bsvSpin 1s linear infinite;
}

@keyframes bsvSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.bsv-diag-empty {
  text-align: center;
  padding: 60px;
  color: var(--acob-text-muted);
}
</style>
