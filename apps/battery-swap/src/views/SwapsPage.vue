<template>
  <section class="reg" aria-label="Swaps" data-testid="swaps-page">
    <header class="reg-head">
      <div>
        <h1 class="reg-title">Swaps</h1>
        <p class="reg-blurb" data-testid="swaps-settings-line">
          <template v-if="store.settings">{{ nairaFromMinor(store.settings.priceMinor) }} per swap · batteries issued at {{ store.settings.minSoc }}% charge or more · held {{ store.settings.reservationMinutes }} minutes</template>
          <template v-else>{{ store.settingsError || 'Loading swap settings…' }}</template>
          <button v-if="isSuperAdmin && store.settings" type="button" class="swap-link" data-testid="swap-settings-open" @click="openSettings">Change</button>
        </p>
      </div>
      <button v-if="canEdit" type="button" class="reg-btn reg-btn--primary" data-testid="swap-new" @click="openNew">New swap</button>
    </header>

    <div class="reg-tools">
      <label class="reg-search">
        <span class="reg-sr">Filter by status</span>
        <select v-model="status" class="reg-input" data-testid="swap-status-filter" @change="page = 1; reload()">
          <option value="">All swaps</option>
          <option v-for="[value, label] in STATUS_OPTIONS" :key="value" :value="value">{{ label }}</option>
        </select>
      </label>
      <span class="reg-count" aria-live="polite">{{ store.swaps.total }} {{ store.swaps.total === 1 ? 'swap' : 'swaps' }}</span>
    </div>

    <p v-if="toast" class="reg-toast" role="status" data-testid="swap-toast">{{ toast }}</p>
    <div v-if="store.error" class="reg-alert" role="alert" data-testid="swaps-error">
      <span>{{ store.error }}</span>
      <button type="button" class="reg-btn" @click="reload">Try again</button>
    </div>

    <div class="reg-table-wrap">
      <table class="reg-table">
        <thead>
          <tr>
            <th scope="col">Code</th><th scope="col">Rider</th><th scope="col">Station</th><th scope="col">Battery out</th>
            <th scope="col">Status</th><th scope="col">Payment</th><th scope="col">Started</th>
            <th scope="col"><span class="reg-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody v-if="store.loading">
          <tr v-for="n in 5" :key="n" class="reg-skeleton-row" aria-hidden="true"><td v-for="c in 8" :key="c"><span class="reg-skeleton" /></td></tr>
        </tbody>
        <tbody v-else-if="store.swaps.items.length">
          <tr v-for="swap in store.swaps.items" :key="swap.id" :data-testid="`swap-row-${swap.id}`">
            <td><code>{{ swap.reservationCode }}</code></td>
            <td>{{ swap.rider?.name ?? '—' }}<br /><small class="reg-help">{{ swap.rider?.phone ?? '' }}</small></td>
            <td>{{ swap.stationName ?? '—' }}</td>
            <td>{{ swap.batteryOutNumber ?? '—' }}</td>
            <td>
              <span :class="['reg-badge', badgeClass(swap)]">{{ statusLabel(swap) }}</span>
              <span v-if="swap.refundDue" class="reg-badge reg-badge--lost" data-testid="refund-due">Refund due</span>
            </td>
            <td>{{ paymentText(swap) }}</td>
            <td>{{ new Date(swap.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' }) }}</td>
            <td class="reg-actions">
              <button type="button" class="reg-btn" :data-testid="`swap-open-${swap.id}`" @click="openSwap(swap)">{{ isOpen(swap) && canEdit ? 'Continue' : 'View' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!store.loading && !store.swaps.items.length && !store.error" class="reg-empty" data-testid="swaps-empty">
        <p class="reg-empty-title">No swaps yet</p>
        <p class="reg-empty-note">Start a swap when a rider arrives at a station.</p>
        <button v-if="canEdit" type="button" class="reg-btn reg-btn--primary" @click="openNew">New swap</button>
      </div>
    </div>

    <nav v-if="pageCount > 1" class="reg-pager" aria-label="Pages">
      <button type="button" class="reg-btn" :disabled="page <= 1" @click="page--; reload()">Previous</button>
      <span>Page {{ page }} of {{ pageCount }}</span>
      <button type="button" class="reg-btn" :disabled="page >= pageCount" @click="page++; reload()">Next</button>
    </nav>

    <!-- New swap -->
    <div v-if="mode === 'new'" class="reg-overlay" @click.self="close" @keydown.esc="close">
      <form class="reg-dialog" role="dialog" aria-modal="true" aria-labelledby="swap-new-title" data-testid="swap-new-form" novalidate @submit.prevent="reserve">
        <h2 id="swap-new-title" class="reg-dialog-title">New swap</h2>
        <p class="reg-help">The system reserves the most charged battery at the station, from live readings. Nothing is guessed: if charge levels are unavailable, the swap cannot start.</p>
        <div class="reg-field">
          <label class="reg-label" for="swap-station">Station <span class="reg-req" aria-hidden="true">*</span></label>
          <select id="swap-station" v-model="form.stationId" class="reg-input" data-testid="swap-station">
            <option value="">Choose…</option>
            <option v-for="o in stationChoices" :key="o.id" :value="o.id">{{ o.label }}</option>
          </select>
        </div>
        <div class="reg-field">
          <label class="reg-label" for="swap-rider">Rider <span class="reg-req" aria-hidden="true">*</span></label>
          <select id="swap-rider" v-model="form.riderId" class="reg-input" data-testid="swap-rider">
            <option value="">Choose…</option>
            <option v-for="o in riderChoices" :key="o.id" :value="o.id">{{ o.label }}</option>
          </select>
        </div>
        <ul v-if="problems.length" class="reg-problems" role="alert" data-testid="swap-problems">
          <li v-for="p in problems" :key="p">{{ p }}</li>
        </ul>
        <p v-if="existingId" class="reg-help"><button type="button" class="swap-link" data-testid="swap-open-existing" @click="openExisting">Open that swap</button></p>
        <div class="reg-dialog-actions">
          <button type="button" class="reg-btn" @click="close">Cancel</button>
          <button type="submit" class="reg-btn reg-btn--primary" :disabled="busy" data-testid="swap-reserve">{{ busy ? 'Reserving…' : 'Reserve battery' }}</button>
        </div>
      </form>
    </div>

    <!-- One swap: pay, hand over, receipt -->
    <div v-if="mode === 'swap' && current" class="reg-overlay" @click.self="close" @keydown.esc="close">
      <div class="reg-dialog swap-dialog" role="dialog" aria-modal="true" aria-labelledby="swap-title" data-testid="swap-dialog">
        <h2 id="swap-title" class="reg-dialog-title">Swap for {{ current.rider?.name ?? 'rider' }}</h2>

        <div class="swap-code-card" data-testid="swap-code-card">
          <span class="reg-help">Pickup code</span>
          <span class="swap-code" data-testid="swap-code">{{ current.reservationCode }}</span>
          <span class="reg-help">Battery {{ current.batteryOutNumber ?? '—' }} · {{ current.stationName ?? '—' }}</span>
          <span :class="['reg-badge', badgeClass(current)]" data-testid="swap-status">{{ statusLabel(current) }}</span>
          <span v-if="current.status === 'reserved'" class="reg-help" data-testid="swap-hold">{{ holdText }}</span>
        </div>

        <dl class="live-metrics">
          <div><dt>Price</dt><dd>{{ nairaFromMinor(current.priceMinor) }}</dd></div>
          <div><dt>Bike</dt><dd>{{ current.bikeSerial ?? '—' }}</dd></div>
          <div><dt>Payment</dt><dd>{{ paymentText(current) }}</dd></div>
        </dl>

        <p v-if="current.refundDue" class="reg-alert" data-testid="swap-refund-note">A refund is due for this swap. Finance pays it out; this screen only records that it is owed.</p>
        <p v-for="attempt in reviewAttempts" :key="attempt.reference" class="reg-alert" data-testid="swap-review-note">Paid online but not applied ({{ attempt.reason }}). Refund it, or contact a developer.</p>

        <!-- Step: pay -->
        <template v-if="current.status === 'reserved' && canEdit && !expired">
          <h3 class="live-sub">Take payment</h3>
          <div class="live-actions">
            <button type="button" class="reg-btn" :disabled="busy" data-testid="pay-cash" @click="payCash">Record cash {{ nairaFromMinor(current.priceMinor) }}</button>
            <button type="button" class="reg-btn" :disabled="busy" data-testid="pay-paystack" @click="payOnline">Pay online (Paystack)</button>
          </div>
          <div class="reg-field swap-ref">
            <label class="reg-label" for="swap-method">Or record a transfer or POS payment</label>
            <div class="swap-ref-row">
              <select id="swap-method" v-model="pay.method" class="reg-input" data-testid="pay-method"><option value="transfer">Bank transfer</option><option value="pos">POS</option></select>
              <input v-model="pay.reference" class="reg-input" placeholder="Payment reference" aria-label="Payment reference" autocomplete="off" data-testid="pay-reference" />
              <button type="button" class="reg-btn" :disabled="busy" data-testid="pay-reference-save" @click="payReference">Record</button>
            </div>
          </div>
          <p v-if="checkout" class="reg-help" data-testid="paystack-note">Paystack checkout opened in a new tab. After the rider pays, it applies automatically. If it is slow, <button type="button" class="swap-link" data-testid="paystack-verify" @click="checkPaystack">check payment now</button>.</p>
        </template>
        <p v-else-if="current.status === 'reserved' && expired" class="reg-alert" data-testid="swap-expired">This reservation expired. Cancel it and start a new swap.</p>

        <!-- Step: hand over -->
        <template v-if="current.status === 'paid' && canEdit">
          <h3 class="live-sub">Hand over</h3>
          <p class="reg-help">Give the rider battery <strong>{{ current.batteryOutNumber }}</strong> and take back the battery on the bike.</p>
          <div class="reg-field">
            <label class="reg-label" for="swap-return">Battery taken back</label>
            <select id="swap-return" v-model="returnedId" class="reg-input" data-testid="swap-return">
              <option value="">{{ onBike.length ? 'Choose…' : 'None: first battery for this bike' }}</option>
              <option v-for="b in onBike" :key="b.id" :value="b.id">{{ b.battery_number }}</option>
            </select>
            <p v-if="!onBike.length" class="reg-help">No battery is recorded on this bike yet.</p>
          </div>
          <div class="reg-dialog-actions"><button type="button" class="reg-btn reg-btn--primary" :disabled="busy" data-testid="swap-complete" @click="complete">Confirm hand over</button></div>
        </template>

        <!-- Receipt -->
        <template v-if="current.status === 'completed'">
          <h3 class="live-sub">Receipt</h3>
          <ul class="swap-receipt" data-testid="swap-receipt">
            <li>Battery issued: <strong>{{ current.batteryOutNumber }}</strong></li>
            <li>Battery taken back: <strong>{{ current.batteryInNumber ?? 'none' }}</strong></li>
            <li>Paid: <strong>{{ paymentText(current) }}</strong></li>
            <li>Completed {{ current.completedAt ? new Date(current.completedAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' }) : '' }}</li>
          </ul>
        </template>

        <ul v-if="problems.length" class="reg-problems" role="alert" data-testid="swap-problems">
          <li v-for="p in problems" :key="p">{{ p }}</li>
        </ul>

        <div v-if="canEdit && isOpen(current)" class="swap-cancel">
          <label class="reg-label" for="swap-cancel-reason">Cancel this swap</label>
          <div class="swap-ref-row">
            <input id="swap-cancel-reason" v-model="cancelReason" class="reg-input" placeholder="Reason" autocomplete="off" data-testid="swap-cancel-reason" />
            <button type="button" class="reg-btn" :disabled="busy" data-testid="swap-cancel" @click="cancel">{{ current.status === 'paid' ? 'Cancel and record refund' : 'Cancel swap' }}</button>
          </div>
        </div>
        <div class="reg-dialog-actions"><button type="button" class="reg-btn" data-testid="swap-close" @click="close">Close</button></div>
      </div>
    </div>

    <!-- Settings (super admin) -->
    <div v-if="mode === 'settings'" class="reg-overlay" @click.self="close" @keydown.esc="close">
      <form class="reg-dialog" role="dialog" aria-modal="true" aria-labelledby="swap-set-title" data-testid="swap-settings-form" novalidate @submit.prevent="saveSettings">
        <h2 id="swap-set-title" class="reg-dialog-title">Swap settings</h2>
        <div class="reg-field"><label class="reg-label" for="set-price">Price per swap (₦)</label><input id="set-price" v-model="settingsForm.price" class="reg-input" inputmode="decimal" data-testid="set-price" /></div>
        <div class="reg-field"><label class="reg-label" for="set-soc">Minimum charge to issue (%)</label><input id="set-soc" v-model="settingsForm.minSoc" class="reg-input" inputmode="numeric" data-testid="set-soc" /></div>
        <div class="reg-field"><label class="reg-label" for="set-hold">Hold a reservation for (minutes)</label><input id="set-hold" v-model="settingsForm.hold" class="reg-input" inputmode="numeric" data-testid="set-hold" /></div>
        <div class="reg-field"><label class="reg-label" for="set-age">Oldest battery reading allowed (minutes)</label><input id="set-age" v-model="settingsForm.age" class="reg-input" inputmode="numeric" data-testid="set-age" /><p class="reg-help">A battery whose last reading is older than this is not offered.</p></div>
        <ul v-if="problems.length" class="reg-problems" role="alert"><li v-for="p in problems" :key="p">{{ p }}</li></ul>
        <div class="reg-dialog-actions">
          <button type="button" class="reg-btn" @click="close">Cancel</button>
          <button type="submit" class="reg-btn reg-btn--primary" :disabled="busy" data-testid="set-save">{{ busy ? 'Saving…' : 'Save' }}</button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup>
/**
 * Swaps: reserve a charged battery, take payment (cash, transfer, POS, or Paystack), hand over.
 * Every step is done by the server and shown as it reports it. A button never assumes success.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { usePueSwapsStore } from "../stores/pue-swaps-store.js";
import { usePueRegistryStore } from "../stores/pue-registry-store.js";
import { useBatterySwapAuthStore } from "../stores/auth";
import { minorFromNaira, nairaFromMinor } from "../services/pue-api.js";

const store = usePueSwapsStore();
const registry = usePueRegistryStore();
const auth = useBatterySwapAuthStore();

const OPERATOR_ROLES = ["super-admin", "operations-manager", "operations-officer"];
const canEdit = computed(() => OPERATOR_ROLES.includes(auth.user?.role ?? ""));
const isSuperAdmin = computed(() => auth.user?.role === "super-admin");

const STATUS_OPTIONS = [["reserved", "Reserved"], ["paid", "Paid"], ["completed", "Completed"], ["cancelled", "Cancelled"], ["expired", "Expired"]];
const STATUS_TEXT = Object.fromEntries(STATUS_OPTIONS);

const status = ref("");
const page = ref(1);
const pageCount = computed(() => Math.max(1, Math.ceil(store.swaps.total / store.pageSize)));
const toast = ref("");
const mode = ref(null); // null | "new" | "swap" | "settings"
const busy = ref(false);
const problems = ref([]);
const form = reactive({ stationId: "", riderId: "" });
const existingId = ref("");
const current = ref(null);
const pay = reactive({ method: "transfer", reference: "" });
const checkout = ref(null);
const returnedId = ref("");
const cancelReason = ref("");
const settingsForm = reactive({ price: "", minSoc: "", hold: "", age: "" });
const nowTick = ref(Date.now());

// One key per user action, kept until it succeeds, so a retry or double click can never act twice.
let reserveKey = "";
let payKey = "";
let tickTimer = null;
let toastTimer = null;

const isOpen = (swap) => swap.status === "reserved" || swap.status === "paid";
const expired = computed(() => current.value?.status === "reserved" && Date.parse(current.value.reservedUntil) < nowTick.value);
const holdText = computed(() => {
  if (!current.value) return "";
  const left = Date.parse(current.value.reservedUntil) - nowTick.value;
  if (left <= 0) return "Reservation expired";
  return `Held for ${Math.floor(left / 60000)} min ${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")} s`;
});
const reviewAttempts = computed(() => (current.value?.paystackAttempts ?? []).filter((a) => a.status === "needs_review"));

const stationChoices = computed(() => (registry.options["swap-stations"] ?? []).filter((s) => s.status === "active").map((s) => ({ id: s.id, label: s.name })));
const riderChoices = computed(() => (registry.options.riders ?? []).filter((r) => r.status === "active").map((r) => ({ id: r.id, label: `${r.full_name} (${r.phone})` })));
const onBike = computed(() => (registry.options.batteries ?? []).filter((b) => current.value && b.bike_id === current.value.bikeId && b.status === "with_rider"));

function statusLabel(swap) { return STATUS_TEXT[swap.status] ?? swap.status; }
function badgeClass(swap) {
  if (swap.status === "completed" || swap.status === "paid") return "reg-badge--active";
  if (swap.status === "cancelled" || swap.status === "expired") return "reg-badge--lost";
  return "reg-badge--maintenance";
}
function paymentText(swap) {
  const paid = (swap.payments ?? []).filter((p) => p.kind === "payment");
  if (!paid.length) return "Not paid";
  const p = paid[paid.length - 1];
  return `${nairaFromMinor(p.amountMinor)} ${p.method === "pos" ? "POS" : p.method}`;
}

function flash(message) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = ""; }, 6000);
}
const reload = () => store.load({ page: page.value, status: status.value });
function close() { mode.value = null; problems.value = []; existingId.value = ""; checkout.value = null; }

async function openNew() {
  Object.assign(form, { stationId: "", riderId: "" });
  problems.value = []; existingId.value = "";
  reserveKey = crypto.randomUUID();
  mode.value = "new";
  await Promise.all([registry.loadOptions("swap-stations"), registry.loadOptions("riders")]);
}

async function reserve() {
  problems.value = [];
  if (!form.stationId) problems.value.push("Choose a station.");
  if (!form.riderId) problems.value.push("Choose a rider.");
  if (problems.value.length) return;
  busy.value = true;
  try {
    const swap = await store.reserve({ riderId: form.riderId, stationId: form.stationId }, reserveKey);
    await showSwap(swap.id);
    flash("Battery reserved.");
    await reload();
  } catch (failure) {
    problems.value = [failure.message];
    existingId.value = failure.code === "swap_already_open" ? failure.details?.swapId ?? "" : "";
  } finally { busy.value = false; }
}

async function showSwap(id) {
  current.value = await store.get(id);
  payKey = crypto.randomUUID();
  Object.assign(pay, { method: "transfer", reference: "" });
  returnedId.value = ""; cancelReason.value = ""; checkout.value = null; problems.value = [];
  mode.value = "swap";
  await registry.loadOptions("batteries");
  if (onBike.value.length === 1) returnedId.value = onBike.value[0].id;
}
const openSwap = (swap) => showSwap(swap.id).catch((failure) => { flash(failure.message); });
const openExisting = () => showSwap(existingId.value);

async function refreshCurrent() {
  current.value = await store.get(current.value.id);
  await reload();
}

async function run(action, successText) {
  busy.value = true; problems.value = [];
  try {
    await action();
    await refreshCurrent();
    if (successText) flash(successText);
  } catch (failure) {
    problems.value = [failure.message];
    // The server may have moved on (expired, paid elsewhere): show what is true now.
    try { await refreshCurrent(); } catch { /* keep the message above */ }
  } finally { busy.value = false; }
}

const payCash = () => run(() => store.recordPayment(current.value.id, { method: "cash", amountMinor: current.value.priceMinor }, payKey), "Cash payment recorded.");
function payReference() {
  if (pay.reference.trim().length < 3) { problems.value = ["Enter the payment reference (at least 3 characters)."]; return; }
  return run(() => store.recordPayment(current.value.id, { method: pay.method, amountMinor: current.value.priceMinor, reference: pay.reference.trim() }, payKey), "Payment recorded.");
}
async function payOnline() {
  busy.value = true; problems.value = [];
  try {
    checkout.value = await store.startPaystack(current.value.id);
    window.open(checkout.value.authorizationUrl, "_blank", "noopener");
  } catch (failure) { problems.value = [failure.message]; } finally { busy.value = false; }
}
async function checkPaystack() {
  busy.value = true; problems.value = [];
  try {
    const outcome = await store.verifyPaystack(current.value.id);
    current.value = outcome.swap;
    await reload();
    const blocked = (outcome.results ?? []).find((r) => r.status === "blocked");
    if (outcome.swap.status === "paid") flash("Online payment confirmed.");
    else if (blocked) problems.value = [`Paid online but not applied (${blocked.reason}). It is flagged for refund.`];
    else problems.value = ["Paystack has no successful payment for this swap yet."];
  } catch (failure) { problems.value = [failure.message]; } finally { busy.value = false; }
}
const complete = () => run(() => store.complete(current.value.id, { returnedBatteryId: returnedId.value || null }), "Hand over recorded.");
function cancel() {
  if (cancelReason.value.trim().length < 3) { problems.value = ["Give a reason (at least 3 characters)."]; return; }
  return run(() => store.cancel(current.value.id, { reason: cancelReason.value.trim() }), "Swap cancelled.");
}

function openSettings() {
  const s = store.settings;
  Object.assign(settingsForm, { price: String(s.priceMinor / 100), minSoc: String(s.minSoc), hold: String(s.reservationMinutes), age: String(s.maxReadingAgeMinutes) });
  problems.value = [];
  mode.value = "settings";
}
async function saveSettings() {
  const priceMinor = minorFromNaira(settingsForm.price);
  const ints = { minSoc: Number(settingsForm.minSoc), reservationMinutes: Number(settingsForm.hold), maxReadingAgeMinutes: Number(settingsForm.age) };
  problems.value = [];
  if (priceMinor === null) problems.value.push("Enter the price in naira.");
  if (!Object.values(ints).every((n) => Number.isInteger(n) && n > 0)) problems.value.push("Charge, hold time and reading age must be whole numbers.");
  if (problems.value.length) return;
  busy.value = true;
  try {
    await store.updateSettings({ priceMinor, ...ints });
    await store.loadSettings();
    close();
    flash("Swap settings saved.");
  } catch (failure) { problems.value = [failure.message]; } finally { busy.value = false; }
}

onMounted(() => {
  reload(); store.loadSettings();
  tickTimer = setInterval(() => { nowTick.value = Date.now(); }, 1000);
});
onBeforeUnmount(() => { clearInterval(tickTimer); clearTimeout(toastTimer); });
</script>
