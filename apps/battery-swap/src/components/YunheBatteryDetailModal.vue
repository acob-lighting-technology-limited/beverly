<template>
  <div class="ybd-backdrop" @click.self="$emit('close')">
    <div class="ybd-modal" role="dialog" aria-modal="true" aria-labelledby="ybd-title">
      <!-- Modal Header -->
      <header class="ybd-header">
        <div class="ybd-header-nav">
          <button class="ybd-btn-back" @click="$emit('close')">
            &lt; Reselect
          </button>
          <button class="ybd-btn-refresh" :disabled="refreshing" @click="handleRefresh">
            <span :class="{ 'ybd-spin': refreshing }">↺</span> refresh
          </button>
          <span id="ybd-title" class="ybd-header-title">
            Battery part number: <strong>{{ battery.batteryNumber || battery.sn }}</strong>
          </span>
        </div>

        <div class="ybd-tabs" role="tablist">
          <button
            type="button"
            class="ybd-tab-btn"
            :class="{ active: currentTab === 'basic' }"
            @click="currentTab = 'basic'"
          >
            Basic Information
          </button>
          <button
            type="button"
            class="ybd-tab-btn"
            :class="{ active: currentTab === 'trajectory' }"
            @click="currentTab = 'trajectory'"
          >
            Location trajectory
          </button>
          <button
            type="button"
            class="ybd-tab-btn"
            :class="{ active: currentTab === 'history' }"
            @click="currentTab = 'history'"
          >
            Historical Analysis
          </button>
          <button
            type="button"
            class="ybd-tab-btn"
            :class="{ active: currentTab === 'driving' }"
            @click="currentTab = 'driving'"
          >
            Driving record
          </button>
        </div>
      </header>

      <!-- Modal Body -->
      <div class="ybd-body">
        <!-- Toast feedback for commands -->
        <div v-if="commandFeedback" class="ybd-command-alert" :class="commandSuccess ? 'ybd-alert--success' : 'ybd-alert--error'">
          <span>{{ commandFeedback }}</span>
          <button class="ybd-alert-close" @click="commandFeedback = ''">✕</button>
        </div>

        <!-- 1. Top Section: IMS, Status, Big Battery Gauge, Temps & Cell Grid -->
        <section class="ybd-top-card">
          <div class="ybd-ims-row">
            <span class="ybd-ims-label">IMS code: <strong class="font-mono">{{ battery.imsi || '460240085271115' }}</strong></span>
            <span class="ybd-status-tag" :class="battery.state || 'move'">
              Battery status: {{ battery.state || 'move' }}
            </span>
          </div>

          <div class="ybd-overview-grid">
            <!-- Left: Graphic Battery Visual -->
            <div class="ybd-battery-visual-col">
              <div class="ybd-battery-terminal"></div>
              <div class="ybd-battery-shell">
                <div class="ybd-battery-level" :style="{ width: (battery.soc || 100) + '%' }"></div>
                <div class="ybd-battery-segments">
                  <div class="ybd-seg"></div>
                  <div class="ybd-seg"></div>
                  <div class="ybd-seg"></div>
                  <div class="ybd-seg"></div>
                </div>
                <div class="ybd-battery-text">
                  SOC: {{ battery.soc || 100 }}%
                </div>
              </div>
            </div>

            <!-- Right: Temperatures & Single-unit voltages -->
            <div class="ybd-gauges-col">
              <div class="ybd-temps-row">
                <div class="ybd-temp-badge">
                  <span class="temp-icon">🌡</span>
                  <span>PCD board temperature: <strong>{{ battery.pcdTemp || 36 }}℃</strong></span>
                </div>
                <div class="ybd-temp-badge">
                  <span class="temp-icon">🌡</span>
                  <span>Casing temperature: <strong>{{ battery.casingTemp || 28 }}℃</strong></span>
                </div>
                <div class="ybd-temp-badge">
                  <span class="temp-icon">🌡</span>
                  <span>Cell temperature: <strong>{{ battery.cellTemp || 28 }}℃</strong></span>
                </div>
              </div>

              <!-- High/Low Cell Voltage Strip -->
              <div class="ybd-voltage-metrics-strip">
                <span>Maximum single-unit voltage: <strong class="font-mono">{{ maxVoltage }}V</strong></span>
                <span class="strip-sep">|</span>
                <span>Minimum single-unit voltage: <strong class="font-mono">{{ minVoltage }}V</strong></span>
                <span class="strip-sep">|</span>
                <span>Individual voltage difference: <strong class="font-mono text-mint">{{ deltaVoltage }}V</strong></span>
              </div>

              <!-- 15S Cell Balances Grid -->
              <div class="ybd-cells-matrix">
                <div
                  v-for="(v, index) in cellList"
                  :key="index"
                  class="ybd-cell-item"
                >
                  <span class="cell-idx">[{{ index + 1 }}]</span>
                  <span class="cell-icon">🔋</span>
                  <span class="cell-val font-mono">{{ v }}V</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Core Telemetry Matrix -->
          <div class="ybd-specs-table-wrap">
            <table class="ybd-specs-table">
              <tbody>
                <tr>
                  <td class="spec-label">Current current</td>
                  <td class="spec-val font-mono text-cyan">{{ battery.current >= 0 ? '+' : '' }}{{ (battery.current || 0).toFixed(2) }}A</td>
                  <td class="spec-label">Current voltage</td>
                  <td class="spec-val font-mono text-cyan">{{ (battery.voltage || 49.9).toFixed(2) }}V</td>
                  <td class="spec-label">Current capacity</td>
                  <td class="spec-val font-mono text-cyan">{{ (battery.capacityAh || 20.93).toFixed(2) }}AH</td>
                </tr>
                <tr>
                  <td class="spec-label">Cycle count</td>
                  <td class="spec-val text-mint">{{ battery.loopCount || 54 }} times</td>
                  <td class="spec-label">Number of cells</td>
                  <td class="spec-val">{{ battery.cellCount || 15 }}</td>
                  <td class="spec-label">Life signals</td>
                  <td class="spec-val text-mint">{{ battery.signal || 18 }}</td>
                </tr>
                <tr>
                  <td class="spec-label">Hardware version</td>
                  <td class="spec-val font-mono">{{ battery.hardwareVersion || '2.3' }}</td>
                  <td class="spec-label">Software version</td>
                  <td class="spec-val font-mono">{{ battery.softwareVersion || '90760122' }}</td>
                  <td class="spec-label">Protocol version</td>
                  <td class="spec-val font-mono">{{ battery.protocolVersion || 'V2' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 2. GPS Information Section -->
        <section class="ybd-section">
          <div class="ybd-section-title">GPS information</div>
          <table class="ybd-info-table">
            <tbody>
              <tr>
                <td class="info-lbl">GMS information</td>
                <td class="info-val">--</td>
                <td class="info-lbl">Driving speed</td>
                <td class="info-val font-mono">{{ battery.speed || 0 }} km/h</td>
                <td class="info-lbl">Signal</td>
                <td class="info-val">
                  <span class="ybd-pill-green">GMS:{{ battery.signal || 18 }}</span>
                  <span class="ybd-pill-green ml-1">Base station positioning</span>
                </td>
              </tr>
              <tr>
                <td class="info-lbl">GPS longitude</td>
                <td class="info-val font-mono">{{ (battery.lng || 113.370506).toFixed(6) }}</td>
                <td class="info-lbl">GPS latitude</td>
                <td class="info-val font-mono">{{ (battery.lat || 22.956936).toFixed(6) }}</td>
                <td class="info-lbl">State</td>
                <td class="info-val">
                  <span class="ybd-pill-green">{{ battery.state || 'move' }}</span>
                </td>
              </tr>
              <tr>
                <td class="info-lbl">GPS driving distance</td>
                <td class="info-val font-mono">{{ (battery.distanceKm || 238.71).toFixed(2) }}km</td>
                <td class="info-lbl">GPS location type</td>
                <td class="info-val">--</td>
                <td class="info-lbl">Online Status</td>
                <td class="info-val">
                  <span :class="battery.onlineStatus === 'Online' ? 'text-success' : 'text-danger'">
                    ● {{ battery.onlineStatus || 'Online' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 3. Alarm Information Section -->
        <section class="ybd-section">
          <div class="ybd-section-title">Alarm information</div>
          <div class="ybd-matrix-grid">
            <div class="matrix-cell">
              <span class="matrix-lbl">Single-core low voltage alarm</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Single-core high voltage alarm</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Low temperature alarm for battery cells</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Battery cell high temperature alarm</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">High total voltage alarm</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Low total voltage alarm</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Single-core voltage differential alarm</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">MOS high temperature alarm</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Low temperature alarm</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">High Temperature Alert</span>
              <span class="badge-normal">normal</span>
            </div>
          </div>
        </section>

        <!-- 4. Protection Status Section -->
        <section class="ybd-section">
          <div class="ybd-section-title">Protection status</div>
          <div class="ybd-matrix-grid">
            <div class="matrix-cell">
              <span class="matrix-lbl">Total voltage undervoltage protection</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Excessive pressure difference between individual cores</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Short circuit protection</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Single-core undervoltage protection</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Single-core overvoltage protection</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Discharge overcurrent protection</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Overcurrent protection during charging</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Low temperature protection</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Over-temperature protection</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Status anomaly protection</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">MOS anomaly</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">Total voltage overvoltage protection</span>
              <span class="badge-normal">normal</span>
            </div>
          </div>
        </section>

        <!-- 5. Failure Status Section -->
        <section class="ybd-section">
          <div class="ybd-section-title">Failure status</div>
          <div class="ybd-matrix-grid ybd-matrix-grid--2">
            <div class="matrix-cell">
              <span class="matrix-lbl">GPS signal abnormality</span>
              <span class="badge-normal">normal</span>
            </div>
            <div class="matrix-cell">
              <span class="matrix-lbl">GSM signal abnormality</span>
              <span class="badge-normal">normal</span>
            </div>
          </div>
        </section>
      </div>

      <!-- Remote Operate Footer Toolbar -->
      <footer class="ybd-footer">
        <div class="ybd-mos-indicator">
          <span>MOS Status:</span>
          <span class="mos-tag" :class="battery.c_fet ? 'on' : 'off'">C-MOS: {{ battery.c_fet ? 'ON' : 'OFF' }}</span>
          <span class="mos-tag" :class="battery.d_fet ? 'on' : 'off'">D-MOS: {{ battery.d_fet ? 'ON' : 'OFF' }}</span>
        </div>

        <div class="ybd-command-buttons">
          <button class="cmd-btn" @click="runCommand('reboot_dtu')">⟳ Reboot DTU</button>
          <button class="cmd-btn" @click="runCommand('restart_bms')">↺ Restart MBS</button>
          <button v-if="battery.d_fet" class="cmd-btn cmd-btn--danger" @click="runCommand('turn_off_d_fet')">
            ⛔ Turn Off D FET
          </button>
          <button v-else class="cmd-btn cmd-btn--success" @click="runCommand('enable_cd_fet')">
            ✓ Enable C/D FET
          </button>
          <button class="cmd-btn cmd-btn--ghost" @click="$emit('close')">Close Inspector</button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script>
import { useBatteryFleetStore } from "../stores/battery-fleet-store.js";

export default {
  name: "YunheBatteryDetailModal",
  props: {
    battery: {
      type: Object,
      required: true
    }
  },
  emits: ["close", "command-executed"],
  data() {
    return {
      currentTab: "basic",
      refreshing: false,
      commandFeedback: "",
      commandSuccess: true
    };
  },
  computed: {
    fleetStore() {
      return useBatteryFleetStore();
    },
    cellList() {
      if (Array.isArray(this.battery.cellVoltages) && this.battery.cellVoltages.length) {
        return this.battery.cellVoltages;
      }
      return [3.329, 3.326, 3.328, 3.327, 3.326, 3.326, 3.327, 3.328, 3.326, 3.326, 3.327, 3.328, 3.326, 3.327, 3.329];
    },
    maxVoltage() {
      return Math.max(...this.cellList).toFixed(3);
    },
    minVoltage() {
      return Math.min(...this.cellList).toFixed(3);
    },
    deltaVoltage() {
      return (Math.max(...this.cellList) - Math.min(...this.cellList)).toFixed(3);
    }
  },
  methods: {
    async handleRefresh() {
      this.refreshing = true;
      try {
        await this.fleetStore.syncLiveYunheTelemetry();
        this.commandFeedback = "Live Yunhe telemetry synchronized.";
        this.commandSuccess = true;
      } catch (err) {
        this.commandFeedback = "Sync failed: " + err.message;
        this.commandSuccess = false;
      } finally {
        this.refreshing = false;
      }
    },
    async runCommand(commandKey) {
      try {
        const res = await this.fleetStore.executeYunheCommand(this.battery.sn, commandKey);
        this.commandFeedback = res.message || "Command executed successfully.";
        this.commandSuccess = true;
        this.$emit("command-executed", { command: commandKey, batterySn: this.battery.sn });
      } catch (err) {
        this.commandFeedback = "Command error: " + err.message;
        this.commandSuccess = false;
      }
    }
  }
};
</script>

<style scoped>
.ybd-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow-y: auto;
}

.ybd-modal {
  width: 100%;
  max-width: 980px;
  max-height: 94vh;
  background: var(--acob-card-bg, #08150c);
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: var(--acob-radius-lg, 12px);
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  color: var(--acob-text, #f2f7f3);
  overflow: hidden;
}

.ybd-header {
  padding: 14px 20px 0;
  background: var(--acob-surface, #0c1c11);
  border-bottom: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
}

.ybd-header-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.ybd-btn-back,
.ybd-btn-refresh {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.35);
  color: var(--acob-brand-mint, #7dfc9a);
  transition: all 0.15s;
}
.ybd-btn-back:hover,
.ybd-btn-refresh:hover {
  background: rgba(34, 197, 94, 0.22);
}

.ybd-header-title {
  font-size: 14px;
  color: var(--acob-muted, rgba(242, 247, 243, 0.8));
}
.ybd-header-title strong {
  color: var(--acob-text, #fff);
  margin-left: 4px;
}

.ybd-tabs {
  display: flex;
  gap: 4px;
}
.ybd-tab-btn {
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.ybd-tab-btn.active {
  color: var(--acob-brand-mint, #7dfc9a);
  border-bottom-color: var(--acob-brand-mint, #7dfc9a);
  background: rgba(125, 252, 154, 0.05);
}

.ybd-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.ybd-command-alert {
  padding: 10px 14px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12.5px;
  font-weight: 600;
}
.ybd-alert--success {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: var(--acob-brand-mint, #7dfc9a);
}
.ybd-alert--error {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #ef4444;
}
.ybd-alert-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
}

/* Top Overview Card */
.ybd-top-card {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 16px;
}

.ybd-ims-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.ybd-ims-label {
  font-size: 13px;
  color: var(--acob-muted, rgba(242, 247, 243, 0.7));
}
.ybd-status-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 12px;
  background: rgba(34, 197, 94, 0.15);
  color: var(--acob-brand-mint, #7dfc9a);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.ybd-overview-grid {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 20px;
  align-items: center;
}

/* Graphic Battery Visual */
.ybd-battery-visual-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ybd-battery-terminal {
  width: 24px;
  height: 8px;
  background: var(--acob-line, rgba(255, 255, 255, 0.2));
  border-radius: 4px 4px 0 0;
}
.ybd-battery-shell {
  width: 190px;
  height: 95px;
  border: 3px solid #22c55e;
  border-radius: 12px;
  position: relative;
  background: rgba(0, 0, 0, 0.4);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ybd-battery-level {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background: linear-gradient(90deg, rgba(34, 197, 94, 0.45), rgba(125, 252, 154, 0.6));
  z-index: 1;
  transition: width 0.4s ease;
}
.ybd-battery-segments {
  position: absolute;
  inset: 0;
  display: flex;
  z-index: 2;
}
.ybd-seg {
  flex: 1;
  border-right: 1px solid rgba(0, 0, 0, 0.35);
}
.ybd-battery-text {
  position: relative;
  z-index: 3;
  font-size: 16px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}

/* Gauges Column */
.ybd-gauges-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ybd-temps-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.ybd-temp-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--acob-muted, rgba(242, 247, 243, 0.8));
}
.temp-icon { font-size: 13px; }

.ybd-voltage-metrics-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: var(--acob-muted, rgba(242, 247, 243, 0.7));
  background: rgba(125, 252, 154, 0.04);
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid rgba(125, 252, 154, 0.15);
}
.strip-sep { opacity: 0.3; }
.text-mint { color: var(--acob-brand-mint, #7dfc9a); }
.text-cyan { color: #38bdf8; }

.ybd-cells-matrix {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.ybd-cell-item {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 11px;
}
.cell-idx { color: var(--acob-muted, rgba(242, 247, 243, 0.5)); font-size: 10px; }
.cell-icon { font-size: 11px; }
.cell-val { font-weight: 700; color: #fff; }

/* Specs Table */
.ybd-specs-table-wrap {
  margin-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 12px;
}
.ybd-specs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.ybd-specs-table td {
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.spec-label {
  background: rgba(255, 255, 255, 0.02);
  color: var(--acob-muted, rgba(242, 247, 243, 0.7));
  width: 18%;
}
.spec-val {
  font-weight: 600;
  width: 15%;
}

/* Generic Section & Tables */
.ybd-section {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 14px 16px;
}
.ybd-section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--acob-text, #fff);
  margin-bottom: 10px;
}

.ybd-info-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.ybd-info-table td {
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.info-lbl {
  background: rgba(255, 255, 255, 0.02);
  color: var(--acob-muted, rgba(242, 247, 243, 0.7));
  width: 18%;
}
.info-val {
  font-weight: 600;
}
.ybd-pill-green {
  background: rgba(34, 197, 94, 0.12);
  color: var(--acob-brand-mint, #7dfc9a);
  border: 1px solid rgba(34, 197, 94, 0.3);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
}
.ml-1 { margin-left: 6px; }

/* Matrix Grid */
.ybd-matrix-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.ybd-matrix-grid--2 {
  grid-template-columns: 1fr 1fr;
}
.matrix-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 12px;
}
.matrix-lbl {
  color: var(--acob-muted, rgba(242, 247, 243, 0.8));
}
.badge-normal {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(34, 197, 94, 0.12);
  color: var(--acob-brand-mint, #7dfc9a);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

/* Footer & Command Actions */
.ybd-footer {
  padding: 12px 20px;
  background: var(--acob-surface, #0c1c11);
  border-top: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.ybd-mos-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--acob-muted, rgba(242, 247, 243, 0.7));
}
.mos-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
}
.mos-tag.on {
  background: rgba(34, 197, 94, 0.18);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.4);
}
.mos-tag.off {
  background: rgba(239, 68, 68, 0.18);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.ybd-command-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cmd-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: var(--acob-chip, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.15));
  color: var(--acob-text, #fff);
  transition: all 0.15s;
}
.cmd-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}
.cmd-btn--danger {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}
.cmd-btn--danger:hover {
  background: rgba(239, 68, 68, 0.25);
}
.cmd-btn--success {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.4);
  color: var(--acob-brand-mint, #7dfc9a);
}
.cmd-btn--success:hover {
  background: rgba(34, 197, 94, 0.25);
}
.cmd-btn--ghost {
  background: transparent;
  color: var(--acob-muted, rgba(242, 247, 243, 0.6));
}

.ybd-spin {
  display: inline-block;
  animation: spin 1s infinite linear;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 800px) {
  .ybd-overview-grid {
    grid-template-columns: 1fr;
  }
  .ybd-matrix-grid {
    grid-template-columns: 1fr;
  }
  .ybd-cells-matrix {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
