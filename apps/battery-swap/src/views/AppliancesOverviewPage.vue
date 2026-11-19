<template>
  <section class="reg" aria-label="Appliances dashboard" data-testid="appliances-overview">
    <header class="dash-head">
      <div>
        <h1 class="reg-title">Appliances</h1>
        <p class="reg-blurb">Fridges, freezers and grinders sold to Beverly customers, in full or by instalment.</p>
      </div>
      <div class="dash-tools">
        <PeriodPicker :model-value="store.days" @update:model-value="change" />
        <router-link v-if="canEdit" to="/appliance-sales" class="reg-btn reg-btn--primary" data-testid="overview-sell">Sell an appliance</router-link>
      </div>
    </header>

    <div v-if="store.appliancesError" class="reg-alert" role="alert" data-testid="overview-error">
      <span>{{ store.appliancesError }}</span>
      <button type="button" class="reg-btn" @click="reload">Try again</button>
    </div>

    <!-- One solid board: what is owed leads, the stock is one bar, the rest are two lines -->
    <div class="board surface" aria-label="Appliance numbers">
      <router-link to="/appliance-sales" class="board-lead" data-testid="stat-owed">
        <span class="board-label">Still owed</span>
        <span class="board-owed">
          <span v-if="loading && !a" class="reg-skeleton" aria-hidden="true" />
          <template v-else>{{ a ? naira(a.totals.outstandingMinor) : "—" }}</template>
        </span>
        <span class="board-note">{{ owedNote }}</span>
      </router-link>

      <div class="board-split" data-testid="stat-stock">
        <span class="board-label">Stock</span>
        <div class="stockbar" role="img" :aria-label="stockSummary">
          <i v-for="seg in segments" :key="seg.key" :class="['seg', `seg--${seg.key}`]" :style="{ flexGrow: seg.value }" />
        </div>
        <ul class="stocklist">
          <li><router-link to="/appliance-units"><i class="dot dot--stock" />In stock <b data-testid="stat-in-stock">{{ show(a?.unitsByStatus.in_stock) }}</b></router-link></li>
          <li><router-link to="/appliance-units"><i class="dot dot--sold" />Sold <b data-testid="stat-sold">{{ show(a?.unitsByStatus.sold) }}</b></router-link></li>
          <li><router-link to="/appliance-units"><i class="dot dot--faulty" />Faulty <b data-testid="stat-faulty">{{ show(a?.unitsByStatus.faulty) }}</b></router-link></li>
        </ul>
      </div>

      <ul class="board-rows">
        <li>
          <router-link to="/appliance-sales" data-testid="stat-active"><span>Active sales</span><b>{{ show(a?.totals.activeSales) }}</b></router-link>
        </li>
        <li>
          <router-link to="/appliance-faults" data-testid="stat-faults"><span>Open faults</span><b>{{ show(a?.totals.openFaults) }}</b></router-link>
        </li>
      </ul>
    </div>

    <div class="dash-grid">
      <article class="panel surface span-8">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Sales and collections by day</h2>
            <p class="panel-note">Appliances sold (bars) and money collected (line).</p>
          </div>
          <span class="source source--ok">Beverly database</span>
        </div>
        <TrendChart
          v-if="a"
          :labels="a.daily.map((d) => d.date)"
          :bars="a.daily.map((d) => d.sales)"
          :line="a.daily.map((d) => d.collectedMinor)"
          bar-label="Sold"
          line-label="Collected"
          :line-format="naira"
        />
        <p v-else class="panel-empty">{{ loading ? "Loading…" : "No data to chart." }}</p>
      </article>

      <article class="panel surface span-4" data-testid="faults-panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Faults</h2>
            <p class="panel-note">Open, by how serious.</p>
          </div>
          <router-link to="/appliance-faults" class="swap-link">Open</router-link>
        </div>
        <dl class="fleet">
          <div><dt>High</dt><dd>{{ show(a?.openFaultsBySeverity.high) }}</dd></div>
          <div><dt>Medium</dt><dd>{{ show(a?.openFaultsBySeverity.medium) }}</dd></div>
          <div><dt>Low</dt><dd>{{ show(a?.openFaultsBySeverity.low) }}</dd></div>
        </dl>
        <p class="panel-note fix-note">{{ fixNote }}</p>
      </article>

      <article class="panel surface span-7">
        <div class="panel-head"><h2 class="panel-title">What stands out</h2></div>
        <InsightList :items="insights" />
      </article>

      <article class="panel surface span-5">
        <div class="panel-head">
          <div><h2 class="panel-title">Best sellers</h2><p class="panel-note">Units sold in this period.</p></div>
          <router-link to="/appliance-analytics" class="swap-link">More analytics</router-link>
        </div>
        <BarList :items="typeItems" empty="No appliance sold in this period." />
      </article>

      <article class="panel surface span-7">
        <h2 class="panel-title">Get started</h2>
        <ol class="app-steps">
          <li><router-link to="/appliance-types">Add what you sell</router-link> to the catalogue, with a standard price.</li>
          <li><router-link to="/appliance-units">Register each unit</router-link> by serial number as it arrives.</li>
          <li><router-link to="/appliance-sales">Sell a unit</router-link> to a Beverly customer, then record each payment.</li>
          <li><router-link to="/appliance-faults">Log faults</router-link> and follow them until they are fixed.</li>
        </ol>
      </article>

      <article class="panel surface span-5" data-testid="remote-control-note">
        <h2 class="panel-title">Remote on/off</h2>
        <p class="app-note">Not connected. Switching an appliance on or off needs a hardware provider, and none is set up yet, so nothing here can claim to switch a device. When a provider is connected, control and its confirmation will appear here.</p>
      </article>
    </div>
  </section>
</template>

<script setup>
/** Appliances dashboard: real figures from Beverly's records, with insights and the way in to each appliance screen. */
import { computed, onMounted } from "vue";
import PeriodPicker from "../charts/PeriodPicker.vue";
import TrendChart from "../charts/TrendChart.vue";
import BarList from "../charts/BarList.vue";
import InsightList from "../charts/InsightList.vue";
import { usePueAnalyticsStore } from "../stores/pue-analytics-store.js";
import { useBatterySwapAuthStore } from "../stores/auth";
import { nairaFromMinor } from "../services/pue-api.js";
import { applianceInsights } from "../services/pue-insights.js";

const store = usePueAnalyticsStore();
const auth = useBatterySwapAuthStore();
const OPERATOR_ROLES = ["super-admin", "operations-manager", "operations-officer"];
const canEdit = computed(() => OPERATOR_ROLES.includes(auth.user?.role ?? ""));

const a = computed(() => store.appliances);
const loading = computed(() => store.appliancesLoading);
const naira = (minor) => nairaFromMinor(minor);
const show = (value) => (value === null || value === undefined ? "—" : String(value));

const owedNote = computed(() => {
  if (!a.value) return "Not loaded";
  const t = a.value.totals;
  return t.activeSales === 1 ? "On 1 active sale" : `Across ${t.activeSales} active sales`;
});

/** The stock bar is drawn from real unit counts only. Unknown counts draw an empty track, never a guess. */
const segments = computed(() => {
  const s = a.value?.unitsByStatus;
  if (!s) return [];
  return [{ key: "stock", value: s.in_stock }, { key: "sold", value: s.sold }, { key: "faulty", value: s.faulty }].filter((x) => x.value > 0);
});
const stockSummary = computed(() => {
  const s = a.value?.unitsByStatus;
  return s ? `${s.in_stock} in stock, ${s.sold} sold, ${s.faulty} faulty` : "Stock not loaded";
});
const fixNote = computed(() => {
  const h = a.value?.totals.medianHoursToResolve;
  return h === null || h === undefined ? "No fault has been fixed in this period yet." : `Faults fixed in this period took ${h} hours (median).`;
});
const typeItems = computed(() => (a.value?.byType ?? []).map((t) => ({ key: t.typeId, label: t.name, value: t.sold, display: String(t.sold), note: `${naira(t.valueMinor)} of sales` })));
const insights = computed(() => applianceInsights(a.value));

function reload() { return store.loadAppliances(store.days); }
function change(days) { return store.loadAppliances(days); }
onMounted(reload);
</script>

<style scoped>
.board-split { min-width: 0; }
.dash-tools { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.swap-link { margin-left: 0; font-size: 13px; }
.fix-note { margin-top: 16px; }
.app-steps { margin: 14px 0 0; padding-left: 20px; display: grid; gap: 10px; font-size: 14px; line-height: 1.5; }
.app-steps a { color: var(--acob-accent); font-weight: 700; text-underline-offset: 3px; }
.app-note { margin: 12px 0 0; color: var(--acob-muted); font-size: 14px; line-height: 1.6; }
</style>
