<template>
  <div class="power-quality-page">
    <!-- Page Header -->
    <header class="pq-header">
      <div class="pq-header__title-group">
        <div class="pq-header__badge-row">
          <BaseBadge variant="live" class="pq-live-pill">
            <span class="pq-pulse-dot" aria-hidden="true"></span>
            LIVE TELEMETRY
          </BaseBadge>
          <BaseBadge variant="neutral" class="pq-oem-pill">
            OEM: {{ oemDisplayName }}
          </BaseBadge>
          <span v-if="lastRefreshedAt" class="pq-last-updated">
            Updated {{ lastRefreshedText }}
          </span>
        </div>
        <h1 class="pq-title">Power Quality & Smart Grid Telemetry</h1>
        <p class="pq-subtitle">
          Real-time three-phase voltage balance, mini-grid feeder current distribution, grid frequency regulation, and power factor analysis.
        </p>
      </div>

      <div class="pq-header__actions">
        <div class="pq-control-item">
          <label for="station-filter" class="pq-label">Station Scope</label>
          <BaseSelect
            id="station-filter"
            v-model="selectedStation"
            class="pq-select"
            @change="handleStationChange"
          >
            <option value="ALL">All Stations (8 Mini-Grids)</option>
            <option value="OTU-COSTAIN">OTU-COSTAIN</option>
            <option value="ADEBAYO">ADEBAYO</option>
            <option value="OLOYAN">OLOYAN</option>
            <option value="SULE">SULE</option>
            <option value="ADEWALE">ADEWALE</option>
            <option value="MILE 13">MILE 13</option>
            <option value="AJEGUNLE">AJEGUNLE</option>
            <option value="ONIPANU">ONIPANU</option>
          </BaseSelect>
        </div>

        <div class="pq-control-item">
          <label for="polling-interval" class="pq-label">Auto-Refresh</label>
          <BaseSelect
            id="polling-interval"
            v-model="pollingInterval"
            class="pq-select pq-select--sm"
            @change="updatePolling"
          >
            <option :value="0">Off (Manual)</option>
            <option :value="10000">10 Seconds</option>
            <option :value="30000">30 Seconds</option>
            <option :value="60000">1 Minute</option>
          </BaseSelect>
        </div>

        <div class="pq-header__btn-group">
          <BaseButton
            variant="secondary"
            :loading="loading"
            class="pq-refresh-btn"
            title="Fetch latest telemetry"
            @click="loadTelemetry"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" :class="{ 'pq-spin': loading }">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            Refresh
          </BaseButton>
        </div>
      </div>
    </header>

    <!-- Error Banner -->
    <div v-if="error" class="pq-error-banner" role="alert">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{{ error }}</span>
      <BaseButton variant="ghost" size="sm" @click="loadTelemetry">Retry</BaseButton>
    </div>

    <!-- Phase Voltage Hero Cards -->
    <section class="pq-phase-section" aria-label="Phase Voltage Metrics">
      <div class="pq-section-header">
        <div class="pq-section-title-wrap">
          <h2 class="pq-section-title">Three-Phase Voltage Balance</h2>
          <span class="pq-spec-hint">Nominal 230V | Standard Range 200V - 240V</span>
        </div>
        <div class="pq-phase-legend">
          <span class="pq-legend-tag"><span class="pq-dot pq-dot--success"></span> Normal (200V - 240V)</span>
          <span class="pq-legend-tag"><span class="pq-dot pq-dot--warning"></span> Under-voltage (&lt; 190V)</span>
          <span class="pq-legend-tag"><span class="pq-dot pq-dot--danger"></span> Over-voltage (&gt; 250V)</span>
        </div>
      </div>

      <div class="pq-phase-grid">
        <!-- Phase A -->
        <BaseCard class="pq-phase-card">
          <div class="pq-phase-card__top">
            <span class="pq-phase-tag pq-phase-tag--a">Phase A (Red)</span>
            <BaseBadge :variant="phaseAVariant" class="pq-badge">
              {{ phaseAStatus }}
            </BaseBadge>
          </div>
          <div class="pq-phase-card__value">
            <span class="pq-number">{{ formatVoltage(phaseAValue) }}</span>
            <span class="pq-unit">V</span>
          </div>
          <div class="pq-meter-bar">
            <div
              class="pq-meter-bar__fill pq-meter-bar__fill--a"
              :style="{ width: calculateVoltagePercentage(phaseAValue) + '%' }"
            ></div>
          </div>
          <div class="pq-phase-card__footer">
            <span class="pq-nominal-diff">{{ calculateDeviation(phaseAValue) }} from 230V</span>
            <span class="pq-status-label">{{ phaseAValue >= 200 && phaseAValue <= 240 ? 'Within Limits' : 'Action Needed' }}</span>
          </div>
        </BaseCard>

        <!-- Phase B -->
        <BaseCard class="pq-phase-card">
          <div class="pq-phase-card__top">
            <span class="pq-phase-tag pq-phase-tag--b">Phase B (Yellow)</span>
            <BaseBadge :variant="phaseBVariant" class="pq-badge">
              {{ phaseBStatus }}
            </BaseBadge>
          </div>
          <div class="pq-phase-card__value">
            <span class="pq-number">{{ formatVoltage(phaseBValue) }}</span>
            <span class="pq-unit">V</span>
          </div>
          <div class="pq-meter-bar">
            <div
              class="pq-meter-bar__fill pq-meter-bar__fill--b"
              :style="{ width: calculateVoltagePercentage(phaseBValue) + '%' }"
            ></div>
          </div>
          <div class="pq-phase-card__footer">
            <span class="pq-nominal-diff">{{ calculateDeviation(phaseBValue) }} from 230V</span>
            <span class="pq-status-label">{{ phaseBValue >= 200 && phaseBValue <= 240 ? 'Within Limits' : 'Action Needed' }}</span>
          </div>
        </BaseCard>

        <!-- Phase C -->
        <BaseCard class="pq-phase-card">
          <div class="pq-phase-card__top">
            <span class="pq-phase-tag pq-phase-tag--c">Phase C (Blue)</span>
            <BaseBadge :variant="phaseCVariant" class="pq-badge">
              {{ phaseCStatus }}
            </BaseBadge>
          </div>
          <div class="pq-phase-card__value">
            <span class="pq-number">{{ formatVoltage(phaseCValue) }}</span>
            <span class="pq-unit">V</span>
          </div>
          <div class="pq-meter-bar">
            <div
              class="pq-meter-bar__fill pq-meter-bar__fill--c"
              :style="{ width: calculateVoltagePercentage(phaseCValue) + '%' }"
            ></div>
          </div>
          <div class="pq-phase-card__footer">
            <span class="pq-nominal-diff">{{ calculateDeviation(phaseCValue) }} from 230V</span>
            <span class="pq-status-label">{{ phaseCValue >= 200 && phaseCValue <= 240 ? 'Within Limits' : 'Action Needed' }}</span>
          </div>
        </BaseCard>
      </div>
    </section>

    <!-- Key Power Quality KPI Cards -->
    <section class="pq-kpi-section" aria-label="Live Telemetry KPIs">
      <div class="pq-kpi-grid">
        <!-- Total Active Load -->
        <BaseCard class="pq-kpi-card">
          <div class="pq-kpi-card__header">
            <span class="pq-kpi-label">Total Active Load</span>
            <div class="pq-icon-wrap pq-icon-wrap--load">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
          </div>
          <div class="pq-kpi-value-row">
            <span class="pq-kpi-val">{{ formatNumber(kpis.totalActiveLoadKw) }}</span>
            <span class="pq-kpi-unit">kW</span>
          </div>
          <div class="pq-kpi-subtext">
            <span>Aggregated mini-grid feeder demand</span>
          </div>
        </BaseCard>

        <!-- Mean Grid Voltage -->
        <BaseCard class="pq-kpi-card">
          <div class="pq-kpi-card__header">
            <span class="pq-kpi-label">Mean Grid Voltage</span>
            <div class="pq-icon-wrap pq-icon-wrap--voltage">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
          </div>
          <div class="pq-kpi-value-row">
            <span class="pq-kpi-val">{{ formatNumber(kpis.meanGridVoltage) }}</span>
            <span class="pq-kpi-unit">V</span>
          </div>
          <div class="pq-kpi-subtext">
            <span>3-Phase mean line-to-neutral</span>
          </div>
        </BaseCard>

        <!-- Grid Frequency -->
        <BaseCard class="pq-kpi-card">
          <div class="pq-kpi-card__header">
            <span class="pq-kpi-label">Grid Frequency</span>
            <div class="pq-icon-wrap pq-icon-wrap--freq">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 12h3l2-6 4 13 3-9 2 5 2-3h4" />
              </svg>
            </div>
          </div>
          <div class="pq-kpi-value-row">
            <span class="pq-kpi-val">{{ formatFrequency(kpis.frequency) }}</span>
            <span class="pq-kpi-unit">Hz</span>
          </div>
          <div class="pq-kpi-subtext">
            <BaseBadge :variant="frequencyToleranceVariant" class="pq-badge-sub">
              {{ frequencyToleranceLabel }}
            </BaseBadge>
            <span>Δ {{ formatFreqDev(kpis.frequencyDeviation) }} Hz</span>
          </div>
        </BaseCard>

        <!-- Power Factor (cos φ) -->
        <BaseCard class="pq-kpi-card">
          <div class="pq-kpi-card__header">
            <span class="pq-kpi-label">Average Power Factor</span>
            <div class="pq-icon-wrap pq-icon-wrap--pf">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
              </svg>
            </div>
          </div>
          <div class="pq-kpi-value-row">
            <span class="pq-kpi-val">{{ formatPF(kpis.avgPowerFactor) }}</span>
            <span class="pq-kpi-unit">cos φ</span>
          </div>
          <div class="pq-kpi-subtext">
            <BaseBadge :variant="powerFactorVariant" class="pq-badge-sub">
              {{ powerFactorBadgeLabel }}
            </BaseBadge>
            <span v-if="kpis.avgPowerFactor < 0.85" class="pq-warning-text">Inductive warning</span>
            <span v-else>Target &ge; 0.85</span>
          </div>
        </BaseCard>

        <!-- Connected Feeder Meters -->
        <BaseCard class="pq-kpi-card">
          <div class="pq-kpi-card__header">
            <span class="pq-kpi-label">Connected Meters</span>
            <div class="pq-icon-wrap pq-icon-wrap--meters">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="7" y1="8" x2="17" y2="8" />
                <line x1="7" y1="12" x2="13" y2="12" />
                <circle cx="15" cy="14" r="2" />
              </svg>
            </div>
          </div>
          <div class="pq-kpi-value-row">
            <span class="pq-kpi-val">{{ formatInt(kpis.totalConnectedMeters) }}</span>
            <span class="pq-kpi-unit">Units</span>
          </div>
          <div class="pq-kpi-subtext">
            <span>{{ kpis.totalActiveFeeders || feeders.length }} active feeders</span>
          </div>
        </BaseCard>
      </div>
    </section>

    <!-- Frequency & Power Factor Deviation Gauges -->
    <section class="pq-diagnostics-section">
      <div class="pq-diag-grid">
        <!-- Frequency Regulation Gauge Card -->
        <BaseCard class="pq-diag-card">
          <div class="pq-diag-card__head">
            <div>
              <h3 class="pq-diag-card__title">Grid Frequency Regulation</h3>
              <p class="pq-diag-card__desc">Centered at 50.0 Hz nominal with ±0.2 Hz tolerance window</p>
            </div>
            <BaseBadge :variant="frequencyToleranceVariant">
              {{ frequencyToleranceLabel }}
            </BaseBadge>
          </div>
          <div class="pq-gauge-track">
            <div class="pq-gauge-tolerance-zone"></div>
            <div
              class="pq-gauge-indicator"
              :style="{ left: calculateFreqPosition(kpis.frequency) + '%' }"
            >
              <div class="pq-gauge-needle"></div>
              <span class="pq-gauge-tooltip">{{ formatFrequency(kpis.frequency) }} Hz</span>
            </div>
          </div>
          <div class="pq-gauge-labels">
            <span>49.6 Hz</span>
            <span class="pq-gauge-center">50.0 Hz (Nominal)</span>
            <span>50.4 Hz</span>
          </div>
        </BaseCard>

        <!-- Power Factor Inductive Guard Card -->
        <BaseCard class="pq-diag-card">
          <div class="pq-diag-card__head">
            <div>
              <h3 class="pq-diag-card__title">Power Factor (cos φ) Health</h3>
              <p class="pq-diag-card__desc">Inductive load alert threshold: &lt; 0.85 cos φ</p>
            </div>
            <BaseBadge :variant="powerFactorVariant">
              {{ kpis.avgPowerFactor < 0.85 ? 'Inductive Load Warning' : 'Optimal Power Factor' }}
            </BaseBadge>
          </div>
          <div class="pq-gauge-track pq-gauge-track--pf">
            <div class="pq-gauge-pf-warning-zone"></div>
            <div
              class="pq-gauge-indicator pq-gauge-indicator--pf"
              :style="{ left: calculatePfPosition(kpis.avgPowerFactor) + '%' }"
            >
              <div class="pq-gauge-needle pq-gauge-needle--pf"></div>
              <span class="pq-gauge-tooltip">{{ formatPF(kpis.avgPowerFactor) }}</span>
            </div>
          </div>
          <div class="pq-gauge-labels">
            <span class="pq-pf-danger">0.70</span>
            <span class="pq-pf-warning">0.85 (Threshold)</span>
            <span class="pq-pf-success">1.00 (Unity)</span>
          </div>
        </BaseCard>
      </div>
    </section>

    <!-- 24-Hour Stability Line Charts Section -->
    <section class="pq-charts-section" aria-label="Telemetry Stability Charts">
      <div class="pq-charts-grid">
        <!-- 24-Hour Voltage Stability Chart -->
        <BaseCard class="pq-chart-card">
          <div class="pq-chart-card__header">
            <div>
              <h3 class="pq-chart-card__title">24-Hour Three-Phase Voltage Stability</h3>
              <p class="pq-chart-card__subtitle">Hourly progression for Phase A, B, C with safe operating band</p>
            </div>
          </div>
          <div class="pq-chart-container">
            <EChartPanel v-if="timeSeries.length" :option="voltageChartOption" />
            <div v-else class="pq-chart-empty">No time-series telemetry available</div>
          </div>
        </BaseCard>

        <!-- 24-Hour Frequency & Power Factor Stability Chart -->
        <BaseCard class="pq-chart-card">
          <div class="pq-chart-card__header">
            <div>
              <h3 class="pq-chart-card__title">24-Hour Frequency & Power Factor Stability</h3>
              <p class="pq-chart-card__subtitle">Grid regulation (Hz) and power factor trend</p>
            </div>
          </div>
          <div class="pq-chart-container">
            <EChartPanel v-if="timeSeries.length" :option="frequencyChartOption" />
            <div v-else class="pq-chart-empty">No time-series telemetry available</div>
          </div>
        </BaseCard>
      </div>
    </section>

    <!-- Feeder Line Current Distribution Section -->
    <section class="pq-feeders-section" aria-label="Mini-Grid Feeder Line Currents">
      <BaseCard class="pq-table-card">
        <div class="pq-table-card__header">
          <div>
            <h3 class="pq-table-card__title">Mini-Grid Feeder Line Currents & Active Load</h3>
            <p class="pq-table-card__subtitle">
              Live current draw (A), active load (kW), and phase balance across mini-grid feeders
            </p>
          </div>
          <BaseBadge variant="neutral">
            {{ feeders.length }} Active Feeders
          </BaseBadge>
        </div>

        <div class="pq-table-wrapper">
          <table class="pq-table">
            <thead>
              <tr>
                <th>Feeder ID</th>
                <th>Feeder Name</th>
                <th>Station</th>
                <th>Line Current (A)</th>
                <th>Active Load (kW)</th>
                <th>Bus Voltage (V)</th>
                <th>Threshold Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="feeder in feeders" :key="feeder.id">
                <td class="pq-font-mono">{{ feeder.id }}</td>
                <td class="pq-font-semibold">{{ feeder.name }}</td>
                <td>
                  <span class="pq-station-tag">{{ feeder.stationName || feeder.stationId }}</span>
                </td>
                <td class="pq-font-mono pq-num-highlight">{{ feeder.currentA }} A</td>
                <td class="pq-font-mono">{{ feeder.loadKw }} kW</td>
                <td class="pq-font-mono">{{ feeder.voltage }} V</td>
                <td>
                  <BaseBadge :variant="feeder.status === 'Normal' ? 'success' : 'warning'" size="sm">
                    {{ feeder.status }}
                  </BaseBadge>
                </td>
              </tr>
              <tr v-if="!feeders.length">
                <td colspan="7" class="pq-empty-row">No feeders reporting telemetry for the selected scope.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </BaseCard>
    </section>

    <!-- Mini-Grid Stations Telemetry Summary -->
    <section v-if="selectedStation === 'ALL'" class="pq-stations-section" aria-label="All Stations Summary">
      <BaseCard class="pq-table-card">
        <div class="pq-table-card__header">
          <div>
            <h3 class="pq-table-card__title">All 8 SparkMeter Mini-Grid Sites Telemetry Matrix</h3>
            <p class="pq-table-card__subtitle">Comparative snapshot across Beverly's active solar/hybrid mini-grids</p>
          </div>
        </div>

        <div class="pq-table-wrapper">
          <table class="pq-table">
            <thead>
              <tr>
                <th>Station</th>
                <th>Phase A (V)</th>
                <th>Phase B (V)</th>
                <th>Phase C (V)</th>
                <th>Frequency</th>
                <th>Power Factor</th>
                <th>Active Load</th>
                <th>Meters</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stn in stations" :key="stn.stationId">
                <td class="pq-font-semibold">{{ stn.stationName }}</td>
                <td class="pq-font-mono">
                  <span :class="voltageClass(stn.voltageA)">{{ stn.voltageA }} V</span>
                </td>
                <td class="pq-font-mono">
                  <span :class="voltageClass(stn.voltageB)">{{ stn.voltageB }} V</span>
                </td>
                <td class="pq-font-mono">
                  <span :class="voltageClass(stn.voltageC)">{{ stn.voltageC }} V</span>
                </td>
                <td class="pq-font-mono">{{ stn.frequency }} Hz</td>
                <td class="pq-font-mono">{{ stn.powerFactor }}</td>
                <td class="pq-font-mono pq-num-highlight">{{ stn.activeLoadKw }} kW</td>
                <td class="pq-font-mono">{{ stn.connectedMeters }}</td>
                <td>
                  <BaseButton
                    variant="ghost"
                    size="sm"
                    class="pq-scope-btn"
                    @click="filterToStation(stn.stationId)"
                  >
                    Inspect
                  </BaseButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </BaseCard>
    </section>
  </div>
</template>

<script>
import BaseCard from "../base/BaseCard.vue";
import BaseBadge from "../base/BaseBadge.vue";
import BaseButton from "../base/BaseButton.vue";
import BaseSelect from "../base/BaseSelect.vue";
import EChartPanel from "../EChartPanel.vue";
import { getApi } from "../../services/api.js";
import { useOemStore } from "../../stores/oem-store.js";

export default {
  name: "PowerQualityPage",
  components: {
    BaseCard,
    BaseBadge,
    BaseButton,
    BaseSelect,
    EChartPanel
  },
  props: {
    route: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      selectedStation: "ALL",
      pollingInterval: 10000,
      pollTimer: null,
      loading: false,
      error: "",
      lastRefreshedAt: null,
      oemSlug: "sparkmeter",
      oemDisplayName: "SparkMeter",
      kpis: {
        totalActiveLoadKw: 184.6,
        meanGridVoltage: 228.2,
        frequency: 49.98,
        frequencyDeviation: -0.02,
        frequencyStatus: "Normal",
        avgPowerFactor: 0.92,
        powerFactorStatus: "Optimal",
        powerFactorAlert: false,
        totalConnectedMeters: 3073,
        totalActiveFeeders: 17,
        phaseA: { voltage: 228.4, status: "Stable", variant: "success" },
        phaseB: { voltage: 226.1, status: "Stable", variant: "success" },
        phaseC: { voltage: 230.2, status: "Stable", variant: "success" }
      },
      feeders: [],
      stations: [],
      timeSeries: []
    };
  },
  computed: {
    phaseAValue() {
      return this.kpis.phaseA?.voltage || 228.4;
    },
    phaseBValue() {
      return this.kpis.phaseB?.voltage || 226.1;
    },
    phaseCValue() {
      return this.kpis.phaseC?.voltage || 230.2;
    },
    phaseAStatus() {
      return this.getVoltageThresholdInfo(this.phaseAValue).label;
    },
    phaseAVariant() {
      return this.getVoltageThresholdInfo(this.phaseAValue).variant;
    },
    phaseBStatus() {
      return this.getVoltageThresholdInfo(this.phaseBValue).label;
    },
    phaseBVariant() {
      return this.getVoltageThresholdInfo(this.phaseBValue).variant;
    },
    phaseCStatus() {
      return this.getVoltageThresholdInfo(this.phaseCValue).label;
    },
    phaseCVariant() {
      return this.getVoltageThresholdInfo(this.phaseCValue).variant;
    },
    frequencyToleranceLabel() {
      const dev = Math.abs(this.kpis.frequencyDeviation || 0);
      return dev <= 0.2 ? "Within Tolerance (±0.2Hz)" : "Frequency Out of Spec";
    },
    frequencyToleranceVariant() {
      const dev = Math.abs(this.kpis.frequencyDeviation || 0);
      return dev <= 0.2 ? "success" : "danger";
    },
    powerFactorVariant() {
      return (this.kpis.avgPowerFactor || 0) < 0.85 ? "warning" : "success";
    },
    powerFactorBadgeLabel() {
      return (this.kpis.avgPowerFactor || 0) < 0.85 ? "Low Power Factor (<0.85)" : "Stable (>=0.85)";
    },
    lastRefreshedText() {
      if (!this.lastRefreshedAt) return "";
      return this.lastRefreshedAt.toLocaleTimeString();
    },
    voltageChartOption() {
      const times = this.timeSeries.map((t) => t.time);
      const seriesA = this.timeSeries.map((t) => t.phaseA);
      const seriesB = this.timeSeries.map((t) => t.phaseB);
      const seriesC = this.timeSeries.map((t) => t.phaseC);

      return {
        tooltip: {
          trigger: "axis",
          formatter: (params) => {
            let str = `<strong>${params[0].name}</strong><br/>`;
            params.forEach((p) => {
              str += `${p.marker} ${p.seriesName}: <b>${p.value} V</b><br/>`;
            });
            return str;
          }
        },
        legend: {
          data: ["Phase A (V)", "Phase B (V)", "Phase C (V)"],
          bottom: 0,
          textStyle: { color: "var(--bev-color-slate-500, #64748b)" }
        },
        grid: {
          top: 24,
          left: 45,
          right: 20,
          bottom: 35
        },
        xAxis: {
          type: "category",
          data: times,
          axisLine: { lineStyle: { color: "#e2e8f0" } },
          axisLabel: { color: "#64748b" }
        },
        yAxis: {
          type: "value",
          min: 190,
          max: 250,
          splitLine: { lineStyle: { color: "#f1f5f9" } },
          axisLabel: {
            formatter: "{value} V",
            color: "#64748b"
          }
        },
        series: [
          {
            name: "Phase A (V)",
            type: "line",
            smooth: true,
            data: seriesA,
            itemStyle: { color: "#ef4444" },
            lineStyle: { width: 2.5 },
            showSymbol: false
          },
          {
            name: "Phase B (V)",
            type: "line",
            smooth: true,
            data: seriesB,
            itemStyle: { color: "#f59e0b" },
            lineStyle: { width: 2.5 },
            showSymbol: false
          },
          {
            name: "Phase C (V)",
            type: "line",
            smooth: true,
            data: seriesC,
            itemStyle: { color: "#0ea5e9" },
            lineStyle: { width: 2.5 },
            showSymbol: false,
            markLine: {
              symbol: "none",
              data: [
                { yAxis: 200, lineStyle: { color: "#10b981", type: "dashed" }, label: { formatter: "Min Normal (200V)" } },
                { yAxis: 240, lineStyle: { color: "#10b981", type: "dashed" }, label: { formatter: "Max Normal (240V)" } }
              ]
            }
          }
        ]
      };
    },
    frequencyChartOption() {
      const times = this.timeSeries.map((t) => t.time);
      const frequencies = this.timeSeries.map((t) => t.frequency);
      const powerFactors = this.timeSeries.map((t) => t.powerFactor);

      return {
        tooltip: {
          trigger: "axis"
        },
        legend: {
          data: ["Frequency (Hz)", "Power Factor (cos φ)"],
          bottom: 0,
          textStyle: { color: "var(--bev-color-slate-500, #64748b)" }
        },
        grid: {
          top: 24,
          left: 45,
          right: 50,
          bottom: 35
        },
        xAxis: {
          type: "category",
          data: times,
          axisLine: { lineStyle: { color: "#e2e8f0" } },
          axisLabel: { color: "#64748b" }
        },
        yAxis: [
          {
            type: "value",
            name: "Hz",
            min: 49.5,
            max: 50.5,
            splitLine: { lineStyle: { color: "#f1f5f9" } },
            axisLabel: { color: "#64748b" }
          },
          {
            type: "value",
            name: "cos φ",
            min: 0.75,
            max: 1.0,
            splitLine: { show: false },
            axisLabel: { color: "#64748b" }
          }
        ],
        series: [
          {
            name: "Frequency (Hz)",
            type: "line",
            smooth: true,
            data: frequencies,
            itemStyle: { color: "#059669" },
            lineStyle: { width: 2.5 },
            showSymbol: false,
            markLine: {
              symbol: "none",
              data: [
                { yAxis: 50.0, lineStyle: { color: "#059669", type: "solid", width: 1.5 }, label: { formatter: "Nominal 50.0Hz" } }
              ]
            }
          },
          {
            name: "Power Factor (cos φ)",
            type: "line",
            yAxisIndex: 1,
            smooth: true,
            data: powerFactors,
            itemStyle: { color: "#6366f1" },
            lineStyle: { width: 2, type: "dashed" },
            showSymbol: false
          }
        ]
      };
    }
  },
  mounted() {
    this.detectActiveOem();
    this.loadTelemetry();
    this.startPolling();
  },
  beforeUnmount() {
    this.stopPolling();
  },
  methods: {
    detectActiveOem() {
      try {
        const store = useOemStore();
        if (store.currentOem) {
          this.oemDisplayName = store.currentOem.displayName || store.currentOem.name || "SparkMeter";
          this.oemSlug = store.currentOem.slug || "sparkmeter";
        }
      } catch {
        // use default
      }
    },
    async loadTelemetry() {
      this.loading = true;
      this.error = "";
      try {
        const res = await getApi("/oem/telemetry/power-quality", {
          station: this.selectedStation
        });
        const payload = res?.data || res?.result || {};
        if (payload.kpis) {
          this.kpis = payload.kpis;
        }
        if (Array.isArray(payload.feeders)) {
          this.feeders = payload.feeders;
        }
        if (Array.isArray(payload.stations)) {
          this.stations = payload.stations;
        }
        if (Array.isArray(payload.timeSeries)) {
          this.timeSeries = payload.timeSeries;
        }
        if (payload.oemDisplayName) {
          this.oemDisplayName = payload.oemDisplayName;
        }
        this.lastRefreshedAt = new Date();
      } catch (err) {
        this.error = err?.message || "Failed to retrieve telemetry readings";
      } finally {
        this.loading = false;
      }
    },
    handleStationChange() {
      this.loadTelemetry();
    },
    filterToStation(stationId) {
      this.selectedStation = stationId;
      this.loadTelemetry();
    },
    updatePolling() {
      this.stopPolling();
      this.startPolling();
    },
    startPolling() {
      if (this.pollingInterval > 0) {
        this.pollTimer = setInterval(() => {
          this.loadTelemetry();
        }, this.pollingInterval);
      }
    },
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },
    getVoltageThresholdInfo(volts) {
      const v = Number(volts);
      if (!Number.isFinite(v)) return { label: "Unknown", variant: "neutral" };
      if (v < 190) return { label: "Under-Voltage", variant: "warning" };
      if (v > 250) return { label: "Over-Voltage", variant: "danger" };
      return { label: "Stable", variant: "success" };
    },
    calculateVoltagePercentage(volts) {
      const v = Number(volts);
      const min = 160;
      const max = 280;
      const pct = ((v - min) / (max - min)) * 100;
      return Math.min(Math.max(pct, 0), 100);
    },
    calculateDeviation(volts) {
      const diff = Math.round((Number(volts) - 230.0) * 10) / 10;
      if (diff === 0) return "0.0V";
      return diff > 0 ? `+${diff}V` : `${diff}V`;
    },
    calculateFreqPosition(freq) {
      const f = Number(freq) || 50.0;
      const min = 49.6;
      const max = 50.4;
      const pct = ((f - min) / (max - min)) * 100;
      return Math.min(Math.max(pct, 0), 100);
    },
    calculatePfPosition(pf) {
      const val = Number(pf) || 0.92;
      const min = 0.70;
      const max = 1.00;
      const pct = ((val - min) / (max - min)) * 100;
      return Math.min(Math.max(pct, 0), 100);
    },
    formatVoltage(v) {
      return Number(v || 0).toFixed(1);
    },
    formatNumber(n) {
      return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    },
    formatFrequency(f) {
      return Number(f || 50).toFixed(2);
    },
    formatFreqDev(d) {
      const val = Number(d || 0);
      return val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
    },
    formatPF(pf) {
      return Number(pf || 0).toFixed(2);
    },
    formatInt(n) {
      return Number(n || 0).toLocaleString("en-US");
    },
    voltageClass(v) {
      const num = Number(v);
      if (num < 190) return "pq-text-warning";
      if (num > 250) return "pq-text-danger";
      return "pq-text-success";
    }
  }
};
</script>

<style scoped>
.power-quality-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6, 24px);
  padding: var(--space-6, 24px);
  max-width: 1440px;
  margin: 0 auto;
  font-family: var(--bev-font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  color: var(--bev-color-slate-900, #0f172a);
}

/* Header Styles */
.pq-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--space-4, 16px);
  border-bottom: 1px solid var(--bev-color-slate-200, #e2e8f0);
  padding-bottom: var(--space-5, 20px);
}

.pq-header__title-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.pq-header__badge-row {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
}

.pq-live-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  letter-spacing: 0.05em;
  font-size: 11px;
}

.pq-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--bev-color-green-500, #10b981);
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pq-pulse 2s infinite;
}

@keyframes pq-pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.pq-last-updated {
  font-size: 12px;
  color: var(--bev-color-slate-500, #64748b);
  margin-left: 4px;
}

.pq-title {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--bev-color-slate-900, #0f172a);
}

.pq-subtitle {
  font-size: 14px;
  color: var(--bev-color-slate-500, #64748b);
  margin: 0;
  max-width: 680px;
  line-height: 1.5;
}

.pq-header__actions {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3, 12px);
  flex-wrap: wrap;
}

.pq-control-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pq-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bev-color-slate-500, #64748b);
}

.pq-select {
  min-width: 220px;
  height: 38px;
}

.pq-select--sm {
  min-width: 140px;
}

.pq-refresh-btn {
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pq-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Error Banner */
.pq-error-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: var(--bev-color-red-50, #fef2f2);
  color: var(--bev-color-red-600, #dc2626);
  border: 1px solid var(--bev-color-red-200, #fecaca);
  padding: 12px 16px;
  border-radius: var(--radius-md, 8px);
  font-size: 14px;
}

/* Phase Voltage Section */
.pq-phase-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
}

.pq-section-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}

.pq-section-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.pq-section-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: var(--bev-color-slate-900, #0f172a);
}

.pq-spec-hint {
  font-size: 12px;
  color: var(--bev-color-slate-500, #64748b);
}

.pq-phase-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: var(--bev-color-slate-500, #64748b);
}

.pq-legend-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pq-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.pq-dot--success { background-color: var(--bev-color-green-500, #10b981); }
.pq-dot--warning { background-color: var(--bev-color-amber-500, #f59e0b); }
.pq-dot--danger { background-color: var(--bev-color-red-500, #ef4444); }

.pq-phase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4, 16px);
}

.pq-phase-card {
  padding: 20px;
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pq-phase-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pq-phase-tag {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.pq-phase-tag--a { color: #dc2626; }
.pq-phase-tag--b { color: #d97706; }
.pq-phase-tag--c { color: #0284c7; }

.pq-phase-card__value {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.pq-number {
  font-family: var(--bev-font-mono, monospace);
  font-size: 38px;
  font-weight: 800;
  line-height: 1;
  color: var(--bev-color-slate-900, #0f172a);
}

.pq-unit {
  font-size: 18px;
  font-weight: 600;
  color: var(--bev-color-slate-500, #64748b);
}

.pq-meter-bar {
  width: 100%;
  height: 8px;
  background-color: var(--bev-color-slate-100, #f1f5f9);
  border-radius: 4px;
  overflow: hidden;
}

.pq-meter-bar__fill {
  height: 100%;
  transition: width 0.4s ease;
  border-radius: 4px;
}

.pq-meter-bar__fill--a { background: linear-gradient(90deg, #f87171, #ef4444); }
.pq-meter-bar__fill--b { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
.pq-meter-bar__fill--c { background: linear-gradient(90deg, #38bdf8, #0ea5e9); }

.pq-phase-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--bev-color-slate-500, #64748b);
}

.pq-nominal-diff {
  font-family: var(--bev-font-mono, monospace);
  font-weight: 600;
}

/* KPI Section */
.pq-kpi-section {
  width: 100%;
}

.pq-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4, 16px);
}

.pq-kpi-card {
  padding: 16px 18px;
  border-radius: var(--radius-lg, 12px);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pq-kpi-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pq-kpi-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--bev-color-slate-500, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.pq-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pq-icon-wrap--load { background-color: var(--bev-color-amber-50, #fffbeb); color: var(--bev-color-amber-500, #f59e0b); }
.pq-icon-wrap--voltage { background-color: var(--bev-color-blue-50, #eff6ff); color: var(--bev-color-blue-500, #0ea5e9); }
.pq-icon-wrap--freq { background-color: var(--bev-color-green-50, #ecfdf5); color: var(--bev-color-green-600, #059669); }
.pq-icon-wrap--pf { background-color: #f5f3ff; color: #7c3aed; }
.pq-icon-wrap--meters { background-color: var(--bev-color-slate-100, #f1f5f9); color: var(--bev-color-slate-700, #334155); }

.pq-kpi-value-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.pq-kpi-val {
  font-family: var(--bev-font-mono, monospace);
  font-size: 26px;
  font-weight: 700;
  color: var(--bev-color-slate-900, #0f172a);
}

.pq-kpi-unit {
  font-size: 13px;
  font-weight: 600;
  color: var(--bev-color-slate-500, #64748b);
}

.pq-kpi-subtext {
  font-size: 12px;
  color: var(--bev-color-slate-500, #64748b);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.pq-badge-sub {
  font-size: 10px;
  padding: 1px 6px;
}

.pq-warning-text {
  color: var(--bev-color-amber-500, #f59e0b);
  font-weight: 600;
}

/* Diagnostics & Gauges */
.pq-diagnostics-section {
  width: 100%;
}

.pq-diag-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: var(--space-4, 16px);
}

.pq-diag-card {
  padding: 20px;
  border-radius: var(--radius-lg, 12px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pq-diag-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.pq-diag-card__title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
  color: var(--bev-color-slate-900, #0f172a);
}

.pq-diag-card__desc {
  font-size: 12px;
  color: var(--bev-color-slate-500, #64748b);
  margin: 2px 0 0 0;
}

.pq-gauge-track {
  position: relative;
  width: 100%;
  height: 14px;
  background-color: var(--bev-color-slate-100, #f1f5f9);
  border-radius: 7px;
  margin-top: 14px;
}

.pq-gauge-tolerance-zone {
  position: absolute;
  left: 25%;
  width: 50%;
  height: 100%;
  background-color: rgba(16, 185, 129, 0.2);
  border-left: 2px dashed var(--bev-color-green-500, #10b981);
  border-right: 2px dashed var(--bev-color-green-500, #10b981);
}

.pq-gauge-pf-warning-zone {
  position: absolute;
  left: 0;
  width: 50%;
  height: 100%;
  background-color: rgba(245, 158, 11, 0.15);
  border-right: 2px dashed var(--bev-color-amber-500, #f59e0b);
}

.pq-gauge-indicator {
  position: absolute;
  top: -6px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: left 0.4s ease;
}

.pq-gauge-needle {
  width: 4px;
  height: 26px;
  background-color: var(--bev-color-slate-900, #0f172a);
  border-radius: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.pq-gauge-tooltip {
  position: absolute;
  bottom: 28px;
  background-color: var(--bev-color-slate-900, #0f172a);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.pq-gauge-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-family: var(--bev-font-mono, monospace);
  color: var(--bev-color-slate-500, #64748b);
  margin-top: 6px;
}

.pq-gauge-center {
  font-weight: 600;
  color: var(--bev-color-slate-700, #334155);
}

.pq-pf-danger { color: #dc2626; }
.pq-pf-warning { color: #d97706; font-weight: 600; }
.pq-pf-success { color: #059669; }

/* Charts Section */
.pq-charts-section {
  width: 100%;
}

.pq-charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(460px, 1fr));
  gap: var(--space-4, 16px);
}

.pq-chart-card {
  padding: 20px;
  border-radius: var(--radius-lg, 12px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pq-chart-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pq-chart-card__title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
  color: var(--bev-color-slate-900, #0f172a);
}

.pq-chart-card__subtitle {
  font-size: 12px;
  color: var(--bev-color-slate-500, #64748b);
  margin: 2px 0 0 0;
}

.pq-chart-container {
  width: 100%;
  height: 280px;
}

.pq-chart-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--bev-color-slate-400, #94a3b8);
}

/* Feeders & Stations Tables */
.pq-feeders-section,
.pq-stations-section {
  width: 100%;
}

.pq-table-card {
  padding: 20px;
  border-radius: var(--radius-lg, 12px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pq-table-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.pq-table-card__title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: var(--bev-color-slate-900, #0f172a);
}

.pq-table-card__subtitle {
  font-size: 12px;
  color: var(--bev-color-slate-500, #64748b);
  margin: 2px 0 0 0;
}

.pq-table-wrapper {
  overflow-x: auto;
}

.pq-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}

.pq-table th {
  padding: 10px 14px;
  background-color: var(--bev-color-slate-50, #f8fafc);
  color: var(--bev-color-slate-500, #64748b);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--bev-color-slate-200, #e2e8f0);
}

.pq-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--bev-color-slate-100, #f1f5f9);
  color: var(--bev-color-slate-700, #334155);
}

.pq-font-mono {
  font-family: var(--bev-font-mono, monospace);
}

.pq-font-semibold {
  font-weight: 600;
  color: var(--bev-color-slate-900, #0f172a);
}

.pq-num-highlight {
  font-weight: 700;
  color: var(--bev-color-slate-900, #0f172a);
}

.pq-station-tag {
  display: inline-block;
  padding: 2px 8px;
  background-color: var(--bev-color-slate-100, #f1f5f9);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--bev-color-slate-700, #334155);
}

.pq-text-success { color: var(--bev-color-green-600, #059669); font-weight: 700; }
.pq-text-warning { color: var(--bev-color-amber-500, #f59e0b); font-weight: 700; }
.pq-text-danger { color: var(--bev-color-red-600, #dc2626); font-weight: 700; }

.pq-empty-row {
  text-align: center;
  padding: 24px;
  color: var(--bev-color-slate-400, #94a3b8);
}

.pq-scope-btn {
  font-size: 12px;
}

@media (max-width: 768px) {
  .power-quality-page {
    padding: var(--space-3, 12px);
  }
  .pq-header {
    flex-direction: column;
    align-items: stretch;
  }
  .pq-header__actions {
    flex-direction: column;
    align-items: stretch;
  }
  .pq-select {
    min-width: 100%;
  }
  .pq-charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
