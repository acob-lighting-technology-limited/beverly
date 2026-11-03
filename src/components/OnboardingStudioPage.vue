<template>
  <section class="onboarding-studio">
    <BasePageHeader
      class="studio-header"
      title="Station Onboarding Studio"
      description="Set up a station and track its readiness."
    >
      <template #eyebrow><span class="studio-eyebrow">Station setup</span></template>
      <template #actions>
        <div class="studio-header-actions">
          <BaseButton variant="ghost" :loading="loading" @click="refreshBoard">Refresh</BaseButton>
          <BaseButton variant="primary" @click="openStep('station')">New Station</BaseButton>
        </div>
      </template>
    </BasePageHeader>

    <BaseCard v-if="error" class="studio-alert studio-alert-error" role="alert">
      <strong>Board load failed.</strong>
      <span>{{ error }}</span>
    </BaseCard>

    <div class="studio-topbar">
      <BaseCard class="studio-picker-card">
        <label class="studio-picker">
          <span>Working station</span>
          <BaseSelect v-model="selectedStation" @change="refreshBoard">
            <option value="">Select station</option>
            <option v-for="option in stationOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </BaseSelect>
        </label>
      </BaseCard>

      <BaseCard class="studio-status-card">
        <div class="studio-status-copy">
          <span class="studio-status-label">Station readiness</span>
          <strong>{{ selectedStationLabel }}</strong>
        </div>
        <div class="studio-status-badges">
          <span class="base-badge" :class="provisioningReady ? 'base-badge--success' : 'base-badge--warning'">Provisioning {{ provisioningReady ? "ready" : "pending" }}</span>
          <span class="base-badge" :class="vendingReady ? 'base-badge--success' : 'base-badge--warning'">Vending {{ vendingReady ? "ready" : "blocked" }}</span>
          <span class="base-badge" :class="reportReady ? 'base-badge--success' : 'base-badge--warning'">Reports {{ reportReady ? "ready" : "blocked" }}</span>
        </div>
      </BaseCard>
    </div>

    <div class="studio-metric-grid" aria-label="Station records">
      <BaseCard v-for="card in metricCards" :key="card.label" class="studio-metric-card">
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </BaseCard>
    </div>

    <div class="studio-layout">
      <BaseCard class="studio-panel">
        <div class="studio-panel-head">
          <div>
            <span class="studio-eyebrow">Onboarding</span>
            <h2>Setup steps</h2>
            <p>Complete the steps for your station.</p>
          </div>
          <span class="studio-progress">{{ completedStepCount }} / {{ steps.length }} ready</span>
        </div>

        <div class="studio-step-list">
          <article v-for="step in steps" :key="step.id" class="studio-step" :class="stepClass(step)">
            <div class="studio-step-order">{{ step.order }}</div>
            <div class="studio-step-copy">
              <div class="studio-step-head">
                <h3>{{ step.title }}</h3>
                <span class="base-badge" :class="stepBadgeClass(step)">{{ stepStateLabel(step) }}</span>
              </div>
              <p>{{ step.body }}</p>
              <div class="studio-step-meta">
                <span>{{ stepMetricLabel(step) }}</span>
                <span>{{ step.helper }}</span>
              </div>
            </div>
            <div class="studio-step-actions">
              <BaseButton
                variant="primary"
                :disabled="stepNeedsStation(step) && !selectedStation"
                @click="openStep(step.id)"
              >
                {{ step.actionLabel }}
              </BaseButton>
              <BaseButton variant="ghost" :aria-label="`Open ${step.title} page`" @click="jumpTo(step.routeHash)">Open page</BaseButton>
            </div>
          </article>
        </div>
      </BaseCard>

      <div class="studio-side">
        <BaseCard class="studio-panel">
          <div class="studio-panel-head">
            <div>
              <span class="studio-eyebrow">Shortcuts</span>
              <h2>Quick links</h2>
              <p>Available when your station is ready.</p>
            </div>
          </div>
          <div class="studio-link-list">
            <BaseButton variant="ghost" @click="jumpTo('#/token-generate/credit-token')" :disabled="!vendingReady">Open Credit Vending</BaseButton>
            <BaseButton variant="ghost" @click="jumpTo('#/remote-operation/remote-meter-reading')" :disabled="!remoteReady">Open Remote Reading</BaseButton>
            <BaseButton variant="ghost" @click="jumpTo('#/prepay-report/long-nonpurchase-situation')" :disabled="!reportReady">Open Nonpurchase Report</BaseButton>
            <BaseButton variant="ghost" @click="jumpTo('#/prepay-report/daily-data-meter')" :disabled="!reportReady">Open Interval Data</BaseButton>
          </div>
        </BaseCard>

        <BaseCard class="studio-panel">
          <div class="studio-panel-head">
            <div>
              <span class="studio-eyebrow">Before you start</span>
              <h2>Setup notes</h2>
              <p>Keep records aligned.</p>
            </div>
          </div>
          <ul class="studio-note-list">
            <li>Select a station first.</li>
            <li>Gateways and meters belong to a station.</li>
            <li>Tariffs are shared across stations.</li>
            <li>Accounts link customers, meters and tariffs.</li>
          </ul>
          <p v-if="lastCompletion" class="studio-last-completion">{{ lastCompletion }}</p>
        </BaseCard>
      </div>
    </div>

    <ActionModal
      v-if="modalRoute && modalAction"
      :route="modalRoute"
      :action="modalAction"
      :row="modalRow"
      @close="closeModal"
      @done="handleDone"
    />
  </section>
</template>

<script>
import ActionModal from "./ActionModal.vue";
import BaseButton from "./base/BaseButton.vue";
import BaseCard from "./base/BaseCard.vue";
import BasePageHeader from "./base/BasePageHeader.vue";
import BaseSelect from "./base/BaseSelect.vue";
import { routeManifest } from "../data/route-manifest.js";
import { postApi } from "../services/api.js";
import {
  buildOnboardingBoard,
  normalizeOnboardingRows,
  normalizeOnboardingTotal,
  onboardingPrefillRow,
  onboardingRouteHashes,
  payloadStationIdFromAction,
  selectStationValue,
  stationOptionsFromRows
} from "../services/onboarding-studio-service.mjs";
import { toastWarn } from "../services/toast.js";

const stepOrder = [
  {
    id: "station",
    order: "01",
    title: "Register station",
    body: "Create the station first. Everything else points here.",
    helper: "This is the base record.",
    actionLabel: "Create Station",
    routeHash: onboardingRouteHashes.station
  },
  {
    id: "gateway",
    order: "02",
    title: "Attach gateway",
    body: "Add the gateway so telemetry has a home.",
    helper: "Needed for live reads.",
    actionLabel: "Create Gateway",
    routeHash: onboardingRouteHashes.gateway
  },
  {
    id: "meter",
    order: "03",
    title: "Provision meter",
    body: "Create the meter with protocol and station binding.",
    helper: "This fills the live gap.",
    actionLabel: "Create Meter",
    routeHash: onboardingRouteHashes.meter
  },
  {
    id: "tariff",
    order: "04",
    title: "Publish tariff",
    body: "Keep one valid tariff ready for vending.",
    helper: "This stays global.",
    actionLabel: "Create Tariff",
    routeHash: onboardingRouteHashes.tariff
  },
  {
    id: "customer",
    order: "05",
    title: "Register customer",
    body: "Create the customer inside the target station.",
    helper: "Customer and meter must align.",
    actionLabel: "Create Customer",
    routeHash: onboardingRouteHashes.customer
  },
  {
    id: "account",
    order: "06",
    title: "Bind account",
    body: "Link customer, meter, tariff, and station.",
    helper: "This unlocks vending.",
    actionLabel: "Create Account",
    routeHash: onboardingRouteHashes.account
  }
];

const emptyListResponse = { data: { data: [], total: 0 }, result: { data: [], total: 0 } };

export default {
  name: "OnboardingStudioPage",
  components: { ActionModal, BaseButton, BaseCard, BasePageHeader, BaseSelect },
  props: {
    route: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      loading: false,
      error: "",
      metrics: {
        stations: 0,
        gateways: 0,
        meters: 0,
        customers: 0,
        accounts: 0,
        tariffs: 0
      },
      stationOptions: [],
      selectedStation: "",
      board: buildOnboardingBoard(),
      modalAction: "",
      modalRoute: null,
      modalRow: {},
      lastCompletion: ""
    };
  },
  computed: {
    steps() {
      return stepOrder;
    },
    completedStepCount() {
      return this.steps.filter((step) => this.stepCompleted(step)).length;
    },
    metricCards() {
      return [
        { label: "Stations", value: this.metrics.stations },
        { label: "Gateways", value: this.metrics.gateways },
        { label: "Meters", value: this.metrics.meters },
        { label: "Customers", value: this.metrics.customers },
        { label: "Accounts", value: this.metrics.accounts },
        { label: "Tariffs", value: this.metrics.tariffs }
      ];
    },
    selectedStationLabel() {
      const option = this.stationOptions.find((row) => row.value === this.selectedStation);
      return option?.label || this.selectedStation || "No station selected";
    },
    provisioningReady() {
      return this.board.readiness.provisioning;
    },
    vendingReady() {
      return this.board.readiness.vending;
    },
    remoteReady() {
      return this.board.readiness.remote;
    },
    reportReady() {
      return this.board.readiness.report;
    },
    hasSelectedStation() {
      return Boolean(String(this.selectedStation || "").trim());
    }
  },
  created() {
    this.refreshBoard();
  },
  methods: {
    async refreshBoard() {
      this.loading = true;
      this.error = "";
      try {
        const stations = await postApi("/api/station/read", this.stationPayload());
        const stationRows = normalizeOnboardingRows(stations);
        this.stationOptions = stationOptionsFromRows(stationRows);
        this.selectedStation = selectStationValue(this.selectedStation, this.stationOptions);

        const scopedPayload = this.stationScopedPayload();
        const [gateways, meters, customers, accounts, tariffs] = await Promise.all([
          this.hasSelectedStation ? postApi("/api/gateway/read", scopedPayload) : emptyListResponse,
          this.hasSelectedStation ? postApi("/api/meter/read", scopedPayload) : emptyListResponse,
          this.hasSelectedStation ? postApi("/api/customer/read", scopedPayload) : emptyListResponse,
          this.hasSelectedStation ? postApi("/api/account/read", scopedPayload) : emptyListResponse,
          postApi("/api/tariff/read", { pageNumber: 1, pageSize: 1 })
        ]);

        this.board = buildOnboardingBoard({
          stationRows,
          gatewayRows: normalizeOnboardingRows(gateways),
          meterRows: normalizeOnboardingRows(meters),
          customerRows: normalizeOnboardingRows(customers),
          accountRows: normalizeOnboardingRows(accounts),
          tariffRows: normalizeOnboardingRows(tariffs),
          selectedStation: this.selectedStation
        });
        this.metrics = {
          stations: this.board.metrics.stations,
          gateways: normalizeOnboardingTotal(gateways),
          meters: normalizeOnboardingTotal(meters),
          customers: normalizeOnboardingTotal(customers),
          accounts: normalizeOnboardingTotal(accounts),
          tariffs: normalizeOnboardingTotal(tariffs)
        };
      } catch (error) {
        this.error = error?.message || "Unable to load onboarding board";
      } finally {
        this.loading = false;
      }
    },
    stationPayload() {
      return { pageNumber: 1, pageSize: 500 };
    },
    stationScopedPayload() {
      return this.hasSelectedStation
        ? { stationId: this.selectedStation, pageNumber: 1, pageSize: 500 }
        : { pageNumber: 1, pageSize: 1 };
    },
    routeFor(hash) {
      return routeManifest.find((route) => route.hash === hash) || null;
    },
    openStep(stepId) {
      const routeHash = onboardingRouteHashes[stepId];
      const route = this.routeFor(routeHash);
      if (!route) {
        toastWarn("Route missing for onboarding step.");
        return;
      }
      if (this.stepNeedsStation({ id: stepId }) && !this.selectedStation) {
        toastWarn("Select or create a station first.");
        return;
      }
      this.modalRoute = route;
      this.modalAction = "Add";
      this.modalRow = this.prefillRow(stepId);
    },
    prefillRow(stepId) {
      return onboardingPrefillRow(stepId, this.board);
    },
    closeModal() {
      this.modalAction = "";
      this.modalRoute = null;
      this.modalRow = {};
    },
    async handleDone(result) {
      const stationId = payloadStationIdFromAction(result);
      if (stationId && (!this.selectedStation || this.modalRoute?.hash === onboardingRouteHashes.station)) {
        this.selectedStation = stationId;
      }
      this.lastCompletion = `${this.modalRoute?.title || "Step"} completed at ${new Date().toLocaleTimeString()}.`;
      this.closeModal();
      await this.refreshBoard();
    },
    jumpTo(hash) {
      window.location.hash = hash;
    },
    stepMetricLabel(step) {
      const lookup = {
        station: `${this.metrics.stations} station record${this.metrics.stations === 1 ? "" : "s"}`,
        gateway: `${this.metrics.gateways} gateway record${this.metrics.gateways === 1 ? "" : "s"}`,
        meter: `${this.metrics.meters} meter record${this.metrics.meters === 1 ? "" : "s"}`,
        tariff: `${this.metrics.tariffs} tariff record${this.metrics.tariffs === 1 ? "" : "s"}`,
        customer: `${this.metrics.customers} customer record${this.metrics.customers === 1 ? "" : "s"}`,
        account: `${this.metrics.accounts} account binding${this.metrics.accounts === 1 ? "" : "s"}`
      };
      return lookup[step.id] || "No data";
    },
    stepCompleted(step) {
      if (step.id === "station") return this.hasSelectedStation;
      if (step.id === "tariff") return this.metrics.tariffs > 0;
      if (step.id === "gateway") return this.metrics.gateways > 0;
      if (step.id === "meter") return this.metrics.meters > 0;
      if (step.id === "customer") return this.metrics.customers > 0;
      if (step.id === "account") return this.metrics.accounts > 0;
      return false;
    },
    stepNeedsStation(step) {
      return !["station", "tariff"].includes(step.id);
    },
    stepStateLabel(step) {
      if (this.stepCompleted(step)) return "Ready";
      if (this.stepNeedsStation(step) && !this.hasSelectedStation) return "Waiting";
      return "Open";
    },
    stepBadgeClass(step) {
      if (this.stepCompleted(step)) return "base-badge--success";
      if (this.stepNeedsStation(step) && !this.hasSelectedStation) return "base-badge--warning";
      return "";
    },
    stepClass(step) {
      return {
        "is-ready": this.stepCompleted(step),
        "is-waiting": this.stepNeedsStation(step) && !this.hasSelectedStation
      };
    }
  }
};
</script>

<style scoped>
.onboarding-studio { display: grid; gap: 18px; min-width: 0; }
.studio-header :deep(.base-page-header__copy) { max-width: 640px; }
.studio-eyebrow, .studio-picker span, .studio-status-label, .studio-metric-card span {
  color: var(--text-muted); font-size: 11px; font-weight: 700;
  letter-spacing: .075em; text-transform: uppercase;
}
.studio-eyebrow { display: block; margin-bottom: 5px; color: var(--primary); }
.studio-header-actions, .studio-status-badges { display: flex; flex-wrap: wrap; gap: 8px; }
.studio-header-actions :deep(.base-button) { min-height: 44px; }
.studio-alert, .studio-picker-card, .studio-status-card, .studio-panel { padding: 16px; }
.studio-alert { display: flex; flex-wrap: wrap; gap: 8px; }
.studio-alert-error { border: 1px solid color-mix(in srgb, var(--color-danger) 24%, transparent); background: var(--color-danger-soft); color: var(--color-danger); }
.studio-topbar { display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); gap: 12px; }
.studio-picker { display: grid; gap: 8px; }
.studio-status-card { display: grid; align-content: center; gap: 10px; min-width: 0; }
.studio-status-copy { display: grid; gap: 4px; min-width: 0; }
.studio-status-copy strong { color: var(--text-strong); font-size: 17px; line-height: 1.3; overflow-wrap: anywhere; }
.studio-status-badges .base-badge { white-space: normal; }
.studio-metric-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
.studio-metric-card { display: grid; align-content: start; gap: 6px; min-width: 0; padding: 14px 16px; }
.studio-metric-card strong { color: var(--text-strong); font-size: 24px; line-height: 1; font-variant-numeric: tabular-nums; }
.studio-layout { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(240px, .75fr); gap: 14px; align-items: start; }
.studio-panel, .studio-side { display: grid; gap: 14px; min-width: 0; }
.studio-panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.studio-panel-head h2, .studio-step-head h3 { margin: 0; color: var(--text-strong); }
.studio-panel-head h2 { font-size: 18px; line-height: 1.25; }
.studio-panel-head p, .studio-step-copy p, .studio-step-meta, .studio-note-list, .studio-last-completion { margin: 0; color: var(--text-muted); }
.studio-panel-head p { margin-top: 4px; font-size: 13px; }
.studio-progress { flex: none; padding: 6px 9px; border-radius: 999px; background: var(--primary-light); color: var(--primary); font-size: 12px; font-weight: 700; white-space: nowrap; }
.studio-step-list, .studio-link-list { display: grid; gap: 8px; }
.studio-step { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: start; gap: 12px; padding: 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-card); }
.studio-step.is-ready { border-color: color-mix(in srgb, var(--color-success) 28%, var(--border-color)); }
.studio-step-order { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: var(--primary-light); color: var(--primary); font-size: 12px; font-weight: 800; }
.studio-step-copy { display: grid; gap: 6px; min-width: 0; }
.studio-step-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.studio-step-head h3 { font-size: 15px; line-height: 1.35; }
.studio-step-copy p { font-size: 13px; line-height: 1.5; }
.studio-step-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; line-height: 1.4; }
.studio-step-meta span:first-child { color: var(--text-strong); font-weight: 600; }
.studio-step-actions { display: grid; gap: 6px; }
.studio-step-actions :deep(.base-button), .studio-link-list :deep(.base-button) { min-height: 44px; }
.studio-link-list :deep(.base-button) { justify-content: flex-start; text-align: left; }
.studio-note-list { display: grid; gap: 9px; padding-left: 18px; font-size: 13px; line-height: 1.5; }
.studio-last-completion { font-size: 12px; }
@media (max-width: 1180px) {
  .studio-metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .studio-layout { grid-template-columns: minmax(0, 1fr); }
  .studio-side { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
}
@media (max-width: 640px) {
  .onboarding-studio { gap: 12px; }
  .studio-topbar { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .studio-metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .studio-metric-card { padding: 12px; }
  .studio-metric-card strong { font-size: 21px; }
  .studio-panel, .studio-picker-card, .studio-status-card { padding: 14px; }
  .studio-side { grid-template-columns: minmax(0, 1fr); }
  .studio-step { grid-template-columns: 32px minmax(0, 1fr); gap: 10px; padding: 12px; }
  .studio-step-order { width: 32px; height: 32px; }
  .studio-step-actions { grid-column: 2; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .studio-step-actions :deep(.base-button) { padding-inline: 8px; }
}
@media (max-width: 360px) {
  .studio-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .studio-step-actions { grid-column: 1 / -1; }
}
</style>
