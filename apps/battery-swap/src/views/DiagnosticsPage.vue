<template>
  <section class="live" aria-label="Battery diagnostics" data-testid="diagnostics-page">
    <header class="reg-head">
      <div>
        <h1 class="reg-title">Diagnostics</h1>
        <p class="reg-blurb">Charge, voltage, temperature and cell health for every battery, read live from the battery platform. A dash means the platform did not send that reading.</p>
      </div>
      <button type="button" class="reg-btn" :disabled="live.status === 'loading'" data-testid="diag-refresh" @click="live.refresh()">
        {{ live.status === 'loading' ? 'Refreshing…' : 'Refresh' }}
      </button>
    </header>

    <div v-if="live.error" class="reg-alert" role="alert" data-testid="diag-error">
      <span>Live battery data is unavailable: {{ live.error }}</span>
      <button type="button" class="reg-btn" @click="live.refresh()">Try again</button>
    </div>
    <p v-if="toast" class="reg-toast" role="status" data-testid="diag-toast">{{ toast }}</p>

    <div class="live-split live-split--diag">
      <aside class="live-list" aria-label="Batteries">
        <label class="reg-search">
          <span class="reg-sr">Search batteries</span>
          <input v-model="search" type="search" class="reg-input" placeholder="Search batteries" data-testid="diag-search" />
        </label>
        <p v-if="!filtered.length" class="reg-empty-note" data-testid="diag-empty">{{ search ? 'No matches.' : 'No batteries yet. Add them in the Batteries register.' }}</p>
        <button
          v-for="row in filtered"
          :key="row.key"
          type="button"
          :class="['live-item', `live-item--${row.level}`, live.selectedKey === row.key && 'is-selected']"
          :data-testid="`diag-item-${row.key}`"
          @click="live.select(row.key)"
        >
          <span class="live-item-name">{{ nameOf(row) }}</span>
          <span class="live-item-meta">{{ row.live ? `${show(row.live.soc, '%')} · ${onlineText(row.live.online)}` : 'No live reading' }}</span>
          <span v-for="alert in row.alerts" :key="alert.code" :class="['reg-badge', alert.level === 'critical' ? 'reg-badge--lost' : 'reg-badge--maintenance']">{{ alert.text }}</span>
        </button>
      </aside>

      <div class="live-detail" data-testid="diag-detail">
        <p v-if="!live.selected" class="reg-empty-note">Choose a battery to see its readings.</p>
        <template v-else>
          <h2 class="live-detail-title">{{ nameOf(live.selected) }}</h2>
          <p class="reg-help">
            Serial {{ live.selected.registry?.serial_number ?? live.selected.live?.serialNumber ?? '—' }} ·
            {{ live.selected.registered ? `Register status: ${live.selected.registry.status.replace(/_/g, ' ')}` : 'Not in the battery register' }}
          </p>

          <p v-if="!live.selected.live" class="reg-alert" data-testid="diag-no-live">The platform has no live reading for this battery.</p>

          <template v-else>
            <ul v-if="live.selected.alerts.length" class="live-alerts" aria-label="Alerts">
              <li v-for="alert in live.selected.alerts" :key="alert.code" :class="`live-alert--${alert.level}`">{{ alert.text }}</li>
            </ul>
            <p v-else class="reg-help">No alerts from the readings received.</p>

            <dl class="live-metrics">
              <div><dt>Charge</dt><dd data-testid="metric-soc">{{ show(live.selected.live.soc, '%') }}</dd></div>
              <div><dt>Voltage</dt><dd>{{ show(live.selected.live.voltageV, ' V') }}</dd></div>
              <div><dt>Current</dt><dd>{{ show(live.selected.live.currentA, ' A') }}</dd></div>
              <div><dt>Temperature</dt><dd>{{ show(live.selected.live.tempC, ' °C') }}</dd></div>
              <div><dt>Capacity</dt><dd>{{ show(live.selected.live.capacityAh, ' Ah') }}</dd></div>
              <div><dt>Charge cycles</dt><dd>{{ show(live.selected.live.cycleCount) }}</dd></div>
              <div><dt>Cells</dt><dd>{{ show(live.selected.live.cellCount) }}</dd></div>
              <div><dt>Distance</dt><dd>{{ show(live.selected.live.distanceKm, ' km') }}</dd></div>
              <div><dt>Signal</dt><dd>{{ show(live.selected.live.signal) }}</dd></div>
              <div><dt>Position</dt><dd>{{ position(live.selected.live) }}</dd></div>
              <div><dt>Last update</dt><dd>{{ live.selected.live.updatedAt ? new Date(live.selected.live.updatedAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' }) : '—' }}</dd></div>
              <div><dt>Motor power</dt><dd>{{ fetText(live.selected.live.dischargeFet) }}</dd></div>
            </dl>

            <h3 class="live-sub">Cell voltages</h3>
            <template v-if="live.selected.live.cellVoltages">
              <p class="reg-help">Lowest {{ Math.min(...live.selected.live.cellVoltages).toFixed(3) }} V · highest {{ Math.max(...live.selected.live.cellVoltages).toFixed(3) }} V · difference {{ (Math.max(...live.selected.live.cellVoltages) - Math.min(...live.selected.live.cellVoltages)).toFixed(3) }} V</p>
              <ol class="live-cells" data-testid="diag-cells">
                <li v-for="(volts, i) in live.selected.live.cellVoltages" :key="i" :class="cellClass(volts)"><span>{{ i + 1 }}</span>{{ volts.toFixed(3) }} V</li>
              </ol>
            </template>
            <p v-else class="reg-help" data-testid="diag-no-cells">The platform response did not include per-cell voltages, so they are not shown. Check "Platform data" below to see what it did send.</p>

            <div v-if="canEdit" class="live-actions">
              <button type="button" class="reg-btn" data-testid="action-reboot" @click="openAction('reboot')">Reboot communication unit</button>
              <button v-if="live.selected.live.dischargeFet !== false" type="button" class="reg-btn" data-testid="action-cut" @click="openAction('cut')">Cut motor power</button>
              <button v-else type="button" class="reg-btn reg-btn--primary" data-testid="action-restore" @click="openAction('restore')">Restore motor power</button>
            </div>

            <details class="live-raw">
              <summary>Platform data (for checking the field mapping)</summary>
              <p class="reg-help">Which platform field each reading came from. Anything marked "not found" was not in the response.</p>
              <ul class="live-sources">
                <li v-for="(key, field) in live.selected.live.sources" :key="field"><code>{{ field }}</code> ← {{ key ? key : 'not found' }}</li>
              </ul>
              <p class="reg-help">Fields we do not read: {{ live.selected.live.unmapped.length ? live.selected.live.unmapped.join(', ') : 'none' }}</p>
              <pre class="live-json" data-testid="diag-raw">{{ JSON.stringify(live.selected.raw, null, 2) }}</pre>
            </details>
          </template>
        </template>
      </div>
    </div>

    <div v-if="action" class="reg-overlay" @click.self="action = null" @keydown.esc="action = null">
      <form class="reg-dialog" role="dialog" aria-modal="true" aria-labelledby="action-title" data-testid="action-form" novalidate @submit.prevent="runAction">
        <h2 id="action-title" class="reg-dialog-title">{{ actionTitle }}</h2>
        <p class="reg-help">{{ actionWarning }}</p>
        <div class="reg-field">
          <label class="reg-label" for="action-reason">Reason <span class="reg-req" aria-hidden="true">*</span></label>
          <input id="action-reason" v-model="reason" class="reg-input" autocomplete="off" data-testid="action-reason" />
        </div>
        <ul v-if="problem" class="reg-problems" role="alert" data-testid="action-problem"><li>{{ problem }}</li></ul>
        <div class="reg-dialog-actions">
          <button type="button" class="reg-btn" @click="action = null">Cancel</button>
          <button type="submit" class="reg-btn reg-btn--primary" :disabled="busy" data-testid="action-confirm">{{ busy ? 'Sending…' : 'Send command' }}</button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup>
/**
 * Battery diagnostics. Readings are what the platform sent; a dash means nothing was sent.
 * Commands go through the server gateway and are reported done only when Yunhe confirms.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { usePueLiveStore } from "../stores/pue-live-store.js";
import { useBatterySwapAuthStore } from "../stores/auth";

const live = usePueLiveStore();
const auth = useBatterySwapAuthStore();
const OPERATOR_ROLES = ["super-admin", "operations-manager", "operations-officer"];
const canEdit = computed(() => OPERATOR_ROLES.includes(auth.user?.role ?? ""));

const search = ref("");
const toast = ref("");
const action = ref(null);
const reason = ref("");
const problem = ref("");
const busy = ref(false);
let timer = null;
let toastTimer = null;

const nameOf = (row) => row.registry?.battery_number ?? row.live?.batteryNumber ?? row.live?.serialNumber ?? "Unknown battery";
const onlineText = (online) => (online === true ? "Online" : online === false ? "Offline" : "Status unknown");
const show = (value, unit = "") => (value === null || value === undefined ? "—" : `${value}${unit}`);
const fetText = (value) => (value === true ? "On" : value === false ? "Off" : "—");
const position = (item) => (item.lat === null || item.lng === null ? "—" : `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)} (may be approximate)`);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return live.rows;
  return live.rows.filter((row) => [nameOf(row), row.registry?.serial_number, row.live?.serialNumber].some((value) => String(value ?? "").toLowerCase().includes(q)));
});

/** Cells further than the alert threshold from the pack's mean are marked. */
function cellClass(volts) {
  const cells = live.selected?.live?.cellVoltages ?? [];
  const mean = cells.reduce((sum, v) => sum + v, 0) / (cells.length || 1);
  return Math.abs(volts - mean) >= live.thresholds.cellDeltaV / 2 ? "is-off" : "";
}

const ACTIONS = {
  reboot: { title: "Reboot communication unit", warning: "The battery's tracker restarts and may be offline for a short while. The battery keeps working." },
  cut: { title: "Cut motor power", warning: "The bike loses power. Only do this when the bike is stopped and the rider has been told. It is recorded against your name." },
  restore: { title: "Restore motor power", warning: "The bike can be ridden again. It is recorded against your name." }
};
const actionTitle = computed(() => ACTIONS[action.value]?.title ?? "");
const actionWarning = computed(() => ACTIONS[action.value]?.warning ?? "");

function openAction(kind) {
  action.value = kind;
  reason.value = "";
  problem.value = "";
}

function flash(message) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = ""; }, 6000);
}

async function runAction() {
  if (reason.value.trim().length < 3) { problem.value = "Give a reason (at least 3 characters)."; return; }
  busy.value = true;
  problem.value = "";
  const row = live.selected;
  try {
    if (action.value === "reboot") await live.reboot(row, reason.value.trim());
    else await live.setMotorPower(row, action.value === "restore", reason.value.trim());
    action.value = null;
    flash("Yunhe confirmed the command. The readings above are the latest from the platform.");
  } catch (failure) {
    // Nothing changed: show exactly why.
    problem.value = `Not sent: ${failure.message}`;
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  live.refresh();
  timer = setInterval(() => live.refresh(), 60000);
});
onBeforeUnmount(() => { clearInterval(timer); clearTimeout(toastTimer); });
</script>
