<template>
  <section class="reg" aria-label="Appliance faults" data-testid="appliance-faults-page">
    <header class="reg-head">
      <div>
        <h1 class="reg-title">Faults and service</h1>
        <p class="reg-blurb">Problems reported on appliance units, from first report to fix.</p>
      </div>
      <button v-if="canEdit" type="button" class="reg-btn reg-btn--primary" data-testid="fault-add" @click="openReport">Report a fault</button>
    </header>

    <div class="reg-tools">
      <label class="reg-search">
        <span class="reg-sr">Filter by status</span>
        <select v-model="statusFilter" class="reg-input" data-testid="fault-filter" @change="reload">
          <option value="">All faults</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </label>
      <span class="reg-count" aria-live="polite">{{ store.faults.total }} {{ store.faults.total === 1 ? 'fault' : 'faults' }}</span>
    </div>

    <p v-if="toast" class="reg-toast" role="status" data-testid="fault-toast">{{ toast }}</p>
    <div v-if="store.faultsError" class="reg-alert" role="alert" data-testid="fault-error">
      <span>{{ store.faultsError }}</span>
      <button type="button" class="reg-btn" @click="reload">Try again</button>
    </div>

    <div class="reg-table-wrap">
      <table class="reg-table">
        <thead>
          <tr><th scope="col">Appliance</th><th scope="col">Problem</th><th scope="col">Severity</th><th scope="col">Status</th><th scope="col">Reported</th><th scope="col"><span class="reg-sr">Actions</span></th></tr>
        </thead>
        <tbody v-if="store.faultsLoading">
          <tr v-for="n in 5" :key="n" aria-hidden="true"><td v-for="c in 6" :key="c"><span class="reg-skeleton" /></td></tr>
        </tbody>
        <tbody v-else-if="store.faults.items.length">
          <tr v-for="fault in store.faults.items" :key="fault.id" :data-testid="`fault-row-${fault.id}`">
            <td>{{ fault.pue_appliances?.pue_appliance_types?.name ?? '—' }}<br /><small class="reg-help">{{ fault.pue_appliances?.serial_number ?? '' }}</small></td>
            <td class="fault-summary">{{ fault.summary }}<template v-if="fault.resolution"><br /><small class="reg-help">Fix: {{ fault.resolution }}</small></template></td>
            <td><span :class="['reg-badge', fault.severity === 'high' ? 'reg-badge--lost' : '']">{{ fault.severity }}</span></td>
            <td><span :class="['reg-badge', `reg-badge--${fault.status}`]">{{ fault.status.replace('_', ' ') }}</span></td>
            <td>{{ new Date(fault.created_at).toLocaleDateString() }}</td>
            <td class="reg-actions">
              <button v-if="canEdit && fault.status !== 'resolved'" type="button" class="reg-btn" :data-testid="`fault-update-${fault.id}`" @click="openUpdate(fault)">Update</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!store.faultsLoading && !store.faults.items.length && !store.faultsError" class="reg-empty" data-testid="fault-empty">
        <p class="reg-empty-title">{{ statusFilter ? 'No faults with that status' : 'No faults reported' }}</p>
        <p class="reg-empty-note">When an appliance has a problem, report it here so it can be followed to a fix.</p>
      </div>
    </div>

    <nav v-if="pageCount > 1" class="reg-pager" aria-label="Pages">
      <button type="button" class="reg-btn" :disabled="page <= 1" @click="goTo(page - 1)">Previous</button>
      <span>Page {{ page }} of {{ pageCount }}</span>
      <button type="button" class="reg-btn" :disabled="page >= pageCount" @click="goTo(page + 1)">Next</button>
    </nav>

    <div v-if="mode" class="reg-overlay" @click.self="mode = null" @keydown.esc="mode = null">
      <form class="reg-dialog" role="dialog" aria-modal="true" aria-labelledby="fault-title" :data-testid="mode === 'report' ? 'fault-report-form' : 'fault-update-form'" novalidate @submit.prevent="submit">
        <h2 id="fault-title" class="reg-dialog-title">{{ mode === 'report' ? 'Report a fault' : 'Update fault' }}</h2>
        <template v-if="mode === 'report'">
          <div class="reg-field">
            <label class="reg-label" for="fault-unit">Appliance unit <span class="reg-req" aria-hidden="true">*</span></label>
            <select id="fault-unit" v-model="report.applianceId" class="reg-input" data-testid="fault-unit">
              <option value="">Choose…</option>
              <option v-for="u in unitChoices" :key="u.id" :value="u.id">{{ u.label }}</option>
            </select>
          </div>
          <div class="reg-field">
            <label class="reg-label" for="fault-summary">What is wrong? <span class="reg-req" aria-hidden="true">*</span></label>
            <input id="fault-summary" v-model="report.summary" class="reg-input" autocomplete="off" data-testid="fault-summary" />
          </div>
          <div class="reg-field">
            <label class="reg-label" for="fault-severity">Severity</label>
            <select id="fault-severity" v-model="report.severity" class="reg-input" data-testid="fault-severity">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
        </template>
        <template v-else>
          <div class="reg-field">
            <label class="reg-label" for="fault-status">Status</label>
            <select id="fault-status" v-model="update.status" class="reg-input" data-testid="fault-status">
              <option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option>
            </select>
          </div>
          <div v-if="update.status === 'resolved'" class="reg-field">
            <label class="reg-label" for="fault-resolution">How was it fixed? <span class="reg-req" aria-hidden="true">*</span></label>
            <input id="fault-resolution" v-model="update.resolution" class="reg-input" autocomplete="off" data-testid="fault-resolution" />
          </div>
        </template>
        <ul v-if="problems.length" class="reg-problems" role="alert" data-testid="fault-problems"><li v-for="p in problems" :key="p">{{ p }}</li></ul>
        <div class="reg-dialog-actions">
          <button type="button" class="reg-btn" @click="mode = null">Cancel</button>
          <button type="submit" class="reg-btn reg-btn--primary" :disabled="saving" data-testid="fault-save">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup>
/** Appliance faults: report, follow and resolve. Server data only. */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { usePueAppliancesStore } from "../stores/pue-appliances-store.js";
import { usePueRegistryStore } from "../stores/pue-registry-store.js";
import { useBatterySwapAuthStore } from "../stores/auth";
import { recordLabel } from "../services/registry-config.js";

const store = usePueAppliancesStore();
const registry = usePueRegistryStore();
const auth = useBatterySwapAuthStore();
const OPERATOR_ROLES = ["super-admin", "operations-manager", "operations-officer"];
const canEdit = computed(() => OPERATOR_ROLES.includes(auth.user?.role ?? ""));

const statusFilter = ref("");
const page = ref(1);
const pageCount = computed(() => Math.max(1, Math.ceil(store.faults.total / 25)));
const mode = ref(null);
const saving = ref(false);
const problems = ref([]);
const toast = ref("");
const report = reactive({ applianceId: "", summary: "", severity: "medium" });
const update = reactive({ id: "", status: "in_progress", resolution: "" });
let toastTimer = null;

const unitChoices = computed(() => (registry.options["appliance-units"] ?? []).map((u) => ({ id: u.id, label: recordLabel("appliance-units", u) })));
const reload = () => store.loadFaults({ page: page.value, status: statusFilter.value });
function goTo(next) { page.value = next; reload(); }
function flash(message) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = ""; }, 4000);
}

async function openReport() {
  Object.assign(report, { applianceId: "", summary: "", severity: "medium" });
  problems.value = [];
  mode.value = "report";
  await Promise.all([registry.loadOptions("appliance-units"), registry.loadOptions("appliance-types")]);
}
function openUpdate(fault) {
  Object.assign(update, { id: fault.id, status: fault.status === "open" ? "in_progress" : "resolved", resolution: "" });
  problems.value = [];
  mode.value = "update";
}

async function submit() {
  problems.value = [];
  if (mode.value === "report") {
    if (!report.applianceId) problems.value.push("Choose an appliance unit.");
    if (report.summary.trim().length < 3) problems.value.push("Say what is wrong (at least 3 characters).");
    if (problems.value.length) return;
    saving.value = true;
    try {
      await store.reportFault({ applianceId: report.applianceId, summary: report.summary.trim(), severity: report.severity });
      mode.value = null;
      flash("Fault reported.");
      await reload();
    } catch (failure) { problems.value = [failure.message]; } finally { saving.value = false; }
    return;
  }
  if (update.status === "resolved" && !update.resolution.trim()) { problems.value = ["Say how the fault was fixed."]; return; }
  saving.value = true;
  try {
    await store.updateFault(update.id, { status: update.status, resolution: update.status === "resolved" ? update.resolution.trim() : null });
    mode.value = null;
    flash("Fault updated.");
    await reload();
  } catch (failure) { problems.value = [failure.message]; } finally { saving.value = false; }
}

onMounted(reload);
onBeforeUnmount(() => clearTimeout(toastTimer));
</script>

<style scoped>
.fault-summary { white-space: normal; max-width: 320px; }
</style>
