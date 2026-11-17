<template>
  <section class="reg" aria-label="Bike sales" data-testid="sales-page">
    <header class="reg-head">
      <div>
        <h1 class="reg-title">Bike sales</h1>
        <p class="reg-blurb">Each bike sold to a rider, in full or by instalment. Payments are collected through the Beverly wallet ledger and appear here once that is connected.</p>
      </div>
      <button v-if="canEdit" type="button" class="reg-btn reg-btn--primary" data-testid="sales-add" @click="openSell">Sell a bike</button>
    </header>

    <p v-if="toast" class="reg-toast" role="status" data-testid="sales-toast">{{ toast }}</p>
    <div v-if="store.salesError" class="reg-alert" role="alert" data-testid="sales-error">
      <span>{{ store.salesError }}</span>
      <button type="button" class="reg-btn" @click="reload">Try again</button>
    </div>

    <div class="reg-table-wrap">
      <table class="reg-table">
        <thead>
          <tr>
            <th scope="col">Rider</th><th scope="col">Bike</th><th scope="col">Type</th>
            <th scope="col">Price</th><th scope="col">Deposit</th><th scope="col">Status</th><th scope="col">Started</th>
            <th v-if="canEdit" scope="col"><span class="reg-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody v-if="store.salesLoading">
          <tr v-for="n in 5" :key="n" class="reg-skeleton-row" aria-hidden="true">
            <td v-for="c in canEdit ? 8 : 7" :key="c"><span class="reg-skeleton" /></td>
          </tr>
        </tbody>
        <tbody v-else-if="store.sales.items.length">
          <tr v-for="sale in store.sales.items" :key="sale.id" :data-testid="`sale-row-${sale.id}`">
            <td>{{ sale.pue_riders?.full_name ?? '—' }}<br /><small class="reg-help">{{ sale.pue_riders?.phone ?? '' }}</small></td>
            <td>{{ sale.pue_bikes?.serial_number ?? '—' }}</td>
            <td>{{ sale.sale_type === 'full' ? 'Full payment' : 'Instalment' }}</td>
            <td>{{ nairaFromMinor(sale.total_minor) }}</td>
            <td>{{ nairaFromMinor(sale.deposit_minor) }}</td>
            <td><span :class="['reg-badge', `reg-badge--${sale.status}`]">{{ sale.status }}</span></td>
            <td>{{ sale.starts_on ?? '—' }}</td>
            <td v-if="canEdit" class="reg-actions">
              <button v-if="sale.status === 'active'" type="button" class="reg-btn" :data-testid="`sale-end-${sale.id}`" @click="openEnd(sale)">End sale</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!store.salesLoading && !store.sales.items.length && !store.salesError" class="reg-empty" data-testid="sales-empty">
        <p class="reg-empty-title">No sales yet</p>
        <p class="reg-empty-note">Register a rider and a bike first, then sell the bike here.</p>
        <button v-if="canEdit" type="button" class="reg-btn reg-btn--primary" @click="openSell">Sell a bike</button>
      </div>
    </div>

    <div v-if="mode" class="reg-overlay" @click.self="mode = null" @keydown.esc="mode = null">
      <form class="reg-dialog" role="dialog" aria-modal="true" aria-labelledby="sales-dialog-title" :data-testid="mode === 'sell' ? 'sell-form' : 'end-form'" novalidate @submit.prevent="submit">
        <h2 id="sales-dialog-title" class="reg-dialog-title">{{ mode === 'sell' ? 'Sell a bike' : 'End sale' }}</h2>

        <template v-if="mode === 'sell'">
          <div class="reg-field">
            <label class="reg-label" for="sale-rider">Rider <span class="reg-req" aria-hidden="true">*</span></label>
            <select id="sale-rider" v-model="sell.riderId" class="reg-input" data-testid="sale-rider">
              <option value="">Choose…</option>
              <option v-for="r in riderChoices" :key="r.id" :value="r.id">{{ r.label }}</option>
            </select>
          </div>
          <div class="reg-field">
            <label class="reg-label" for="sale-bike">Bike <span class="reg-req" aria-hidden="true">*</span></label>
            <select id="sale-bike" v-model="sell.bikeId" class="reg-input" data-testid="sale-bike">
              <option value="">Choose…</option>
              <option v-for="b in bikeChoices" :key="b.id" :value="b.id">{{ b.label }}</option>
            </select>
            <p v-if="!bikeChoices.length" class="reg-help">No bikes are available to sell. Add bikes in the Bikes registry.</p>
          </div>
          <div class="reg-field">
            <label class="reg-label" for="sale-type">Payment</label>
            <select id="sale-type" v-model="sell.saleType" class="reg-input" data-testid="sale-type">
              <option value="instalment">Instalment</option>
              <option value="full">Full payment</option>
            </select>
          </div>
          <div class="reg-field">
            <label class="reg-label" for="sale-total">Price (₦) <span class="reg-req" aria-hidden="true">*</span></label>
            <input id="sale-total" v-model="sell.total" class="reg-input" inputmode="decimal" autocomplete="off" data-testid="sale-total" />
          </div>
          <div class="reg-field">
            <label class="reg-label" for="sale-deposit">Deposit (₦)</label>
            <input id="sale-deposit" v-model="sell.deposit" class="reg-input" inputmode="decimal" autocomplete="off" data-testid="sale-deposit" />
            <p class="reg-help">Recording a sale does not collect money. Payments go through the Beverly wallet.</p>
          </div>
        </template>

        <template v-else>
          <div class="reg-field">
            <label class="reg-label" for="end-outcome">Outcome</label>
            <select id="end-outcome" v-model="end.outcome" class="reg-input" data-testid="end-outcome">
              <option value="completed">Completed (fully paid)</option>
              <option value="repossessed">Repossessed</option>
              <option value="cancelled">Cancelled (bike returns to stock)</option>
            </select>
          </div>
          <div class="reg-field">
            <label class="reg-label" for="end-reason">Reason <span class="reg-req" aria-hidden="true">*</span></label>
            <input id="end-reason" v-model="end.reason" class="reg-input" autocomplete="off" data-testid="end-reason" />
          </div>
        </template>

        <ul v-if="problems.length" class="reg-problems" role="alert" data-testid="sales-form-problems">
          <li v-for="problem in problems" :key="problem">{{ problem }}</li>
        </ul>
        <div class="reg-dialog-actions">
          <button type="button" class="reg-btn" @click="mode = null">Cancel</button>
          <button type="submit" class="reg-btn reg-btn--primary" :disabled="saving" data-testid="sales-save">{{ saving ? 'Saving…' : mode === 'sell' ? 'Record sale' : 'End sale' }}</button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup>
/** Bike sales: who bought which bike, and how. Server data only; see stores/pue-registry-store.js. */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { usePueRegistryStore } from "../stores/pue-registry-store.js";
import { useBatterySwapAuthStore } from "../stores/auth";
import { minorFromNaira, nairaFromMinor } from "../services/pue-api.js";
import { recordLabel } from "../services/registry-config.js";

const store = usePueRegistryStore();
const auth = useBatterySwapAuthStore();
const OPERATOR_ROLES = ["super-admin", "operations-manager", "operations-officer"];
const canEdit = computed(() => OPERATOR_ROLES.includes(auth.user?.role ?? ""));

const mode = ref(null);
const saving = ref(false);
const problems = ref([]);
const toast = ref("");
const sell = reactive({ riderId: "", bikeId: "", saleType: "instalment", total: "", deposit: "" });
const end = reactive({ id: "", outcome: "completed", reason: "" });
let toastTimer = null;

const riderChoices = computed(() => (store.options.riders ?? []).filter((r) => r.status === "active").map((r) => ({ id: r.id, label: recordLabel("riders", r) })));
const bikeChoices = computed(() => (store.options.bikes ?? []).filter((b) => b.status === "in_stock" || b.status === "repossessed").map((b) => ({ id: b.id, label: recordLabel("bikes", b) })));

const reload = () => store.loadSales();

async function openSell() {
  Object.assign(sell, { riderId: "", bikeId: "", saleType: "instalment", total: "", deposit: "" });
  problems.value = [];
  mode.value = "sell";
  await Promise.all([store.loadOptions("riders"), store.loadOptions("bikes")]);
}
function openEnd(sale) {
  Object.assign(end, { id: sale.id, outcome: "completed", reason: "" });
  problems.value = [];
  mode.value = "end";
}

function flash(message) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = ""; }, 4000);
}

async function submit() {
  problems.value = [];
  if (mode.value === "sell") {
    const total = minorFromNaira(sell.total);
    const deposit = sell.deposit === "" ? 0 : minorFromNaira(sell.deposit);
    if (!sell.riderId) problems.value.push("Choose a rider.");
    if (!sell.bikeId) problems.value.push("Choose a bike.");
    if (total === null || total <= 0) problems.value.push("Enter the price in naira.");
    if (deposit === null) problems.value.push("Enter the deposit in naira, or leave it empty.");
    if (total && deposit !== null && deposit > total) problems.value.push("The deposit cannot be more than the price.");
    if (problems.value.length) return;
    saving.value = true;
    try {
      await store.sell({ riderId: sell.riderId, bikeId: sell.bikeId, saleType: sell.saleType, totalMinor: total, depositMinor: deposit });
      mode.value = null;
      flash("Sale recorded.");
      await Promise.all([reload(), store.loadOptions("bikes")]);
    } catch (failure) {
      problems.value = [failure.message];
    } finally { saving.value = false; }
    return;
  }
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
onBeforeUnmount(() => clearTimeout(toastTimer));
</script>
