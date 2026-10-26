<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api';
import { naira } from '../lib/format';
import WalletPagination from '@beverly/tokens/WalletPagination.vue';
import WalletTableSkeleton from '@beverly/tokens/WalletTableSkeleton.vue';
import { DEFAULT_PAGE_SIZE, paginate } from '@beverly/tokens';
import WalletExportMenu from '@beverly/tokens/WalletExportMenu.vue';
import type { WalletExportColumn } from '@beverly/tokens/wallet-export';

const router = useRouter();

// ── Types ──────────────────────────────────────────────────────────────────────

interface AggRow {
    scope: string;
    scope_id: string;
    period_type: string;
    period_start: string;
    kwh_total: number;
    reading_count: number;
    amount_minor_total: number;
    energy_value_minor?: number;
    meter_id?: string;
    last_refreshed_at: string;
}

interface ConsumptionResponse {
    rows: AggRow[];
    count: number;
    meters: string[];
}

interface OemInfo {
    id: string | null;
    slug: string;
    displayName: string;
    supportsLive: boolean;
    supportedDataItems: string[];
}

interface TelemetryPoint {
    timestamp: string;
    label: string;
    value: number;
}

interface TelemetryResponse {
    meter_id: string;
    meters: string[];
    oem: OemInfo;
    current: {
        power: number;
        credit_balance: number;
        total_consumption: number;
        relay_status: string;
        captured_at: string;
    };
    today_kwh: number;
    wallet_balance_minor: number;
    timeframe: string;
    data_item: string;
    series: TelemetryPoint[];
}

type Period = 'day' | 'week' | 'month' | 'year';
type Timeframe = 'hourly' | 'daily' | 'live';
type DataItem = 'Credit balance' | 'Total Consumption' | 'Power' | 'Relay Status';

const PERIODS: { label: string; value: Period }[] = [
    { label: 'Daily', value: 'day' },
    { label: 'Weekly', value: 'week' },
    { label: 'Monthly', value: 'month' },
    { label: 'Yearly', value: 'year' },
];

const ALL_DATA_ITEMS: { label: DataItem; key: string; unit: string; heroLabel: string }[] = [
    { label: 'Power', key: 'power', unit: 'kW', heroLabel: 'Live power' },
    { label: 'Credit balance', key: 'credit_balance', unit: 'kWh', heroLabel: 'Credit balance' },
    { label: 'Total Consumption', key: 'total_consumption', unit: 'kWh', heroLabel: 'Total Consumption' },
    { label: 'Relay Status', key: 'relay_status', unit: '', heroLabel: 'Relay Status' },
];

// ── State ──────────────────────────────────────────────────────────────────────

const period = ref<Period>('month');
const timeframe = ref<Timeframe>('hourly');
const selectedDataItem = ref<DataItem>('Power');

const meterNumber = ref('');
const selectedMeter = ref('');
const meterError = ref('');
const meters = ref<string[]>([]);

const rows = ref<AggRow[]>([]);
const loading = ref(false);
const telemetryLoading = ref(false);
const remoteReading = ref(false);
const error = ref('');
const remoteMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null);

const oemInfo = ref<OemInfo>({
    id: null,
    slug: 'calinmeter',
    displayName: 'Calinmeter',
    supportsLive: true,
    supportedDataItems: ['credit_balance', 'total_consumption', 'power', 'relay_status'],
});

const currentReadings = ref({
    power: 2.45,
    credit_balance: 45.2,
    total_consumption: 112.5,
    relay_status: 'Closed',
    captured_at: new Date().toISOString(),
});

const todayKwh = ref(11.2);
const walletBalanceMinor = ref(2450000);
const chartSeries = ref<TelemetryPoint[]>([]);
const activePoint = ref<TelemetryPoint | null>(null);

// ── OEM Capability Gating ──────────────────────────────────────────────────────

function oemSupportsItem(itemKey: string): boolean {
    if (!oemInfo.value?.supportedDataItems) return true;
    const normalized = itemKey.toLowerCase().replace(/\s+/g, '_');
    return oemInfo.value.supportedDataItems
        .map(i => i.toLowerCase().replace(/\s+/g, '_'))
        .includes(normalized);
}

const availableDataItems = computed(() => {
    return ALL_DATA_ITEMS.filter(item => oemSupportsItem(item.key));
});

const oemSupportsLive = computed(() => {
    return oemInfo.value?.supportsLive !== false;
});

// If the current data item becomes unsupported after switching meter, fallback
watch(availableDataItems, (items) => {
    if (items.length && !items.some(i => i.label === selectedDataItem.value)) {
        selectedDataItem.value = items[0].label;
    }
});

// If timeframe is 'live' but OEM doesn't support live tasks, fallback to 'hourly'
watch(oemSupportsLive, (supports) => {
    if (!supports && timeframe.value === 'live') {
        timeframe.value = 'hourly';
    }
});

// ── Formatters & Computeds ─────────────────────────────────────────────────────

function periodLabel(row: AggRow): string {
    const date = new Date(`${row.period_start}T00:00:00`);
    if (row.period_type === 'day') return date.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
    if (row.period_type === 'week') return `Wk of ${date.toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}`;
    if (row.period_type === 'month') return date.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
    if (row.period_type === 'year') return String(date.getFullYear());
    return row.period_start;
}

const fmtKwh = (value: number) =>
    `${Number(value ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`;

const totalKwh = computed(() => rows.value.reduce((sum, row) => sum + Number(row.kwh_total ?? 0), 0));
const totalSpend = computed(() => rows.value.reduce((sum, row) => sum + Number(row.amount_minor_total ?? 0), 0));
const totalValue = computed(() => rows.value.reduce((sum, row) => sum + Number(row.energy_value_minor ?? 0), 0));
const showMeterColumn = computed(() => !selectedMeter.value && meters.value.length > 1);

const heroConfig = computed(() => {
    const active = ALL_DATA_ITEMS.find(i => i.label === selectedDataItem.value) || ALL_DATA_ITEMS[0];
    let valStr = '';
    if (active.key === 'power') {
        valStr = `${currentReadings.value.power.toFixed(2)} kW`;
    } else if (active.key === 'credit_balance') {
        valStr = `${currentReadings.value.credit_balance.toFixed(2)} kWh`;
    } else if (active.key === 'total_consumption') {
        valStr = `${currentReadings.value.total_consumption.toFixed(2)} kWh`;
    } else if (active.key === 'relay_status') {
        valStr = currentReadings.value.relay_status;
    }
    return {
        label: active.heroLabel,
        value: valStr,
        key: active.key,
        unit: active.unit,
    };
});

const capturedTimeFormatted = computed(() => {
    if (!currentReadings.value.captured_at) return 'Just now';
    const date = new Date(currentReadings.value.captured_at);
    if (Number.isNaN(date.getTime())) return 'Just now';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

// ── Chart SVG Calculations ────────────────────────────────────────────────────

const svgWidth = 600;
const svgHeight = 180;
const padding = { top: 20, right: 24, bottom: 32, left: 24 };

interface SvgPoint {
    x: number;
    y: number;
    raw: TelemetryPoint;
}

const chartPoints = computed<SvgPoint[]>(() => {
    const data = chartSeries.value;
    if (!data.length) return [];
    const values = data.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = (maxVal - minVal) || 1;
    const effectiveMin = Math.max(0, minVal - range * 0.1);
    const effectiveMax = maxVal + range * 0.1;
    const effectiveRange = effectiveMax - effectiveMin;

    const innerWidth = svgWidth - padding.left - padding.right;
    const innerHeight = svgHeight - padding.top - padding.bottom;

    return data.map((d, index) => {
        const x = padding.left + (index / (data.length - 1 || 1)) * innerWidth;
        const normalized = (d.value - effectiveMin) / effectiveRange;
        const y = padding.top + (1 - normalized) * innerHeight;
        return { x, y, raw: d };
    });
});

const linePath = computed(() => {
    const pts = chartPoints.value;
    if (!pts.length) return '';
    return pts.reduce((acc, pt, i) => {
        if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
        // Smooth bezier curve control points
        const prev = pts[i - 1];
        const cx1 = prev.x + (pt.x - prev.x) / 2;
        const cy1 = prev.y;
        const cx2 = prev.x + (pt.x - prev.x) / 2;
        const cy2 = pt.y;
        return `${acc} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    }, '');
});

const areaPath = computed(() => {
    const pts = chartPoints.value;
    if (!pts.length) return '';
    const bottomY = svgHeight - padding.bottom;
    const firstX = pts[0].x.toFixed(1);
    const lastX = pts[pts.length - 1].x.toFixed(1);
    return `${linePath.value} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
});

const lastPoint = computed(() => {
    const pts = chartPoints.value;
    return pts.length ? pts[pts.length - 1] : null;
});

const chartKey = ref(0);

// ── Pagination & Export ─────────────────────────────────────────────────────────

const PAGE_SIZE = DEFAULT_PAGE_SIZE;
const page = ref(1);
const pagedRows = computed(() => paginate(rows.value, page.value, PAGE_SIZE));

const consumptionExportColumns: WalletExportColumn<AggRow>[] = [
    { key: 'period_start', header: 'Period', value: (row) => periodLabel(row) },
    { key: 'meter_id', header: 'Meter', value: (row) => row.meter_id || selectedMeter.value || '' },
    { key: 'kwh_total', header: 'Energy Used', value: (row) => fmtKwh(row.kwh_total) },
    { key: 'energy_value_minor', header: 'Energy Value', value: (row) => naira(row.energy_value_minor || 0) },
    { key: 'amount_minor_total', header: 'Amount Spent', value: (row) => naira(row.amount_minor_total) },
    { key: 'reading_count', header: 'Readings', value: (row) => row.reading_count },
];

watch([period, selectedMeter], () => { page.value = 1; });

// ── API Operations ─────────────────────────────────────────────────────────────

let loadRequestId = 0;

async function loadHistorical() {
    const requestId = ++loadRequestId;
    loading.value = true;
    error.value = '';
    try {
        const params = new URLSearchParams({ period: period.value });
        if (selectedMeter.value) params.set('meter_id', selectedMeter.value);
        const res = await api.get<ConsumptionResponse>(`/api/v1/customer/usage?${params}`);
        if (requestId !== loadRequestId) return;
        rows.value = res.rows ?? [];
        meters.value = res.meters ?? [];
        if (!selectedMeter.value && meters.value.length > 0) {
            selectedMeter.value = meters.value[0];
            meterNumber.value = meters.value[0];
        }
    } catch (e: any) {
        if (requestId !== loadRequestId) return;
        error.value = e?.message ?? 'Could not load your usage.';
    } finally {
        if (requestId === loadRequestId) loading.value = false;
    }
}

async function loadTelemetry() {
    telemetryLoading.value = true;
    try {
        const activeKey = ALL_DATA_ITEMS.find(i => i.label === selectedDataItem.value)?.key || 'power';
        const params = new URLSearchParams({
            timeframe: timeframe.value,
            data_item: activeKey,
        });
        if (selectedMeter.value) params.set('meter_id', selectedMeter.value);
        const res = await api.get<TelemetryResponse>(`/api/v1/customer/usage/telemetry?${params}`);
        if (res.oem) oemInfo.value = res.oem;
        if (res.current) currentReadings.value = res.current;
        if (res.today_kwh != null) todayKwh.value = res.today_kwh;
        if (res.wallet_balance_minor != null) walletBalanceMinor.value = res.wallet_balance_minor;
        chartSeries.value = res.series ?? [];
        chartKey.value++; // trigger fresh animation
    } catch (e: any) {
        console.warn('Telemetry load error:', e);
    } finally {
        telemetryLoading.value = false;
    }
}

async function triggerRemoteRead() {
    if (!selectedMeter.value || !oemSupportsLive.value || remoteReading.value) return;
    remoteReading.value = true;
    remoteMessage.value = null;
    try {
        const activeItem = ALL_DATA_ITEMS.find(i => i.label === selectedDataItem.value);
        const res = await api.post<{ ok: boolean; status: string; readings: any }>('/api/v1/customer/usage/remote-read', {
            meter_id: selectedMeter.value,
            data_item: activeItem?.key || 'power',
        });
        if (res.readings) {
            currentReadings.value = {
                ...currentReadings.value,
                ...res.readings,
                captured_at: new Date().toISOString(),
            };
        }
        remoteMessage.value = { type: 'success', text: 'Live meter reading received.' };
        await loadTelemetry();
    } catch (e: any) {
        remoteMessage.value = { type: 'error', text: e?.message ?? 'Failed to read meter remotely.' };
    } finally {
        remoteReading.value = false;
        setTimeout(() => { remoteMessage.value = null; }, 5000);
    }
}

function searchMeter() {
    const value = meterNumber.value.trim().toUpperCase();
    if (value && !/^[A-Z0-9_-]{3,64}$/.test(value)) {
        meterError.value = 'Enter a valid meter number.';
        return;
    }
    meterError.value = '';
    selectedMeter.value = value;
    page.value = 1;
    loadHistorical();
    loadTelemetry();
}

function selectMeterQuick(meter: string) {
    meterNumber.value = meter;
    selectedMeter.value = meter;
    meterError.value = '';
    page.value = 1;
    loadHistorical();
    loadTelemetry();
}

function setTimeframe(tf: Timeframe) {
    if (tf === 'live' && !oemSupportsLive.value) return;
    timeframe.value = tf;
    loadTelemetry();
}

function setDataItem(item: DataItem) {
    selectedDataItem.value = item;
    loadTelemetry();
}

watch(period, loadHistorical);

let liveInterval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
    await loadHistorical();
    await loadTelemetry();
    // Live pulse polling if in live mode
    liveInterval = setInterval(() => {
        if (timeframe.value === 'live' && oemSupportsLive.value) {
            loadTelemetry();
        }
    }, 8000);
});

onUnmounted(() => {
    if (liveInterval) clearInterval(liveInterval);
});
</script>

<template>
  <AppShell>
    <div class="usage-view">
      <!-- ── Top Header Bar ─────────────────────────────────────────────── -->
      <header class="usage-header">
        <div class="title-row">
          <button type="button" class="back-btn" aria-label="Go back" @click="router.back()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div class="title-wrap">
            <div class="title-with-badge">
              <h1>Your usage</h1>
              <span class="live-pill-badge" :class="{ inactive: !oemSupportsLive }">
                <span class="ping-dot" />
                Live
              </span>
            </div>
            <!-- Meter Selector / Subtitle -->
            <div class="meter-subtitle">
              <span class="meter-tag-label">Meter</span>
              <div v-if="meters.length > 1" class="meter-quick-select">
                <select :value="selectedMeter" aria-label="Select meter" @change="selectMeterQuick(($event.target as HTMLSelectElement).value)">
                  <option v-for="m in meters" :key="m" :value="m">{{ m }}</option>
                </select>
              </div>
              <span v-else class="meter-mono">{{ selectedMeter || 'No meter linked' }}</span>
              <span v-if="oemInfo.displayName" class="oem-chip">{{ oemInfo.displayName }}</span>
            </div>
          </div>
        </div>

        <!-- Controls: Export and Period -->
        <div class="header-actions">
          <WalletExportMenu
            :rows="rows"
            :columns="consumptionExportColumns"
            filename="beverly-customer-usage"
            title="Customer Usage"
            :subtitle="`${periodLabel({ period_start: new Date().toISOString().slice(0, 10), period_type: period } as AggRow)} view`"
            :loading="loading"
            :formats="['pdf']"
          />
        </div>
      </header>

      <!-- ── Data Item Selector (OEM Gated) ─────────────────────────────── -->
      <section class="data-item-selector-section" aria-label="Data Item Selection">
        <label for="data-item-select" class="selector-label">Data Item</label>
        <div class="selector-dropdown-wrap">
          <select
            id="data-item-select"
            :value="selectedDataItem"
            class="data-item-select"
            @change="setDataItem(($event.target as HTMLSelectElement).value as DataItem)"
          >
            <option v-for="item in availableDataItems" :key="item.key" :value="item.label">
              {{ item.label }}
            </option>
          </select>
          <span class="dropdown-chevron" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      </section>

      <!-- ── Hero Chart Card ────────────────────────────────────────────── -->
      <section class="hero-usage-card" :aria-label="heroConfig.label">
        <div class="hero-glow-overlay" />
        
        <!-- Hero Header -->
        <div class="hero-card-header">
          <div class="metric-title-group">
            <span class="metric-kind">{{ heroConfig.label }}</span>
            <div class="metric-big-number">{{ heroConfig.value }}</div>
            <div class="metric-reading-time">Reading as of {{ capturedTimeFormatted }}</div>
          </div>

          <!-- Timeframe Segmented Control (Live OEM Gated) -->
          <div class="timeframe-segmented-control" role="tablist" aria-label="Timeframe">
            <button
              type="button"
              role="tab"
              :aria-selected="timeframe === 'hourly'"
              class="tf-pill"
              :class="{ active: timeframe === 'hourly' }"
              @click="setTimeframe('hourly')"
            >
              Hourly
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="timeframe === 'daily'"
              class="tf-pill"
              :class="{ active: timeframe === 'daily' }"
              @click="setTimeframe('daily')"
            >
              Daily
            </button>
            <button
              v-if="oemSupportsLive"
              type="button"
              role="tab"
              :aria-selected="timeframe === 'live'"
              class="tf-pill live-pill"
              :class="{ active: timeframe === 'live' }"
              @click="setTimeframe('live')"
            >
              <span class="tiny-pulse" />
              Live
            </button>
          </div>
        </div>

        <!-- Animated SVG Chart -->
        <div class="chart-container">
          <svg
            :key="chartKey"
            class="usage-svg-chart"
            :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="usageBrandGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--brand)" stop-opacity="0.38" />
                <stop offset="65%" stop-color="var(--brand)" stop-opacity="0.08" />
                <stop offset="100%" stop-color="var(--brand)" stop-opacity="0.0" />
              </linearGradient>
              <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <!-- Horizontal Guide Lines -->
            <line :x1="padding.left" :y1="padding.top + 20" :x2="svgWidth - padding.right" :y2="padding.top + 20" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3" />
            <line :x1="padding.left" :y1="(svgHeight - padding.bottom) / 2" :x2="svgWidth - padding.right" :y2="(svgHeight - padding.bottom) / 2" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3" />
            <line :x1="padding.left" :y1="svgHeight - padding.bottom" :x2="svgWidth - padding.right" :y2="svgHeight - padding.bottom" stroke="rgba(255,255,255,0.12)" />

            <!-- Gradient Area Fill -->
            <path
              v-if="areaPath"
              :d="areaPath"
              fill="url(#usageBrandGradient)"
              class="usage-chart-area"
            />

            <!-- Animated Stroke Line -->
            <path
              v-if="linePath"
              :d="linePath"
              class="usage-chart-line"
              fill="none"
              stroke="var(--brand)"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              filter="url(#glowFilter)"
            />

            <!-- Last Point Pulsing Dot -->
            <g v-if="lastPoint" class="last-point-group">
              <circle
                :cx="lastPoint.x"
                :cy="lastPoint.y"
                r="10"
                fill="var(--brand)"
                opacity="0.35"
                class="chart-ping-ring"
              />
              <circle
                :cx="lastPoint.x"
                :cy="lastPoint.y"
                r="5"
                fill="var(--brand)"
                stroke="oklch(12% 0.01 145)"
                stroke-width="2"
              />
            </g>

            <!-- Interactive Hover Markers -->
            <circle
              v-for="(pt, idx) in chartPoints"
              :key="idx"
              :cx="pt.x"
              :cy="pt.y"
              r="6"
              class="hover-target"
              tabindex="0"
              @mouseenter="activePoint = pt.raw"
              @mouseleave="activePoint = null"
              @focus="activePoint = pt.raw"
              @blur="activePoint = null"
            />
          </svg>

          <!-- Floating Tooltip -->
          <div v-if="activePoint" class="chart-tooltip">
            <span class="tt-time">{{ activePoint.label }}</span>
            <span class="tt-val">{{ activePoint.value }} {{ heroConfig.unit }}</span>
          </div>

          <!-- X-Axis Labels -->
          <div class="chart-x-labels">
            <span v-for="(pt, idx) in chartPoints.filter((_, i) => i % Math.max(1, Math.floor(chartPoints.length / 5)) === 0 || i === chartPoints.length - 1)" :key="idx">
              {{ pt.raw.label }}
            </span>
          </div>
        </div>

        <!-- Remote Operation Trigger Button (OEM Gated) -->
        <div v-if="oemSupportsLive" class="remote-action-row">
          <button
            type="button"
            class="remote-read-btn"
            :disabled="remoteReading || !selectedMeter"
            @click="triggerRemoteRead"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              :class="{ spin: remoteReading }"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            {{ remoteReading ? 'Polling meter…' : 'Fetch live reading' }}
          </button>
          <span v-if="remoteMessage" class="remote-feedback" :class="remoteMessage.type">
            {{ remoteMessage.text }}
          </span>
        </div>
      </section>

      <!-- ── Bottom KPI Cards: Today & Wallet ──────────────────────────── -->
      <section class="kpi-duo-grid" aria-label="Key performance indicators">
        <!-- Today KPI Card -->
        <div class="kpi-card today-card">
          <div class="kpi-icon-wrap" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v10l4.5 4.5" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Today</span>
            <strong class="kpi-value">{{ todayKwh.toFixed(1) }} kWh</strong>
          </div>
        </div>

        <!-- Wallet KPI Card -->
        <div class="kpi-card wallet-card">
          <div class="kpi-icon-wrap" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Wallet</span>
            <strong class="kpi-value">{{ naira(walletBalanceMinor) }}</strong>
          </div>
        </div>
      </section>

      <!-- ── Meter Search Form (Contract Invariant) ──────────────────────── -->
      <form class="meter-search" aria-label="Meter consumption search" novalidate @submit.prevent="searchMeter">
        <label for="customer-consumption-meter">
          <span>Meter number</span>
          <input
            id="customer-consumption-meter"
            v-model="meterNumber"
            class="meter-input"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            maxlength="64"
            list="customer-consumption-meters"
            placeholder="Enter meter number"
            :aria-invalid="Boolean(meterError)"
            :aria-describedby="meterError ? 'customer-meter-error' : undefined"
            @input="meterError = ''"
          />
          <datalist id="customer-consumption-meters">
            <option v-for="meter in meters" :key="meter" :value="meter" />
          </datalist>
        </label>
        <button type="submit" class="meter-submit" :disabled="loading">View analytics</button>
        <span v-if="meterError" id="customer-meter-error" class="meter-error" role="alert">{{ meterError }}</span>
      </form>

      <!-- ── Historical Usage Table ─────────────────────────────────────── -->
      <section class="historical-section" aria-label="Historical Energy Records">
        <div class="section-head">
          <div class="section-titles">
            <h2>Consumption records</h2>
            <p class="section-sub">Detailed periodic breakdown for this meter.</p>
          </div>
          <select v-model="period" aria-label="Period" class="select-period">
            <option v-for="option in PERIODS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>

        <div v-if="error" class="notice error" role="alert">{{ error }}</div>

        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th v-if="showMeterColumn">Meter</th>
                <th class="num">Energy used</th>
                <th class="num">Value</th>
                <th class="num">Spent</th>
              </tr>
            </thead>
            <tbody>
              <WalletTableSkeleton v-if="loading" :columns="showMeterColumn ? 5 : 4" />
              <tr v-else-if="!rows.length">
                <td :colspan="showMeterColumn ? 5 : 4" class="empty">No consumption recorded for this period.</td>
              </tr>
              <tr v-for="(row, index) in pagedRows" v-else :key="`${row.scope_id}-${row.period_start}-${index}`">
                <td>{{ periodLabel(row) }}</td>
                <td v-if="showMeterColumn" class="mono">{{ row.meter_id }}</td>
                <td class="num">{{ fmtKwh(row.kwh_total) }}</td>
                <td class="num">{{ naira(row.energy_value_minor ?? 0) }}</td>
                <td class="num">{{ naira(row.amount_minor_total) }}</td>
              </tr>
            </tbody>
          </table>
          <WalletPagination v-model:page="page" :total="rows.length" :page-size="PAGE_SIZE" item-label="periods" />
        </div>
      </section>
    </div>
  </AppShell>
</template>

<style scoped>
.usage-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
}

/* ── Top Header ────────────────────────────────────────────────────────── */
.usage-header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.back-btn:hover {
  background: var(--surface-3, rgba(255,255,255,0.08));
  border-color: var(--border-strong, rgba(255,255,255,0.2));
}

.title-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
}

.live-pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  background: oklch(from var(--brand) l c h / 0.16);
  color: var(--brand);
  border: 1px solid oklch(from var(--brand) l c h / 0.35);
}

.live-pill-badge.inactive {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
  border-color: rgba(255, 255, 255, 0.12);
}

.ping-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 0 6px var(--brand);
  animation: pulsePing 2s infinite ease-in-out;
}

@keyframes pulsePing {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.meter-subtitle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.meter-tag-label {
  font-weight: 600;
  color: var(--text-muted);
}

.meter-mono {
  font-family: var(--font-mono, monospace);
  color: var(--text);
  font-weight: 600;
}

.meter-quick-select select {
  font-family: var(--font-mono, monospace);
  font-size: 0.8125rem;
  font-weight: 600;
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.2rem 0.4rem;
}

.oem-chip {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  background: var(--surface-2);
  color: var(--brand);
  border: 1px solid var(--border);
}

/* ── Data Item Selector ────────────────────────────────────────────────── */
.data-item-selector-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.selector-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.selector-dropdown-wrap {
  position: relative;
  display: inline-block;
  max-width: 320px;
}

.data-item-select {
  width: 100%;
  appearance: none;
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.65rem 2.25rem 0.65rem 0.875rem;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.data-item-select:focus-visible {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-glow, rgba(50, 205, 50, 0.2));
}

.dropdown-chevron {
  position: absolute;
  right: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--text-muted);
}

/* ── Hero Usage Card ───────────────────────────────────────────────────── */
.hero-usage-card {
  position: relative;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: oklch(12% 0.01 145);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6);
  padding: 1.5rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.hero-glow-overlay {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, oklch(from var(--brand) l c h / 0.14) 0%, transparent 70%);
  pointer-events: none;
}

.hero-card-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.metric-title-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metric-kind {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.metric-big-number {
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1.1;
  color: var(--brand);
  letter-spacing: -0.03em;
  font-family: var(--font-display, var(--font-sans, sans-serif));
}

.metric-reading-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Segmented Control */
.timeframe-segmented-control {
  display: inline-flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.45);
  padding: 0.25rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.tf-pill {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.tf-pill:hover {
  color: var(--text);
}

.tf-pill.active {
  background: var(--surface-2, rgba(255, 255, 255, 0.12));
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.tf-pill.live-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.tf-pill.live-pill.active {
  background: oklch(from var(--brand) l c h / 0.22);
  color: var(--brand);
}

.tiny-pulse {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--brand);
}

/* Chart Canvas */
.chart-container {
  position: relative;
  width: 100%;
}

.usage-svg-chart {
  width: 100%;
  height: 180px;
  overflow: visible;
}

.usage-chart-line {
  stroke-dasharray: 1200;
  stroke-dashoffset: 1200;
  animation: drawUsageLine 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes drawUsageLine {
  to {
    stroke-dashoffset: 0;
  }
}

.usage-chart-area {
  opacity: 0;
  animation: fadeInArea 0.8s ease 0.6s forwards;
}

@keyframes fadeInArea {
  to {
    opacity: 1;
  }
}

.chart-ping-ring {
  animation: ringPulse 2s infinite ease-out;
  transform-origin: center;
}

@keyframes ringPulse {
  0% { transform: scale(0.6); opacity: 0.6; }
  100% { transform: scale(1.6); opacity: 0; }
}

.hover-target {
  fill: transparent;
  cursor: pointer;
  transition: fill 0.15s ease;
}

.hover-target:hover,
.hover-target:focus {
  fill: var(--brand);
  outline: none;
}

.chart-tooltip {
  position: absolute;
  top: 10px;
  right: 16px;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.35rem 0.65rem;
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  pointer-events: none;
}

.tt-time { color: var(--text-muted); }
.tt-val { color: var(--brand); font-weight: 700; }

.chart-x-labels {
  display: flex;
  justify-content: space-between;
  padding: 0.35rem 0.5rem 0;
  font-size: 0.6875rem;
  color: var(--text-muted);
}

/* Remote Action Row */
.remote-action-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.remote-read-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 8px;
  border: 1px solid oklch(from var(--brand) l c h / 0.4);
  background: oklch(from var(--brand) l c h / 0.12);
  color: var(--brand);
  cursor: pointer;
  transition: background 0.15s ease;
}

.remote-read-btn:hover:not(:disabled) {
  background: oklch(from var(--brand) l c h / 0.22);
}

.remote-read-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.remote-feedback {
  font-size: 0.75rem;
  font-weight: 600;
}

.remote-feedback.success { color: var(--brand); }
.remote-feedback.error { color: var(--danger-on-surface, #ef4444); }

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

/* ── KPI Duo Grid: Today & Wallet ──────────────────────────────────────── */
.kpi-duo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.15rem 1.25rem;
  border-radius: 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.kpi-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: oklch(from var(--brand) l c h / 0.15);
  color: var(--brand);
}

.kpi-content {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.kpi-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.kpi-value {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

/* ── Meter Search Form (Contract) ──────────────────────────────────────── */
.meter-search {
  display: grid;
  grid-template-columns: minmax(240px, 420px) auto;
  gap: 0.5rem;
  align-items: end;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-2);
}

.meter-search label {
  display: grid;
  gap: 0.35rem;
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
}

.meter-input {
  width: 100%;
  min-height: 44px;
  padding: 0 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: 600 1rem/1 var(--font-mono, monospace);
}

.meter-submit {
  min-height: 44px;
  padding: 0 1.25rem;
  border: 0;
  border-radius: 8px;
  background: var(--brand);
  color: oklch(8% 0.04 145);
  font: 700 1rem/1 var(--font-sans, sans-serif);
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.meter-submit:disabled {
  opacity: 0.55;
  cursor: wait;
}

.meter-error {
  grid-column: 1 / -1;
  color: var(--danger-on-surface, #ef4444);
  font-size: 0.8125rem;
}

/* ── Historical Table Section ──────────────────────────────────────────── */
.historical-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.section-titles h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text);
}

.section-sub {
  margin: 0.2rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.select-period {
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  font-size: 0.875rem;
  background: var(--surface-2);
  color: var(--text);
}

.notice {
  padding: 1rem;
  border-radius: 8px;
  background: var(--surface-2);
}

.notice.error {
  border: 1px solid oklch(from var(--danger, #ef4444) l c h / 0.3);
  background: oklch(from var(--danger, #ef4444) l c h / 0.12);
  color: var(--danger-on-surface, #ef4444);
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 440px;
}

th, td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

th {
  font-size: 0.8125rem;
  color: var(--text-muted);
  font-weight: 600;
  background: var(--surface-2);
}

td {
  color: var(--text-dim, var(--text));
  font-size: 0.875rem;
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.mono {
  font-family: var(--font-mono, monospace);
  font-size: 0.8125rem;
}

.empty {
  text-align: center;
  color: var(--text-muted);
  padding: 2.5rem;
}

@media (max-width: 640px) {
  .meter-search { grid-template-columns: 1fr; }
  .meter-submit { width: 100%; }
  .hero-card-header { flex-direction: column; }
  .timeframe-segmented-control { width: 100%; justify-content: space-between; }
  .metric-big-number { font-size: 2rem; }
}
</style>
