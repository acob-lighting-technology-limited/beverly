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
interface OemInstallation { id: string; tenantId: string; displayName: string; status: string; environment: string }
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

/** Unknown strategies remain unavailable instead of implying credit support. */
function vendingLabel(strategy: OemManufacturer['vendingStrategy']): string {
  if (strategy === 'sts_token') return 'STS Token (Standard)';
  if (strategy === 'direct_credit') return 'Direct Credit';
  return 'Not available';
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
          <h4>{{ selectedInstallation.displayName }}</h4>
          <p class="bw-text-muted">Environment: {{ selectedInstallation.environment }}. Status: {{ selectedInstallation.status }}.</p>
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
            <div>Vending Strategy: <strong>{{ vendingLabel(oem.vendingStrategy) }}</strong></div>
            <div class="oem-caps">
              <template v-for="(enabled, capability) in oem.capabilities" :key="capability">
                <span v-if="enabled" class="bw-badge bw-badge-neutral">{{ String(capability).replace(/_/g, ' ') }}</span>
              </template>
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
.bw-table-wrap { overflow-x: auto; }
</style>
