<template>
  <div class="demand-curves-page">
    <!-- Page Header -->
    <header class="dc-header">
      <div class="dc-header__title-group">
        <div class="dc-header__badge-row">
          <BaseBadge variant="neutral" class="dc-badge-tag">15-MIN INTERVAL RESOLUTION</BaseBadge>
          <BaseBadge variant="live" class="dc-badge-live">
            <span class="dc-pulse-dot" aria-hidden="true"></span>
            ACTIVE OEM: {{ oemDisplayName }}
          </BaseBadge>
          <span v-if="lastRefreshedAt" class="dc-last-updated">
            Updated {{ lastRefreshedText }}
          </span>
        </div>
        <h1 class="dc-title">Demand Profiles & Mini-Grid Load Curves</h1>
        <p class="dc-subtitle">
          High-resolution 15-minute interval active demand (kW), baseload vs. peak comparisons, diurnal load trends, and cross-station capacity benchmarks.
        </p>
      </div>

      <div class="dc-header__actions">
        <!-- Station Filter -->
        <div class="dc-control-item">
          <label for="dc-station-filter" class="dc-label">Station Scope</label>
          <BaseSelect
            id="dc-station-filter"
            v-model="selectedStation"
            class="dc-select"
            @change="handleFilterChange"
          >
            <option value="ALL">All Stations (Combined Grid)</option>
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

        <!-- Date Range Filter -->
        <div class="dc-control-item">
          <label for="dc-range-filter" class="dc-label">Time Window</label>
          <BaseSelect
            id="dc-range-filter"
            v-model="selectedRange"
            class="dc-select dc-select--range"
            @change="handleFilterChange"
          >
            <option value="24h">Today (24 Hours / 96 Intervals)</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </BaseSelect>
        </div>

        <!-- Export & Refresh Buttons -->
        <div class="dc-header__btn-group">
          <BaseButton
            variant="secondary"
            class="dc-btn"
            title="Download CSV"
            @click="exportCsv"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </BaseButton>

          <BaseButton
            variant="secondary"
            class="dc-btn"
            title="Download Excel Spreadsheet"
            @click="exportExcel"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="16" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Export Excel
          </BaseButton>

          <BaseButton
            variant="ghost"
            :loading="loading"
            class="dc-btn"
            title="Reload telemetry"
            @click="loadLoadCurves"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" :class="{ 'dc-spin': loading }">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            Refresh
          </BaseButton>
        </div>
      </div>
    </header>

    <!-- Error Banner -->
    <div v-if="error" class="dc-error-banner" role="alert">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{{ error }}</span>
      <BaseButton variant="ghost" size="sm" @click="loadLoadCurves">Retry</BaseButton>
    </div>

    <!-- Demand Comparison KPI Cards Row -->
    <section class="dc-kpi-section" aria-label="Demand Comparison KPIs">
      <div class="dc-kpi-grid">
        <!-- Peak Demand -->
        <BaseCard class="dc-kpi-card dc-kpi-card--peak">
          <div class="dc-kpi-card__header">
            <span class="dc-kpi-label">Peak Demand</span>
            <BaseBadge variant="danger" class="dc-kpi-badge">Max Load</BaseBadge>
          </div>
          <div class="dc-kpi-value-row">
            <span class="dc-kpi-val">{{ formatNumber(kpis.peakDemandKw) }}</span>
            <span class="dc-kpi-unit">kW</span>
          </div>
          <div class="dc-kpi-subtext">
            <span>Occurred at <strong>{{ kpis.peakTime || '19:45' }}</strong> (Evening peak)</span>
          </div>
        </BaseCard>

        <!-- Baseload Demand -->
        <BaseCard class="dc-kpi-card dc-kpi-card--base">
          <div class="dc-kpi-card__header">
            <span class="dc-kpi-label">Baseload Demand</span>
            <BaseBadge variant="info" class="dc-kpi-badge">Min Steady</BaseBadge>
          </div>
          <div class="dc-kpi-value-row">
            <span class="dc-kpi-val">{{ formatNumber(kpis.baseloadDemandKw) }}</span>
            <span class="dc-kpi-unit">kW</span>
          </div>
          <div class="dc-kpi-subtext">
            <span>Occurred at <strong>{{ kpis.baseloadTime || '03:30' }}</strong> (Deep night)</span>
          </div>
        </BaseCard>

        <!-- Mean Grid Demand -->
        <BaseCard class="dc-kpi-card">
          <div class="dc-kpi-card__header">
            <span class="dc-kpi-label">Average Demand</span>
            <BaseBadge variant="neutral" class="dc-kpi-badge">24h Mean</BaseBadge>
          </div>
          <div class="dc-kpi-value-row">
            <span class="dc-kpi-val">{{ formatNumber(kpis.meanDemandKw) }}</span>
            <span class="dc-kpi-unit">kW</span>
          </div>
          <div class="dc-kpi-subtext">
            <span>Base-to-peak ratio: <strong>{{ baseToPeakRatio }}%</strong></span>
          </div>
        </BaseCard>

        <!-- Load Factor -->
        <BaseCard class="dc-kpi-card">
          <div class="dc-kpi-card__header">
            <span class="dc-kpi-label">Grid Load Factor</span>
            <BaseBadge :variant="loadFactorVariant" class="dc-kpi-badge">
              {{ loadFactorQuality }}
            </BaseBadge>
          </div>
          <div class="dc-kpi-value-row">
            <span class="dc-kpi-val">{{ formatNumber(kpis.loadFactor) }}</span>
            <span class="dc-kpi-unit">%</span>
          </div>
          <div class="dc-kpi-subtext">
            <span>Mean Demand / Peak Demand ratio</span>
          </div>
        </BaseCard>

        <!-- Total Energy Delivered -->
        <BaseCard class="dc-kpi-card dc-kpi-card--energy">
          <div class="dc-kpi-card__header">
            <span class="dc-kpi-label">Total Energy Vended</span>
            <BaseBadge variant="success" class="dc-kpi-badge">Output</BaseBadge>
          </div>
          <div class="dc-kpi-value-row">
            <span class="dc-kpi-val">{{ formatInt(kpis.totalEnergyKwh) }}</span>
            <span class="dc-kpi-unit">kWh</span>
          </div>
          <div class="dc-kpi-subtext">
            <span>Cumulative interval energy delivery</span>
          </div>
        </BaseCard>
      </div>
    </section>

    <!-- 15-Minute Load Curve ECharts Panel -->
    <section class="dc-main-chart-section" aria-label="15-Minute Interval Load Curve">
      <BaseCard class="dc-chart-card">
        <div class="dc-chart-card__header">
          <div>
            <h2 class="dc-chart-card__title">15-Minute Interval Active Load Profile (kW)</h2>
            <p class="dc-chart-card__subtitle">
              Continuous 96-interval diurnal demand profile with baseload and peak demand reference thresholds
            </p>
          </div>
          <div class="dc-chart-legend-pills">
            <span class="dc-legend-pill dc-legend-pill--load">Active Demand (kW)</span>
            <span class="dc-legend-pill dc-legend-pill--peak">Peak ({{ formatNumber(kpis.peakDemandKw) }} kW)</span>
            <span class="dc-legend-pill dc-legend-pill--base">Baseload ({{ formatNumber(kpis.baseloadDemandKw) }} kW)</span>
          </div>
        </div>

        <div class="dc-chart-wrap">
          <EChartPanel v-if="points.length" :option="loadCurveOption" />
          <div v-else class="dc-chart-empty">Loading 15-minute interval demand data...</div>
        </div>
      </BaseCard>
    </section>

    <!-- Cross-Station Demand Comparison Section -->
    <section class="dc-station-comparison-section" aria-label="Station Demand Comparison">
      <BaseCard class="dc-chart-card">
        <div class="dc-chart-card__header">
          <div>
            <h2 class="dc-chart-card__title">Mini-Grid Station Demand Benchmark (Peak vs. Baseload)</h2>
            <p class="dc-chart-card__subtitle">
              Comparative active power capacity, baseload demand, and mean load across all 8 Beverly mini-grid stations
            </p>
          </div>
        </div>

        <div class="dc-chart-wrap dc-chart-wrap--station">
          <EChartPanel v-if="stationComparison.length" :option="stationComparisonOption" />
          <div v-else class="dc-chart-empty">Loading station benchmark data...</div>
        </div>
      </BaseCard>
    </section>

    <!-- 15-Minute Interval Telemetry Table -->
    <section class="dc-table-section" aria-label="15-Minute Interval Table">
      <BaseCard class="dc-table-card">
        <div class="dc-table-card__header">
          <div>
            <h2 class="dc-table-card__title">15-Minute Interval Demand Log</h2>
            <p class="dc-table-card__subtitle">
              Detailed chronological telemetry readings ({{ points.length }} intervals recorded)
            </p>
          </div>
          <div class="dc-table-actions">
            <span class="dc-table-count">{{ points.length }} Records</span>
            <BaseButton variant="secondary" size="sm" @click="exportCsv">
              Download CSV
            </BaseButton>
          </div>
        </div>

        <div class="dc-table-wrapper">
          <table class="dc-table">
            <thead>
              <tr>
                <th>Interval Time</th>
                <th>Active Load (kW)</th>
                <th>Baseload (kW)</th>
                <th>Peak Margin</th>
                <th>Line Current (A)</th>
                <th>Power Factor</th>
                <th>Operating Window</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pt in displayedPoints" :key="pt.time">
                <td class="dc-font-mono dc-time-cell">
                  <strong>{{ pt.time }}</strong>
                </td>
                <td class="dc-font-mono dc-load-cell">
                  {{ pt.activeLoadKw }} kW
                </td>
                <td class="dc-font-mono dc-subdued">
                  {{ pt.baseloadKw }} kW
                </td>
                <td class="dc-font-mono">
                  <span :class="marginClass(pt.activeLoadKw)">
                    {{ calculatePeakMargin(pt.activeLoadKw) }}%
                  </span>
                </td>
                <td class="dc-font-mono">{{ pt.currentA }} A</td>
                <td class="dc-font-mono">{{ pt.powerFactor }}</td>
                <td>
                  <BaseBadge :variant="windowBadgeVariant(pt.time)" size="sm">
                    {{ windowBadgeLabel(pt.time) }}
                  </BaseBadge>
                </td>
              </tr>
              <tr v-if="!points.length">
                <td colspan="7" class="dc-empty-row">No interval demand records loaded.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="points.length > pageSize" class="dc-pagination-bar">
          <span class="dc-page-info">
            Showing {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, points.length) }} of {{ points.length }} intervals
          </span>
          <div class="dc-page-buttons">
            <BaseButton
              variant="ghost"
              size="sm"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              Previous
            </BaseButton>
            <BaseButton
              variant="ghost"
              size="sm"
              :disabled="currentPage * pageSize >= points.length"
              @click="currentPage++"
            >
              Next
            </BaseButton>
          </div>
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
  name: "DemandCurvesPage",
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
      selectedRange: "24h",
      loading: false,
      error: "",
      lastRefreshedAt: null,
      oemDisplayName: "SparkMeter",
      currentPage: 1,
      pageSize: 24,
      kpis: {
        peakDemandKw: 214.8,
        peakTime: "19:45",
        baseloadDemandKw: 38.2,
        baseloadTime: "03:30",
        meanDemandKw: 112.5,
        loadFactor: 52.4,
        totalEnergyKwh: 2700.0
      },
      points: [],
      stationComparison: []
    };
  },
  computed: {
    lastRefreshedText() {
      if (!this.lastRefreshedAt) return "";
      return this.lastRefreshedAt.toLocaleTimeString();
    },
    baseToPeakRatio() {
      if (!this.kpis.peakDemandKw) return 0;
      return Math.round((this.kpis.baseloadDemandKw / this.kpis.peakDemandKw) * 100);
    },
    loadFactorVariant() {
      const lf = Number(this.kpis.loadFactor || 0);
      if (lf >= 50) return "success";
      if (lf >= 35) return "info";
      return "warning";
    },
    loadFactorQuality() {
      const lf = Number(this.kpis.loadFactor || 0);
      if (lf >= 50) return "Optimal (≥50%)";
      if (lf >= 35) return "Moderate (35-50%)";
      return "Low (<35%)";
    },
    displayedPoints() {
      const start = (this.currentPage - 1) * this.pageSize;
      return this.points.slice(start, start + this.pageSize);
    },
    loadCurveOption() {
      const times = this.points.map((p) => p.time);
      const loads = this.points.map((p) => p.activeLoadKw);

      return {
        tooltip: {
          trigger: "axis",
          formatter: (params) => {
            const p = params[0];
            const pt = this.points[p.dataIndex] || {};
            return `
              <div style="font-family: var(--bev-font-sans); padding: 4px;">
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">Interval: ${p.name}</div>
                <div>Active Demand: <b style="color: #0284c7;">${p.value} kW</b></div>
                <div>Baseload Reference: <b>${pt.baseloadKw || 38.2} kW</b></div>
                <div>Power Factor: <b>${pt.powerFactor || 0.92}</b></div>
                <div>Line Current: <b>${pt.currentA || 0} A</b></div>
              </div>
            `;
          }
        },
        grid: {
          top: 30,
          left: 55,
          right: 30,
          bottom: 35
        },
        xAxis: {
          type: "category",
          data: times,
          axisLine: { lineStyle: { color: "#e2e8f0" } },
          axisLabel: {
            color: "#64748b",
            interval: 7 // Label every 2 hours (8 intervals of 15m)
          }
        },
        yAxis: {
          type: "value",
          name: "Active Power (kW)",
          splitLine: { lineStyle: { color: "#f1f5f9" } },
          axisLabel: {
            color: "#64748b",
            formatter: "{value} kW"
          }
        },
        series: [
          {
            name: "Active Demand (kW)",
            type: "line",
            smooth: true,
            data: loads,
            itemStyle: { color: "#0ea5e9" },
            lineStyle: { width: 3, color: "#0284c7" },
            areaStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: "rgba(14, 165, 233, 0.45)" },
                  { offset: 1, color: "rgba(14, 165, 233, 0.02)" }
                ]
              }
            },
            showSymbol: false,
            markLine: {
              symbol: "none",
              data: [
                {
                  yAxis: this.kpis.peakDemandKw,
                  lineStyle: { color: "#ef4444", type: "dashed", width: 2 },
                  label: {
                    formatter: `Peak Demand: ${this.kpis.peakDemandKw} kW`,
                    position: "insideEndTop",
                    color: "#dc2626"
                  }
                },
                {
                  yAxis: this.kpis.baseloadDemandKw,
                  lineStyle: { color: "#10b981", type: "dashed", width: 2 },
                  label: {
                    formatter: `Baseload: ${this.kpis.baseloadDemandKw} kW`,
                    position: "insideEndBottom",
                    color: "#059669"
                  }
                }
              ]
            }
          }
        ]
      };
    },
    stationComparisonOption() {
      const stations = this.stationComparison.map((s) => s.stationName);
      const peaks = this.stationComparison.map((s) => s.peakDemandKw);
      const baseloads = this.stationComparison.map((s) => s.baseloadDemandKw);
      const avgs = this.stationComparison.map((s) => s.avgDemandKw);

      return {
        tooltip: {
          trigger: "axis"
        },
        legend: {
          data: ["Peak Demand (kW)", "Baseload Demand (kW)", "Average Demand (kW)"],
          bottom: 0,
          textStyle: { color: "#64748b" }
        },
        grid: {
          top: 30,
          left: 55,
          right: 30,
          bottom: 35
        },
        xAxis: {
          type: "category",
          data: stations,
          axisLine: { lineStyle: { color: "#e2e8f0" } },
          axisLabel: { color: "#64748b", rotate: 15 }
        },
        yAxis: {
          type: "value",
          name: "Demand (kW)",
          splitLine: { lineStyle: { color: "#f1f5f9" } },
          axisLabel: { color: "#64748b", formatter: "{value} kW" }
        },
        series: [
          {
            name: "Peak Demand (kW)",
            type: "bar",
            data: peaks,
            itemStyle: { color: "#ef4444", borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 28
          },
          {
            name: "Baseload Demand (kW)",
            type: "bar",
            data: baseloads,
            itemStyle: { color: "#0ea5e9", borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 28
          },
          {
            name: "Average Demand (kW)",
            type: "line",
            smooth: true,
            data: avgs,
            itemStyle: { color: "#10b981" },
            lineStyle: { width: 3 },
            symbolSize: 6
          }
        ]
      };
    }
  },
  mounted() {
    this.detectActiveOem();
    this.loadLoadCurves();
  },
  methods: {
    detectActiveOem() {
      try {
        const store = useOemStore();
        if (store.currentOem) {
          this.oemDisplayName = store.currentOem.displayName || store.currentOem.name || "SparkMeter";
        }
      } catch {
        // default
      }
    },
    async loadLoadCurves() {
      this.loading = true;
      this.error = "";
      try {
        const res = await getApi("/oem/telemetry/load-curves", {
          station: this.selectedStation,
          range: this.selectedRange
        });
        const payload = res?.data || res?.result || {};
        if (payload.kpis) {
          this.kpis = payload.kpis;
        }
        if (Array.isArray(payload.points)) {
          this.points = payload.points;
        }
        if (Array.isArray(payload.stationComparison)) {
          this.stationComparison = payload.stationComparison;
        }
        if (payload.oemDisplayName) {
          this.oemDisplayName = payload.oemDisplayName;
        }
        this.lastRefreshedAt = new Date();
      } catch (err) {
        this.error = err?.message || "Failed to load interval demand telemetry";
      } finally {
        this.loading = false;
      }
    },
    handleFilterChange() {
      this.currentPage = 1;
      this.loadLoadCurves();
    },
    formatNumber(n) {
      return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    },
    formatInt(n) {
      return Number(n || 0).toLocaleString("en-US");
    },
    calculatePeakMargin(load) {
      if (!this.kpis.peakDemandKw) return 0;
      return Math.round((Number(load) / this.kpis.peakDemandKw) * 100);
    },
    marginClass(load) {
      const pct = this.calculatePeakMargin(load);
      if (pct >= 85) return "dc-text-peak";
      if (pct <= 30) return "dc-text-base";
      return "";
    },
    windowBadgeVariant(timeStr) {
      const hour = parseInt(timeStr.slice(0, 2), 10);
      if (hour >= 18 && hour <= 21) return "danger";
      if (hour >= 9 && hour <= 16) return "info";
      if (hour < 6) return "neutral";
      return "default";
    },
    windowBadgeLabel(timeStr) {
      const hour = parseInt(timeStr.slice(0, 2), 10);
      if (hour >= 18 && hour <= 21) return "Peak Window";
      if (hour >= 9 && hour <= 16) return "Midday Plateau";
      if (hour < 6) return "Baseload Window";
      return "Ramp Interval";
    },
    exportCsv() {
      const headers = ["Interval", "Timestamp", "Active Demand (kW)", "Baseload (kW)", "Peak Reference (kW)", "Power Factor", "Line Current (A)", "Station"];
      const rows = this.points.map((p) => [
        p.time,
        p.timestamp,
        p.activeLoadKw,
        p.baseloadKw,
        p.peakDemandKw,
        p.powerFactor,
        p.currentA,
        this.selectedStation
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute("href", url);
      link.setAttribute("download", `beverly-demand-curve-${this.selectedStation}-${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    exportExcel() {
      // Formats as an XML Spreadsheet 2003 (.xls) readable directly by Microsoft Excel
      const dateStr = new Date().toISOString().slice(0, 10);
      let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
      xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
      xml += '<Worksheet ss:Name="Demand Profile"><Table>';

      // Header Row
      const headers = ["Interval", "Timestamp", "Active Demand (kW)", "Baseload (kW)", "Peak Reference (kW)", "Power Factor", "Current (A)", "Station Scope"];
      xml += "<Row>";
      headers.forEach((h) => {
        xml += `<Cell><Data ss:Type="String">${h}</Data></Cell>`;
      });
      xml += "</Row>";

      // Data Rows
      this.points.forEach((p) => {
        xml += "<Row>";
        xml += `<Cell><Data ss:Type="String">${p.time}</Data></Cell>`;
        xml += `<Cell><Data ss:Type="String">${p.timestamp}</Data></Cell>`;
        xml += `<Cell><Data ss:Type="Number">${p.activeLoadKw}</Data></Cell>`;
        xml += `<Cell><Data ss:Type="Number">${p.baseloadKw}</Data></Cell>`;
        xml += `<Cell><Data ss:Type="Number">${p.peakDemandKw}</Data></Cell>`;
        xml += `<Cell><Data ss:Type="Number">${p.powerFactor}</Data></Cell>`;
        xml += `<Cell><Data ss:Type="Number">${p.currentA}</Data></Cell>`;
        xml += `<Cell><Data ss:Type="String">${this.selectedStation}</Data></Cell>`;
        xml += "</Row>";
      });

      xml += "</Table></Worksheet></Workbook>";
      const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `beverly-demand-curve-${this.selectedStation}-${dateStr}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
};
</script>

<style scoped>
.demand-curves-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6, 24px);
  padding: var(--space-6, 24px);
  max-width: 1440px;
  margin: 0 auto;
  font-family: var(--bev-font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  color: var(--bev-color-slate-900, #0f172a);
}

/* Header */
.dc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--space-4, 16px);
  border-bottom: 1px solid var(--bev-color-slate-200, #e2e8f0);
  padding-bottom: var(--space-5, 20px);
}

.dc-header__title-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.dc-header__badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dc-badge-tag {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.dc-badge-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
}

.dc-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--bev-color-green-500, #10b981);
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: dc-pulse 2s infinite;
}

@keyframes dc-pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.dc-last-updated {
  font-size: 12px;
  color: var(--bev-color-slate-500, #64748b);
  margin-left: 4px;
}

.dc-title {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--bev-color-slate-900, #0f172a);
}

.dc-subtitle {
  font-size: 14px;
  color: var(--bev-color-slate-500, #64748b);
  margin: 0;
  max-width: 680px;
  line-height: 1.5;
}

.dc-header__actions {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3, 12px);
  flex-wrap: wrap;
}

.dc-control-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dc-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bev-color-slate-500, #64748b);
}

.dc-select {
  min-width: 220px;
  height: 38px;
}

.dc-select--range {
  min-width: 200px;
}

.dc-header__btn-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dc-btn {
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.dc-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Error Banner */
.dc-error-banner {
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

/* KPI Section */
.dc-kpi-section {
  width: 100%;
}

.dc-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4, 16px);
}

.dc-kpi-card {
  padding: 16px 18px;
  border-radius: var(--radius-lg, 12px);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dc-kpi-card--peak {
  border-top: 3px solid #ef4444;
}

.dc-kpi-card--base {
  border-top: 3px solid #0ea5e9;
}

.dc-kpi-card--energy {
  border-top: 3px solid #10b981;
}

.dc-kpi-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dc-kpi-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--bev-color-slate-500, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dc-kpi-badge {
  font-size: 10px;
  padding: 1px 6px;
}

.dc-kpi-value-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.dc-kpi-val {
  font-family: var(--bev-font-mono, monospace);
  font-size: 28px;
  font-weight: 800;
  color: var(--bev-color-slate-900, #0f172a);
}

.dc-kpi-unit {
  font-size: 14px;
  font-weight: 600;
  color: var(--bev-color-slate-500, #64748b);
}

.dc-kpi-subtext {
  font-size: 12px;
  color: var(--bev-color-slate-500, #64748b);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Charts Section */
.dc-main-chart-section,
.dc-station-comparison-section {
  width: 100%;
}

.dc-chart-card {
  padding: 20px;
  border-radius: var(--radius-lg, 12px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dc-chart-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.dc-chart-card__title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: var(--bev-color-slate-900, #0f172a);
}

.dc-chart-card__subtitle {
  font-size: 12px;
  color: var(--bev-color-slate-500, #64748b);
  margin: 2px 0 0 0;
}

.dc-chart-legend-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.dc-legend-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
}

.dc-legend-pill--load { background-color: rgba(14, 165, 233, 0.15); color: #0284c7; }
.dc-legend-pill--peak { background-color: rgba(239, 68, 68, 0.12); color: #dc2626; }
.dc-legend-pill--base { background-color: rgba(16, 185, 129, 0.15); color: #059669; }

.dc-chart-wrap {
  width: 100%;
  height: 320px;
}

.dc-chart-wrap--station {
  height: 280px;
}

.dc-chart-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--bev-color-slate-400, #94a3b8);
}

/* Table Section */
.dc-table-section {
  width: 100%;
}

.dc-table-card {
  padding: 20px;
  border-radius: var(--radius-lg, 12px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dc-table-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.dc-table-card__title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: var(--bev-color-slate-900, #0f172a);
}

.dc-table-card__subtitle {
  font-size: 12px;
  color: var(--bev-color-slate-500, #64748b);
  margin: 2px 0 0 0;
}

.dc-table-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dc-table-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--bev-color-slate-500, #64748b);
}

.dc-table-wrapper {
  overflow-x: auto;
}

.dc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}

.dc-table th {
  padding: 10px 14px;
  background-color: var(--bev-color-slate-50, #f8fafc);
  color: var(--bev-color-slate-500, #64748b);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--bev-color-slate-200, #e2e8f0);
}

.dc-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--bev-color-slate-100, #f1f5f9);
  color: var(--bev-color-slate-700, #334155);
}

.dc-font-mono {
  font-family: var(--bev-font-mono, monospace);
}

.dc-time-cell {
  color: var(--bev-color-slate-900, #0f172a);
}

.dc-load-cell {
  font-weight: 700;
  color: #0284c7;
}

.dc-subdued {
  color: var(--bev-color-slate-400, #94a3b8);
}

.dc-text-peak {
  color: #dc2626;
  font-weight: 700;
}

.dc-text-base {
  color: #059669;
  font-weight: 600;
}

.dc-empty-row {
  text-align: center;
  padding: 24px;
  color: var(--bev-color-slate-400, #94a3b8);
}

.dc-pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 8px;
}

.dc-page-info {
  font-size: 12px;
  color: var(--bev-color-slate-500, #64748b);
}

.dc-page-buttons {
  display: flex;
  gap: 6px;
}

@media (max-width: 768px) {
  .demand-curves-page {
    padding: var(--space-3, 12px);
  }
  .dc-header {
    flex-direction: column;
    align-items: stretch;
  }
  .dc-header__actions {
    flex-direction: column;
    align-items: stretch;
  }
  .dc-select,
  .dc-select--range {
    min-width: 100%;
  }
}
</style>
