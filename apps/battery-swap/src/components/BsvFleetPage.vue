<template>
  <section class="bsv-fleet-page" aria-label="Bike & Battery Registry">
    <!-- Page header -->
    <header class="bsv-fleet-header">
      <div class="bsv-fleet-header-left">
        <h1 class="bsv-fleet-title">
          {{ activeView === 'bikes' ? 'Bike & Battery Registry' : 'Merchant Batteries' }}
        </h1>
        <p class="bsv-fleet-subtitle">
          <template v-if="activeView === 'bikes'">
            {{ fleetStore.totalBikes }} EV Bikes tracked via Yunhe IoT GPS
          </template>
          <template v-else>
            {{ fleetStore.totalBatteries }} Yunhe Smart Lithium Packs &bull; OEM Fleet Telemetry
          </template>
        </p>
      </div>

      <div class="bsv-fleet-header-actions">
        <!-- View Mode Switcher -->
        <div class="bsv-mode-switcher">
          <button
            class="bsv-mode-btn"
            :class="{ active: activeView === 'bikes' }"
            @click="activeView = 'bikes'"
          >
            🚲 EV Bikes
          </button>
          <button
            class="bsv-mode-btn"
            :class="{ active: activeView === 'batteries' }"
            @click="activeView = 'batteries'"
          >
            🔋 Merchant Batteries
          </button>
        </div>

        <template v-if="activeView === 'bikes'">
          <button class="bsv-btn bsv-btn--ghost" @click="exportCsv">↓ Export CSV</button>
          <button class="bsv-btn bsv-btn--primary" @click="openSwap(null)">⚡ Record Swap</button>
        </template>
        <template v-else>
          <button class="bsv-btn bsv-btn--blue" @click="showAddBatteryModal = true">
            + Merchants add batteries
          </button>
          <button class="bsv-btn bsv-btn--cyan" @click="showBatchImportModal = true">
            + Batch import merchant batteries
          </button>
          <button
            class="bsv-btn bsv-btn--danger"
            :disabled="selectedBatSns.length === 0"
            @click="handleBatchRemove"
          >
            Batch battery removal ({{ selectedBatSns.length }})
          </button>
        </template>
      </div>
    </header>

    <!-- Notification / Action Toast -->
    <div v-if="actionToast" class="bsv-swap-toast" :class="{ 'bsv-toast--err': actionToastError }" role="status" aria-live="polite">
      <span class="bsv-toast-text">{{ actionToast }}</span>
      <button class="bsv-toast-close" aria-label="Dismiss message" @click="actionToast = null">✕</button>
    </div>

    <!-- ── Beverly Wallet Standard Fleet KPIs ────────────────── -->
    <section class="bw-kpi-grid bsv-fleet-kpi-grid" aria-label="Fleet Summary KPIs">
      <article class="bw-kpi featured">
        <div class="bw-kpi-row">
          <span class="bw-kpi-label">{{ activeView === 'bikes' ? 'TOTAL FLEET' : 'TOTAL BATTERIES' }}</span>
          <span class="bw-kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 9l3-4h3l2 4"/><path d="M19 17.5V14l-4-4"/>
            </svg>
          </span>
        </div>
        <strong class="bw-kpi-value">{{ activeView === 'bikes' ? fleetStore.totalBikes : fleetStore.totalBatteries }}</strong>
        <span class="bw-kpi-note">{{ activeView === 'bikes' ? 'Active EV Fleet in Registry' : 'Registered Yunhe Packs' }}</span>
      </article>

      <article class="bw-kpi info-tone">
        <div class="bw-kpi-row">
          <span class="bw-kpi-label">{{ activeView === 'bikes' ? 'ON THE ROAD' : 'ONLINE' }}</span>
          <span class="bw-kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>
            </svg>
          </span>
        </div>
        <strong class="bw-kpi-value text-success">{{ activeView === 'bikes' ? onlineCount : fleetStore.onlineBatteriesCount }}</strong>
        <span class="bw-kpi-note">Transmitting Live Telemetry</span>
      </article>

      <article class="bw-kpi warn-tone">
        <div class="bw-kpi-row">
          <span class="bw-kpi-label">{{ activeView === 'bikes' ? 'IDLE / PARKED' : 'CHARGING AT HUBS' }}</span>
          <span class="bw-kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </span>
        </div>
        <strong class="bw-kpi-value text-warning">{{ activeView === 'bikes' ? idleCount : fleetStore.chargingBatteriesCount }}</strong>
        <span class="bw-kpi-note">{{ activeView === 'bikes' ? 'Stationary or Off-Shift' : 'Replenishing in Lockers' }}</span>
      </article>

      <article class="bw-kpi danger-tone">
        <div class="bw-kpi-row">
          <span class="bw-kpi-label">{{ activeView === 'bikes' ? 'IMPOUNDED' : 'NEEDS SWAP (<20%)' }}</span>
          <span class="bw-kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M12 9v4M12 17h.01"/><path d="M10.3 3.3L2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"/>
            </svg>
          </span>
        </div>
        <strong class="bw-kpi-value text-danger">{{ activeView === 'bikes' ? impoundedCount : lowBatteryCount }}</strong>
        <span class="bw-kpi-note">{{ activeView === 'bikes' ? 'Security Hold / Arrears' : 'Depleted Charge Alert' }}</span>
      </article>
    </section>

    <!-- ─────────────────────────────────────────────────────────── -->
    <!-- VIEW A: EV BIKES REGISTRY TABLE                            -->
    <!-- ─────────────────────────────────────────────────────────── -->
    <template v-if="activeView === 'bikes'">
      <div class="bsv-fleet-toolbar">
        <input
          v-model="search"
          class="bsv-toolbar-search"
          placeholder="Search bike, rider, plate or battery SN..."
          type="search"
        />
        <select v-model="filterStatus" class="bsv-toolbar-select">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="idle">Idle</option>
          <option value="impounded">Impounded</option>
        </select>
        <select v-model="filterSoc" class="bsv-toolbar-select">
          <option value="all">All Charge Levels</option>
          <option value="low">Low (&lt;20%)</option>
          <option value="medium">Medium (20–60%)</option>
          <option value="high">High (&gt;60%)</option>
        </select>
        <button
          class="bsv-pill-filter"
          :class="{ 'bsv-pill-filter--active': filterSoc === 'low' }"
          @click="filterSoc = filterSoc === 'low' ? 'all' : 'low'"
        >⚡ Needs Swap (&lt;20%)</button>
        <span class="bsv-fleet-count">{{ filteredBikes.length }} bikes</span>
      </div>

      <div class="bsv-fleet-table-wrap">
        <table class="bsv-fleet-table" aria-label="Bike registry">
          <thead>
            <tr>
              <th>Bike &amp; Model</th>
              <th>Assigned Rider</th>
              <th>Battery SN</th>
              <th>Charge Level</th>
              <th>Voltage</th>
              <th>Speed / Odo</th>
              <th>Location</th>
              <th>Motor</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="bike in pageBikes"
              :key="bike.id"
              :class="{
                'bsv-row--low': bike.telemetry.soc < 20,
                'bsv-row--impounded': bike.status === 'impounded'
              }"
            >
              <td>
                <div class="bsv-bike-id-cell">
                  <span class="bsv-bike-id">{{ bike.id }}</span>
                  <span class="bsv-bike-model">{{ bike.model }}</span>
                </div>
              </td>
              <td>
                <div class="bsv-rider-cell">
                  <span class="bsv-rider-name">{{ bike.riderName }}</span>
                  <span class="bsv-rider-phone">{{ bike.riderPhone }}</span>
                </div>
              </td>
              <td>
                <span class="bsv-mono bsv-link" @click="openBatteryDetail(bike.batterySn)">
                  {{ bike.batterySn }}
                </span>
              </td>
              <td>
                <div class="bsv-soc-cell">
                  <div class="bsv-soc-bar-wrap">
                    <div
                      class="bsv-soc-bar"
                      :style="{
                        width: bike.telemetry.soc + '%',
                        background: socColor(bike.telemetry.soc)
                      }"
                    ></div>
                  </div>
                  <span class="bsv-soc-pct" :style="{ color: socColor(bike.telemetry.soc) }">
                    {{ bike.telemetry.soc }}%
                  </span>
                </div>
              </td>
              <td>
                <span class="bsv-mono">{{ bike.telemetry.voltage }}V</span>
              </td>
              <td>
                <span class="bsv-mono font-bold">{{ bike.telemetry.speed }} km/h</span>
                <span class="bsv-odo">{{ Number(bike.telemetry.mileage || 0).toFixed(1) }} km</span>
              </td>
              <td>
                <span class="bsv-location">{{ bike.telemetry.city }}</span>
                <span v-if="!bike.telemetry.online" class="bsv-offline-tag">Offline</span>
              </td>
              <td>
                <span
                  class="bsv-motor-badge"
                  :class="bike.telemetry.d_fet ? 'bsv-motor-badge--on' : 'bsv-motor-badge--off'"
                >
                  {{ bike.telemetry.d_fet ? 'ON' : 'CUT' }}
                </span>
              </td>
              <td>
                <div class="bsv-row-actions">
                  <button class="bsv-action-btn bsv-action-btn--primary" @click="openSwap(bike)">Swap</button>
                  <button class="bsv-action-btn" @click="openCrm(bike)">CRM</button>
                  <button class="bsv-action-btn" @click="openBatteryDetail(bike.batterySn)">Inspect</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination for Bikes -->
      <div class="bsv-pagination">
        <button class="bsv-page-btn" :disabled="page <= 1" @click="page--">&lsaquo; Prev</button>
        <span class="bsv-page-info">Page {{ page }} of {{ totalPages }}</span>
        <button class="bsv-page-btn" :disabled="page >= totalPages" @click="page++">Next &rsaquo;</button>
      </div>
    </template>

    <!-- ─────────────────────────────────────────────────────────── -->
    <!-- VIEW B: MERCHANT BATTERIES TABLE (YUNHE OEM SCREENSHOT 1 & 2)-->
    <!-- ─────────────────────────────────────────────────────────── -->
    <template v-else>
      <!-- Filters matching Screenshot 1 -->
      <div class="bsv-yunhe-filter-bar">
        <div class="bsv-filter-input-wrap">
          <input
            v-model="batSearchNumber"
            type="text"
            placeholder="Please enter the battery number."
            class="bsv-y-input"
          />
        </div>
        <div class="bsv-filter-input-wrap">
          <input
            v-model="batSearchSn"
            type="text"
            placeholder="Please enter SN"
            class="bsv-y-input"
          />
        </div>
        <div class="bsv-filter-input-wrap">
          <select v-model="batSearchStation" class="bsv-y-select">
            <option value="">Please enter the website/hub address.</option>
            <option v-for="st in fleetStore.stations" :key="st.id" :value="st.id">
              {{ st.name }} ({{ st.city }})
            </option>
          </select>
        </div>
        <div class="bsv-filter-btns">
          <button class="bsv-btn bsv-btn--green" @click="applyBatFilter">
            🔍 search
          </button>
          <button class="bsv-btn bsv-btn--amber" @click="resetBatFilter">
            ↺ Reset
          </button>
        </div>
      </div>

      <!-- Full Yunhe Batteries Data Table -->
      <div class="bsv-fleet-table-wrap">
        <table class="bsv-fleet-table bsv-yunhe-table" aria-label="Merchant Batteries">
          <thead>
            <tr>
              <th style="width: 32px;">
                <input
                  type="checkbox"
                  :checked="selectedBatSns.length === pageBatteries.length && pageBatteries.length > 0"
                  @change="toggleSelectAllBats"
                />
              </th>
              <th>Battery number</th>
              <th>SN</th>
              <th>Signal</th>
              <th>Distance traveled (km)</th>
              <th>Voltage (V)</th>
              <th>Current (A)</th>
              <th>Battery life (%)</th>
              <th>Capacity (AH)</th>
              <th>Loop count</th>
              <th>IMSI</th>
              <th>state</th>
              <th>Online status</th>
              <th>Update time</th>
              <th>operate</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bat in pageBatteries" :key="bat.sn">
              <td>
                <input
                  type="checkbox"
                  :value="bat.sn"
                  v-model="selectedBatSns"
                />
              </td>
              <td>
                <a class="bsv-part-no font-mono" @click="openBatteryDetail(bat.sn)">
                  {{ bat.batteryNumber }}
                </a>
              </td>
              <td>
                <span class="bsv-sn-mono font-mono">{{ bat.sn }}</span>
              </td>
              <td>{{ bat.signal || 18 }}</td>
              <td>{{ (bat.distanceKm || 0).toFixed(2) }}</td>
              <td class="font-mono">{{ (bat.voltage || 0).toFixed(1) }}</td>
              <td class="font-mono">{{ (bat.current || 0).toFixed(2) }}</td>
              <td>
                <span class="font-bold" :style="{ color: socColor(bat.soc) }">{{ bat.soc }}%</span>
              </td>
              <td class="font-mono">{{ (bat.capacityAh || 20.93).toFixed(2) }}</td>
              <td>{{ bat.loopCount || 54 }}</td>
              <td class="font-mono bsv-imsi-cell">{{ bat.imsi || '4602400...' }}</td>
              <td>
                <span class="bsv-state-pill" :class="bat.state">{{ bat.state }}</span>
              </td>
              <td>
                <span :class="bat.onlineStatus === 'Online' ? 'text-success' : 'text-danger'">
                  {{ bat.onlineStatus }}
                </span>
              </td>
              <td class="bsv-time-cell">{{ bat.updateTime }}</td>
              <td class="bsv-operate-cell">
                <div class="bsv-dropdown-wrap">
                  <button
                    class="bsv-operate-btn"
                    @click.stop="toggleOperateMenu(bat.sn)"
                  >
                    operate ▾
                  </button>

                  <!-- Operate Dropdown Matching Screenshot 2 -->
                  <div v-if="openOperateSn === bat.sn" class="bsv-operate-menu">
                    <button class="bsv-op-item" @click="triggerCommand(bat.sn, 'details')">
                      Details
                    </button>
                    <button class="bsv-op-item" @click="triggerCommand(bat.sn, 'unbind_battery')">
                      Unbind battery
                    </button>
                    <button class="bsv-op-item" @click="triggerCommand(bat.sn, 'reboot_dtu')">
                      Reboot DTU
                    </button>
                    <button class="bsv-op-item" @click="triggerCommand(bat.sn, 'restart_bms')">
                      Restart MBS
                    </button>
                    <button class="bsv-op-item text-danger" @click="triggerCommand(bat.sn, 'turn_off_cd_fet')">
                      Turn off C/D FET
                    </button>
                    <button class="bsv-op-item text-warning" @click="triggerCommand(bat.sn, 'turn_off_c_fet')">
                      Turn off C FET
                    </button>
                    <button class="bsv-op-item text-danger" @click="triggerCommand(bat.sn, 'turn_off_d_fet')">
                      Turn off D FET
                    </button>
                    <button class="bsv-op-item text-success" @click="triggerCommand(bat.sn, 'enable_cd_fet')">
                      Enable C/D FET
                    </button>
                    <button class="bsv-op-item" @click="triggerCommand(bat.sn, 'get_mos_state')">
                      MOS state
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination for Batteries -->
      <div class="bsv-pagination">
        <button class="bsv-page-btn" :disabled="batPage <= 1" @click="batPage--">&lsaquo; Prev</button>
        <span class="bsv-page-info">Page {{ batPage }} of {{ totalBatPages }}</span>
        <button class="bsv-page-btn" :disabled="batPage >= totalBatPages" @click="batPage++">Next &rsaquo;</button>
      </div>
    </template>

    <!-- Modals -->
    <BikeCustomerCrmModal
      v-if="crmBikeId"
      :bike-id="crmBikeId"
      @close="crmBikeId = null"
    />

    <BatterySwapStationModal
      v-if="swapBikeId !== undefined"
      :initial-bike-id="swapBikeId"
      :bike-id="swapBikeId"
      :stations="fleetStore.stations"
      :bikes="fleetStore.bikes"
      @close="swapBikeId = undefined"
      @execute-swap="handleExecuteSwap"
    />

    <YunheBatteryDetailModal
      v-if="detailBattery"
      :battery="detailBattery"
      @close="detailBattery = null"
      @command-executed="onCommandExecuted"
    />

    <AddBatteryModal
      v-if="showAddBatteryModal"
      @close="showAddBatteryModal = false"
      @added="onBatteryAdded"
    />

    <BatchImportBatteriesModal
      v-if="showBatchImportModal"
      @close="showBatchImportModal = false"
      @imported="onBatteriesImported"
    />
  </section>
</template>

<script>
import { useBatteryFleetStore } from "../stores/battery-fleet-store.js";
import BikeCustomerCrmModal from "./BikeCustomerCrmModal.vue";
import BatterySwapStationModal from "./BatterySwapStationModal.vue";
import YunheBatteryDetailModal from "./YunheBatteryDetailModal.vue";
import AddBatteryModal from "./AddBatteryModal.vue";
import BatchImportBatteriesModal from "./BatchImportBatteriesModal.vue";

const PAGE_SIZE = 50;

export default {
  name: "BsvFleetPage",
  components: {
    BikeCustomerCrmModal,
    BatterySwapStationModal,
    YunheBatteryDetailModal,
    AddBatteryModal,
    BatchImportBatteriesModal
  },
  setup() {
    const fleetStore = useBatteryFleetStore();
    return { fleetStore };
  },
  data() {
    return {
      activeView: "bikes", // "bikes" | "batteries"
      search: "",
      filterStatus: "all",
      filterSoc: "all",
      page: 1,
      // Battery View filters
      batSearchNumber: "",
      batSearchSn: "",
      batSearchStation: "",
      batPage: 1,
      selectedBatSns: [],
      openOperateSn: null,
      // Modals
      crmBikeId: null,
      swapBikeId: undefined,
      detailBattery: null,
      showAddBatteryModal: false,
      showBatchImportModal: false,
      actionToast: null,
      actionToastError: false
    };
  },
  computed: {
    onlineCount() {
      return this.fleetStore.bikes.filter(b => b.telemetry.online).length;
    },
    idleCount() {
      return this.fleetStore.bikes.filter(b => b.status === "idle").length;
    },
    impoundedCount() {
      return this.fleetStore.bikes.filter(b => b.status === "impounded").length;
    },
    lowBatteryCount() {
      return this.fleetStore.batteries.filter(b => b.soc < 20).length;
    },
    filteredBikes() {
      let list = this.fleetStore.bikes;
      if (this.filterStatus !== "all") list = list.filter(b => b.status === this.filterStatus);
      if (this.filterSoc === "low") list = list.filter(b => b.telemetry.soc < 20);
      else if (this.filterSoc === "medium") list = list.filter(b => b.telemetry.soc >= 20 && b.telemetry.soc <= 60);
      else if (this.filterSoc === "high") list = list.filter(b => b.telemetry.soc > 60);
      if (this.search.trim()) {
        const q = this.search.toLowerCase();
        list = list.filter(b =>
          b.id.toLowerCase().includes(q) ||
          b.plateNumber.toLowerCase().includes(q) ||
          b.riderName.toLowerCase().includes(q) ||
          b.batterySn.toLowerCase().includes(q) ||
          b.telemetry.city.toLowerCase().includes(q)
        );
      }
      return list;
    },
    totalPages() {
      return Math.max(1, Math.ceil(this.filteredBikes.length / PAGE_SIZE));
    },
    pageBikes() {
      const start = (this.page - 1) * PAGE_SIZE;
      return this.filteredBikes.slice(start, start + PAGE_SIZE);
    },
    filteredBatteries() {
      let list = this.fleetStore.batteries || [];
      if (this.batSearchNumber.trim()) {
        const q = this.batSearchNumber.toLowerCase().trim();
        list = list.filter(b => b.batteryNumber.toLowerCase().includes(q));
      }
      if (this.batSearchSn.trim()) {
        const q = this.batSearchSn.toLowerCase().trim();
        list = list.filter(b => b.sn.toLowerCase().includes(q));
      }
      if (this.batSearchStation) {
        list = list.filter(b => b.assignedStationId === this.batSearchStation);
      }
      return list;
    },
    totalBatPages() {
      return Math.max(1, Math.ceil(this.filteredBatteries.length / PAGE_SIZE));
    },
    pageBatteries() {
      const start = (this.batPage - 1) * PAGE_SIZE;
      return this.filteredBatteries.slice(start, start + PAGE_SIZE);
    }
  },
  mounted() {
    window.addEventListener("click", this.closeDropdowns);
  },
  beforeUnmount() {
    window.removeEventListener("click", this.closeDropdowns);
  },
  methods: {
    closeDropdowns() {
      this.openOperateSn = null;
    },
    toggleOperateMenu(sn) {
      this.openOperateSn = this.openOperateSn === sn ? null : sn;
    },
    socColor(soc) {
      if (soc > 60) return "#22c55e";
      if (soc >= 20) return "#f59e0b";
      return "#ef4444";
    },
    openCrm(bike) {
      this.crmBikeId = bike.id;
    },
    openSwap(bike) {
      this.swapBikeId = bike ? bike.id : (this.fleetStore.selectedBikeId || this.fleetStore.bikes[0]?.id || "");
    },
    openBatteryDetail(sn) {
      const bat = this.fleetStore.batteries.find(b => b.sn === sn);
      if (bat) {
        this.detailBattery = bat;
      }
    },
    async triggerCommand(sn, command) {
      this.openOperateSn = null;
      if (command === "details") {
        this.openBatteryDetail(sn);
        return;
      }
      try {
        const res = await this.fleetStore.executeYunheCommand(sn, command);
        this.actionToast = res.message || res.statusText || "Command executed.";
        this.actionToastError = false;
        setTimeout(() => { this.actionToast = null; }, 5000);
      } catch (err) {
        this.actionToast = "Error: " + err.message;
        this.actionToastError = true;
      }
    },
    onCommandExecuted(e) {
      this.actionToast = `Command ${e.command} completed for ${e.batterySn}.`;
      setTimeout(() => { this.actionToast = null; }, 5000);
    },
    handleExecuteSwap(swap) {
      const bikeId = swap?.bikeId || this.swapBikeId || "Bike";
      const packSn = swap?.batteryOutSn ? `#${swap.batteryOutSn.slice(-6)}` : "Fresh pack";
      this.actionToast = `⚡ Swap recorded successfully for ${bikeId}! Battery ${packSn} (100% full) is active.`;
      setTimeout(() => { this.actionToast = null; }, 6000);
    },
    onBatteryAdded(bat) {
      this.actionToast = `Battery ${bat.sn} added to inventory successfully.`;
      setTimeout(() => { this.actionToast = null; }, 5000);
    },
    onBatteriesImported(count) {
      this.actionToast = `Successfully imported ${count} merchant batteries.`;
      setTimeout(() => { this.actionToast = null; }, 5000);
    },
    toggleSelectAllBats(e) {
      if (e.target.checked) {
        this.selectedBatSns = this.pageBatteries.map(b => b.sn);
      } else {
        this.selectedBatSns = [];
      }
    },
    handleBatchRemove() {
      if (!this.selectedBatSns.length) return;
      const count = this.selectedBatSns.length;
      this.fleetStore.batchRemoveBatteries(this.selectedBatSns);
      this.selectedBatSns = [];
      this.actionToast = `Removed ${count} batteries from active fleet.`;
      setTimeout(() => { this.actionToast = null; }, 5000);
    },
    applyBatFilter() {
      this.batPage = 1;
    },
    resetBatFilter() {
      this.batSearchNumber = "";
      this.batSearchSn = "";
      this.batSearchStation = "";
      this.batPage = 1;
    },
    exportCsv() {
      const rows = [
        ["Bike ID", "Model", "Plate", "Rider", "Phone", "Battery SN", "SoC", "Voltage", "City", "Status"]
      ];
      this.filteredBikes.forEach(b => {
        rows.push([b.id, b.model, b.plateNumber, b.riderName, b.riderPhone, b.batterySn, b.telemetry.soc, b.telemetry.voltage, b.telemetry.city, b.status]);
      });
      const csv = rows.map(r => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `beverly_fleet_${Date.now()}.csv`;
      a.click();
    }
  }
};
</script>

<style scoped>
.bsv-fleet-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  height: auto;
  overflow-y: visible;
  background: var(--acob-bg);
  color: var(--acob-text);
  font-family: var(--acob-font-sans);
}

.bsv-fleet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
  flex-shrink: 0;
  gap: 16px;
  flex-wrap: wrap;
}
.bsv-fleet-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--acob-text);
  margin: 0 0 4px;
}
.bsv-fleet-subtitle {
  font-size: 12.5px;
  color: var(--acob-muted);
  margin: 0;
}
.bsv-fleet-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.bsv-mode-switcher {
  display: inline-flex;
  background: var(--acob-chip, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
  padding: 3px;
  gap: 3px;
}
.bsv-mode-btn {
  padding: 6px 14px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: var(--acob-muted);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.bsv-mode-btn.active {
  background: var(--acob-brand, #008000);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 128, 0, 0.3);
}

.bsv-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.bsv-btn--ghost {
  background: transparent;
  border: 1px solid var(--acob-line);
  color: var(--acob-muted);
}
.bsv-btn--primary {
  background: var(--acob-brand, #008000);
  border: 1px solid var(--acob-brand-mint, #7dfc9a);
  color: #fff;
}
.bsv-btn--blue {
  background: #1d4ed8;
  border: 1px solid #3b82f6;
  color: #fff;
}
.bsv-btn--cyan {
  background: #0284c7;
  border: 1px solid #38bdf8;
  color: #fff;
}
.bsv-btn--green {
  background: #16a34a;
  border: 1px solid #22c55e;
  color: #fff;
}
.bsv-btn--amber {
  background: #d97706;
  border: 1px solid #f59e0b;
  color: #fff;
}
.bsv-btn--danger {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #ef4444;
}
.bsv-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.bsv-swap-toast {
  margin: 12px 24px 0;
  padding: 10px 16px;
  border-radius: var(--acob-radius-md, 8px);
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.35);
  color: var(--acob-brand-mint, #7dfc9a);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.82rem;
  font-weight: 600;
}
.bsv-toast--err {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.35);
  color: #ef4444;
}
.bsv-toast-close {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
}

/* KPI Grid */
.bsv-fleet-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px 24px 0;
  flex-shrink: 0;
}
.bsv-fleet-kpi-grid .bw-kpi {
  background: var(--acob-surface, rgba(10, 22, 15, 0.96));
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: var(--acob-radius-lg, 12px);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 108px;
}
.bsv-fleet-kpi-grid .bw-kpi-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.bsv-fleet-kpi-grid .bw-kpi-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--acob-muted);
}
.bsv-fleet-kpi-grid .bw-kpi-value {
  font-size: 1.65rem;
  font-weight: 800;
  font-family: var(--acob-font-mono, monospace);
  color: #fff;
}
.bsv-fleet-kpi-grid .bw-kpi-note {
  font-size: 0.72rem;
  color: var(--acob-subtle, rgba(242, 247, 243, 0.45));
}
.text-success { color: #22c55e !important; }
.text-warning { color: #f59e0b !important; }
.text-danger { color: #ef4444 !important; }

/* Toolbars */
.bsv-fleet-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.bsv-toolbar-search {
  flex: 1;
  min-width: 220px;
  padding: 8px 12px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  outline: none;
}
.bsv-toolbar-select {
  padding: 8px 10px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 8px;
  color: #fff;
  font-size: 12.5px;
  outline: none;
}
.bsv-toolbar-select option { background: #0b1810; }
.bsv-pill-filter {
  padding: 7px 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 20px;
  color: var(--color-danger);
  font-size: 12px;
  cursor: pointer;
}
.bsv-pill-filter--active {
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.5);
}
.bsv-fleet-count {
  font-size: 12px;
  color: var(--acob-muted);
  margin-left: 4px;
}

/* Yunhe Filter Bar (Screenshot 1) */
.bsv-yunhe-filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px 8px;
  flex-wrap: wrap;
}
.bsv-filter-input-wrap {
  flex: 1;
  min-width: 200px;
}
.bsv-y-input,
.bsv-y-select {
  width: 100%;
  padding: 8px 12px;
  background: var(--acob-chip, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: 6px;
  color: #fff;
  font-size: 12.5px;
  outline: none;
}
.bsv-y-select option { background: #0b1810; }
.bsv-filter-btns {
  display: flex;
  gap: 8px;
}

/* Tables */
.bsv-fleet-table-wrap {
  width: 100%;
  overflow-x: auto;
  padding: 0 24px;
}
.bsv-fleet-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
}
.bsv-fleet-table thead th {
  position: sticky;
  top: 0;
  padding: 10px 12px;
  background: var(--acob-surface, #0c1c11);
  color: var(--acob-muted);
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  border-bottom: 1px solid var(--acob-line);
  white-space: nowrap;
}
.bsv-fleet-table tbody tr {
  border-bottom: 1px solid var(--acob-line);
}
.bsv-fleet-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.03);
}
.bsv-fleet-table tbody td {
  padding: 9px 12px;
  vertical-align: middle;
  border-bottom: 1px solid var(--acob-line);
  white-space: nowrap;
}
.bsv-bike-id { font-weight: 700; color: #fff; }
.bsv-bike-model { font-size: 11px; color: var(--acob-muted); display: block; }
.bsv-rider-name { font-weight: 600; color: #fff; }
.bsv-rider-phone { font-size: 11px; color: var(--acob-muted); display: block; }
.bsv-mono { font-family: monospace; }
.bsv-link {
  color: var(--acob-brand-mint, #7dfc9a);
  cursor: pointer;
  text-decoration: underline;
}
.bsv-part-no {
  color: #38bdf8;
  cursor: pointer;
  font-weight: 600;
}
.bsv-part-no:hover { text-decoration: underline; }
.bsv-imsi-cell { font-size: 11px; color: var(--acob-muted); }
.bsv-time-cell { font-size: 11px; color: var(--acob-muted); }

.bsv-state-pill {
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: capitalize;
}
.bsv-state-pill.move { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.bsv-state-pill.static { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.bsv-state-pill.charge { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }

.bsv-soc-cell { display: flex; align-items: center; gap: 8px; min-width: 90px; }
.bsv-soc-bar-wrap { flex: 1; height: 5px; background: rgba(255, 255, 255, 0.08); border-radius: 3px; overflow: hidden; }
.bsv-soc-bar { height: 100%; }
.bsv-soc-pct { font-size: 11.5px; font-weight: 700; min-width: 30px; text-align: right; }
.bsv-location { font-size: 11.5px; display: block; }
.bsv-offline-tag { font-size: 10px; background: rgba(239, 68, 68, 0.12); color: #ef4444; padding: 1px 4px; border-radius: 4px; }
.bsv-motor-badge { padding: 2px 6px; border-radius: 12px; font-size: 10.5px; font-weight: 700; }
.bsv-motor-badge--on { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.bsv-motor-badge--off { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

.bsv-row-actions { display: flex; gap: 6px; }
.bsv-action-btn {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  color: var(--acob-muted);
}
.bsv-action-btn--primary {
  background: rgba(0, 128, 0, 0.15);
  border-color: rgba(0, 128, 0, 0.4);
  color: var(--acob-brand);
}

/* Operate Dropdown (Screenshot 2) */
.bsv-dropdown-wrap {
  position: relative;
  display: inline-block;
}
.bsv-operate-btn {
  padding: 4px 10px;
  border-radius: 4px;
  background: transparent;
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #38bdf8;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.bsv-operate-btn:hover {
  background: rgba(56, 189, 248, 0.1);
}
.bsv-operate-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 100;
  width: 150px;
  background: #091a10;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
  padding: 4px 0;
  display: flex;
  flex-direction: column;
}
.bsv-op-item {
  padding: 6px 12px;
  background: transparent;
  border: none;
  text-align: left;
  font-size: 12px;
  color: var(--acob-text, #f2f7f3);
  cursor: pointer;
  transition: background 0.12s;
}
.bsv-op-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* Pagination */
.bsv-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px 24px;
  border-top: 1px solid var(--acob-line);
}
.bsv-page-btn {
  padding: 6px 14px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 6px;
  color: var(--acob-muted);
  font-size: 12px;
  cursor: pointer;
}
.bsv-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.bsv-page-info { font-size: 12px; color: var(--acob-muted); }

@media (max-width: 900px) {
  .bsv-fleet-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
}
@media (max-width: 640px) {
  .bsv-fleet-header { flex-direction: column; align-items: flex-start; }
  .bsv-fleet-header-actions { width: 100%; }
  .bsv-fleet-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
}
</style>
