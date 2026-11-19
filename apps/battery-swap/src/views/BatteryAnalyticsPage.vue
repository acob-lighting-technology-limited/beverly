<template>
  <section class="reg" aria-label="Battery swap analytics" data-testid="battery-analytics">
    <header class="dash-head">
      <div>
        <h1 class="reg-title">Analytics</h1>
        <p class="reg-blurb">Where swaps happen, who is swapping, and how the money arrives.</p>
      </div>
      <div class="dash-tools">
        <PeriodPicker :model-value="store.days" @update:model-value="change" />
        <button type="button" class="reg-btn" :disabled="!a" data-testid="export-csv" @click="exportCsv">Download CSV</button>
      </div>
    </header>

    <div v-if="store.swapsError" class="reg-alert" role="alert" data-testid="analytics-error">
      <span>{{ store.swapsError }}</span>
      <button type="button" class="reg-btn" @click="reload">Try again</button>
    </div>
    <p v-if="a?.truncated" class="reg-toast" role="status">This period has more records than can be read at once, so the figures cover the earliest part of it. Choose a shorter period.</p>

    <div class="dash-grid">
      <article class="panel surface span-6">
        <div class="panel-head"><div><h2 class="panel-title">Stations</h2><p class="panel-note">Completed handovers, with money taken.</p></div></div>
        <BarList :items="stationItems" empty="No handovers at any station in this period." />
      </article>

      <article class="panel surface span-6">
        <div class="panel-head"><div><h2 class="panel-title">How riders pay</h2><p class="panel-note">Money taken by method.</p></div></div>
        <BarList :items="methodItems" empty="No payments in this period." />
      </article>

      <article class="panel surface span-6">
        <div class="panel-head"><div><h2 class="panel-title">Busiest hours</h2><p class="panel-note">Completed handovers by hour of day, West Africa time.</p></div></div>
        <HourBars v-if="a" :hours="a.byHour" />
        <p v-else class="panel-empty">{{ store.swapsLoading ? "Loading…" : "No data to chart." }}</p>
      </article>

      <article class="panel surface span-6">
        <div class="panel-head"><div><h2 class="panel-title">Riders</h2><p class="panel-note">Who swapped in this period.</p></div></div>
        <dl class="fleet" data-testid="rider-stats">
          <div><dt>Active riders</dt><dd>{{ a ? a.totals.activeRiders : "—" }}</dd></div>
          <div><dt>Came back</dt><dd>{{ share(a?.totals.repeatRiderShare) }}</dd></div>
          <div><dt>Avg money / swap</dt><dd class="small">{{ a && a.totals.avgRevenuePerSwapMinor !== null ? naira(a.totals.avgRevenuePerSwapMinor) : "—" }}</dd></div>
        </dl>
      </article>

      <article class="panel surface span-12">
        <div class="panel-head"><div><h2 class="panel-title">What stands out</h2></div></div>
        <InsightList :items="insights" />
      </article>

      <article class="panel surface span-12">
        <div class="panel-head"><div><h2 class="panel-title">Day by day</h2><p class="panel-note">The numbers behind the charts. Most recent first.</p></div></div>
        <div v-if="a" class="dash-table-wrap">
          <table class="dash-table">
            <thead><tr><th>Date</th><th class="num">Swaps started</th><th class="num">Handovers</th><th class="num">Money taken</th></tr></thead>
            <tbody>
              <tr v-for="d in rows" :key="d.date"><td>{{ d.date }}</td><td class="num">{{ d.swaps }}</td><td class="num">{{ d.completed }}</td><td class="num">{{ naira(d.revenueMinor) }}</td></tr>
            </tbody>
          </table>
        </div>
        <p v-else class="panel-empty">{{ store.swapsLoading ? "Loading…" : "No data." }}</p>
      </article>
    </div>
  </section>
</template>

<script setup>
/** Swap analytics: the breakdowns behind the dashboard. Server data only. */
import { computed, onMounted } from "vue";
import PeriodPicker from "../charts/PeriodPicker.vue";
import BarList from "../charts/BarList.vue";
import HourBars from "../charts/HourBars.vue";
import InsightList from "../charts/InsightList.vue";
import { usePueAnalyticsStore } from "../stores/pue-analytics-store.js";
import { usePueLiveStore } from "../stores/pue-live-store.js";
import { nairaFromMinor } from "../services/pue-api.js";
import { swapInsights } from "../services/pue-insights.js";

const METHOD_NAMES = { cash: "Cash", transfer: "Bank transfer", pos: "POS", paystack: "Paystack" };

const store = usePueAnalyticsStore();
const live = usePueLiveStore();
const a = computed(() => store.swaps);

const naira = (minor) => nairaFromMinor(minor);
const share = (s) => (s === null || s === undefined ? "—" : `${Math.round(s * 100)}%`);
const rows = computed(() => (a.value ? [...a.value.daily].reverse() : []));

const stationItems = computed(() => (a.value?.byStation ?? []).map((s) => ({ key: s.stationId, label: s.name, value: s.completed, display: `${s.completed}`, note: `${naira(s.revenueMinor)} taken` })));
const methodItems = computed(() => (a.value?.byMethod ?? []).map((m) => ({ key: m.method, label: METHOD_NAMES[m.method] ?? m.method, value: m.amountMinor, display: naira(m.amountMinor), note: `${m.count} ${m.count === 1 ? "payment" : "payments"}` })));
const insights = computed(() => swapInsights(a.value, { status: live.status, counts: live.counts, error: live.error }));

function reload() { return store.loadSwaps(store.days); }
function change(days) { return store.loadSwaps(days); }

/** Saves the daily table as a CSV the person downloads. Nothing leaves the browser. */
function exportCsv() {
  if (!a.value) return;
  const lines = ["date,swaps_started,handovers,money_taken_naira", ...a.value.daily.map((d) => `${d.date},${d.swaps},${d.completed},${(d.revenueMinor / 100).toFixed(2)}`)];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `pue-swaps-${a.value.days}-days.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  reload();
  if (live.status === "idle") live.refresh();
});
</script>

<style scoped>
.dash-tools { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.fleet dd.small { font-size: 20px; }
</style>
