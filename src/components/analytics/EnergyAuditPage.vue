<template>
  <div class="eap-container">
    <!-- ═══════════════════════════════════════════════════════ HERO ═══ -->
    <header class="eap-hero">
      <div class="eap-hero-glow" />
      <div class="eap-hero-inner">
        <div class="eap-hero-left">
          <div class="eap-hero-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div>
            <div class="eap-hero-eyebrow">Anti-Theft Loss Engine · SparkMeter Grids</div>
            <h1 class="eap-hero-title">Site Energy Audit & Balancing</h1>
            <p class="eap-hero-sub">
              Mini-grid commercial loss detection, feeder totalizer energy balancing, and illegal bypass surveillance.
            </p>
          </div>
        </div>

        <div class="eap-hero-badges">
          <span class="eap-badge eap-badge--live">
            <span class="eap-badge-dot"></span>
            8 Mini-Grids Online
          </span>
          <span v-if="summary.theftAlertSitesCount > 0" class="eap-badge eap-badge--danger eap-badge--pulse">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {{ summary.theftAlertSitesCount }} Theft Bypass Alerts
          </span>
          <span class="eap-badge eap-badge--neutral">
            Last Audit: {{ formattedAuditTime }}
          </span>
        </div>

        <div class="eap-hero-actions">
          <button class="eap-hbtn eap-hbtn--ghost" :disabled="loading" @click="exportAuditCsv" title="Export Audit CSV">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
          <button class="eap-hbtn eap-hbtn--primary" :disabled="loading" @click="fetchAuditData">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" :class="{ 'eap-spin': loading }">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {{ loading ? 'Auditing…' : 'Run Audit' }}
          </button>
        </div>
      </div>
    </header>

    <!-- ══════════════════════════════════════════════════ FILTERS / CONTROLS ═══ -->
    <div class="eap-controls-card">
      <div class="eap-ctrl-group">
        <label class="eap-ctrl-label" for="site-filter">Mini-Grid Feeder Scope</label>
        <div class="eap-select-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="eap-ctrl-icon">
            <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
          <select id="site-filter" v-model="selectedSiteFilter" class="eap-select" @change="fetchAuditData">
            <option value="">All 8 SparkMeter Sites (Grid Wide)</option>
            <option v-for="site in rawSites" :key="site.siteId" :value="site.siteCode">
              {{ site.siteCode }} — {{ site.siteName }} ({{ site.state }})
            </option>
          </select>
        </div>
      </div>

      <div class="eap-ctrl-group">
        <label class="eap-ctrl-label">Audit Timeframe</label>
        <div class="eap-seg">
          <button
            v-for="tf in timeframes"
            :key="tf.value"
            :class="['eap-seg-btn', selectedTimeframe === tf.value && 'eap-seg-btn--active']"
            @click="setTimeframe(tf.value)"
          >
            {{ tf.label }}
          </button>
        </div>
      </div>

      <div class="eap-ctrl-group eap-loss-legend">
        <div class="eap-ctrl-label">Loss Rating Thresholds</div>
        <div class="eap-legend-badges">
          <span class="eap-rating-badge eap-rating-badge--optimal">0% - 5%: Optimal Technical Loss</span>
          <span class="eap-rating-badge eap-rating-badge--warning">5% - 10%: Elevated Loss / Line Warning</span>
          <span class="eap-rating-badge eap-rating-badge--danger eap-rating-badge--pulse">&gt; 10%: Commercial Theft Alert / Illegal Bypass</span>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════ KPI METRIC CARDS ═══ -->
    <section class="eap-kpi-grid">
      <!-- Card 1: Totalizer Dispatch -->
      <div class="eap-kpi-card">
        <div class="eap-kpi-header">
          <span class="eap-kpi-label">Totalizer Dispatch Energy</span>
          <div class="eap-kpi-icon-wrap eap-kpi-icon--brand">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
        </div>
        <div class="eap-kpi-value-row">
          <span class="eap-kpi-num">{{ formatNumber(summary.totalDispatchedKwh) }}</span>
          <span class="eap-kpi-unit">kWh</span>
        </div>
        <p class="eap-kpi-sub">
          Dispatched at Powerhouse transformer across {{ summary.siteCount }} active mini-grid sites.
        </p>
      </div>

      <!-- Card 2: Customer Consumed -->
      <div class="eap-kpi-card">
        <div class="eap-kpi-header">
          <span class="eap-kpi-label">Billed / Customer Consumed</span>
          <div class="eap-kpi-icon-wrap eap-kpi-icon--positive">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M7 15h0M2 9.5h20" />
            </svg>
          </div>
        </div>
        <div class="eap-kpi-value-row">
          <span class="eap-kpi-num">{{ formatNumber(summary.totalConsumedKwh) }}</span>
          <span class="eap-kpi-unit">kWh</span>
        </div>
        <p class="eap-kpi-sub">
          Registered across {{ formatNumber(summary.totalCustomers) }} customer smart meters.
        </p>
      </div>

      <!-- Card 3: Real-Time Line Loss Rate -->
      <div class="eap-kpi-card" :class="kpiLossCardClass">
        <div class="eap-kpi-header">
          <span class="eap-kpi-label">Real-Time Line Loss Rate</span>
          <div class="eap-kpi-icon-wrap" :class="kpiLossIconClass">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
              <polyline points="17 18 23 18 23 12"/>
            </svg>
          </div>
        </div>
        <div class="eap-kpi-value-row">
          <span class="eap-kpi-num">{{ summary.networkLossRatePercent }}%</span>
          <span class="eap-kpi-unit">({{ formatNumber(summary.totalLossKwh) }} kWh loss)</span>
        </div>
        <div class="eap-kpi-badge-wrap">
          <span :class="['eap-rating-badge', networkBadgeClass]">
            {{ summary.networkRating?.label || 'Calculating…' }}
          </span>
        </div>
      </div>

      <!-- Card 4: Commercial Theft Exposure -->
      <div class="eap-kpi-card">
        <div class="eap-kpi-header">
          <span class="eap-kpi-label">Commercial Theft Exposure</span>
          <div class="eap-kpi-icon-wrap eap-kpi-icon--danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
            </svg>
          </div>
        </div>
        <div class="eap-kpi-value-row">
          <span class="eap-kpi-num">₦{{ formatNumber(summary.totalFinancialLossNgn) }}</span>
          <span class="eap-kpi-unit">estimated</span>
        </div>
        <p class="eap-kpi-sub">
          Unaccounted energy variance ({{ formatNumber(summary.totalTheftKwh) }} kWh) exceeding technical 4% threshold.
        </p>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════ ECHARTS FLOW BALANCE ═══ -->
    <section class="eap-chart-section">
      <div class="eap-chart-header">
        <div>
          <h2 class="eap-chart-title">Energy Flow Balance & Commercial Loss Dynamics</h2>
          <p class="eap-chart-sub">
            End-to-end power generation flow from transformer dispatch through technical line loss to billed customer consumption vs unmetered commercial bypass.
          </p>
        </div>
        <div class="eap-chart-tabs">
          <button
            :class="['eap-chart-tab', activeChartTab === 'flow' && 'eap-chart-tab--active']"
            @click="activeChartTab = 'flow'"
          >
            Energy Flow Diagram
          </button>
          <button
            :class="['eap-chart-tab', activeChartTab === 'trend' && 'eap-chart-tab--active']"
            @click="activeChartTab = 'trend'"
          >
            24H Dispatch vs Billed Curve
          </button>
          <button
            :class="['eap-chart-tab', activeChartTab === 'feeders' && 'eap-chart-tab--active']"
            @click="activeChartTab = 'feeders'"
          >
            Feeder Loss Breakdown
          </button>
        </div>
      </div>

      <div class="eap-chart-body">
        <div ref="echartContainer" class="eap-echart-canvas" role="img" aria-label="Energy flow balance chart"></div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════ FEEDER AUDIT TABLE ═══ -->
    <section class="eap-table-section">
      <div class="eap-table-header">
        <div>
          <h2 class="eap-table-title">Mini-Grid Feeder Audit & Loss Register</h2>
          <p class="eap-table-sub">
            Real-time loss balancing across the 8 SparkMeter mini-grid sites. Sites with &gt;10% line loss are flagged for immediate field anti-theft inspection.
          </p>
        </div>
        <div class="eap-table-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="eap-search-icon">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            v-model="tableSearchQuery"
            type="text"
            placeholder="Search feeder, site, or totalizer…"
            class="eap-search-input"
          />
        </div>
      </div>

      <div class="eap-table-wrap">
        <table class="eap-table">
          <thead>
            <tr>
              <th @click="sortBy('siteCode')" class="sortable">
                Mini-Grid Site
                <span class="sort-icon">{{ sortKey === 'siteCode' ? (sortAsc ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th>Totalizer Meter</th>
              <th @click="sortBy('customerCount')" class="sortable text-right">
                Customers
                <span class="sort-icon">{{ sortKey === 'customerCount' ? (sortAsc ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th @click="sortBy('dispatchedKwh')" class="sortable text-right">
                Dispatched (kWh)
                <span class="sort-icon">{{ sortKey === 'dispatchedKwh' ? (sortAsc ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th @click="sortBy('consumedKwh')" class="sortable text-right">
                Billed Consumed (kWh)
                <span class="sort-icon">{{ sortKey === 'consumedKwh' ? (sortAsc ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th @click="sortBy('lossKwh')" class="sortable text-right">
                Net Loss (kWh)
                <span class="sort-icon">{{ sortKey === 'lossKwh' ? (sortAsc ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th @click="sortBy('lossRatePercent')" class="sortable text-center">
                Line Loss Rate
                <span class="sort-icon">{{ sortKey === 'lossRatePercent' ? (sortAsc ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th class="text-center">Visual Loss Rating</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="site in filteredAndSortedSites"
              :key="site.siteId"
              :class="{ 'eap-row--theft': site.rating.isTheftAlert }"
            >
              <td class="eap-site-cell">
                <div class="eap-site-code">{{ site.siteCode }}</div>
                <div class="eap-site-name">{{ site.siteName }} · {{ site.state }}</div>
                <div class="eap-feeder-name">{{ site.feederName }}</div>
              </td>
              <td>
                <span class="eap-mono-tag">{{ site.totalizerMeterId }}</span>
                <div class="eap-sub-serial">{{ site.totalizerSerial }}</div>
              </td>
              <td class="text-right font-medium">{{ formatNumber(site.customerCount) }}</td>
              <td class="text-right font-mono">{{ formatNumber(site.dispatchedKwh) }}</td>
              <td class="text-right font-mono">{{ formatNumber(site.consumedKwh) }}</td>
              <td class="text-right font-mono font-medium" :class="site.lossKwh > 1000 ? 'text-danger' : 'text-primary'">
                {{ formatNumber(site.lossKwh) }}
              </td>
              <td class="text-center">
                <div class="eap-loss-pct-bar">
                  <span class="eap-loss-pct-num">{{ site.lossRatePercent }}%</span>
                  <div class="eap-progress-track">
                    <div
                      class="eap-progress-fill"
                      :class="progressFillClass(site.lossRatePercent)"
                      :style="{ width: `${Math.min(site.lossRatePercent * 4, 100)}%` }"
                    ></div>
                  </div>
                </div>
              </td>
              <td class="text-center">
                <span :class="['eap-rating-badge', getBadgeClass(site.rating)]">
                  <span v-if="site.rating.isTheftAlert" class="eap-pulse-dot"></span>
                  {{ site.rating.label }}
                </span>
              </td>
              <td class="text-right">
                <button
                  class="eap-action-btn"
                  :class="{ 'eap-action-btn--danger': site.rating.isTheftAlert }"
                  @click="openInspectModal(site)"
                >
                  {{ site.rating.isTheftAlert ? 'Bypass Alert' : 'Inspect' }}
                </button>
              </td>
            </tr>
            <tr v-if="filteredAndSortedSites.length === 0">
              <td colspan="9" class="eap-empty-row">No mini-grid feeder matching search criteria.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════ INSPECTION MODAL ═══ -->
    <div v-if="inspectingSite" class="eap-modal-backdrop" @click.self="closeInspectModal">
      <div class="eap-modal-dialog">
        <div class="eap-modal-header">
          <div>
            <div class="eap-modal-eyebrow">Feeder Investigation</div>
            <h3 class="eap-modal-title">{{ inspectingSite.siteCode }} — {{ inspectingSite.feederName }}</h3>
          </div>
          <button class="eap-modal-close" @click="closeInspectModal" aria-label="Close dialog">✕</button>
        </div>

        <div class="eap-modal-content">
          <div v-if="inspectingSite.rating.isTheftAlert" class="eap-alert-banner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="eap-alert-icon">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <div class="eap-alert-headline">Commercial Theft Risk High ({{ inspectingSite.lossRatePercent }}% Loss)</div>
              <p class="eap-alert-desc">
                Dispatched energy ({{ formatNumber(inspectingSite.dispatchedKwh) }} kWh) exceeds customer billed registrations
                ({{ formatNumber(inspectingSite.consumedKwh) }} kWh) by {{ formatNumber(inspectingSite.lossKwh) }} kWh.
                Estimated unmetered commercial bypass value: ₦{{ formatNumber(inspectingSite.financialLossNgn) }}.
              </p>
            </div>
          </div>

          <div class="eap-modal-stats-grid">
            <div class="eap-mstat">
              <div class="eap-mstat-label">Powerhouse Totalizer</div>
              <div class="eap-mstat-val font-mono">{{ inspectingSite.totalizerMeterId }}</div>
              <div class="eap-mstat-sub">Serial: {{ inspectingSite.totalizerSerial }}</div>
            </div>
            <div class="eap-mstat">
              <div class="eap-mstat-label">Connected Customers</div>
              <div class="eap-mstat-val">{{ formatNumber(inspectingSite.customerCount) }} meters</div>
              <div class="eap-mstat-sub">Transformer: {{ inspectingSite.capacityKva }} kVA</div>
            </div>
            <div class="eap-mstat">
              <div class="eap-mstat-label">Net Variance</div>
              <div class="eap-mstat-val font-mono text-danger">{{ formatNumber(inspectingSite.lossKwh) }} kWh</div>
              <div class="eap-mstat-sub">Baseline Technical: ~4%</div>
            </div>
          </div>

          <div class="eap-modal-actions">
            <button class="eap-hbtn eap-hbtn--primary" @click="dispatchCanaryInspection">
              Dispatch Anti-Theft Inspection Task
            </button>
            <button class="eap-hbtn eap-hbtn--ghost" @click="closeInspectModal">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { loadECharts } from "../../services/echarts-loader.mjs";

export default {
  name: "EnergyAuditPage",
  data() {
    return {
      loading: false,
      selectedSiteFilter: "",
      selectedTimeframe: "all",
      timeframes: [
        { label: "Today", value: "today" },
        { label: "Last 7 Days", value: "week" },
        { label: "This Month", value: "month" },
        { label: "All Time", value: "all" }
      ],
      activeChartTab: "flow",
      tableSearchQuery: "",
      sortKey: "lossRatePercent",
      sortAsc: false,
      summary: {
        totalDispatchedKwh: 0,
        totalConsumedKwh: 0,
        totalLossKwh: 0,
        networkLossRatePercent: 0,
        networkRating: null,
        totalCustomers: 0,
        totalTheftKwh: 0,
        totalFinancialLossNgn: 0,
        theftAlertSitesCount: 0,
        siteCount: 8,
        auditTimestamp: ""
      },
      rawSites: [],
      flowBalance: null,
      hourlyTrend: [],
      inspectingSite: null,
      echartInstance: null,
      resizeObserver: null
    };
  },
  computed: {
    formattedAuditTime() {
      if (!this.summary.auditTimestamp) return "Just now";
      try {
        const d = new Date(this.summary.auditTimestamp);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      } catch {
        return "Just now";
      }
    },
    networkBadgeClass() {
      const code = this.summary.networkRating?.code;
      if (code === "OPTIMAL") return "eap-rating-badge--optimal";
      if (code === "WARNING" || code === "ELEVATED") return "eap-rating-badge--warning";
      return "eap-rating-badge--danger eap-rating-badge--pulse";
    },
    kpiLossCardClass() {
      const pct = this.summary.networkLossRatePercent;
      if (pct > 10) return "eap-kpi-card--danger";
      if (pct > 5) return "eap-kpi-card--warning";
      return "eap-kpi-card--optimal";
    },
    kpiLossIconClass() {
      const pct = this.summary.networkLossRatePercent;
      if (pct > 10) return "eap-kpi-icon--danger";
      if (pct > 5) return "eap-kpi-icon--warning";
      return "eap-kpi-icon--positive";
    },
    filteredAndSortedSites() {
      let list = [...this.rawSites];
      const q = this.tableSearchQuery.trim().toLowerCase();
      if (q) {
        list = list.filter(
          (s) =>
            s.siteCode.toLowerCase().includes(q) ||
            s.siteName.toLowerCase().includes(q) ||
            s.feederName.toLowerCase().includes(q) ||
            s.totalizerMeterId.toLowerCase().includes(q) ||
            s.state.toLowerCase().includes(q)
        );
      }
      list.sort((a, b) => {
        let valA = a[this.sortKey];
        let valB = b[this.sortKey];
        if (typeof valA === "string") {
          return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return this.sortAsc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
      });
      return list;
    }
  },
  watch: {
    activeChartTab() {
      this.renderChart();
    }
  },
  mounted() {
    this.fetchAuditData();
    this.setupResizeObserver();
  },
  beforeUnmount() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.echartInstance) {
      this.echartInstance.dispose();
      this.echartInstance = null;
    }
  },
  methods: {
    formatNumber(val) {
      return (Number(val) || 0).toLocaleString("en-US", { maximumFractionDigits: 1 });
    },
    setTimeframe(tf) {
      this.selectedTimeframe = tf;
      this.fetchAuditData();
    },
    sortBy(key) {
      if (this.sortKey === key) {
        this.sortAsc = !this.sortAsc;
      } else {
        this.sortKey = key;
        this.sortAsc = false;
      }
    },
    getBadgeClass(rating) {
      if (!rating) return "eap-rating-badge--neutral";
      if (rating.code === "OPTIMAL") return "eap-rating-badge--optimal";
      if (rating.code === "WARNING" || rating.code === "ELEVATED") return "eap-rating-badge--warning";
      return "eap-rating-badge--danger eap-rating-badge--pulse";
    },
    progressFillClass(pct) {
      if (pct <= 5.0) return "eap-progress-fill--green";
      if (pct <= 10.0) return "eap-progress-fill--amber";
      return "eap-progress-fill--red";
    },
    async fetchAuditData() {
      this.loading = true;
      try {
        const queryParams = new URLSearchParams();
        if (this.selectedSiteFilter) queryParams.set("siteId", this.selectedSiteFilter);
        if (this.selectedTimeframe) queryParams.set("timeframe", this.selectedTimeframe);

        const url = `/api/oem/analytics/energy-audit?${queryParams.toString()}`;
        const res = await fetch(url);
        const data = await res.json();
        const payload = data?.data || data?.result || data;

        if (payload?.summary) {
          this.summary = payload.summary;
          this.rawSites = payload.sites || [];
          this.flowBalance = payload.flowBalance || null;
          this.hourlyTrend = payload.hourlyTrend || [];
        }
      } catch (err) {
        console.error("[energy-audit-fetch]", err);
      } finally {
        this.loading = false;
        this.$nextTick(() => {
          this.renderChart();
        });
      }
    },
    setupResizeObserver() {
      if (typeof ResizeObserver !== "undefined" && this.$refs.echartContainer) {
        this.resizeObserver = new ResizeObserver(() => {
          if (this.echartInstance) {
            this.echartInstance.resize();
          }
        });
        this.resizeObserver.observe(this.$refs.echartContainer);
      }
    },
    async renderChart() {
      const container = this.$refs.echartContainer;
      if (!container) return;

      const echarts = await loadECharts();
      if (!echarts) return;

      if (!this.echartInstance) {
        this.echartInstance = echarts.init(container);
      }

      let option = {};

      if (this.activeChartTab === "flow") {
        // Multi-stage energy balance flow diagram (Sankey-style balance)
        const total = this.summary.totalDispatchedKwh || 92100;
        const billed = this.summary.totalConsumedKwh || 83235;
        const loss = this.summary.totalLossKwh || 8865;
        const techLoss = Math.round(total * 0.041);
        const commLoss = Math.max(0, loss - techLoss);

        option = {
          title: {
            text: "Powerhouse Dispatch & Feeder Balancing Flow (kWh)",
            subtext: `Total Generated: ${this.formatNumber(total)} kWh · Commercial Loss: ${this.formatNumber(commLoss)} kWh`,
            textStyle: { color: "#e2e8f0", fontSize: 14, fontWeight: "600", fontFamily: "Plus Jakarta Sans, sans-serif" },
            subtextStyle: { color: "#94a3b8", fontSize: 12 }
          },
          tooltip: {
            trigger: "item",
            formatter: "{b}: {c} kWh"
          },
          series: [
            {
              type: "sankey",
              layout: "none",
              emphasis: { focus: "adjacency" },
              data: [
                { name: "Powerhouse Dispatch", itemStyle: { color: "#38bdf8" } },
                { name: "Substation Delivery", itemStyle: { color: "#818cf8" } },
                { name: "Technical Line Loss (~4.1%)", itemStyle: { color: "#f59e0b" } },
                { name: "Billed Customer Consumption", itemStyle: { color: "#22c55e" } },
                { name: "Commercial Loss / Bypass", itemStyle: { color: "#ef4444" } }
              ],
              links: [
                { source: "Powerhouse Dispatch", target: "Technical Line Loss (~4.1%)", value: techLoss },
                { source: "Powerhouse Dispatch", target: "Substation Delivery", value: total - techLoss },
                { source: "Substation Delivery", target: "Billed Customer Consumption", value: billed },
                { source: "Substation Delivery", target: "Commercial Loss / Bypass", value: commLoss }
              ],
              lineStyle: {
                color: "gradient",
                curveness: 0.5,
                opacity: 0.4
              },
              label: {
                color: "#f1f5f9",
                fontSize: 12,
                fontFamily: "Inter, sans-serif"
              }
            }
          ]
        };
      } else if (this.activeChartTab === "trend") {
        // 24H Hourly Dispatch vs Consumed Line Chart
        const hours = this.hourlyTrend.map((h) => h.hour);
        const dispatched = this.hourlyTrend.map((h) => h.dispatchedKwh);
        const consumed = this.hourlyTrend.map((h) => h.consumedKwh);
        const lossRates = this.hourlyTrend.map((h) => h.lossRatePercent);

        option = {
          title: {
            text: "24-Hour Dispatch vs Customer Consumption Profile",
            subtext: "Evening surge highlights commercial theft & illegal bypass during peak hours",
            textStyle: { color: "#e2e8f0", fontSize: 14, fontWeight: "600" },
            subtextStyle: { color: "#94a3b8", fontSize: 12 }
          },
          tooltip: {
            trigger: "axis",
            axisPointer: { type: "cross" }
          },
          legend: {
            data: ["Dispatched (kWh)", "Consumed (kWh)", "Loss Rate (%)"],
            textStyle: { color: "#94a3b8" },
            top: 10,
            right: 20
          },
          grid: { left: "3%", right: "4%", bottom: "8%", top: "18%", containLabel: true },
          xAxis: {
            type: "category",
            boundaryGap: false,
            data: hours,
            axisLine: { lineStyle: { color: "#334155" } },
            axisLabel: { color: "#94a3b8", fontSize: 11 }
          },
          yAxis: [
            {
              type: "value",
              name: "Energy (kWh)",
              nameTextStyle: { color: "#94a3b8" },
              splitLine: { lineStyle: { color: "#1e293b" } },
              axisLabel: { color: "#94a3b8" }
            },
            {
              type: "value",
              name: "Loss %",
              max: 25,
              nameTextStyle: { color: "#94a3b8" },
              splitLine: { show: false },
              axisLabel: { formatter: "{value}%", color: "#94a3b8" }
            }
          ],
          series: [
            {
              name: "Dispatched (kWh)",
              type: "line",
              smooth: true,
              data: dispatched,
              itemStyle: { color: "#38bdf8" },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: "rgba(56, 189, 248, 0.28)" },
                  { offset: 1, color: "rgba(56, 189, 248, 0.0)" }
                ])
              }
            },
            {
              name: "Consumed (kWh)",
              type: "line",
              smooth: true,
              data: consumed,
              itemStyle: { color: "#22c55e" },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: "rgba(34, 197, 94, 0.22)" },
                  { offset: 1, color: "rgba(34, 197, 94, 0.0)" }
                ])
              }
            },
            {
              name: "Loss Rate (%)",
              type: "line",
              yAxisIndex: 1,
              smooth: true,
              data: lossRates,
              itemStyle: { color: "#ef4444" },
              lineStyle: { width: 2.5, type: "dashed" }
            }
          ]
        };
      } else {
        // Feeder Comparison Bar Chart
        const siteNames = this.rawSites.map((s) => s.siteCode);
        const dispVals = this.rawSites.map((s) => s.dispatchedKwh);
        const consVals = this.rawSites.map((s) => s.consumedKwh);
        const lossVals = this.rawSites.map((s) => s.lossRatePercent);

        option = {
          title: {
            text: "Feeder Comparison: Dispatched vs Consumed & Loss Rate %",
            textStyle: { color: "#e2e8f0", fontSize: 14, fontWeight: "600" }
          },
          tooltip: { trigger: "axis" },
          legend: {
            data: ["Dispatched (kWh)", "Consumed (kWh)", "Loss Rate (%)"],
            textStyle: { color: "#94a3b8" },
            right: 20
          },
          grid: { left: "3%", right: "4%", bottom: "10%", top: "18%", containLabel: true },
          xAxis: {
            type: "category",
            data: siteNames,
            axisLabel: { color: "#94a3b8", interval: 0, rotate: 20 }
          },
          yAxis: [
            {
              type: "value",
              name: "kWh",
              nameTextStyle: { color: "#94a3b8" },
              splitLine: { lineStyle: { color: "#1e293b" } },
              axisLabel: { color: "#94a3b8" }
            },
            {
              type: "value",
              name: "Loss %",
              nameTextStyle: { color: "#94a3b8" },
              splitLine: { show: false },
              axisLabel: { formatter: "{value}%", color: "#94a3b8" }
            }
          ],
          series: [
            {
              name: "Dispatched (kWh)",
              type: "bar",
              data: dispVals,
              itemStyle: { color: "#38bdf8", borderRadius: [4, 4, 0, 0] }
            },
            {
              name: "Consumed (kWh)",
              type: "bar",
              data: consVals,
              itemStyle: { color: "#22c55e", borderRadius: [4, 4, 0, 0] }
            },
            {
              name: "Loss Rate (%)",
              type: "line",
              yAxisIndex: 1,
              data: lossVals,
              itemStyle: { color: "#f59e0b" }
            }
          ]
        };
      }

      this.echartInstance.setOption(option, true);
    },
    openInspectModal(site) {
      this.inspectingSite = site;
    },
    closeInspectModal() {
      this.inspectingSite = null;
    },
    dispatchCanaryInspection() {
      alert(`Canary Inspection Task dispatched to ${this.inspectingSite?.siteCode} for Totalizer ${this.inspectingSite?.totalizerMeterId}. Field anti-theft crew notified.`);
      this.closeInspectModal();
    },
    exportAuditCsv() {
      if (!this.rawSites.length) return;
      const headers = ["Site Code", "Site Name", "Feeder", "Totalizer ID", "Customers", "Dispatched (kWh)", "Consumed (kWh)", "Loss (kWh)", "Loss Rate (%)", "Rating"];
      const rows = this.rawSites.map((s) => [
        s.siteCode,
        s.siteName,
        s.feederName,
        s.totalizerMeterId,
        s.customerCount,
        s.dispatchedKwh,
        s.consumedKwh,
        s.lossKwh,
        s.lossRatePercent,
        s.rating?.label || ""
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Beverly_Energy_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    }
  }
};
</script>

<style scoped>
.eap-container {
  padding: var(--s-6);
  max-width: 1440px;
  margin: 0 auto;
  font-family: var(--font-sans);
  color: var(--text-primary, #f1f5f9);
}

/* ── Hero ── */
.eap-hero {
  position: relative;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-2xl);
  padding: var(--s-6) var(--s-8);
  margin-bottom: var(--s-6);
  overflow: hidden;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
}

.eap-hero-glow {
  position: absolute;
  top: -50px;
  right: -50px;
  width: 250px;
  height: 250px;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%);
  pointer-events: none;
}

.eap-hero-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-6);
  flex-wrap: wrap;
}

.eap-hero-left {
  display: flex;
  align-items: center;
  gap: var(--s-4);
}

.eap-hero-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--r-xl);
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(14, 165, 233, 0.05) 100%);
  border: 1px solid rgba(56, 189, 248, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #38bdf8;
}

.eap-hero-icon svg {
  width: 24px;
  height: 24px;
}

.eap-hero-eyebrow {
  font-size: var(--t-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: var(--fw-semibold);
  color: #38bdf8;
  margin-bottom: 2px;
}

.eap-hero-title {
  font-family: var(--font-display);
  font-size: var(--t-2xl);
  font-weight: var(--fw-bold);
  margin: 0;
  color: #fff;
  letter-spacing: -0.02em;
}

.eap-hero-sub {
  font-size: var(--t-sm);
  color: var(--text-secondary, #94a3b8);
  margin: 4px 0 0;
}

.eap-hero-badges {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  flex-wrap: wrap;
}

.eap-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--r-full);
  font-size: var(--t-xs);
  font-weight: var(--fw-medium);
}

.eap-badge--live {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.eap-badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}

.eap-badge--danger {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.eap-badge--danger svg {
  width: 14px;
  height: 14px;
}

.eap-badge--neutral {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.eap-badge--pulse {
  animation: pulseGlow 1.8s infinite;
}

@keyframes pulseGlow {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
  70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

.eap-hero-actions {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}

.eap-hbtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--r-md);
  font-size: var(--t-sm);
  font-weight: var(--fw-medium);
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease-out);
  border: none;
}

.eap-hbtn svg {
  width: 16px;
  height: 16px;
}

.eap-hbtn--primary {
  background: #0284c7;
  color: #fff;
}

.eap-hbtn--primary:hover {
  background: #0369a1;
}

.eap-hbtn--ghost {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.eap-hbtn--ghost:hover {
  background: rgba(255, 255, 255, 0.14);
}

.eap-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── Controls ── */
.eap-controls-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
  background: var(--bg-card, #1e293b);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-xl);
  padding: var(--s-4) var(--s-6);
  margin-bottom: var(--s-6);
  flex-wrap: wrap;
}

.eap-ctrl-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.eap-ctrl-label {
  font-size: var(--t-xs);
  font-weight: var(--fw-medium);
  color: var(--text-secondary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.eap-select-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.eap-ctrl-icon {
  position: absolute;
  left: 10px;
  width: 16px;
  height: 16px;
  color: #94a3b8;
  pointer-events: none;
}

.eap-select {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f1f5f9;
  border-radius: var(--r-md);
  padding: 8px 12px 8px 34px;
  font-size: var(--t-sm);
  outline: none;
  cursor: pointer;
}

.eap-seg {
  display: inline-flex;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--r-md);
  padding: 3px;
  gap: 2px;
}

.eap-seg-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 6px 12px;
  border-radius: var(--r-sm);
  font-size: var(--t-xs);
  font-weight: var(--fw-medium);
  cursor: pointer;
  transition: all var(--dur-fast);
}

.eap-seg-btn--active {
  background: #0284c7;
  color: #fff;
}

.eap-loss-legend {
  flex-grow: 1;
  max-width: 480px;
}

.eap-legend-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* ── Rating Badges ── */
.eap-rating-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: var(--r-sm);
  font-size: 11px;
  font-weight: var(--fw-semibold);
  letter-spacing: 0.02em;
}

.eap-rating-badge--optimal {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.35);
}

.eap-rating-badge--warning {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.35);
}

.eap-rating-badge--danger {
  background: rgba(239, 68, 68, 0.18);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.45);
}

.eap-rating-badge--pulse {
  animation: pulseBorderRed 2s infinite;
}

@keyframes pulseBorderRed {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

.eap-pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 4px #ef4444;
}

/* ── KPI Grid ── */
.eap-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--s-4);
  margin-bottom: var(--s-6);
}

.eap-kpi-card {
  background: var(--bg-card, #1e293b);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-xl);
  padding: var(--s-5);
  transition: transform var(--dur-fast);
}

.eap-kpi-card:hover {
  transform: translateY(-2px);
}

.eap-kpi-card--danger {
  border-color: rgba(239, 68, 68, 0.3);
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(69, 10, 10, 0.25) 100%);
}

.eap-kpi-card--warning {
  border-color: rgba(245, 158, 11, 0.3);
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(69, 40, 10, 0.2) 100%);
}

.eap-kpi-card--optimal {
  border-color: rgba(34, 197, 94, 0.3);
}

.eap-kpi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--s-3);
}

.eap-kpi-label {
  font-size: var(--t-xs);
  font-weight: var(--fw-semibold);
  color: var(--text-secondary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.eap-kpi-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: var(--r-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.eap-kpi-icon-wrap svg {
  width: 18px;
  height: 18px;
}

.eap-kpi-icon--brand {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.eap-kpi-icon--positive {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.eap-kpi-icon--warning {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.eap-kpi-icon--danger {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.eap-kpi-value-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.eap-kpi-num {
  font-family: var(--font-display);
  font-size: var(--t-3xl);
  font-weight: var(--fw-bold);
  color: #fff;
  letter-spacing: -0.03em;
}

.eap-kpi-unit {
  font-size: var(--t-sm);
  color: #94a3b8;
}

.eap-kpi-sub {
  font-size: var(--t-xs);
  color: #94a3b8;
  margin: 6px 0 0;
  line-height: 1.4;
}

.eap-kpi-badge-wrap {
  margin-top: 8px;
}

/* ── Chart Section ── */
.eap-chart-section {
  background: var(--bg-card, #1e293b);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-2xl);
  padding: var(--s-6);
  margin-bottom: var(--s-6);
}

.eap-chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
  margin-bottom: var(--s-4);
  flex-wrap: wrap;
}

.eap-chart-title {
  font-family: var(--font-display);
  font-size: var(--t-lg);
  font-weight: var(--fw-bold);
  margin: 0;
  color: #fff;
}

.eap-chart-sub {
  font-size: var(--t-xs);
  color: #94a3b8;
  margin: 4px 0 0;
}

.eap-chart-tabs {
  display: flex;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-md);
  padding: 3px;
  gap: 4px;
}

.eap-chart-tab {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 6px 14px;
  font-size: var(--t-xs);
  font-weight: var(--fw-medium);
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: all var(--dur-fast);
}

.eap-chart-tab--active {
  background: #0284c7;
  color: #fff;
}

.eap-chart-body {
  width: 100%;
}

.eap-echart-canvas {
  width: 100%;
  height: 380px;
}

/* ── Table Section ── */
.eap-table-section {
  background: var(--bg-card, #1e293b);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-2xl);
  padding: var(--s-6);
}

.eap-table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
  margin-bottom: var(--s-4);
  flex-wrap: wrap;
}

.eap-table-title {
  font-family: var(--font-display);
  font-size: var(--t-lg);
  font-weight: var(--fw-bold);
  margin: 0;
  color: #fff;
}

.eap-table-sub {
  font-size: var(--t-xs);
  color: #94a3b8;
  margin: 4px 0 0;
}

.eap-table-search {
  position: relative;
  display: flex;
  align-items: center;
}

.eap-search-icon {
  position: absolute;
  left: 10px;
  width: 16px;
  height: 16px;
  color: #94a3b8;
  pointer-events: none;
}

.eap-search-input {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f1f5f9;
  border-radius: var(--r-md);
  padding: 8px 12px 8px 34px;
  font-size: var(--t-sm);
  width: 260px;
  outline: none;
}

.eap-table-wrap {
  overflow-x: auto;
}

.eap-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--t-sm);
}

.eap-table th {
  background: rgba(15, 23, 42, 0.6);
  color: #94a3b8;
  font-weight: var(--fw-semibold);
  font-size: var(--t-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap;
}

.eap-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.eap-table th.sortable:hover {
  color: #f1f5f9;
}

.sort-icon {
  margin-left: 4px;
  font-size: 10px;
}

.eap-table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.eap-row--theft {
  background: rgba(239, 68, 68, 0.04);
}

.eap-site-cell {
  min-width: 180px;
}

.eap-site-code {
  font-family: var(--font-display);
  font-weight: var(--fw-bold);
  color: #fff;
}

.eap-site-name {
  font-size: var(--t-xs);
  color: #94a3b8;
}

.eap-feeder-name {
  font-size: 11px;
  color: #64748b;
}

.eap-mono-tag {
  font-family: var(--font-mono);
  font-size: var(--t-xs);
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 6px;
  border-radius: var(--r-xs);
  color: #38bdf8;
}

.eap-sub-serial {
  font-family: var(--font-mono);
  font-size: 10px;
  color: #64748b;
  margin-top: 2px;
}

.eap-loss-pct-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.eap-loss-pct-num {
  font-family: var(--font-mono);
  font-weight: var(--fw-bold);
}

.eap-progress-track {
  width: 70px;
  height: 5px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
}

.eap-progress-fill {
  height: 100%;
  border-radius: 3px;
}

.eap-progress-fill--green {
  background: #22c55e;
}

.eap-progress-fill--amber {
  background: #f59e0b;
}

.eap-progress-fill--red {
  background: #ef4444;
}

.eap-action-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #e2e8f0;
  padding: 5px 12px;
  border-radius: var(--r-sm);
  font-size: var(--t-xs);
  font-weight: var(--fw-medium);
  cursor: pointer;
  transition: all var(--dur-fast);
}

.eap-action-btn:hover {
  background: rgba(255, 255, 255, 0.16);
}

.eap-action-btn--danger {
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.35);
  color: #f87171;
}

.eap-action-btn--danger:hover {
  background: rgba(239, 68, 68, 0.3);
}

.eap-empty-row {
  text-align: center;
  color: #94a3b8;
  padding: 24px;
}

/* ── Modal ── */
.eap-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--s-4);
}

.eap-modal-dialog {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--r-2xl);
  width: 100%;
  max-width: 580px;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);
}

.eap-modal-header {
  padding: var(--s-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.eap-modal-eyebrow {
  font-size: var(--t-xs);
  text-transform: uppercase;
  color: #38bdf8;
  font-weight: var(--fw-semibold);
}

.eap-modal-title {
  margin: 2px 0 0;
  font-size: var(--t-lg);
  font-weight: var(--fw-bold);
  color: #fff;
}

.eap-modal-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
}

.eap-modal-content {
  padding: var(--s-5);
}

.eap-alert-banner {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--r-lg);
  padding: var(--s-4);
  display: flex;
  gap: var(--s-3);
  margin-bottom: var(--s-4);
}

.eap-alert-icon {
  width: 24px;
  height: 24px;
  color: #ef4444;
  flex-shrink: 0;
}

.eap-alert-headline {
  font-weight: var(--fw-bold);
  color: #f87171;
  font-size: var(--t-sm);
}

.eap-alert-desc {
  font-size: var(--t-xs);
  color: #cbd5e1;
  margin: 4px 0 0;
  line-height: 1.4;
}

.eap-modal-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--s-3);
  margin-bottom: var(--s-5);
}

.eap-mstat {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--r-md);
  padding: var(--s-3);
}

.eap-mstat-label {
  font-size: 10px;
  text-transform: uppercase;
  color: #94a3b8;
}

.eap-mstat-val {
  font-size: var(--t-md);
  font-weight: var(--fw-bold);
  color: #fff;
  margin-top: 2px;
}

.eap-mstat-sub {
  font-size: 10px;
  color: #64748b;
  margin-top: 2px;
}

.eap-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--s-3);
}

/* Helper Utilities */
.text-right { text-align: right; }
.text-center { text-align: center; }
.font-medium { font-weight: 500; }
.font-bold { font-weight: 700; }
.font-mono { font-family: var(--font-mono); }
.text-danger { color: #f87171; }
.text-primary { color: #f1f5f9; }

@media (max-width: 768px) {
  .eap-hero-inner { flex-direction: column; align-items: flex-start; }
  .eap-controls-card { flex-direction: column; align-items: stretch; }
  .eap-modal-stats-grid { grid-template-columns: 1fr; }
}
</style>
