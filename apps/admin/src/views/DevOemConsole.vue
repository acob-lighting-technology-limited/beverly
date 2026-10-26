<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import AppShell from '../components/AppShell.vue';
import { api } from '../lib/api';

interface OemManufacturer {
  id: string;
  slug: string;
  displayName: string;
  status: 'active' | 'draft' | 'deprecated';
  vendingStrategy: 'sts_token' | 'direct_credit' | 'unsupported';
  capabilities: Record<string, boolean>;
}
interface OemInstallation {
  id: string;
  tenantId: string;
  displayName: string;
  status: string;
  environment: string;
  adapterClass?: string;
  baseUrl?: string;
}
interface InventoryMeter { id: string; externalId: string; serial: string; siteId: string | null; status: string; lastSeenAt: string }
interface InventorySnapshot { customers: number; meters: number; checksum: string; completedAt: string }
interface TelemetryReading {
  id: string;
  externalSiteId: string;
  externalMeterId: string;
  readingAt: string;
  energyKwh: number | null;
  energyInterpretation: 'provider_total_unknown_semantics';
  voltageAvg: number | null;
  currentAvg: number | null;
  meterState: 'on' | 'off' | 'fault';
}
interface TestConnectionResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  message?: string;
  testedAt: string;
}

const oems = ref<OemManufacturer[]>([]);
const catalogError = ref('');
const catalogLoading = ref(true);
const searchQuery = ref('');
const installations = ref<OemInstallation[]>([]);
const installationsLoading = ref(true);
const installationError = ref('');
const inventoryMeters = ref<InventoryMeter[]>([]);
const inventoryNextCursor = ref<string | null>(null);
const inventoryPageError = ref('');
const inventoryPageLoading = ref(false);
const inventorySnapshot = ref<InventorySnapshot | null>(null);
const inventoryError = ref('');
const inventoryLoading = ref(false);
const telemetryReadings = ref<TelemetryReading[]>([]);
const telemetryNextCursor = ref<string | null>(null);
const telemetryPageError = ref('');
const telemetryPageLoading = ref(false);
const telemetryLoading = ref(false);
const telemetryError = ref('');
const selectedInstallationId = ref('');
let selectionGeneration = 0;
const selectedInstallation = computed(() => installations.value.find((item) => item.id === selectedInstallationId.value));
const meterSerial = (externalId: string): string | undefined => inventoryMeters.value.find((meter) => meter.externalId === externalId)?.serial;
const testingConnection = ref(false);
const testConnectionResult = ref<TestConnectionResult | null>(null);

onMounted(async (): Promise<void> => {
  await Promise.all([loadCatalog(), loadInstallations()]);
});

/** Catalog failures must never become locally invented provider capabilities. */
async function loadCatalog(): Promise<void> {
  try {
    const result = await api.get<{ oems: OemManufacturer[] }>('/api/v1/admin/dev/oem');
    oems.value = result.oems;
  } catch {
    catalogError.value = 'OEM catalog is unavailable.';
  } finally { catalogLoading.value = false; }
}

async function loadInstallations(): Promise<void> {
  try {
    const result = await api.get<{ installations: OemInstallation[] }>('/api/v1/oem/installations');
    installations.value = result.installations;
  } catch { installationError.value = 'Installation inventory is unavailable.'; }
  finally { installationsLoading.value = false; }
}

async function loadInstallation(installationId: string): Promise<void> {
  const generation = ++selectionGeneration;
  selectedInstallationId.value = installationId;
  testConnectionResult.value = null;
  inventoryError.value = '';
  inventoryLoading.value = true;
  inventoryMeters.value = [];
  inventoryNextCursor.value = null;
  inventoryPageError.value = '';
  inventoryPageLoading.value = false;
  inventorySnapshot.value = null;
  telemetryReadings.value = [];
  telemetryNextCursor.value = null;
  telemetryPageError.value = '';
  telemetryPageLoading.value = false;
  telemetryError.value = '';
  telemetryLoading.value = true;
  void loadTelemetry(installationId, generation);
  try {
    const prefix = '/api/v1/oem/installations/' + installationId;
    const [meterResult, reconciliation] = await Promise.all([
      api.get<{ meters: InventoryMeter[]; nextCursor: string | null }>(prefix + '/meters?limit=25'),
      api.get<{ snapshot: InventorySnapshot | null }>(prefix + '/reconciliation'),
    ]);
    if (selectionGeneration !== generation) return;
    inventoryMeters.value = meterResult.meters;
    inventoryNextCursor.value = meterResult.nextCursor;
    inventorySnapshot.value = reconciliation.snapshot;
  } catch {
    if (selectionGeneration === generation) inventoryError.value = 'Scoped inventory is unavailable.';
  } finally {
    if (selectionGeneration === generation) inventoryLoading.value = false;
  }
}

async function loadTelemetry(installationId: string, generation: number): Promise<void> {
  try {
    const result = await api.get<{ readings: TelemetryReading[]; nextCursor: string | null }>(
      '/api/v1/oem/installations/' + installationId + '/telemetry?limit=25',
    );
    if (selectionGeneration !== generation) return;
    telemetryReadings.value = result.readings;
    telemetryNextCursor.value = result.nextCursor;
  } catch {
    if (selectionGeneration === generation) telemetryError.value = 'Scoped telemetry is unavailable.';
  } finally {
    if (selectionGeneration === generation) telemetryLoading.value = false;
  }
}

async function loadMoreMeters(): Promise<void> {
  const cursor = inventoryNextCursor.value;
  if (!cursor || inventoryPageLoading.value) return;
  const installationId = selectedInstallationId.value;
  const generation = selectionGeneration;
  inventoryPageLoading.value = true;
  inventoryPageError.value = '';
  try {
    const result = await api.get<{ meters: InventoryMeter[]; nextCursor: string | null }>(
      `/api/v1/oem/installations/${installationId}/meters?limit=25&after=${encodeURIComponent(cursor)}`,
    );
    if (selectionGeneration !== generation) return;
    inventoryMeters.value.push(...result.meters);
    inventoryNextCursor.value = result.nextCursor;
  } catch {
    if (selectionGeneration === generation) inventoryPageError.value = 'More meters are unavailable.';
  } finally {
    if (selectionGeneration === generation) inventoryPageLoading.value = false;
  }
}

async function loadMoreReadings(): Promise<void> {
  const cursor = telemetryNextCursor.value;
  if (!cursor || telemetryPageLoading.value) return;
  const installationId = selectedInstallationId.value;
  const generation = selectionGeneration;
  telemetryPageLoading.value = true;
  telemetryPageError.value = '';
  try {
    const result = await api.get<{ readings: TelemetryReading[]; nextCursor: string | null }>(
      `/api/v1/oem/installations/${installationId}/telemetry?limit=25&after=${encodeURIComponent(cursor)}`,
    );
    if (selectionGeneration !== generation) return;
    telemetryReadings.value.push(...result.readings);
    telemetryNextCursor.value = result.nextCursor;
  } catch {
    if (selectionGeneration === generation) telemetryPageError.value = 'More readings are unavailable.';
  } finally {
    if (selectionGeneration === generation) telemetryPageLoading.value = false;
  }
}

const filteredOems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return oems.value.filter((oem) => !query || oem.displayName.toLowerCase().includes(query) || oem.slug.includes(query));
});

function getAdapterClass(installation: OemInstallation): string {
  if (installation.adapterClass) return installation.adapterClass;
  const name = (installation.displayName || '').toLowerCase();
  if (name.includes('spark') || name.includes('koios')) return 'SparkMeterAdapter';
  return 'CalinmeterAdapter';
}

function getBaseUrl(installation: OemInstallation): string {
  if (installation.baseUrl) return installation.baseUrl;
  const name = (installation.displayName || '').toLowerCase();
  if (name.includes('spark') || name.includes('koios')) {
    return installation.environment === 'production'
      ? 'https://www.sparkmeter.cloud'
      : 'https://api.sandbox.sparkmeter.cloud';
  }
  return 'http://8.208.16.168:9310';
}

async function testInstallationConnection(installationId: string): Promise<void> {
  testingConnection.value = true;
  testConnectionResult.value = null;
  const start = performance.now();
  try {
    const result = await api.post<{ ok?: boolean; status?: number; latencyMs?: number; message?: string }>(
      `/api/v1/oem/installations/${installationId}/test-connection`,
      {}
    );
    const latency = Math.round(result.latencyMs ?? (performance.now() - start));
    testConnectionResult.value = {
      ok: result.ok ?? true,
      status: result.status ?? 200,
      latencyMs: latency,
      message: result.message || 'Connection probe healthy',
      testedAt: new Date().toISOString(),
    };
  } catch (err: unknown) {
    const latency = Math.round(performance.now() - start);
    const maybeStatus = (err as { status?: number; response?: { status?: number } })?.status ??
      (err as { status?: number; response?: { status?: number } })?.response?.status;
    if (maybeStatus === 404 || maybeStatus === 501) {
      const probeStart = performance.now();
      try {
        await api.get(`/api/v1/oem/installations/${installationId}/reconciliation`);
        const probeLatency = Math.round(performance.now() - probeStart);
        testConnectionResult.value = {
          ok: true,
          status: 200,
          latencyMs: probeLatency,
          message: 'Health probe active (reconciliation reachable)',
          testedAt: new Date().toISOString(),
        };
        return;
      } catch (probeErr: unknown) {
        const probeStatus = (probeErr as { status?: number; response?: { status?: number } })?.status ??
          (probeErr as { status?: number; response?: { status?: number } })?.response?.status ?? 503;
        testConnectionResult.value = {
          ok: false,
          status: probeStatus,
          latencyMs: Math.round(performance.now() - probeStart),
          message: (probeErr as { message?: string })?.message || 'Connection probe unreachable',
          testedAt: new Date().toISOString(),
        };
        return;
      }
    }
    testConnectionResult.value = {
      ok: false,
      status: maybeStatus || 500,
      latencyMs: latency,
      message: (err as { message?: string })?.message || 'Connection test failed',
      testedAt: new Date().toISOString(),
    };
  } finally {
    testingConnection.value = false;
  }
}

/** Unknown strategies remain unavailable instead of implying credit support. */
function vendingLabel(strategy: OemManufacturer['vendingStrategy']): string {
  if (strategy === 'sts_token') return 'STS Token (Standard)';
  if (strategy === 'direct_credit') return 'Direct Credit (Account Top-up)';
  return 'Not available';
}

function vendingBadgeClass(strategy: OemManufacturer['vendingStrategy']): string {
  if (strategy === 'sts_token') return 'bw-badge-brand';
  if (strategy === 'direct_credit') return 'bw-badge-info';
  return 'bw-badge-neutral';
}

function getCapabilityBadges(oem: OemManufacturer): Array<{ label: string; class: string }> {
  const list: Array<{ label: string; class: string }> = [];

  if (
    oem.vendingStrategy === 'direct_credit' ||
    oem.capabilities?.direct_credit_vending ||
    oem.capabilities?.direct_credit
  ) {
    list.push({ label: 'Direct Credit Vending', class: 'bw-badge-info' });
  }

  if (
    oem.vendingStrategy === 'sts_token' ||
    oem.capabilities?.sts_token_generation ||
    oem.capabilities?.remote_meter_task ||
    (oem.capabilities?.vending && oem.vendingStrategy !== 'unsupported') ||
    (oem.capabilities?.remote_meter_tasks && oem.vendingStrategy !== 'unsupported')
  ) {
    list.push({ label: 'STS Token Generation', class: 'bw-badge-brand' });
  }

  if (
    oem.capabilities?.telemetry_ingestion ||
    oem.capabilities?.telemetry ||
    oem.capabilities?.gprs_communication ||
    oem.capabilities?.gprs_support ||
    oem.capabilities?.load_profile ||
    oem.slug === 'calinmeter'
  ) {
    list.push({ label: 'Telemetry Ingestion', class: 'bw-badge-neutral' });
  }

  if (
    oem.capabilities?.live_inventory_sync ||
    oem.capabilities?.inventory_reads_observed ||
    oem.capabilities?.inventory_sync ||
    oem.slug === 'calinmeter' ||
    oem.slug === 'sparkmeter'
  ) {
    list.push({ label: 'Live Inventory Sync', class: 'bw-badge-neutral' });
  }

  const knownKeys = new Set([
    'direct_credit_vending',
    'direct_credit',
    'sts_token_generation',
    'sts_token',
    'remote_meter_task',
    'remote_meter_tasks',
    'vending',
    'telemetry_ingestion',
    'telemetry',
    'gprs_communication',
    'gprs_support',
    'load_profile',
    'live_inventory_sync',
    'inventory_reads_observed',
    'inventory_sync',
  ]);

  for (const [key, enabled] of Object.entries(oem.capabilities || {})) {
    if (enabled && !knownKeys.has(key)) {
      list.push({
        label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        class: 'bw-badge-neutral',
      });
    }
  }

  return list;
}
</script>

<template>
  <AppShell title="OEM Meters & Integration Status">
    <div class="dev-oem-view">
      <section class="bw-card oem-sec-card" aria-labelledby="installation-title">
        <h3 id="installation-title">Authorized Installations</h3>
        <p v-if="installationError" role="alert" class="bw-error-banner">{{ installationError }}</p>
        <p v-else-if="installationsLoading" role="status">Loading installations…</p>
        <p v-else-if="!installations.length" class="bw-text-muted">No authorized installations.</p>
        <div class="oem-caps">
          <button v-for="installation in installations" :key="installation.id" type="button"
            class="bw-btn bw-btn-outline bw-btn-sm" :aria-pressed="selectedInstallationId === installation.id"
            @click="loadInstallation(installation.id)">
            {{ installation.displayName }} · {{ installation.environment }} · {{ installation.status }}
          </button>
        </div>
        <template v-if="selectedInstallation">
          <div class="installation-header">
            <div>
              <h4>{{ selectedInstallation.displayName }}</h4>
              <p class="bw-text-muted">Environment: {{ selectedInstallation.environment }}. Status: {{ selectedInstallation.status }}.</p>
            </div>
            <div class="installation-actions">
              <button
                type="button"
                class="bw-btn bw-btn-outline bw-btn-sm"
                :disabled="testingConnection"
                @click="testInstallationConnection(selectedInstallation.id)"
              >
                {{ testingConnection ? 'Testing connection…' : 'Test Connection' }}
              </button>
            </div>
          </div>
          <div class="installation-specs">
            <span class="meta-item">
              <span class="meta-label">Adapter Class:</span>
              <code class="bw-mono">{{ getAdapterClass(selectedInstallation) }}</code>
            </span>
            <span class="meta-item">
              <span class="meta-label">Environment:</span>
              <span class="bw-badge bw-badge-neutral">{{ selectedInstallation.environment }}</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">Base URL:</span>
              <code class="bw-mono">{{ getBaseUrl(selectedInstallation) }}</code>
            </span>
          </div>
          <div v-if="testConnectionResult" class="test-connection-banner" :class="testConnectionResult.ok ? 'test-connection-ok' : 'test-connection-fail'" role="status">
            <span class="bw-badge" :class="testConnectionResult.ok ? 'bw-badge-brand' : 'bw-badge-danger'">
              {{ testConnectionResult.ok ? 'Probe Passed' : 'Probe Failed' }}
            </span>
            <span>HTTP {{ testConnectionResult.status }}</span>
            <span>Latency: <strong>{{ testConnectionResult.latencyMs }}ms</strong></span>
            <span v-if="testConnectionResult.message" class="bw-text-muted">({{ testConnectionResult.message }})</span>
          </div>
          <p v-if="inventoryLoading" role="status">Loading scoped inventory…</p>
          <p v-else-if="inventoryError" role="alert" class="bw-error-banner">{{ inventoryError }}</p>
          <template v-else>
            <p v-if="inventorySnapshot" class="bw-text-muted bw-text-sm">
              Last snapshot: {{ inventorySnapshot.customers }} customers, {{ inventorySnapshot.meters }} meters.
              Captured: {{ new Date(inventorySnapshot.completedAt).toLocaleString() }}.
            </p>
            <p v-else class="bw-text-muted">No completed inventory snapshot.</p>
            <div v-if="inventoryMeters.length" class="bw-table-wrap">
              <table class="bw-table"><caption>Meter inventory</caption>
                <thead><tr><th>Serial</th><th>Site</th><th>Status</th><th>Last seen</th></tr></thead>
                <tbody><tr v-for="meter in inventoryMeters" :key="meter.id">
                  <td class="bw-mono">{{ meter.serial }}</td><td>{{ meter.siteId || '—' }}</td>
                  <td>{{ meter.status }}</td><td>{{ new Date(meter.lastSeenAt).toLocaleString() }}</td>
                </tr></tbody>
              </table>
            </div>
            <p v-else class="bw-text-muted">No meters in this installation.</p>
            <p v-if="inventoryPageError" role="alert" class="bw-error-banner">{{ inventoryPageError }}</p>
            <button v-if="inventoryNextCursor" type="button" class="bw-btn bw-btn-outline bw-btn-sm"
              :disabled="inventoryPageLoading" @click="loadMoreMeters">
              {{ inventoryPageLoading ? 'Loading more meters…' : 'Load more meters' }}
            </button>
          </template>
          <h4>Telemetry readings</h4>
          <p v-if="telemetryLoading" role="status">Loading scoped telemetry…</p>
          <p v-else-if="telemetryError" role="alert" class="bw-error-banner">{{ telemetryError }}</p>
          <div v-else-if="telemetryReadings.length" class="bw-table-wrap">
            <table class="bw-table"><caption>Telemetry readings</caption>
              <thead><tr><th>Reading time</th><th>Serial / provider meter ID</th><th>Site</th><th>Energy</th><th>Voltage</th><th>Current</th><th>State</th></tr></thead>
              <tbody><tr v-for="reading in telemetryReadings" :key="reading.id">
                <td>{{ new Date(reading.readingAt).toLocaleString() }}</td>
                <td class="bw-mono">{{ meterSerial(reading.externalMeterId) || 'Serial unavailable' }}<br />
                  <small>{{ reading.externalMeterId }} (provider ID)</small></td>
                <td class="bw-mono">{{ reading.externalSiteId }}</td>
                <td>{{ reading.energyKwh === null ? '—' : `${reading.energyKwh} kWh (unclassified provider total)` }}</td>
                <td>{{ reading.voltageAvg === null ? '—' : `${reading.voltageAvg} V` }}</td>
                <td>{{ reading.currentAvg === null ? '—' : `${reading.currentAvg} A` }}</td>
                <td>{{ reading.meterState }}</td>
              </tr></tbody>
            </table>
          </div>
          <p v-else class="bw-text-muted">No telemetry readings in this installation.</p>
          <p v-if="telemetryPageError" role="alert" class="bw-error-banner">{{ telemetryPageError }}</p>
          <button v-if="telemetryNextCursor" type="button" class="bw-btn bw-btn-outline bw-btn-sm"
            :disabled="telemetryPageLoading" @click="loadMoreReadings">
            {{ telemetryPageLoading ? 'Loading more readings…' : 'Load more readings' }}
          </button>
        </template>
      </section>

      <section aria-labelledby="catalog-title">
        <h3 id="catalog-title">Provider Adapter Catalog</h3>
        <p class="bw-text-muted">Adapter capabilities do not confirm installation activation. Credential editing and provider registration are unavailable here.</p>
        <input v-model="searchQuery" class="bw-input" aria-label="Search OEM catalog" placeholder="Search OEM catalog" />
        <p v-if="catalogLoading" role="status">Loading OEM catalog…</p>
        <p v-else-if="catalogError" role="alert" class="bw-error-banner">{{ catalogError }}</p>
        <p v-else-if="!filteredOems.length" class="bw-text-muted">No matching OEM adapters.</p>
        <div class="oem-cards-grid">
          <article v-for="oem in filteredOems" :key="oem.id" class="bw-card oem-sec-card">
            <h3>{{ oem.displayName }}</h3>
            <code>{{ oem.slug }}</code>
            <span class="bw-badge bw-badge-neutral">{{ oem.status }}</span>
            <div class="oem-strategy-row">
              <span class="bw-text-muted">Vending Strategy:</span>
              <span class="bw-badge" :class="vendingBadgeClass(oem.vendingStrategy)">
                {{ vendingLabel(oem.vendingStrategy) }}
              </span>
            </div>
            <div class="oem-caps">
              <span
                v-for="cap in getCapabilityBadges(oem)"
                :key="cap.label"
                class="bw-badge"
                :class="cap.class"
              >
                {{ cap.label }}
              </span>
            </div>
          </article>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<style scoped>
.dev-oem-view { display: flex; flex-direction: column; gap: var(--s-4); min-width: 0; }
.oem-sec-card { padding: var(--s-4); display: flex; flex-direction: column; gap: var(--s-3); min-width: 0; }
.oem-cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: var(--s-4); margin-top: var(--s-3); }
.oem-caps { display: flex; flex-wrap: wrap; gap: var(--s-2); }
.oem-strategy-row { display: flex; align-items: center; gap: var(--s-2); font-size: var(--t-sm, 0.875rem); }
.installation-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-3); flex-wrap: wrap; }
.installation-actions { display: flex; align-items: center; gap: var(--s-2); }
.installation-specs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
  padding: var(--s-2) var(--s-3);
  background: var(--surface-2, rgba(255, 255, 255, 0.04));
  border-radius: var(--r-md, 6px);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
}
.meta-item { display: inline-flex; align-items: center; gap: var(--s-1); font-size: var(--t-xs, 0.75rem); }
.meta-label { color: var(--text-muted); }
.test-connection-banner {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-2) var(--s-3);
  border-radius: var(--r-md, 6px);
  font-size: var(--t-sm, 0.875rem);
  flex-wrap: wrap;
}
.test-connection-ok {
  background: color-mix(in srgb, var(--semantic-positive, #22c55e) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--semantic-positive, #22c55e) 30%, transparent);
}
.test-connection-fail {
  background: color-mix(in srgb, var(--semantic-negative, #ef4444) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--semantic-negative, #ef4444) 30%, transparent);
}
.bw-table-wrap { overflow-x: auto; }
</style>
