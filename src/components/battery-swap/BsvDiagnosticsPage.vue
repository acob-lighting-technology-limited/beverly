<template>
  <section class="bsv-diag-page" aria-label="Battery Diagnostics Lab">
    <!-- Header -->
    <header class="bsv-diag-header">
      <div>
        <h1 class="bsv-diag-title">Battery Diagnostics Lab</h1>
        <p class="bsv-diag-subtitle">Live cell health, FET control &amp; fault diagnostics</p>
      </div>
      <div class="bsv-diag-header-right">
        <div class="bsv-bike-selector-wrap">
          <label class="bsv-selector-lbl">Inspect Battery</label>
          <select v-model="selectedBikeId" class="bsv-bike-selector">
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
            <h3 class="bsv-card-title">Cell Balance</h3>
            <div class="bsv-cell-grid">
              <div class="bsv-cell-stat">
                <span class="bsv-cell-val">{{ bike.telemetry.cellSum }}</span>
                <span class="bsv-cell-lbl">Cell Count</span>
              </div>
              <div class="bsv-cell-stat">
                <span class="bsv-cell-val">{{ bike.telemetry.loopSum }}</span>
                <span class="bsv-cell-lbl">Loop Sum</span>
              </div>
              <div class="bsv-cell-stat">
                <span class="bsv-cell-val" :style="{ color: bike.telemetry.cellSum === 23 ? '#22c55e' : '#f59e0b' }">
                  {{ bike.telemetry.cellSum === 23 ? 'OK' : 'Check' }}
                </span>
                <span class="bsv-cell-lbl">Balance Status</span>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT column -->
        <div class="bsv-diag-right">
          <!-- FET Control -->
          <div class="bsv-diag-card bsv-diag-card--fet">
            <h3 class="bsv-card-title">FET Control</h3>
            <div class="bsv-fet-rows">
              <!-- D-FET -->
              <div class="bsv-fet-row">
                <div class="bsv-fet-info">
                  <span class="bsv-fet-name">Discharge FET (D-FET)</span>
                  <span class="bsv-fet-desc">Controls motor power to bike</span>
                </div>
                <button
                  class="bsv-fet-toggle"
                  :class="bike.telemetry.d_fet ? 'bsv-fet-toggle--on' : 'bsv-fet-toggle--off'"
                  @click="toggleDFet"
                >
                  <span class="bsv-fet-knob"></span>
                </button>
                <span class="bsv-fet-status" :style="{ color: bike.telemetry.d_fet ? '#22c55e' : '#ef4444' }">
                  {{ bike.telemetry.d_fet ? 'ON' : 'OFF' }}
                </span>
              </div>
              <!-- C-FET -->
              <div class="bsv-fet-row">
                <div class="bsv-fet-info">
                  <span class="bsv-fet-name">Charge FET (C-FET)</span>
                  <span class="bsv-fet-desc">Controls battery charging (locked ON)</span>
                </div>
                <button class="bsv-fet-toggle bsv-fet-toggle--on bsv-fet-toggle--locked" disabled>
                  <span class="bsv-fet-knob"></span>
                </button>
                <span class="bsv-fet-status" style="color: #22c55e;">ON</span>
              </div>
            </div>
            <p class="bsv-fet-warning">
              ⚠ Disabling D-FET cuts motor power to the bike. Only use this for overdue or impounded bikes.
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
              {{ bike.telemetry.current < 0 ? 'Discharging — motor running' : bike.telemetry.current > 0 ? 'Charging — power incoming' : 'Idle — no load' }}
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
                <span class="bsv-big-num">{{ bike.telemetry.mileage.toFixed(1) }}</span>
                <span class="bsv-big-unit">km total</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- GPS Location card -->
      <div class="bsv-diag-card bsv-diag-card--gps">
        <h3 class="bsv-card-title">GPS Location</h3>
        <div class="bsv-gps-row">
          <div class="bsv-gps-coords">
            <span class="bsv-gps-label">Latitude</span>
            <span class="bsv-gps-val bsv-mono">{{ bike.telemetry.lat }}</span>
          </div>
          <div class="bsv-gps-coords">
            <span class="bsv-gps-label">Longitude</span>
            <span class="bsv-gps-val bsv-mono">{{ bike.telemetry.lng }}</span>
          </div>
          <div class="bsv-gps-coords">
            <span class="bsv-gps-label">Area</span>
            <span class="bsv-gps-val">{{ bike.telemetry.city }}</span>
          </div>
          <div class="bsv-gps-coords">
            <span class="bsv-gps-label">GPS Status</span>
            <span class="bsv-gps-val" :style="{ color: bike.telemetry.online ? '#22c55e' : '#64748b' }">
              {{ bike.telemetry.online ? '● Live' : '● Offline' }}
            </span>
          </div>
          <a
            :href="`https://www.google.com/maps?q=${bike.telemetry.lat},${bike.telemetry.lng}`"
            target="_blank"
            rel="noopener"
            class="bsv-maps-link"
          >🗺 Open in Google Maps</a>
        </div>
      </div>

      <!-- Command actions -->
      <div class="bsv-diag-card bsv-diag-card--commands">
        <h3 class="bsv-card-title">Remote Commands</h3>
        <div class="bsv-commands-row">
          <div class="bsv-command-block">
            <p class="bsv-cmd-desc">Restart the battery's DTU module. Use when the bike stops reporting GPS.</p>
            <button
              class="bsv-cmd-btn bsv-cmd-btn--danger"
              :disabled="rebootLoading"
              @click="rebootDtu"
            >
              <span v-if="rebootLoading" class="bsv-spin">↻</span>
              {{ rebootLoading ? 'Rebooting...' : '⟳ Reboot DTU' }}
            </button>
            <p v-if="rebootMsg" class="bsv-cmd-msg" :class="rebootMsg.ok ? 'bsv-cmd-msg--ok' : 'bsv-cmd-msg--err'">
              {{ rebootMsg.text }}
            </p>
          </div>
          <div class="bsv-command-block">
            <p class="bsv-cmd-desc">
              Motor is currently
              <strong :style="{ color: bike.telemetry.d_fet ? '#22c55e' : '#ef4444' }">
                {{ bike.telemetry.d_fet ? 'ENABLED' : 'DISABLED' }}
              </strong>.
            </p>
            <button
              v-if="bike.telemetry.d_fet"
              class="bsv-cmd-btn bsv-cmd-btn--warn"
              @click="disableMotor"
            >⛔ Disable Motor</button>
            <button
              v-else
              class="bsv-cmd-btn bsv-cmd-btn--ok"
              @click="enableMotor"
            >✓ Enable Motor</button>
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
import { useBatteryFleetStore } from "../../stores/battery-fleet-store.js";

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
      rebootMsg: null
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
    }
  },
  mounted() {
    this.selectedBikeId = this.fleetStore.bikes[0]?.id || null;
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
    toggleDFet() {
      if (!this.bike) return;
      const bikeIdx = this.fleetStore.bikes.findIndex(b => b.id === this.bike.id);
      if (bikeIdx < 0) return;
      const current = this.fleetStore.bikes[bikeIdx].telemetry.d_fet;
      this.fleetStore.bikes[bikeIdx].telemetry.d_fet = current ? 0 : 1;
    },
    disableMotor() {
      if (!this.bike) return;
      const bikeIdx = this.fleetStore.bikes.findIndex(b => b.id === this.bike.id);
      if (bikeIdx >= 0) this.fleetStore.bikes[bikeIdx].telemetry.d_fet = 0;
    },
    enableMotor() {
      if (!this.bike) return;
      const bikeIdx = this.fleetStore.bikes.findIndex(b => b.id === this.bike.id);
      if (bikeIdx >= 0) this.fleetStore.bikes[bikeIdx].telemetry.d_fet = 1;
    },
    async rebootDtu() {
      if (!this.bike || this.rebootLoading) return;
      if (!confirm(`Reboot DTU for ${this.bike.id}? This will temporarily disconnect GPS reporting.`)) return;
      this.rebootLoading = true;
      this.rebootMsg = null;
      try {
        await new Promise(r => setTimeout(r, 1500)); // Simulate API call
        this.rebootMsg = { ok: true, text: `DTU reboot command sent to ${this.bike.id} at ${new Date().toLocaleTimeString("en-GB")}` };
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
  overflow: hidden;
  background: var(--acob-bg);
  color: var(--acob-text);
  font-family: var(--acob-font-sans);
}

/* Header */
.bsv-diag-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 0;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.bsv-diag-title { font-size: 20px; font-weight: 800; color: var(--acob-text); margin: 0 0 4px; }
.bsv-diag-subtitle { font-size: 12.5px; color: var(--acob-muted); margin: 0; }
.bsv-diag-header-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.bsv-bike-selector-wrap { display: flex; flex-direction: column; gap: 3px; }
.bsv-selector-lbl { font-size: 10px; color: var(--acob-muted); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
.bsv-bike-selector {
  padding: 7px 10px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 8px;
  color: var(--acob-text);
  font-size: 12.5px;
  outline: none;
  min-width: 280px;
  cursor: pointer;
}
.bsv-bike-selector option { background: var(--acob-panel); }
.bsv-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.bsv-btn--ghost {
  background: transparent;
  border: 1px solid var(--acob-line);
  color: var(--acob-muted);
  margin-top: 14px;
}
.bsv-btn--ghost:hover { background: var(--acob-chip); color: var(--acob-text); }
.bsv-btn--ghost:disabled { opacity: 0.5; cursor: not-allowed; }
.bsv-spin { display: inline-block; animation: bsv-spin 0.8s linear infinite; }
@keyframes bsv-spin { to { transform: rotate(360deg); } }

/* Body (scrollable) */
.bsv-diag-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 24px;
}
.bsv-diag-body::-webkit-scrollbar { width: 4px; }
.bsv-diag-body::-webkit-scrollbar-thumb { background: rgba(21,128,61,0.30); border-radius: 2px; }

/* Main 2-col layout */
.bsv-diag-main {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
.bsv-diag-left, .bsv-diag-right { display: flex; flex-direction: column; gap: 16px; }

/* Card base */
.bsv-diag-card {
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 14px;
  padding: 18px;
}
.bsv-card-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--acob-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 14px;
}

/* SOC donut */
.bsv-diag-card--soc { }
.bsv-donut-wrap {
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: 14px;
}
.bsv-donut { width: 140px; height: 140px; }
.bsv-donut-fill { transition: stroke-dashoffset 0.8s ease; }
.bsv-donut-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.bsv-donut-pct { font-size: 28px; font-weight: 900; line-height: 1; }
.bsv-donut-lbl { font-size: 10px; color: var(--acob-muted); margin-top: 2px; }
.bsv-soc-meta { display: flex; flex-direction: column; gap: 8px; }
.bsv-soc-meta-item { display: flex; justify-content: space-between; align-items: center; }
.bsv-soc-meta-lbl { font-size: 11.5px; color: var(--acob-muted); }
.bsv-soc-meta-val { font-size: 12px; color: var(--acob-text); }
.bsv-mono { font-family: var(--acob-font-mono); }

/* Big metric */
.bsv-big-metric { display: flex; align-items: baseline; gap: 4px; margin-bottom: 10px; }
.bsv-big-num { font-size: 36px; font-weight: 900; color: var(--acob-text); line-height: 1; }
.bsv-big-unit { font-size: 16px; color: var(--acob-muted); font-weight: 600; }

/* Voltage bar */
.bsv-v-range { display: flex; align-items: center; gap: 8px; }
.bsv-v-min, .bsv-v-max { font-size: 10.5px; color: var(--acob-muted); white-space: nowrap; }
.bsv-v-bar-wrap { flex: 1; height: 5px; background: var(--acob-line); border-radius: 3px; overflow: hidden; }
.bsv-v-bar { height: 100%; border-radius: 3px; transition: width 0.4s; }

/* Cell grid */
.bsv-cell-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.bsv-cell-stat { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px; background: var(--acob-chip); border-radius: 8px; }
.bsv-cell-val { font-size: 20px; font-weight: 800; color: var(--acob-text); }
.bsv-cell-lbl { font-size: 10px; color: var(--acob-muted); text-align: center; }

/* FET toggles */
.bsv-diag-card--fet { }
.bsv-fet-rows { display: flex; flex-direction: column; gap: 14px; margin-bottom: 12px; }
.bsv-fet-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--acob-chip); border-radius: 8px; }
.bsv-fet-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.bsv-fet-name { font-size: 13px; font-weight: 700; color: var(--acob-text); }
.bsv-fet-desc { font-size: 11px; color: var(--acob-muted); }
.bsv-fet-toggle {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  border: none;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}
.bsv-fet-toggle--on { background: var(--acob-brand-bright); }
.bsv-fet-toggle--off { background: var(--acob-chip); }
.bsv-fet-toggle--locked { opacity: 0.6; cursor: not-allowed; }
.bsv-fet-knob {
  position: absolute;
  top: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  transition: left 0.2s;
  left: auto;
}
.bsv-fet-toggle--on .bsv-fet-knob { left: calc(100% - 21px); }
.bsv-fet-toggle--off .bsv-fet-knob { left: 3px; }
.bsv-fet-status { font-size: 12px; font-weight: 800; min-width: 30px; text-align: right; }
.bsv-fet-warning {
  font-size: 11.5px;
  color: var(--acob-gold);
  background: rgba(184,134,46,0.08);
  border: 1px solid rgba(184,134,46,0.20);
  border-radius: 6px;
  padding: 8px 10px;
  margin: 0;
}

/* Temperature bar */
.bsv-temp-bar-wrap { height: 5px; background: var(--acob-line); border-radius: 3px; overflow: hidden; margin-bottom: 6px; }
.bsv-temp-bar { height: 100%; border-radius: 3px; transition: width 0.4s; }
.bsv-temp-range { font-size: 10.5px; color: var(--acob-muted); }

/* Current hint */
.bsv-current-hint { font-size: 12px; color: var(--acob-muted); margin: 4px 0 0; }

/* Speed & odo */
.bsv-speed-row { display: flex; align-items: center; gap: 16px; }
.bsv-speed-block { display: flex; align-items: baseline; gap: 4px; }
.bsv-speed-divider { width: 1px; height: 40px; background: var(--acob-line); }

/* GPS card */
.bsv-diag-card--gps {
  display: block;
  margin-bottom: 16px;
}
.bsv-gps-row { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
.bsv-gps-coords { display: flex; flex-direction: column; gap: 3px; }
.bsv-gps-label { font-size: 10.5px; color: var(--acob-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.bsv-gps-val { font-size: 13px; font-weight: 600; color: var(--acob-text); }
.bsv-maps-link {
  margin-left: auto;
  padding: 8px 14px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 8px;
  color: var(--acob-accent);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.15s;
}
.bsv-maps-link:hover { background: var(--acob-chip); }

/* Commands card */
.bsv-diag-card--commands { }
.bsv-commands-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.bsv-command-block { display: flex; flex-direction: column; gap: 10px; }
.bsv-cmd-desc { font-size: 12.5px; color: var(--acob-muted); margin: 0; line-height: 1.5; }
.bsv-cmd-btn {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  align-self: flex-start;
}
.bsv-cmd-btn--danger {
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  color: var(--color-danger);
}
.bsv-cmd-btn--danger:hover:not(:disabled) { background: rgba(239,68,68,0.2); }
.bsv-cmd-btn--danger:disabled { opacity: 0.5; cursor: not-allowed; }
.bsv-cmd-btn--warn {
  background: rgba(184,134,46,0.1);
  border: 1px solid rgba(184,134,46,0.3);
  color: var(--acob-gold);
}
.bsv-cmd-btn--warn:hover { background: rgba(184,134,46,0.2); }
.bsv-cmd-btn--ok {
  background: rgba(34,197,94,0.1);
  border: 1px solid rgba(34,197,94,0.3);
  color: var(--acob-brand-bright);
}
.bsv-cmd-btn--ok:hover { background: rgba(34,197,94,0.2); }
.bsv-cmd-msg {
  font-size: 12px;
  padding: 7px 10px;
  border-radius: 6px;
  margin: 0;
}
.bsv-cmd-msg--ok { background: rgba(34,197,94,0.08); color: var(--acob-brand-bright); }
.bsv-cmd-msg--err { background: rgba(239,68,68,0.08); color: var(--color-danger); }

.bsv-diag-empty { display: flex; align-items: center; justify-content: center; flex: 1; color: var(--color-text-faint); font-size: 14px; }

@media (max-width: 900px) {
  .bsv-diag-main { grid-template-columns: 1fr; }
  .bsv-commands-row { grid-template-columns: 1fr; }
}
</style>
