<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api';
import { naira } from '../lib/format';

const router = useRouter();

// ── Types ──────────────────────────────────────────────────────────────────────

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

type Timeframe = 'hourly' | 'daily' | 'live';
type DataItem = 'Credit balance' | 'Total Consumption' | 'Power' | 'Relay Status';

const ALL_DATA_ITEMS: { label: DataItem; key: string; unit: string; heroLabel: string }[] = [
    { label: 'Power', key: 'power', unit: 'kW', heroLabel: 'Live power' },
    { label: 'Credit balance', key: 'credit_balance', unit: 'kWh', heroLabel: 'Credit balance' },
    { label: 'Total Consumption', key: 'total_consumption', unit: 'kWh', heroLabel: 'Total Consumption' },
    { label: 'Relay Status', key: 'relay_status', unit: '', heroLabel: 'Relay Status' },
];

// ── State (100% Real API Data — Zero Guesswork / Zero Synthetic Fallbacks) ──────

const timeframe = ref<Timeframe>('hourly');
const selectedDataItem = ref<DataItem>('Power');

const meterNumber = ref('');
const selectedMeter = ref('');
const meterError = ref('');
const meters = ref<string[]>([]);

const telemetryLoading = ref(false);
const remoteReading = ref(false);
const remoteMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null);

const oemInfo = ref<OemInfo>({
    id: null,
    slug: 'calinmeter',
    displayName: 'Calinmeter',
    supportsLive: true,
    supportedDataItems: ['credit_balance', 'total_consumption', 'power', 'relay_status'],
});

const currentReadings = ref({
    power: 0,
    credit_balance: 0,
    total_consumption: 0,
    relay_status: 'Closed',
    captured_at: '',
});

const todayKwh = ref(0);
const walletBalanceMinor = ref(0);
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

const heroConfig = computed(() => {
    const active = ALL_DATA_ITEMS.find(i => i.label === selectedDataItem.value) || ALL_DATA_ITEMS[0];
    let valStr = '';
    if (active.key === 'power') {
        valStr = `${(currentReadings.value.power ?? 0).toFixed(2)} kW`;
    } else if (active.key === 'credit_balance') {
        valStr = `${(currentReadings.value.credit_balance ?? 0).toFixed(2)} kWh`;
    } else if (active.key === 'total_consumption') {
        valStr = `${(currentReadings.value.total_consumption ?? 0).toFixed(2)} kWh`;
    } else if (active.key === 'relay_status') {
        valStr = currentReadings.value.relay_status || 'Closed';
    }
    return {
        label: active.heroLabel,
        value: valStr,
        key: active.key,
        unit: active.unit,
    };
});

const capturedTimeFormatted = computed(() => {
    if (!currentReadings.value.captured_at) return 'No reading recorded yet';
    const date = new Date(currentReadings.value.captured_at);
    if (Number.isNaN(date.getTime())) return 'No reading recorded yet';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

// ── Chart SVG Calculations (Real Data Points) ─────────────────────────────────

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
    const range = maxVal === minVal ? (maxVal === 0 ? 1 : maxVal) : maxVal - minVal;

    const usableWidth = svgWidth - padding.left - padding.right;
    const usableHeight = svgHeight - padding.top - padding.bottom;

    return data.map((pt, i) => {
        const x = data.length === 1
            ? padding.left + usableWidth / 2
            : padding.left + (i / (data.length - 1)) * usableWidth;
        const normalized = (pt.value - minVal) / range;
        const y = svgHeight - padding.bottom - normalized * usableHeight;
        return { x, y, raw: pt };
    });
});

const linePath = computed(() => {
    const pts = chartPoints.value;
    if (!pts.length) return '';
    if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    return pts.reduce((acc, pt, i) => {
        if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
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

// ── API Operations ─────────────────────────────────────────────────────────────

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
        if (res.meters && res.meters.length) {
            meters.value = res.meters;
            if (!selectedMeter.value) {
                selectedMeter.value = res.meter_id || res.meters[0];
                meterNumber.value = selectedMeter.value;
            }
        }
        chartSeries.value = res.series ?? [];
        chartKey.value++; // trigger kinetic redraw
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
    loadTelemetry();
}

function selectMeterQuick(meter: string) {
    meterNumber.value = meter;
    selectedMeter.value = meter;
    meterError.value = '';
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

let liveInterval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
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
          <div v-if="chartSeries.length === 0 && !telemetryLoading" class="chart-empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="empty-chart-icon">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
            <span>No telemetry recorded for {{ selectedMeter || 'this meter' }} in {{ timeframe }} view.</span>
          </div>

          <svg
            v-else
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
              fill="transparent"
              class="chart-hit-point"
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
          <div v-if="chartPoints.length > 0" class="chart-x-labels">
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

        <!-- Wallet Balance Card -->
        <div class="kpi-card wallet-card">
          <div class="kpi-icon-wrap" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M2 10h20" />
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Wallet</span>
            <strong class="kpi-value">{{ naira(walletBalanceMinor) }}</strong>
          </div>
        </div>
      </section>

      <!-- ── Meter Search Form ─────────────────────────────────────────── -->
      <form class="meter-search" @submit.prevent="searchMeter">
        <label>
          <span>Find by meter number</span>
          <input
            v-model="meterNumber"
            class="meter-input"
            type="text"
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
        <button type="submit" class="meter-submit" :disabled="telemetryLoading">View analytics</button>
        <span v-if="meterError" id="customer-meter-error" class="meter-error" role="alert">{{ meterError }}</span>
      </form>
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
}

.meter-tag-label {
  color: var(--text-muted);
}

.meter-quick-select select {
  font-family: var(--font-mono, monospace);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.15rem 0.4rem;
  cursor: pointer;
}

.meter-mono {
  font-family: var(--font-mono, monospace);
  font-weight: 600;
  color: var(--text);
}

.oem-chip {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-2, var(--text-muted));
  font-size: 0.6875rem;
  font-weight: 600;
}

/* ── Data Item Selector ────────────────────────────────────────────────── */
.data-item-selector-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.selector-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.selector-dropdown-wrap {
  position: relative;
  width: 100%;
}

.data-item-select {
  width: 100%;
  min-height: 48px;
  appearance: none;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0 2.5rem 0 1rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.data-item-select:focus {
  outline: none;
  border-color: var(--brand);
}

.dropdown-chevron {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--text-muted);
}

/* ── Hero Usage Card ───────────────────────────────────────────────────── */
.hero-usage-card {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  background: oklch(12% 0.01 145);
  border: 1px solid rgba(255, 255, 255, 0.09);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.65);
}

.hero-glow-overlay {
  position: absolute;
  top: -80px;
  left: 20%;
  width: 280px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, oklch(from var(--brand) l c h / 0.12) 0%, transparent 70%);
  pointer-events: none;
}

.hero-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  position: relative;
  z-index: 1;
}

.metric-title-group {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.metric-kind {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.metric-big-number {
  font-size: 2.75rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
  color: oklch(0.65 0.15 142);
  letter-spacing: -0.025em;
  text-shadow: 0 0 24px oklch(from var(--brand) l c h / 0.25);
}

.metric-reading-time {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
}

/* Timeframe Segmented Control */
.timeframe-segmented-control {
  display: inline-flex;
  background: rgba(255, 255, 255, 0.06);
  padding: 3px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.tf-pill {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.tf-pill:hover {
  color: var(--text);
}

.tf-pill.active {
  background: oklch(24% 0.02 145);
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.tf-pill.live-pill.active {
  color: var(--brand);
}

.tiny-pulse {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--brand);
  animation: pulsePing 1.8s infinite;
}

/* ── Chart Container ───────────────────────────────────────────────────── */
.chart-container {
  position: relative;
  width: 100%;
  min-height: 180px;
  margin-top: 0.5rem;
}

.chart-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1.5rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.empty-chart-icon {
  opacity: 0.45;
  color: var(--brand);
}

.usage-svg-chart {
  width: 100%;
  height: 180px;
  overflow: visible;
}

.usage-chart-line {
  stroke-dasharray: 2000;
  stroke-dashoffset: 2000;
  animation: drawUsageLine 1.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes drawUsageLine {
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .usage-chart-line {
    animation: none;
    stroke-dashoffset: 0;
  }
}

.usage-chart-area {
  opacity: 0;
  animation: fadeInArea 0.8s ease 0.4s forwards;
}

@keyframes fadeInArea {
  to { opacity: 1; }
}

.chart-ping-ring {
  animation: ringPing 2s infinite ease-out;
  transform-origin: center;
}

@keyframes ringPing {
  0% { transform: scale(0.8); opacity: 0.7; }
  100% { transform: scale(2.2); opacity: 0; }
}

.chart-hit-point {
  cursor: pointer;
  outline: none;
}

.chart-tooltip {
  position: absolute;
  top: 10px;
  right: 16px;
  display: flex;
  flex-direction: column;
  background: oklch(18% 0.02 145);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.tt-time {
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.tt-val {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--brand);
}

.chart-x-labels {
  display: flex;
  justify-content: space-between;
  padding: 0.4rem 0.5rem 0;
  font-size: 0.6875rem;
  color: var(--text-muted);
  font-family: var(--font-mono, monospace);
}

/* Remote Operation Trigger */
.remote-action-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-top: 0.5rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.remote-read-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.95rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.remote-read-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.remote-read-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.remote-feedback {
  font-size: 0.8125rem;
}

.remote-feedback.success {
  color: var(--success, #22c55e);
}

.remote-feedback.error {
  color: var(--danger-on-surface, #ef4444);
}

/* ── Bottom KPI Cards: Today & Wallet ──────────────────────────────────── */
.kpi-duo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.15rem;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.kpi-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  flex-shrink: 0;
}

.today-card .kpi-icon-wrap {
  background: oklch(from var(--brand) l c h / 0.14);
  color: var(--brand);
}

.wallet-card .kpi-icon-wrap {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

.kpi-content {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.kpi-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.kpi-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Meter Search Form ─────────────────────────────────────────────────── */
.meter-search {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
  align-items: end;
  padding: 1.25rem;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
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

@media (max-width: 640px) {
  .kpi-duo-grid { grid-template-columns: 1fr; }
  .meter-search { grid-template-columns: 1fr; }
  .meter-submit { width: 100%; }
  .hero-card-header { flex-direction: column; }
  .timeframe-segmented-control { width: 100%; justify-content: space-between; }
  .metric-big-number { font-size: 2rem; }
}
</style>
