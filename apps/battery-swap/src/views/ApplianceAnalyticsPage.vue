<template>
  <section class="reg" aria-label="Appliance analytics" data-testid="appliance-analytics">
    <header class="dash-head">
      <div>
        <h1 class="reg-title">Analytics</h1>
        <p class="reg-blurb">What sells, how it is paid for, and how the stock and faults are holding up.</p>
      </div>
      <div class="dash-tools">
        <PeriodPicker :model-value="store.days" @update:model-value="change" />
        <button type="button" class="reg-btn" :disabled="!a" data-testid="export-csv" @click="exportCsv">Download CSV</button>
      </div>
    </header>

    <div v-if="store.appliancesError" class="reg-alert" role="alert" data-testid="analytics-error">
      <span>{{ store.appliancesError }}</span>
      <button type="button" class="reg-btn" @click="reload">Try again</button>
    </div>
    <p v-if="a?.truncated" class="reg-toast" role="status">This period has more records than can be read at once, so some figures are partial. Choose a shorter period.</p>

    <div class="dash-grid">
      <article class="panel surface span-6">
        <div class="panel-head"><div><h2 class="panel-title">Best sellers</h2><p class="panel-note">Units sold, with the value of the sales.</p></div></div>
        <BarList :items="typeItems" empty="No appliance sold in this period." />
      </article>

      <article class="panel surface span-6">
        <div class="panel-head"><div><h2 class="panel-title">How customers pay</h2><p class="panel-note">Money collected by method.</p></div></div>
        <BarList :items="methodItems" empty="No payments in this period." />
      </article>

      <article class="panel surface span-6">
        <div class="panel-head"><div><h2 class="panel-title">Stock by kind</h2><p class="panel-note">Units on the shelf and out with customers.</p></div></div>
        <BarList :items="stockItems" empty="No units registered yet." />
      </article>

      <article class="panel surface span-6" data-testid="sale-types">
        <div class="panel-head"><div><h2 class="panel-title">Full or instalment</h2><p class="panel-note">How the sales in this period were structured.</p></div></div>
        <div class="stockbar" role="img" :aria-label="typeSummary">
          <i v-for="seg in typeSegments" :key="seg.key" :class="['seg', `seg--${seg.key}`]" :style="{ flexGrow: seg.value }" />
        </div>
        <ul class="stocklist">
          <li><span class="item"><i class="dot dot--done" />Full payment <b>{{ a ? a.bySaleType.full : "—" }}</b></span></li>
          <li><span class="item"><i class="dot dot--open" />Instalment <b>{{ a ? a.bySaleType.instalment : "—" }}</b></span></li>
        </ul>
      </article>

      <article class="panel surface span-12">
        <div class="panel-head"><div><h2 class="panel-title">What stands out</h2></div></div>
        <InsightList :items="insights" />
      </article>

      <article class="panel surface span-12">
        <div class="panel-head"><div><h2 class="panel-title">Day by day</h2><p class="panel-note">The numbers behind the charts. Most recent first.</p></div></div>
        <div v-if="a" class="dash-table-wrap">
          <table class="dash-table">
            <thead><tr><th>Date</th><th class="num">Sold</th><th class="num">Collected</th></tr></thead>
            <tbody>
              <tr v-for="d in rows" :key="d.date"><td>{{ d.date }}</td><td class="num">{{ d.sales }}</td><td class="num">{{ naira(d.collectedMinor) }}</td></tr>
            </tbody>
          </table>
        </div>
        <p v-else class="panel-empty">{{ store.appliancesLoading ? "Loading…" : "No data." }}</p>
      </article>
    </div>
  </section>
</template>

<script setup>
/** Appliance analytics: the breakdowns behind the dashboard. Server data only. */
import { computed, onMounted } from "vue";
import PeriodPicker from "../charts/PeriodPicker.vue";
import BarList from "../charts/BarList.vue";
import InsightList from "../charts/InsightList.vue";
import { usePueAnalyticsStore } from "../stores/pue-analytics-store.js";
import { nairaFromMinor } from "../services/pue-api.js";
import { applianceInsights } from "../services/pue-insights.js";

const METHOD_NAMES = { cash: "Cash", transfer: "Bank transfer", pos: "POS" };
const KIND_NAMES = { fridge: "Fridges", freezer: "Freezers", grinder: "Grinders", other: "Other" };

const store = usePueAnalyticsStore();
const a = computed(() => store.appliances);
const naira = (minor) => nairaFromMinor(minor);
const rows = computed(() => (a.value ? [...a.value.daily].reverse() : []));

const typeItems = computed(() => (a.value?.byType ?? []).map((t) => ({ key: t.typeId, label: t.name, value: t.sold, display: String(t.sold), note: `${naira(t.valueMinor)} of sales` })));
const methodItems = computed(() => (a.value?.byMethod ?? []).map((m) => ({ key: m.method, label: METHOD_NAMES[m.method] ?? m.method, value: m.amountMinor, display: naira(m.amountMinor), note: `${m.count} ${m.count === 1 ? "payment" : "payments"}` })));
const stockItems = computed(() => (a.value?.stockByCategory ?? []).map((c) => ({ key: c.category, label: KIND_NAMES[c.category] ?? c.category, value: c.inStock + c.sold + c.faulty, display: `${c.inStock + c.sold + c.faulty}`, note: `${c.inStock} in stock, ${c.sold} sold, ${c.faulty} faulty` })));
const typeSegments = computed(() => (a.value ? [{ key: "done", value: a.value.bySaleType.full }, { key: "open", value: a.value.bySaleType.instalment }].filter((s) => s.value > 0) : []));
const typeSummary = computed(() => (a.value ? `${a.value.bySaleType.full} full payment, ${a.value.bySaleType.instalment} instalment` : "Not loaded"));
const insights = computed(() => applianceInsights(a.value));

function reload() { return store.loadAppliances(store.days); }
function change(days) { return store.loadAppliances(days); }

/** Saves the daily table as a CSV the person downloads. Nothing leaves the browser. */
function exportCsv() {
  if (!a.value) return;
  const lines = ["date,sold,collected_naira", ...a.value.daily.map((d) => `${d.date},${d.sales},${(d.collectedMinor / 100).toFixed(2)}`)];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `pue-appliances-${a.value.days}-days.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

onMounted(reload);
</script>

<style scoped>
.dash-tools { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
</style>
