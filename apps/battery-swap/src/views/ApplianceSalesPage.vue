<template>
  <section class="reg" aria-label="Appliance sales" data-testid="appliance-sales-page">
    <header class="reg-head">
      <div>
        <h1 class="reg-title">Appliance sales</h1>
        <p class="reg-blurb">Each appliance sold to a Beverly customer. Payments are recorded by hand as cash, transfer or POS; the balance is worked out from what is recorded.</p>
      </div>
      <button v-if="canEdit" type="button" class="reg-btn reg-btn--primary" data-testid="asale-add" @click="openSell">Sell an appliance</button>
    </header>

    <div class="reg-tools">
      <label class="reg-search">
        <span class="reg-sr">Filter by status</span>
        <select v-model="statusFilter" class="reg-input" data-testid="asale-filter" @change="reload">
          <option value="">All sales</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="repossessed">Repossessed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <span class="reg-count" aria-live="polite">{{ store.sales.total }} {{ store.sales.total === 1 ? 'sale' : 'sales' }}</span>
    </div>

    <p v-if="toast" class="reg-toast" role="status" data-testid="asale-toast">{{ toast }}</p>
    <div v-if="store.salesError" class="reg-alert" role="alert" data-testid="asale-error">
      <span>{{ store.salesError }}</span>
      <button type="button" class="reg-btn" @click="reload">Try again</button>
    </div>

    <div class="reg-table-wrap">
      <table class="reg-table">
        <thead>
          <tr>
            <th scope="col">Customer</th><th scope="col">Appliance</th><th scope="col">Price</th><th scope="col">Paid</th>
            <th scope="col">Balance</th><th scope="col">Status</th><th scope="col"><span class="reg-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody v-if="store.salesLoading">
          <tr v-for="n in 5" :key="n" aria-hidden="true"><td v-for="c in 7" :key="c"><span class="reg-skeleton" /></td></tr>
        </tbody>
        <tbody v-else-if="store.sales.items.length">
          <tr v-for="sale in store.sales.items" :key="sale.id" :data-testid="`asale-row-${sale.id}`">
            <td>{{ sale.customers?.full_name ?? '—' }}<br /><small class="reg-help">{{ sale.customers?.phone ?? '' }}{{ sale.meter_id ? ` · meter ${sale.meter_id}` : '' }}</small></td>
            <td>{{ sale.pue_appliances?.pue_appliance_types?.name ?? '—' }}<br /><small class="reg-help">{{ sale.pue_appliances?.serial_number ?? '' }}</small></td>
            <td>{{ nairaFromMinor(sale.total_minor) }}</td>
            <td>{{ nairaFromMinor(sale.paidMinor) }}</td>
            <td><strong>{{ nairaFromMinor(sale.balanceMinor) }}</strong></td>
            <td><span :class="['reg-badge', `reg-badge--${sale.status}`]">{{ sale.status }}</span></td>
            <td class="reg-actions">
              <button type="button" class="reg-btn" :data-testid="`asale-view-${sale.id}`" @click="openDetail(sale.id)">Details</button>
              <button v-if="canEdit && sale.status === 'active'" type="button" class="reg-btn reg-btn--primary" :data-testid="`asale-pay-${sale.id}`" @click="openPay(sale)">Record payment</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!store.salesLoading && !store.sales.items.length && !store.salesError" class="reg-empty" data-testid="asale-empty">
        <p class="reg-empty-title">{{ statusFilter ? 'No sales with that status' : 'No appliance sales yet' }}</p>
        <p class="reg-empty-note">Add a catalogue item and a unit first, then sell it to a customer here.</p>
        <button v-if="canEdit && !statusFilter" type="button" class="reg-btn reg-btn--primary" @click="openSell">Sell an appliance</button>
      </div>
    </div>

    <nav v-if="pageCount > 1" class="reg-pager" aria-label="Pages">
      <button type="button" class="reg-btn" :disabled="page <= 1" @click="goTo(page - 1)">Previous</button>
      <span>Page {{ page }} of {{ pageCount }}</span>
      <button type="button" class="reg-btn" :disabled="page >= pageCount" @click="goTo(page + 1)">Next</button>
    </nav>

    <!-- Sell -->
    <div v-if="mode === 'sell'" class="reg-overlay" @click.self="close" @keydown.esc="close">
      <form class="reg-dialog" role="dialog" aria-modal="true" aria-labelledby="asale-title" data-testid="asale-sell-form" novalidate @submit.prevent="submitSell">
        <h2 id="asale-title" class="reg-dialog-title">Sell an appliance</h2>

        <div class="reg-field">
          <label class="reg-label" for="asale-search">Customer <span class="reg-req" aria-hidden="true">*</span></label>
          <input id="asale-search" v-model="customerQuery" class="reg-input" type="search" autocomplete="off" placeholder="Name, phone, email or meter number" data-testid="asale-customer-search" @input="onCustomerSearch" />
          <p v-if="store.customersError" class="reg-help" role="alert">{{ store.customersError }}</p>
          <ul v-if="store.customers.length && !sell.customer" class="app-pick" data-testid="asale-customers">
            <li v-for="c in store.customers" :key="c.id">
              <button type="button" class="app-pick-item" :disabled="c.status !== 'active'" :data-testid="`asale-customer-${c.id}`" @click="pickCustomer(c)">
                <strong>{{ c.full_name ?? 'Unnamed customer' }}</strong>
                <span>{{ c.phone ?? 'No phone' }}{{ c.status !== 'active' ? ` · ${c.status}` : '' }}</span>
                <small>{{ c.meters.length ? `Meters: ${c.meters.join(', ')}` : 'No meter on file' }}</small>
              </button>
            </li>
          </ul>
          <p v-else-if="customerQuery.trim().length >= 2 && !store.customers.length && !sell.customer && !store.customersError" class="reg-help">No Beverly customer matches. Appliance customers must already exist in the Beverly CRM.</p>
          <p v-if="sell.customer" class="app-chosen" data-testid="asale-customer-chosen">
            {{ sell.customer.full_name }} · {{ sell.customer.phone ?? 'no phone' }}
            <button type="button" class="swap-link" @click="clearCustomer">Change</button>
          </p>
        </div>

        <div v-if="sell.customer" class="reg-field">
          <label class="reg-label" for="asale-meter">Meter (optional)</label>
          <select id="asale-meter" v-model="sell.meterId" class="reg-input" data-testid="asale-meter">
            <option value="">No meter</option>
            <option v-for="m in sell.customer.meters" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>

        <div class="reg-field">
          <label class="reg-label" for="asale-unit">Appliance unit <span class="reg-req" aria-hidden="true">*</span></label>
          <select id="asale-unit" v-model="sell.applianceId" class="reg-input" data-testid="asale-unit" @change="onUnitChosen">
            <option value="">Choose…</option>
            <option v-for="u in unitChoices" :key="u.id" :value="u.id">{{ u.label }}</option>
          </select>
          <p v-if="!unitChoices.length" class="reg-help">No units are in stock. Register units under Appliance units.</p>
        </div>

        <div class="reg-field">
          <label class="reg-label" for="asale-type">Payment</label>
          <select id="asale-type" v-model="sell.saleType" class="reg-input" data-testid="asale-type">
            <option value="instalment">Instalment</option>
            <option value="full">Full payment</option>
          </select>
        </div>
        <div class="reg-field">
          <label class="reg-label" for="asale-total">Price (₦) <span class="reg-req" aria-hidden="true">*</span></label>
          <input id="asale-total" v-model="sell.total" class="reg-input" inputmode="decimal" autocomplete="off" data-testid="asale-total" />
        </div>
        <div class="reg-field">
          <label class="reg-label" for="asale-deposit">{{ sell.saleType === 'full' ? 'Paid now (₦)' : 'Deposit (₦)' }}</label>
          <input id="asale-deposit" v-model="sell.deposit" class="reg-input" inputmode="decimal" autocomplete="off" data-testid="asale-deposit" />
          <p class="reg-help">{{ sell.saleType === 'full' ? 'Enter the whole price if the customer has paid, or leave empty.' : 'Money handed over today. Leave empty for none.' }}</p>
        </div>
        <div v-if="sell.deposit !== ''" class="reg-field">
          <label class="reg-label" for="asale-method">Paid by</label>
          <select id="asale-method" v-model="sell.depositMethod" class="reg-input" data-testid="asale-method">
            <option v-for="[value, label] in METHODS" :key="value" :value="value">{{ label }}</option>
          </select>
        </div>

        <ul v-if="problems.length" class="reg-problems" role="alert" data-testid="asale-problems"><li v-for="p in problems" :key="p">{{ p }}</li></ul>
        <div class="reg-dialog-actions">
          <button type="button" class="reg-btn" @click="close">Cancel</button>
          <button type="submit" class="reg-btn reg-btn--primary" :disabled="saving" data-testid="asale-save">{{ saving ? 'Saving…' : 'Record sale' }}</button>
        </div>
      </form>
    </div>

    <!-- Record payment -->
    <div v-if="mode === 'pay'" class="reg-overlay" @click.self="close" @keydown.esc="close">
      <form class="reg-dialog" role="dialog" aria-modal="true" aria-labelledby="apay-title" data-testid="asale-pay-form" novalidate @submit.prevent="submitPay">
        <h2 id="apay-title" class="reg-dialog-title">Record a payment</h2>
        <p class="reg-help">Balance owed: <strong>{{ nairaFromMinor(pay.balanceMinor) }}</strong>. Only record money you have actually received.</p>
        <div class="reg-field">
          <label class="reg-label" for="apay-amount">Amount received (₦) <span class="reg-req" aria-hidden="true">*</span></label>
          <input id="apay-amount" v-model="pay.amount" class="reg-input" inputmode="decimal" autocomplete="off" data-testid="apay-amount" />
        </div>
        <div class="reg-field">
          <label class="reg-label" for="apay-method">Paid by</label>
          <select id="apay-method" v-model="pay.method" class="reg-input" data-testid="apay-method">
            <option v-for="[value, label] in METHODS" :key="value" :value="value">{{ label }}</option>
          </select>
        </div>
        <div class="reg-field">
          <label class="reg-label" for="apay-ref">Reference</label>
          <input id="apay-ref" v-model="pay.reference" class="reg-input" autocomplete="off" placeholder="Transfer or receipt number" data-testid="apay-ref" />
        </div>
        <ul v-if="problems.length" class="reg-problems" role="alert" data-testid="apay-problems"><li v-for="p in problems" :key="p">{{ p }}</li></ul>
        <div class="reg-dialog-actions">
          <button type="button" class="reg-btn" @click="close">Cancel</button>
          <button type="submit" class="reg-btn reg-btn--primary" :disabled="saving" data-testid="apay-save">{{ saving ? 'Saving…' : 'Record payment' }}</button>
        </div>
      </form>
    </div>

    <!-- Details -->
    <div v-if="mode === 'detail'" class="reg-overlay" @click.self="close" @keydown.esc="close">
      <div class="reg-dialog" role="dialog" aria-modal="true" aria-labelledby="adet-title" data-testid="asale-detail">
        <h2 id="adet-title" class="reg-dialog-title">Sale details</h2>
        <p v-if="detailError" class="reg-problems" role="alert">{{ detailError }}</p>
        <template v-else-if="detail">
          <p class="reg-help">{{ detail.customers?.full_name }} · {{ detail.pue_appliances?.pue_appliance_types?.name }} ({{ detail.pue_appliances?.serial_number }})</p>
          <dl class="live-metrics">
            <div><dt>Price</dt><dd>{{ nairaFromMinor(detail.total_minor) }}</dd></div>
            <div><dt>Paid</dt><dd>{{ nairaFromMinor(detail.paidMinor) }}</dd></div>
            <div><dt>Balance</dt><dd>{{ nairaFromMinor(detail.balanceMinor) }}</dd></div>
            <div><dt>Status</dt><dd>{{ detail.status }}</dd></div>
          </dl>
          <h3 class="live-sub">Payments</h3>
          <ul v-if="detail.payments.length" class="swap-receipt" data-testid="asale-payments">
            <li v-for="p in detail.payments" :key="p.id">{{ nairaFromMinor(p.amount_minor) }} by {{ p.method }}{{ p.reference ? ` (${p.reference})` : '' }} · {{ new Date(p.created_at).toLocaleDateString() }}</li>
          </ul>
          <p v-else class="reg-help">No payments recorded yet.</p>

          <div v-if="canEdit && detail.status === 'active'" class="swap-cancel">
            <label class="reg-label" for="aend-outcome">End this sale</label>
            <select id="aend-outcome" v-model="end.outcome" class="reg-input" data-testid="aend-outcome">
              <option value="repossessed">Repossessed (unit returns to stock)</option>
              <option value="cancelled">Cancelled (unit returns to stock)</option>
            </select>
            <input v-model="end.reason" class="reg-input" style="margin-top: 8px" placeholder="Reason" autocomplete="off" data-testid="aend-reason" />
            <p class="reg-help">Money already received stays on record.</p>
            <ul v-if="problems.length" class="reg-problems" role="alert"><li v-for="p in problems" :key="p">{{ p }}</li></ul>
            <button type="button" class="reg-btn" style="margin-top: 8px" :disabled="saving" data-testid="aend-save" @click="submitEnd">End sale</button>
          </div>
        </template>
        <div class="reg-dialog-actions"><button type="button" class="reg-btn" @click="close">Close</button></div>
      </div>
    </div>
  </section>
</template>

<script setup>
/** Appliance sales: who bought which unit, what they have paid, what they owe. Server data only. */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { usePueAppliancesStore } from "../stores/pue-appliances-store.js";
import { usePueRegistryStore } from "../stores/pue-registry-store.js";
import { useBatterySwapAuthStore } from "../stores/auth";
import { minorFromNaira, nairaFromMinor } from "../services/pue-api.js";
import { recordLabel } from "../services/registry-config.js";

const store = usePueAppliancesStore();
const registry = usePueRegistryStore();
const auth = useBatterySwapAuthStore();
const OPERATOR_ROLES = ["super-admin", "operations-manager", "operations-officer"];
const canEdit = computed(() => OPERATOR_ROLES.includes(auth.user?.role ?? ""));
const METHODS = [["cash", "Cash"], ["transfer", "Bank transfer"], ["pos", "POS"]];

const statusFilter = ref("");
const page = ref(1);
const pageCount = computed(() => Math.max(1, Math.ceil(store.sales.total / 25)));
const mode = ref(null);
const saving = ref(false);
const problems = ref([]);
const toast = ref("");
const customerQuery = ref("");
const detail = ref(null);
const detailError = ref("");
const sell = reactive({ customer: null, meterId: "", applianceId: "", saleType: "instalment", total: "", deposit: "", depositMethod: "cash" });
const pay = reactive({ id: "", balanceMinor: 0, amount: "", method: "cash", reference: "", key: "" });
const end = reactive({ id: "", outcome: "repossessed", reason: "" });
let toastTimer = null;
let searchTimer = null;

const unitChoices = computed(() =>
  (registry.options["appliance-units"] ?? []).filter((u) => u.status === "in_stock").map((u) => ({ id: u.id, label: recordLabel("appliance-units", u) }))
);

const reload = () => store.loadSales({ page: page.value, status: statusFilter.value });
function goTo(next) { page.value = next; reload(); }
function flash(message) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = ""; }, 4000);
}
function close() { mode.value = null; }

async function openSell() {
  Object.assign(sell, { customer: null, meterId: "", applianceId: "", saleType: "instalment", total: "", deposit: "", depositMethod: "cash" });
  customerQuery.value = "";
  store.customers = [];
  problems.value = [];
  mode.value = "sell";
  await Promise.all([registry.loadOptions("appliance-units"), registry.loadOptions("appliance-types")]);
}
function onCustomerSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => store.searchCustomers(customerQuery.value), 300);
}
function pickCustomer(customer) {
  sell.customer = customer;
  sell.meterId = customer.meters.length === 1 ? customer.meters[0] : "";
}
function clearCustomer() { sell.customer = null; sell.meterId = ""; }
/** Pre-fills the standard price of the chosen unit's type; the attendant can still change it. */
function onUnitChosen() {
  const unit = (registry.options["appliance-units"] ?? []).find((u) => u.id === sell.applianceId);
  const type = (registry.options["appliance-types"] ?? []).find((t) => t.id === unit?.type_id);
  if (type?.default_price_minor != null && !sell.total) sell.total = String(Number(type.default_price_minor) / 100);
}

async function submitSell() {
  problems.value = [];
  const total = minorFromNaira(sell.total);
  const deposit = sell.deposit === "" ? 0 : minorFromNaira(sell.deposit);
  if (!sell.customer) problems.value.push("Choose a Beverly customer.");
  if (!sell.applianceId) problems.value.push("Choose an appliance unit.");
  if (total === null || total <= 0) problems.value.push("Enter the price in naira.");
  if (deposit === null) problems.value.push("Enter the amount in naira, or leave it empty.");
  if (total && deposit !== null && deposit > total) problems.value.push("The amount cannot be more than the price.");
  if (sell.saleType === "full" && deposit && total && deposit !== total) problems.value.push("A full sale takes the whole price, or nothing yet.");
  if (problems.value.length) return;
  saving.value = true;
  try {
    await store.sell({
      applianceId: sell.applianceId, customerId: sell.customer.id, meterId: sell.meterId || null, saleType: sell.saleType,
      totalMinor: total, depositMinor: deposit, depositMethod: sell.depositMethod
    });
    mode.value = null;
    flash("Sale recorded.");
    await Promise.all([reload(), registry.loadOptions("appliance-units")]);
  } catch (failure) {
    problems.value = [failure.message];
  } finally { saving.value = false; }
}

function openPay(sale) {
  // One key per dialog: a retry after a dropped connection can never record the money twice.
  Object.assign(pay, { id: sale.id, balanceMinor: sale.balanceMinor, amount: "", method: "cash", reference: "", key: crypto.randomUUID() });
  problems.value = [];
  mode.value = "pay";
}
async function submitPay() {
  problems.value = [];
  const amount = minorFromNaira(pay.amount);
  if (amount === null || amount <= 0) problems.value.push("Enter the amount received in naira.");
  else if (amount > pay.balanceMinor) problems.value.push(`That is more than the ${nairaFromMinor(pay.balanceMinor)} still owed.`);
  if (problems.value.length) return;
  saving.value = true;
  try {
    await store.recordPayment(pay.id, { amountMinor: amount, method: pay.method, reference: pay.reference.trim() || null }, pay.key);
    mode.value = null;
    flash("Payment recorded.");
    await reload();
  } catch (failure) {
    problems.value = [failure.message];
  } finally { saving.value = false; }
}

async function openDetail(id) {
  detail.value = null;
  detailError.value = "";
  problems.value = [];
  Object.assign(end, { id, outcome: "repossessed", reason: "" });
  mode.value = "detail";
  try { detail.value = await store.getSale(id); } catch (failure) { detailError.value = failure.message; }
}
async function submitEnd() {
  problems.value = [];
  if (end.reason.trim().length < 3) { problems.value = ["Give a reason (at least 3 characters)."]; return; }
  saving.value = true;
  try {
    await store.endSale(end.id, { outcome: end.outcome, reason: end.reason.trim() });
    mode.value = null;
    flash("Sale ended.");
    await reload();
  } catch (failure) {
    problems.value = [failure.message];
  } finally { saving.value = false; }
}

onMounted(reload);
onBeforeUnmount(() => { clearTimeout(toastTimer); clearTimeout(searchTimer); });
</script>

<style scoped>
.app-pick { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 6px; max-height: 220px; overflow-y: auto; }
.app-pick-item { width: 100%; display: grid; gap: 2px; padding: 10px 14px; text-align: left; border: 1px solid var(--acob-line); border-radius: var(--acob-radius-md); background: var(--acob-surface); color: var(--acob-text); font: inherit; cursor: pointer; }
.app-pick-item:hover:not(:disabled) { background: var(--acob-surface-hover); border-color: var(--acob-brand-bright); }
.app-pick-item:disabled { opacity: .55; cursor: not-allowed; }
.app-pick-item small { color: var(--acob-muted); font-size: 12px; }
.app-chosen { margin: 8px 0 0; padding: 10px 14px; border-radius: var(--acob-radius-md); background: var(--color-success-soft); font-size: 14px; font-weight: 600; }
</style>
