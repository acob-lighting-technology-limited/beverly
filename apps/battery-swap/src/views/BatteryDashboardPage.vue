<template>
  <section class="reg" aria-label="Battery swap dashboard" data-testid="battery-dashboard">
    <header class="dash-head">
      <div>
        <h1 class="reg-title">Dashboard</h1>
        <p class="reg-blurb">How the swap network is doing: handovers, money, and the batteries themselves.</p>
      </div>
      <PeriodPicker :model-value="store.days" @update:model-value="change" />
    </header>

    <div v-if="store.swapsError" class="reg-alert" role="alert" data-testid="dash-error">
      <span>{{ store.swapsError }}</span>
      <button type="button" class="reg-btn" @click="reload">Try again</button>
    </div>

    <!-- One solid board: money leads, then the outcome of every swap, then two rates -->
    <div class="board surface" aria-label="Swap summary">
      <router-link to="/analytics" class="board-lead" data-testid="kpi-revenue">
        <span class="board-label">Money taken</span>
        <span class="board-owed">
          <span v-if="store.swapsLoading && !a" class="reg-skeleton" aria-hidden="true" />
          <template v-else>{{ a ? naira(a.totals.netRevenueMinor) : "—" }}</template>
        </span>
        <span class="board-note">{{ revenueNote }}</span>
      </router-link>

      <div class="board-split" data-testid="kpi-outcomes">
        <span class="board-label">Swaps</span>
        <div class="stockbar" role="img" :aria-label="outcomeSummary">
          <i v-for="seg in segments" :key="seg.key" :class="['seg', `seg--${seg.key}`]" :style="{ flexGrow: seg.value }" />
        </div>
        <ul class="stocklist">
          <li v-for="row in outcomeRows" :key="row.key"><span class="item"><i :class="['dot', `dot--${row.key}`]" />{{ row.label }} <b>{{ row.value }}</b></span></li>
        </ul>
      </div>

      <ul class="board-rows">
        <li><div data-testid="kpi-completion"><span>Handover rate</span><b>{{ rate(a?.totals.completionRate) }}</b></div></li>
        <li><div data-testid="kpi-time"><span>Median time to handover</span><b>{{ minutes(a?.totals.medianMinutesToHandover) }}</b></div></li>
      </ul>
    </div>

    <div class="dash-grid">
      <article class="panel surface span-8">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Swaps by day</h2>
            <p class="panel-note">Swaps started (bars) against handovers completed (line). The gap is swaps that did not finish.</p>
          </div>
          <span class="source source--ok">Beverly database</span>
        </div>
        <TrendChart
          v-if="a"
          :labels="a.daily.map((d) => d.date)"
                :bars="a.daily.map((d) => d.swaps)"
          :line="a.daily.map((d) => d.completed)"
          bar-label="Swaps started"
          line-label="Handovers"
          shared-scale
        />
        <p v-else class="panel-empty">{{ store.swapsLoading ? "Loading…" : "No data to chart." }}</p>
      </article>

      <article class="panel surface span-4" data-testid="fleet-panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Batteries right now</h2>
            <p class="panel-note">Live from the Yunhe battery platform.</p>
          </div>
          <span :class="['source', live.status === 'ok' ? 'source--ok' : 'source--off']" data-testid="fleet-source">{{ fleetSource }}</span>
        </div>
        <dl v-if="live.status === 'ok'" class="fleet">
          <div><dt>Online</dt><dd>{{ live.counts.online }}</dd></div>
          <div><dt>Offline</dt><dd>{{ live.counts.offline }}</dd></div>
          <div><dt>Low charge</dt><dd>{{ live.counts.lowCharge }}</dd></div>
        </dl>
        <template v-else>
          <p class="fleet-off">{{ fleetOff }}</p>
          <button type="button" class="reg-btn" :disabled="live.status === 'loading'" data-testid="fleet-retry" @click="live.refresh()">{{ live.status === "loading" ? "Connecting…" : "Try again" }}</button>
        </template>
      </article>

      <article class="panel surface span-7">
        <div class="panel-head"><h2 class="panel-title">What stands out</h2></div>
        <InsightList :items="insights" />
      </article>

      <article class="panel surface span-5">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Busiest hours</h2>
            <p class="panel-note">Handovers by hour of day.</p>
          </div>
          <router-link to="/analytics" class="swap-link">More analytics</router-link>
        </div>
        <HourBars v-if="a" :hours="a.byHour" />
        <p v-else class="panel-empty">{{ store.swapsLoading ? "Loading…" : "No data to chart." }}</p>
      </article>
    </div>
  </section>
</template>

<script setup>
/**
 * Battery swap dashboard. Money, handovers and rates come from Beverly's own records through
 * /api/v1/pue/analytics/swaps. Battery charge, online state and location come from the Yunhe platform
 * through the server gateway (the live store); when that is not connected the panel says so instead of
 * showing numbers.
 */
import { computed, onMounted } from "vue";
import PeriodPicker from "../charts/PeriodPicker.vue";
import TrendChart from "../charts/TrendChart.vue";
import HourBars from "../charts/HourBars.vue";
import InsightList from "../charts/InsightList.vue";
import { usePueAnalyticsStore } from "../stores/pue-analytics-store.js";
import { usePueLiveStore } from "../stores/pue-live-store.js";
import { nairaFromMinor } from "../services/pue-api.js";
import { swapInsights } from "../services/pue-insights.js";

const store = usePueAnalyticsStore();
const live = usePueLiveStore();
const a = computed(() => store.swaps);

const naira = (minor) => nairaFromMinor(minor);
const rate = (share) => (share === null || share === undefined ? "—" : `${Math.round(share * 100)}%`);
const minutes = (m) => (m === null || m === undefined ? "—" : m < 90 ? `${m} min` : `${Math.round(m / 6) / 10} h`);

const revenueNote = computed(() => {
  if (!a.value) return "Not loaded";
  const t = a.value.totals;
  const refunds = t.refundsMinor ? `, after ${naira(t.refundsMinor)} refunds owed` : "";
  return `${t.completed} ${t.completed === 1 ? "swap" : "swaps"} completed in ${a.value.days} days${refunds}`;
});

const outcomeRows = computed(() => {
  const t = a.value?.totals;
  return [
    { key: "done", label: "Completed", value: t ? t.completed : "—" },
    { key: "open", label: "In progress", value: t ? t.open : "—" },
    { key: "cancel", label: "Cancelled", value: t ? t.cancelled : "—" },
    { key: "expired", label: "Expired", value: t ? t.expired : "—" }
  ];
});
const segments = computed(() => (a.value ? outcomeRows.value.filter((r) => r.value > 0).map((r) => ({ key: r.key, value: r.value })) : []));
const outcomeSummary = computed(() => (a.value ? outcomeRows.value.map((r) => `${r.value} ${r.label.toLowerCase()}`).join(", ") : "Swaps not loaded"));

const fleetSource = computed(() => ({ ok: "Yunhe connected", loading: "Connecting", idle: "Connecting" })[live.status] ?? "Yunhe not connected");
const fleetOff = computed(() => (live.status === "unavailable"
  ? `Live battery data is not available: ${live.error ?? "the platform did not answer"}. Charge, location and online state appear here once it does.`
  : "Waiting for the battery platform…"));

const insights = computed(() => swapInsights(a.value, { status: live.status, counts: live.counts, error: live.error }));

function reload() { return store.loadSwaps(store.days); }
function change(days) { return store.loadSwaps(days); }

onMounted(() => {
  reload();
  if (live.status === "idle") live.refresh();
});
</script>

<style scoped>
.board-split { min-width: 0; }
.swap-link { margin-left: 0; font-size: 13px; }
</style>
