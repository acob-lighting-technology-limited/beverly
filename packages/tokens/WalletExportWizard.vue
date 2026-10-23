<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { buildDailyCsvZip, exportTimestamp, printPdf, rowsToCsv, type WalletExportColumn, type WalletExportMeta } from './wallet-export';
import type { WalletExportOption, WalletExportSelection } from './wallet-export-wizard';

const props = withDefaults(defineProps<{
  rows: T[];
  columns: WalletExportColumn<T>[];
  filename: string;
  title: string;
  subtitle?: string;
  meta?: WalletExportMeta[];
  loading?: boolean;
  label?: string;
  formats?: Array<'csv' | 'pdf'>;
  statusOptions?: WalletExportOption[];
  stationOptions?: WalletExportOption[];
  actorOptions?: WalletExportOption[];
  showActorTypeSelector?: boolean;
  statusLabel?: string;
  stationLabel?: string;
  actorLabel?: string;
  allStatusLabel?: string;
  allStationLabel?: string;
  allActorLabel?: string;
  hoverTitle?: string;
  hoverDescription?: string;
  initialStatus?: string;
  initialStation?: string;
  initialActor?: string;
  initialSince?: string;
  initialUntil?: string;
  dateValue?: (row: T) => string | null | undefined;
  statusValue?: (row: T) => string | null | undefined;
  stationValue?: (row: T) => string | null | undefined;
  actorValue?: (row: T) => string | null | undefined;
  resolveRows?: (selection: WalletExportSelection) => Promise<T[]>;
  allowDailyCsvArchive?: boolean;
}>(), {
  subtitle: '',
  meta: () => [],
  loading: false,
  label: 'Export',
  formats: () => ['csv', 'pdf'],
  statusOptions: () => [],
  stationOptions: () => [],
  actorOptions: () => [],
  showActorTypeSelector: false,
  statusLabel: 'Transaction status',
  stationLabel: 'StationID',
  actorLabel: 'Vendor or customer',
  allStatusLabel: 'All statuses',
  allStationLabel: 'All stations',
  allActorLabel: 'All vendors and customers',
  hoverTitle: 'Choose export contents',
  hoverDescription: 'Dates, status, station, actor.',
  initialStatus: '',
  initialStation: '',
  initialActor: '',
  initialSince: '',
  initialUntil: '',
  allowDailyCsvArchive: false,
});

const emit = defineEmits<{
  (event: 'success', payload: { format: 'csv' | 'pdf'; count: number; selection: WalletExportSelection }): void;
  (event: 'error', error: Error): void;
}>();

const open = ref(false);
const step = ref(1);
const busy = ref(false);
const message = ref('');
const downloadUrl = ref('');
const downloadFilename = ref('');
const preparedCount = ref(0);
const preparedSelection = ref<WalletExportSelection | null>(null);
const format = ref<'csv' | 'pdf'>(props.formats[0] ?? 'pdf');
const csvDelivery = ref<'single' | 'daily-zip'>('single');
const since = ref(props.initialSince);
const until = ref(props.initialUntil);
const status = ref(props.initialStatus);
const station = ref(props.initialStation);
const actor = ref(props.initialActor);
const actorType = ref<'' | 'vendor' | 'customer'>('');
const actorQuery = ref('');
const selectedColumns = ref<string[]>(props.columns.map((column) => column.key));

const disabled = computed(() => props.loading || busy.value || (props.rows.length === 0 && !props.resolveRows));
const fieldActorType = computed(() => actor.value.startsWith('vendor:') ? 'vendor'
  : actor.value.startsWith('customer:') ? 'customer' : actorType.value);
const availableColumns = computed(() => props.columns.filter((column) =>
  !fieldActorType.value || !column.actorTypes?.length || column.actorTypes.includes(fieldActorType.value)));
const chosenColumns = computed(() => availableColumns.value.filter((column) => selectedColumns.value.includes(column.key)));
const matchingActorOptions = computed(() => {
  const query = actorQuery.value.trim().toLocaleLowerCase();
  return props.actorOptions.filter((option) =>
    (!actorType.value || option.value.startsWith(`${actorType.value}:`))
    && (!query || `${option.label} ${option.description ?? ''}`.toLocaleLowerCase().includes(query)));
});
const hasDeliveryStep = computed(() => props.allowDailyCsvArchive && Boolean(props.dateValue) && format.value === 'csv' && props.formats.includes('csv'));
const selectedScopeCount = computed(() => [since.value || until.value, status.value, station.value, actorType.value, actor.value].filter(Boolean).length);
const scopeSummary = computed(() => {
  const labels = [
    props.stationOptions.length ? (station.value ? props.stationOptions.find((item) => item.value === station.value)?.label : props.allStationLabel) : '',
    props.statusOptions.length ? (status.value ? props.statusOptions.find((item) => item.value === status.value)?.label : props.allStatusLabel) : '',
    props.showActorTypeSelector || props.actorOptions.length
      ? (actor.value ? props.actorOptions.find((item) => item.value === actor.value)?.label
        : actorType.value === 'vendor' ? 'All vendors' : actorType.value === 'customer' ? 'All customers' : props.allActorLabel) : '',
  ];
  return labels.filter(Boolean).join(' · ');
});

function reset() {
  clearDownload();
  step.value = 1;
  format.value = props.formats[0] ?? 'pdf';
  csvDelivery.value = 'single';
  since.value = props.initialSince;
  until.value = props.initialUntil;
  status.value = props.initialStatus;
  station.value = props.initialStation;
  actor.value = props.initialActor;
  actorType.value = props.showActorTypeSelector && props.initialActor.startsWith('vendor:') ? 'vendor'
    : props.showActorTypeSelector && props.initialActor.startsWith('customer:') ? 'customer' : '';
  actorQuery.value = '';
  selectedColumns.value = props.columns.map((column) => column.key);
  message.value = '';
}

function show() {
  if (disabled.value) return;
  reset();
  open.value = true;
}

function close() {
  if (!busy.value) {
    open.value = false;
    clearDownload();
  }
}

function clearDownload() {
  if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value);
  downloadUrl.value = '';
  downloadFilename.value = '';
  preparedSelection.value = null;
}

function goBack() {
  clearDownload();
  message.value = '';
  step.value--;
}

function onDownload() {
  message.value = 'Download requested. Check your browser downloads.';
  if (preparedSelection.value) emit('success', { format: 'csv', count: preparedCount.value, selection: preparedSelection.value });
}

function selectActorType(value: '' | 'vendor' | 'customer') {
  actorType.value = value;
  actor.value = '';
  actorQuery.value = '';
  selectedColumns.value = availableColumns.value.map((column) => column.key);
  message.value = '';
}

function toggleColumn(key: string) {
  selectedColumns.value = selectedColumns.value.includes(key)
    ? selectedColumns.value.filter((item) => item !== key)
    : [...selectedColumns.value, key];
}

function rowMatches(row: T) {
  const date = props.dateValue?.(row);
  const rowStatus = props.statusValue?.(row);
  const rowStation = props.stationValue?.(row);
  const rowActor = props.actorValue?.(row);
  if ((since.value || until.value) && (!date || Number.isNaN(new Date(date).getTime()))) return false;
  if (since.value && date && new Date(date) < new Date(`${since.value}T00:00:00`)) return false;
  if (until.value && date && new Date(date) > new Date(`${until.value}T23:59:59.999`)) return false;
  if (status.value && String(rowStatus ?? '') !== status.value) return false;
  if (station.value && String(rowStation ?? '') !== station.value) return false;
  if (actorType.value && !String(rowActor ?? '').startsWith(`${actorType.value}:`)) return false;
  if (actor.value && String(rowActor ?? '') !== actor.value) return false;
  return true;
}

function selection(): WalletExportSelection {
  return {
    format: format.value,
    csvDelivery: csvDelivery.value,
    since: since.value,
    until: until.value,
    status: status.value,
    station: station.value,
    actor: actor.value,
    actorType: actorType.value,
    columnKeys: chosenColumns.value.map((column) => column.key),
  };
}

async function run() {
  if (!chosenColumns.value.length) {
    message.value = 'Select at least one field.';
    return;
  }
  if (since.value && until.value && since.value > until.value) {
    message.value = 'Start date must precede end date.';
    return;
  }
  busy.value = true;
  message.value = '';
  try {
    const currentSelection = selection();
    const sourceRows = props.resolveRows ? await props.resolveRows(currentSelection) : props.rows;
    const exportRows = props.resolveRows ? sourceRows : sourceRows.filter(rowMatches);
    if (!exportRows.length) {
      step.value = 1;
      message.value = 'No records match these filters. Change the available scope options.';
      return;
    }
    const scopeMeta = [
      ...props.meta,
      { label: 'Scope', value: scopeSummary.value },
      { label: 'Coverage', value: props.resolveRows ? 'All matching records' : 'Loaded records only' },
      { label: 'Period', value: since.value || until.value ? `${since.value || 'First record'} to ${until.value || 'Latest record'}` : props.resolveRows ? 'All dates' : 'All loaded dates' },
      { label: 'Records', value: String(exportRows.length) },
    ];
    if (format.value === 'csv') {
      const daily = csvDelivery.value === 'daily-zip';
      if (daily && !props.dateValue) throw new Error('Daily exports require dated records.');
      const blob = daily
        ? new Blob([buildDailyCsvZip(props.filename, exportRows, chosenColumns.value, props.dateValue!)], { type: 'application/zip' })
        : new Blob(['\uFEFF' + rowsToCsv(exportRows, chosenColumns.value)], { type: 'text/csv;charset=utf-8;' });
      clearDownload();
      downloadFilename.value = `${props.filename}${daily ? '-daily' : ''}-${exportTimestamp()}.${daily ? 'zip' : 'csv'}`;
      downloadUrl.value = URL.createObjectURL(blob);
      preparedCount.value = exportRows.length;
      preparedSelection.value = currentSelection;
      message.value = `${exportRows.length} records ready. Select Download ${daily ? 'ZIP' : 'CSV'}.`;
    } else {
      printPdf({ title: props.title, subtitle: props.subtitle, rows: exportRows, columns: chosenColumns.value, meta: scopeMeta });
      emit('success', { format: 'pdf', count: exportRows.length, selection: currentSelection });
      close();
    }
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error('Export failed.');
    message.value = error.message;
    emit('error', error);
  } finally {
    busy.value = false;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) close();
}

watch(() => props.columns, (columns) => {
  if (!open.value) selectedColumns.value = columns.map((column) => column.key);
});
watch(actor, () => {
  if (open.value) selectedColumns.value = availableColumns.value.map((column) => column.key);
});

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => { document.removeEventListener('keydown', onKeydown); clearDownload(); });
</script>

<template>
  <div class="bw-export-wizard-root">
    <button
      type="button"
      class="bw-btn bw-export-wizard-trigger"
      :disabled="disabled"
      aria-haspopup="dialog"
      @click="show"
    >
      {{ busy ? 'Exporting…' : label }}
      <span v-if="selectedScopeCount" class="bw-export-scope-count">{{ selectedScopeCount }}</span>
    </button>
    <div class="bw-export-hover-card" role="tooltip">
      <strong>{{ hoverTitle }}</strong>
      <span>{{ hoverDescription }}</span>
      <span>Then choose fields{{ formats.length > 1 ? ' and format' : '' }}.</span>
    </div>

    <Teleport to="body">
      <Transition name="bw-export-modal">
        <div v-if="open" class="bw-export-scrim" @click.self="close">
          <section class="bw-export-dialog" role="dialog" aria-modal="true" :aria-label="`${title} export`">
            <header class="bw-export-dialog-head">
              <div>
                <span class="bw-export-kicker">Export builder</span>
                <h2>{{ title }}</h2>
                <p>{{ subtitle || 'Choose exact export contents.' }}</p>
              </div>
              <button type="button" class="bw-export-close" aria-label="Close export builder" @click="close">×</button>
            </header>

            <ol class="bw-export-steps" :class="{ 'has-delivery': hasDeliveryStep }" aria-label="Export steps">
              <li v-for="number in (hasDeliveryStep ? 4 : 3)" :key="number" :class="{ active: step === number, done: step > number }">
                <span>{{ number }}</span>
                {{ number === 1 ? 'Scope' : number === 2 ? 'Fields' : number === 3 ? 'Format' : 'Delivery' }}
              </li>
            </ol>

            <div v-if="step === 1" class="bw-export-step-panel">
              <h3>Choose record scope</h3>
              <div class="bw-export-form-grid">
                <label v-if="dateValue"><span>Start date</span><input v-model="since" type="date" class="bw-input" /></label>
                <label v-if="dateValue"><span>End date</span><input v-model="until" type="date" class="bw-input" /></label>
                <label v-if="statusOptions.length"><span>{{ statusLabel }}</span><select v-model="status" class="bw-select"><option value="">{{ allStatusLabel }}</option><option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
                <label v-if="stationOptions.length"><span>{{ stationLabel }}</span><select v-model="station" class="bw-select"><option value="">{{ allStationLabel }}</option><option v-for="option in stationOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
                <div v-if="showActorTypeSelector || actorOptions.length" class="wide bw-export-actor-scope">
                  <label v-if="showActorTypeSelector"><span>Account type</span><select :value="actorType" class="bw-select" @change="selectActorType(($event.target as HTMLSelectElement).value as '' | 'vendor' | 'customer')"><option value="">All vendors and customers</option><option value="vendor">Vendors</option><option value="customer">Customers</option></select></label>
                  <template v-if="actorOptions.length">
                    <label><span>Search {{ actorLabel.toLocaleLowerCase() }}</span><input v-model="actorQuery" class="bw-input" type="search" :placeholder="actorType === 'vendor' ? 'Search vendors' : actorType === 'customer' ? 'Search customers' : 'Search vendors or customers'" @input="actor = ''" /><small v-if="actorQuery">{{ matchingActorOptions.length }} matches</small></label>
                    <label><span>{{ actorLabel }}</span><select v-model="actor" class="bw-select"><option value="">{{ actorType === 'vendor' ? 'All vendors' : actorType === 'customer' ? 'All customers' : allActorLabel }}</option><option v-for="option in matchingActorOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
                  </template>
                </div>
                <p v-if="!resolveRows" class="bw-export-coverage-note">This export includes loaded records only.</p>
              </div>
            </div>

            <div v-else-if="step === 2" class="bw-export-step-panel">
              <div class="bw-export-step-title">
                <div><h3>Choose exported fields</h3><p>{{ chosenColumns.length }} fields selected for {{ fieldActorType === 'vendor' ? 'vendors' : fieldActorType === 'customer' ? 'customers' : 'all accounts' }}.</p></div>
                <div class="bw-export-inline-actions"><button type="button" class="bw-btn sm" @click="selectedColumns = availableColumns.map(column => column.key)">Select all</button><button type="button" class="bw-btn sm" @click="selectedColumns = []">Clear</button></div>
              </div>
              <p v-if="scopeSummary" class="bw-export-field-scope">{{ scopeSummary }}</p>
              <div class="bw-export-field-grid">
                <label v-for="column in availableColumns" :key="column.key" :class="{ selected: selectedColumns.includes(column.key) }">
                  <input type="checkbox" :checked="selectedColumns.includes(column.key)" @change="toggleColumn(column.key)" />
                  <span>{{ column.header }}</span>
                </label>
              </div>
            </div>

            <div v-else-if="step === 3" class="bw-export-step-panel">
              <h3>Choose export format</h3>
              <div class="bw-export-format-grid">
                <button v-if="formats.includes('csv')" type="button" :class="{ selected: format === 'csv' }" @click="format = 'csv'"><strong>CSV</strong><span>Power BI and spreadsheets</span></button>
                <button v-if="formats.includes('pdf')" type="button" :class="{ selected: format === 'pdf' }" @click="format = 'pdf'"><strong>PDF</strong><span>Printable Beverly report</span></button>
              </div>
              <dl class="bw-export-review">
                <div><dt>Scope</dt><dd>{{ scopeSummary }}</dd></div>
                <div><dt>Fields</dt><dd>{{ chosenColumns.length }} selected</dd></div>
                <div><dt>Source</dt><dd>{{ resolveRows ? 'Complete filtered dataset' : `${rows.length} loaded records` }}</dd></div>
              </dl>
            </div>

            <div v-else class="bw-export-step-panel">
              <h3>Choose CSV delivery</h3>
              <fieldset class="bw-export-csv-delivery">
                <legend>CSV delivery</legend>
                <label :class="{ selected: csvDelivery === 'single' }"><input v-model="csvDelivery" type="radio" value="single" /> One combined CSV</label>
                <label :class="{ selected: csvDelivery === 'daily-zip' }"><input v-model="csvDelivery" type="radio" value="daily-zip" /> One CSV per day, zipped</label>
                <small v-if="csvDelivery === 'daily-zip'">Dates use your local time.</small>
              </fieldset>
            </div>

            <p v-if="message" class="bw-export-message" role="status">{{ message }}</p>
            <footer class="bw-export-dialog-actions">
              <button type="button" class="bw-btn" @click="step === 1 ? close() : goBack()">{{ step === 1 ? 'Cancel' : 'Back' }}</button>
              <a v-if="downloadUrl" class="bw-btn primary" :href="downloadUrl" :download="downloadFilename" @click="onDownload">Download {{ csvDelivery === 'daily-zip' ? 'ZIP' : 'CSV' }}</a>
              <button v-else-if="step < 3 || (step === 3 && hasDeliveryStep)" type="button" class="bw-btn primary" :disabled="step === 2 && !chosenColumns.length" @click="message = ''; step++">Continue</button>
              <button v-else type="button" class="bw-btn primary" :disabled="busy || !chosenColumns.length" @click="run">{{ busy ? 'Preparing…' : `Prepare ${format.toUpperCase()}` }}</button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>
    <span class="bw-sr-only" aria-live="polite">{{ message }}</span>
  </div>
</template>

<style scoped>
.bw-export-form-grid label.wide { display:grid; gap:var(--s-2); }
.bw-export-form-grid label.wide small { color:var(--text-muted); font-size:var(--t-xs); }
.bw-export-actor-scope { display:grid; gap:var(--s-3); }
.bw-export-actor-scope label { display:grid; gap:var(--s-2); }
.bw-export-coverage-note { color:var(--text-muted); font-size:var(--t-xs); margin:var(--s-3) 0 0; }
.bw-export-field-scope { color:var(--text-muted); font-size:var(--t-sm); margin:0 0 var(--s-3); }
.bw-export-csv-delivery { display:grid; gap:var(--s-2); margin-top:var(--s-4); border:1px solid var(--border); border-radius:var(--r-md); padding:var(--s-3); }
.bw-export-csv-delivery legend { color:var(--text-muted); font-size:var(--t-xs); font-weight:700; padding:0 var(--s-1); text-transform:uppercase; letter-spacing:.06em; }
.bw-export-csv-delivery label { display:flex; gap:var(--s-2); align-items:center; cursor:pointer; }
.bw-export-csv-delivery small { color:var(--text-muted); }
</style>
