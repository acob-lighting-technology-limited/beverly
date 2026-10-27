<template>
  <div class="dashboard-live-page">
    <!-- OEM Workspace Hero Banner -->
    <header class="oem-hero-banner" :class="{ 'oem-hero-banner--sparkmeter': isSparkMeter, 'oem-hero-banner--miyaji': isMiyaji }" aria-label="OEM Workspace Overview">
      <div class="oem-hero-main">
        <div class="oem-hero-pills">
          <div class="oem-hero-pill oem-hero-pill--brand">
            <span class="oem-hero-badge" :class="isSparkMeter ? 'badge-sparkmeter' : isMiyaji ? 'badge-miyaji' : 'badge-calinmeter'">
              <svg v-if="isSparkMeter" class="oem-hero-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <svg v-else-if="isMiyaji" class="oem-hero-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="16" height="10" rx="2" ry="2"></rect>
                <line x1="22" y1="11" x2="22" y2="13"></line>
              </svg>
              <svg v-else class="oem-hero-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                <path d="M9 9h6v6H9z"></path>
              </svg>
            </span>
            <span class="oem-hero-name">{{ currentOemDisplayName }}</span>
          </div>

          <div class="oem-hero-pill oem-hero-pill--strategy">
            <span class="oem-strategy-tag">{{ vendingStrategyPill }}</span>
          </div>

          <div class="oem-hero-pill oem-hero-pill--status">
            <span class="hero-status-dot"></span>
            <span>Active Grid Integration</span>
          </div>
        </div>

        <div class="oem-hero-sites">
          <svg class="oem-hero-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span class="oem-hero-subtitle-text">{{ workspaceSubtitle }}</span>
        </div>
      </div>

      <div class="oem-hero-actions">
        <BaseButton
          class="btn-switch-workspace"
          size="sm"
          variant="outline"
          title="Switch OEM Workspace"
          @click="switchWorkspace"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="btn-switch-icon" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
          <span>Switch OEM Workspace</span>
        </BaseButton>
      </div>
    </header>

    <section class="dashboard-card-grid" aria-label="Dashboard summary">
      <template v-if="loading">
        <div v-for="i in 4" :key="'skel-card-'+i" class="dashboard-stat-card dashboard-stat-skeleton" aria-hidden="true">
          <span class="dashboard-skeleton-icon"></span>
          <div class="dashboard-skeleton-copy">
            <span class="dashboard-skeleton-line dashboard-skeleton-line--label"></span>
            <span class="dashboard-skeleton-line dashboard-skeleton-line--value"></span>
          </div>
        </div>
      </template>
      <template v-else>
        <BaseButton
          v-for="card in cards"
          :key="card.key"
          :class="['dashboard-stat-card', 'dashboard-stat-card--' + card.key, activeType === card.type ? 'active' : '']"
          @click="loadTopChart(card.type)"
        >
          <span class="dashboard-stat-icon" :style="{ color: card.color, '--theme-color': card.color }" v-html="card.icon"></span>
          <span class="dashboard-stat-copy">
            <span class="dashboard-stat-label">{{ card.label }}</span>
            <span class="dashboard-stat-value">
              <span v-if="card.hasDot" class="dashboard-live-dot" aria-hidden="true"></span>
              <span v-if="card.key === 'totalPurchaseMoney' || card.hasNaira" class="dashboard-stat-symbol" aria-label="Naira">₦</span>
              <span>{{ card.isStatic ? card.value : formatStatValue(card, animatedPanel[card.key]) }}</span>
              <span v-if="card.key === 'totalPurchaseUnit' || card.unit" class="dashboard-stat-unit">{{ card.unit || 'kWh' }}</span>
            </span>
          </span>
        </BaseButton>
      </template>
    </section>

    <section class="dashboard-chart-card dashboard-chart-wide" aria-label="Top dashboard chart">
      <div v-if="loading" class="dashboard-chart-skeleton" role="status" aria-label="Loading purchase chart">
        <span class="dashboard-chart-skeleton-title"></span>
        <div class="dashboard-chart-skeleton-plot" aria-hidden="true">
          <span v-for="height in [36, 56, 44, 72, 48, 62, 40, 78, 52, 66, 46, 70]" :key="height" class="dashboard-chart-skeleton-bar" :style="{ height: `${height}%` }"></span>
        </div>
      </div>
      <EChartPanel v-else :option="topChartOption" />
    </section>

    <section class="dashboard-chart-pair">
      <article class="dashboard-chart-card">
        <div v-if="loading" class="dashboard-chart-skeleton dashboard-chart-skeleton--compact" role="status" aria-label="Loading success chart">
          <span class="dashboard-chart-skeleton-title"></span>
          <div class="dashboard-chart-skeleton-plot" aria-hidden="true">
            <span v-for="height in [42, 58, 48, 68, 54, 76, 64, 82]" :key="height" class="dashboard-chart-skeleton-bar" :style="{ height: `${height}%` }"></span>
          </div>
        </div>
        <EChartPanel v-else :option="successChartOption" />
      </article>
      <article class="dashboard-chart-card">
        <div v-if="loading" class="dashboard-chart-skeleton dashboard-chart-skeleton--compact" role="status" aria-label="Loading alarm chart">
          <span class="dashboard-chart-skeleton-title"></span>
          <div class="dashboard-chart-skeleton-plot" aria-hidden="true">
            <span v-for="height in [58, 46, 70, 52, 80, 64, 42, 72]" :key="height" class="dashboard-chart-skeleton-bar" :style="{ height: `${height}%` }"></span>
          </div>
        </div>
        <EChartPanel v-else :option="alarmChartOption" @chart-click="openAbnormalAlarmPage" />
      </article>
    </section>

    <section class="dashboard-chart-card dashboard-consumption-card" :aria-label="`${consumptionTitle} chart`">
      <div class="dashboard-consumption-top">
        <div class="dashboard-consumption-heading">
          <h2>{{ consumptionTitle }}</h2>
          <span v-if="consumptionMode === 'monthly' && monthlyThrough">Selected period ends {{ monthlyThrough }} · current month is partial</span>
        </div>
        <div class="dashboard-consumption-modes" aria-label="Consumption period">
        <BaseButton
          v-for="mode in consumptionModes"
          :key="mode.id"
          :class="['dashboard-period-chip', consumptionMode === mode.id ? 'active' : '']"
          size="sm"
          @click="setConsumptionMode(mode.id)"
        >
          {{ mode.label }}
        </BaseButton>
        </div>
      </div>
      <div v-if="monthlyError && consumptionMode === 'monthly'" class="dashboard-chart-empty" role="alert">{{ monthlyError }} <BaseButton size="sm" @click="loadMonthlyConsumption">Retry</BaseButton></div>
      <div v-else-if="loading || (monthlyLoading && consumptionMode === 'monthly')" class="dashboard-chart-skeleton dashboard-chart-skeleton--compact" role="status" aria-label="Loading consumption chart">
        <span class="dashboard-chart-skeleton-title"></span>
        <div class="dashboard-chart-skeleton-plot" aria-hidden="true">
          <span v-for="height in [34, 62, 46, 72, 54, 42, 68, 58]" :key="height" class="dashboard-chart-skeleton-bar" :style="{ height: `${height}%` }"></span>
        </div>
      </div>
      <div v-else-if="!consumption.values.length" class="dashboard-chart-empty">No current consumption data.</div>
      <EChartPanel v-else :option="consumptionChartOption" />
    </section>
  </div>
</template>

<script>
import EChartPanel from "./EChartPanel.vue";
import BaseButton from "./base/BaseButton.vue";
import { dashboardMonthlyWindow, fetchDashboardData, mapStoredMonthlyConsumption } from "../services/dashboard-service.mjs";
import { fetchStationConsumptionAnalytics } from "../services/consumption-service.mjs";
import { createBarOption, createLineOption, createPieOption, dashboardSeries } from "../services/dashboard-chart-options.mjs";
import { dashboardChartTitles } from "../services/mappers/dashboard-mapper.mjs";
import { useOemStore } from "../stores/oem-store";

const iconMarkup = {
  account: '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path d="M512 512c113.1 0 204.8-91.7 204.8-204.8S625.1 102.4 512 102.4 307.2 194.1 307.2 307.2 398.9 512 512 512zm0 102.4c-136.5 0-409.6 68.5-409.6 204.8v102.4h819.2V819.2c0-136.3-273.1-204.8-409.6-204.8z"/></svg>',
  times: '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path d="M170.7 170.7h682.6v85.3H170.7v-85.3zm0 298.6h682.6v85.4H170.7v-85.4zm0 298.7h682.6v85.3H170.7V768zm85.3-426.7 170.7 170.7L256 682.7h128L554.7 512 384 341.3H256z"/></svg>',
  unit: '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path d="M512 128c176.7 0 320 57.3 320 128S688.7 384 512 384 192 326.7 192 256s143.3-128 320-128zm320 256v96c0 70.7-143.3 128-320 128s-320-57.3-320-128v-96c68.8 58.7 192 85.3 320 85.3s251.2-26.6 320-85.3zm0 224v96c0 70.7-143.3 128-320 128s-320-57.3-320-128v-96c68.8 58.7 192 85.3 320 85.3s251.2-26.6 320-85.3z"/></svg>',
  money: '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path d="M512 128c176.7 0 320 57.3 320 128S688.7 384 512 384 192 326.7 192 256s143.3-128 320-128zm0 341.3c78.5 0 151.5-11.3 213.3-30.7V512c0 117.8 95.5 213.3 213.4 213.3-23.7 61.9-196.3 106.7-426.7 106.7-176.7 0-320-57.3-320-128V384c68.8 58.7 192 85.3 320 85.3zm298.7 85.4 64 64 128-128 42.6 42.6-170.6 170.7-106.7-106.7 42.7-42.6z"/></svg>',
  meter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
  station: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
  ota: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11a9 9 0 0 1 9 9"></path><path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1"></circle></svg>',
  sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>',
  battery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="16" height="10" rx="2" ry="2"></rect><line x1="22" y1="11" x2="22" y2="13"></line></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5"></path><path d="M4 20L21 3"></path><path d="M21 16v5h-5"></path><path d="M15 15l6 6"></path><path d="M4 4l5 5"></path></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="6" rx="2"></rect><circle cx="7" cy="17" r="2"></circle><circle cx="17" cy="17" r="2"></circle><path d="M5 11l2-5h10l2 5"></path></svg>',
  soc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>'
};

const dashboardCards = [
  { type: 0, key: "totalAccountCount", label: "Account Count", icon: iconMarkup.account, colorKey: "primary" },
  { type: 1, key: "totalPurchaseTimes", label: "Purchase Times", icon: iconMarkup.times, colorKey: "success" },
  { type: 2, key: "totalPurchaseUnit", label: "Purchase Unit", icon: iconMarkup.unit, colorKey: "primaryDeep" },
  { type: 3, key: "totalPurchaseMoney", label: "Purchase Money", icon: iconMarkup.money, colorKey: "primary" }
];

const consumptionModes = [
  { id: "daily", label: "Daily", type: 4 },
  { id: "monthly", label: "Monthly", type: 5 }
];

export default {
  name: "DashboardPage",
  components: { BaseButton, EChartPanel },
  data() {
    return {
      loading: true,
      activeType: 3,
      panel: {
        totalAccountCount: 0,
        totalPurchaseTimes: 0,
        totalPurchaseUnit: 0,
        totalPurchaseMoney: 0
      },
      animatedPanel: {
        totalAccountCount: 0,
        totalPurchaseTimes: 0,
        totalPurchaseUnit: 0,
        totalPurchaseMoney: 0
      },
      top: { title: dashboardChartTitles[3], labels: [], values: [] },
      consumption: { title: dashboardChartTitles[4], labels: [], values: [] },
      dailyConsumption: { title: dashboardChartTitles[4], labels: [], values: [] },
      monthlyConsumption: null,
      monthlyLoading: false,
      monthlyError: "",
      monthlyThrough: "",
      monthlyRequestId: 0,
      success: { labels: [], values: [] },
      alarms: [],
      consumptionMode: "daily",
      chartTheme: null,
      themeObserver: null,
      countFrame: null,
      refreshTimer: null,
      visibilityHandler: null,
      dashboardLoadId: 0,
      warmApplied: false
    };
  },
  computed: {
    oemStore() {
      return useOemStore();
    },
    isSparkMeter() {
      const oemId = this.oemStore?.currentOemId || "";
      return oemId === "sparkmeter" || this.oemStore?.currentOem?.vendingStrategy === "direct_credit";
    },
    isMiyaji() {
      const oemId = this.oemStore?.currentOemId || "";
      return oemId === "miyaji" || oemId.includes("ev");
    },
    currentOemDisplayName() {
      if (this.isSparkMeter) return "SparkMeter";
      if (this.isMiyaji) return "Miyaji EV";
      return (
        this.oemStore?.currentOem?.displayName ||
        (this.oemStore?.currentOemId
          ? this.oemStore.currentOemId.toUpperCase()
          : "Calinmeter")
      );
    },
    vendingStrategyPill() {
      if (this.isSparkMeter) {
        return "Direct Credit (Over-the-Air Account Top-up)";
      }
      if (this.isMiyaji) {
        return "BaaS / Subscription Swapping";
      }
      return "STS Token (20-Digit Keypad)";
    },
    workspaceSubtitle() {
      if (this.isSparkMeter) {
        const count = this.panel?.totalAccountCount ? Number(this.panel.totalAccountCount).toLocaleString() : "3,073";
        return `${count} Smart Meters across 8 Grid Sites: OTU-COSTAIN, Adebayo, Oloyan, Sule, Adewale, Mile 13, Ajegunle, Onipanu`;
      }
      if (this.isMiyaji) {
        return "Smart EV Battery Swapping Stations & Connected Fleet Telemetry";
      }
      return "Calinmeter Prepayment Grid Architecture & Standard Transfer Specification (STS)";
    },
    cards() {
      const theme = this.chartTheme || {};
      if (this.isSparkMeter) {
        return [
          {
            type: 0,
            key: "totalAccountCount",
            label: "SparkMeter Meters",
            icon: iconMarkup.meter,
            colorKey: "primary",
            color: theme.primary || "var(--primary)"
          },
          {
            type: 1,
            key: "activeGridSites",
            label: "Active Grid Sites",
            icon: iconMarkup.station,
            colorKey: "primaryDeep",
            color: theme.primaryDeep || "#047857",
            isStatic: true,
            value: String(this.panel?.activeGridSites || 8)
          },
          {
            type: 2,
            key: "totalPurchaseUnit",
            label: "Total Billed Energy",
            icon: iconMarkup.unit,
            colorKey: "warning",
            color: theme.warning || "#f59e0b",
            unit: "kWh"
          },
          {
            type: 3,
            key: "totalPurchaseMoney",
            label: "Equivalent in Naira",
            icon: iconMarkup.money,
            colorKey: "success",
            color: theme.success || "#10b981",
            hasNaira: true
          }
        ];
      }
      if (this.isMiyaji) {
        return [
          {
            type: 0,
            key: "totalBatteryPacks",
            label: "EV Battery Packs",
            icon: iconMarkup.battery,
            colorKey: "primary",
            color: theme.primary || "var(--primary)",
            isStatic: true,
            value: "1,240"
          },
          {
            type: 1,
            key: "swappingStations",
            label: "Swapping Stations",
            icon: iconMarkup.swap,
            colorKey: "primaryDeep",
            color: theme.primaryDeep || "#047857",
            isStatic: true,
            value: "14"
          },
          {
            type: 2,
            key: "activeVehicles",
            label: "Active Vehicles",
            icon: iconMarkup.car,
            colorKey: "warning",
            color: theme.warning || "#f59e0b",
            isStatic: true,
            value: "860"
          },
          {
            type: 3,
            key: "stateOfCharge",
            label: "State-of-Charge",
            icon: iconMarkup.soc,
            colorKey: "success",
            color: theme.success || "#10b981",
            isStatic: true,
            hasDot: true,
            value: "94.2%"
          }
        ];
      }
      return dashboardCards.map((card) => ({
        ...card,
        color: theme[card.colorKey] || "var(--primary)"
      }));
    },
    consumptionModes() {
      return consumptionModes;
    },
    consumptionType() {
      return consumptionModes.find((mode) => mode.id === this.consumptionMode)?.type || 4;
    },
    topChartOption() {
      let defaultTitle = dashboardChartTitles[this.activeType];
      if (this.isSparkMeter) {
        const titles = ["Meter Registrations", "Active Grid Sites", "Total Billed Energy (kWh)", "Equivalent in Naira (₦)"];
        defaultTitle = titles[this.activeType] || "SparkMeter Live Telemetry";
      }
      return createBarOption(dashboardSeries(this.top.labels, this.top.values), this.top.title || defaultTitle, this.chartTheme);
    },
    consumptionChartOption() {
      const option = createBarOption(dashboardSeries(this.consumption.labels, this.consumption.values), this.consumptionTitle, this.chartTheme);
      option.title.show = false;
      option.grid = { left: 8, right: 8, top: 12, bottom: 8, containLabel: true };
      option.yAxis.axisLabel.formatter = (value) => Number(value).toLocaleString("en-NG", { notation: "compact", maximumFractionDigits: 1 });
      option.series[0].name = "kWh";
      option.tooltip.valueFormatter = (value) => `${Number(value || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })} kWh`;
      return option;
    },
    consumptionTitle() {
      return this.consumption.title || dashboardChartTitles[this.consumptionType] || "Daily Consumption";
    },
    successChartOption() {
      return createLineOption(dashboardSeries(this.success.labels, this.success.values), "Hourly Success Rate", this.chartTheme);
    },
    alarmChartOption() {
      const theme = {
        ...(this.chartTheme || {}),
        alarmColors: this.alarms.map((item) => item.color).filter(Boolean)
      };
      return createPieOption(
        dashboardSeries(
          this.alarms.map((item) => item.label),
          this.alarms.map((item) => item.value)
        ),
        "Abnormal Alarm",
        theme
      );
    }
  },
  watch: {
    "oemStore.currentOemId"(newId, oldId) {
      if (newId !== oldId) {
        this.warmApplied = false;
        this.refreshDashboard();
      }
    },
    "oemStore.currentOem"(newOem, oldOem) {
      if (newOem?.slug !== oldOem?.slug) {
        this.warmApplied = false;
        this.refreshDashboard();
      }
    }
  },
  created() {
    this.refreshDashboard();
  },
  mounted() {
    this.syncThemePalette();
    this.observeThemeChanges();
    this.refreshTimer = window.setInterval(() => this.loadDataset(this.activeType, false), 300000);
    this.visibilityHandler = () => {
      if (document.visibilityState === "visible") this.loadDataset(this.activeType, false);
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  },
  beforeUnmount() {
    if (this.themeObserver) this.themeObserver.disconnect();
    if (this.countFrame) cancelAnimationFrame(this.countFrame);
    if (this.refreshTimer) window.clearInterval(this.refreshTimer);
    if (this.visibilityHandler) document.removeEventListener("visibilitychange", this.visibilityHandler);
  },
  methods: {
    async refreshDashboard() {
      await this.loadDataset(this.activeType);
    },
    async loadTopChart(type) {
      this.activeType = type;
      await this.loadDataset(type);
    },
    setConsumptionMode(mode) {
      if (this.consumptionMode === mode) return;
      this.consumptionMode = mode;
      if (mode === "monthly") {
        this.consumption = this.monthlyConsumption || { title: "Monthly Consumption", labels: [], values: [] };
        void this.loadMonthlyConsumption();
      } else {
        this.consumption = this.dailyConsumption;
      }
    },
    async loadMonthlyConsumption() {
      const requestId = ++this.monthlyRequestId;
      this.monthlyLoading = true;
      this.monthlyError = "";
      const { from, to } = dashboardMonthlyWindow();
      try {
        const data = await fetchStationConsumptionAnalytics({ from, to, granularity: "monthly", topMeters: 1 });
        if (requestId !== this.monthlyRequestId) return;
        this.monthlyConsumption = mapStoredMonthlyConsumption(data);
        this.monthlyThrough = data?.range?.to || to;
        if (this.consumptionMode === "monthly") this.consumption = this.monthlyConsumption;
      } catch (error) {
        if (requestId === this.monthlyRequestId) this.monthlyError = error?.message || "Monthly readings are unavailable.";
      } finally {
        if (requestId === this.monthlyRequestId) this.monthlyLoading = false;
      }
    },
    applyDataset(dataset) {
      this.panel = dataset.panel;
      this.animatePanel(dataset.panel);
      this.top = dataset.top;
      this.dailyConsumption = dataset.consumption;
      this.consumption = this.consumptionMode === "monthly"
        ? this.monthlyConsumption || { title: "Monthly Consumption", labels: [], values: [] }
        : this.dailyConsumption;
      this.success = dataset.success;
      this.alarms = dataset.alarms;
    },
    async loadDataset(activeType, showLoading = true) {
      if (!showLoading && this.loading) return;
      const loadId = ++this.dashboardLoadId;
      // Paint the background-warmed dataset instantly (no spinner) if the OEM Hub
      // prefetched this OEM's dashboard, then refresh silently in the background.
      if (showLoading && !this.warmApplied) {
        const warm = this.oemStore.warmCache[this.oemStore.currentOemId];
        if (warm && warm.status === "ready" && warm.dataset) {
          this.applyDataset(warm.dataset);
          this.warmApplied = true;
          this.loading = false;
          this.loadDataset(activeType, false);
          return;
        }
      }
      if (showLoading) this.loading = true;
      try {
        const dataset = await fetchDashboardData({ activeType, consumptionType: 4 });
        if (loadId !== this.dashboardLoadId) return;
        this.applyDataset(dataset);
        if (this.consumptionMode === "monthly" && !this.monthlyLoading) void this.loadMonthlyConsumption();
      } finally {
        if (showLoading && loadId === this.dashboardLoadId) this.loading = false;
      }
    },
    formatStatValue(card, value) {
      const num = Number(value || 0);
      if (card && card.key === "totalPurchaseMoney") {
        return num.toLocaleString("en-NG", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }
      if (card && (card.key === "totalAccountCount" || card.key === "totalPurchaseTimes")) {
        return Math.round(num).toLocaleString();
      }
      return num.toLocaleString(undefined, {
        maximumFractionDigits: 1
      });
    },
    formatNumber(value) {
      return Number(value || 0).toLocaleString(undefined, {
        maximumFractionDigits: 1
      });
    },
    animatePanel(targetPanel) {
      if (this.countFrame) cancelAnimationFrame(this.countFrame);
      const startPanel = { ...this.animatedPanel };
      const duration = 1100;
      const startAt = performance.now();
      const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);
      const step = (now) => {
        const progress = Math.min(1, (now - startAt) / duration);
        const eased = easeOutCubic(progress);
        for (const key of Object.keys(this.animatedPanel)) {
          const start = Number(startPanel[key] || 0);
          const end = Number(targetPanel[key] || 0);
          this.animatedPanel[key] = start + (end - start) * eased;
        }
        if (progress < 1) {
          this.countFrame = requestAnimationFrame(step);
          return;
        }
        this.animatedPanel = { ...targetPanel };
        this.countFrame = null;
      };
      this.countFrame = requestAnimationFrame(step);
    },
    syncThemePalette() {
      if (typeof window === "undefined" || typeof document === "undefined" || !document.documentElement) return;
      const styles = window.getComputedStyle(document.documentElement);
      const resolve = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
      this.chartTheme = {
        primary: resolve("--primary", "#059669"),
        primaryDeep: resolve("--primary-deep", "#047857"),
        primaryLight: resolve("--primary-light", "rgba(5, 150, 105, 0.12)"),
        success: resolve("--success", "#10b981"),
        warning: resolve("--warning", "#f59e0b"),
        danger: resolve("--danger", "#ef4444"),
        textMuted: resolve("--text-muted", "#64748b"),
        textFaint: resolve("--text-faint", "#94a3b8"),
        textInverse: resolve("--text-inverse", "#f8fafc"),
        border: resolve("--border-color", "rgba(148, 163, 184, 0.14)"),
        surface: resolve("--bg-card", "#ffffff"),
        tooltip: resolve("--bg-card", "#ffffff"),
        tooltipText: resolve("--text-strong", "#0f172a")
      };
    },
    observeThemeChanges() {
      if (typeof MutationObserver === "undefined" || typeof document === "undefined" || !document.documentElement) return;
      this.themeObserver = new MutationObserver(() => this.syncThemePalette());
      this.themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"]
      });
    },
    openAbnormalAlarmPage(params) {
      const label = String(params?.name || "").trim();
      const map = {
        "No Data Report": "noData",
        "Magnetic Interference": "magneticInterference",
        "Battery Low": "batteryLow",
        "Terminal Cover Open": "terminalCoverOpen",
        "Cover Open": "coverOpen",
        "Current Reverse": "currentReverse",
        "Current Unbalance": "currentUnbalance"
      };
      const alarm = map[label] || "";
      window.location.hash = `#/prepay-report/abnormal-alarm${alarm ? `?alarm=${encodeURIComponent(alarm)}` : ""}`;
    },
    switchWorkspace() {
      this.oemStore.clearSelection();
      window.location.hash = "#/dashboard";
    }
  }
};
</script>

<style scoped>
.oem-hero-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 20px;
  margin-bottom: 20px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, rgba(148, 163, 184, 0.16));
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
  transition: all 0.25s ease;
}

.oem-hero-banner::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
  background: var(--primary, #059669);
  border-top-left-radius: 12px;
  border-bottom-left-radius: 12px;
}

.oem-hero-banner--sparkmeter::before {
  background: linear-gradient(180deg, #10b981 0%, #059669 100%);
}

.oem-hero-banner--miyaji::before {
  background: linear-gradient(180deg, #38bdf8 0%, #0284c7 100%);
}

.oem-hero-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.oem-hero-pills {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.oem-hero-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
}

.oem-hero-pill--brand {
  background: var(--bg-subtle, rgba(241, 245, 249, 0.8));
  color: var(--text-strong, #0f172a);
  font-weight: 600;
  font-size: 13px;
  padding-left: 4px;
}

.oem-hero-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
}

.badge-sparkmeter {
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
}

.badge-miyaji {
  background: rgba(14, 165, 233, 0.15);
  color: #0284c7;
}

.badge-calinmeter {
  background: rgba(99, 102, 241, 0.15);
  color: #4f46e5;
}

.oem-hero-pill-icon {
  width: 13px;
  height: 13px;
}

.oem-hero-pill--strategy {
  background: rgba(245, 158, 11, 0.1);
  color: #b45309;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.oem-hero-pill--status {
  background: rgba(16, 185, 129, 0.1);
  color: #047857;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.hero-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.35);
  animation: hero-pulse 2s infinite ease-in-out;
}

.oem-hero-sites {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted, #64748b);
  font-size: 12px;
  line-height: 1.4;
}

.oem-hero-pin {
  width: 14px;
  height: 14px;
  color: var(--primary, #059669);
  flex-shrink: 0;
}

.oem-hero-subtitle-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oem-hero-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.btn-switch-workspace {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-switch-icon {
  width: 14px;
  height: 14px;
}

.dashboard-live-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  margin-right: 6px;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
  animation: hero-pulse 2s infinite ease-in-out;
}

@keyframes hero-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
  }
}

/* Executive dark theme overrides */
[data-theme="executive"] .oem-hero-banner {
  background: var(--bg-card, #1e293b);
  border-color: rgba(255, 255, 255, 0.08);
}

[data-theme="executive"] .oem-hero-pill--brand {
  background: rgba(255, 255, 255, 0.06);
  color: #f8fafc;
}

[data-theme="executive"] .oem-hero-pill--strategy {
  background: rgba(245, 158, 11, 0.15);
  color: #fcd34d;
  border-color: rgba(245, 158, 11, 0.3);
}

[data-theme="executive"] .oem-hero-pill--status {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
  border-color: rgba(16, 185, 129, 0.3);
}
</style>
