<template>
  <section class="ops-page" aria-label="EV Bike & Battery Swap Operations">
    <!-- Header -->
    <header class="ops-head">
      <div class="ops-head-text">
        <div class="oem-tag">Yunhe IoT &amp; Beverly Fleet</div>
        <h1>Fleet &amp; Swap Operations</h1>
        <p>Live GPS tracking, rider lease payments, and swap station inventory</p>
      </div>
      <div class="ops-head-actions">
        <button
          type="button"
          class="bw-btn bw-btn-secondary"
          :disabled="fleetStore.loading"
          @click="syncTelemetry"
        >
          <span v-if="fleetStore.loading" class="spin-icon">↻</span>
          {{ fleetStore.loading ? "Checking Telemetry..." : "Refresh Live GPS" }}
        </button>
        <button
          type="button"
          class="bw-btn bw-btn-primary"
          @click="openSwapModal()"
        >
          + Record Battery Swap
        </button>
      </div>
    </header>

    <!-- KPI Strip -->
    <div class="kpi-strip">
      <div class="kpi-cell">
        <span class="kpi-label">Total EV Bikes</span>
        <span class="kpi-value">{{ fleetStore.totalBikes }}</span>
        <span class="kpi-sub">100% battery-tracked</span>
      </div>
      <div class="kpi-cell tone-good">
        <span class="kpi-label">GPS Active</span>
        <span class="kpi-value">{{ fleetStore.onlineBikesCount }}</span>
        <span class="kpi-sub">reporting live coords</span>
      </div>
      <div class="kpi-cell tone-danger">
        <span class="kpi-label">Needs Swap (&lt;20%)</span>
        <span class="kpi-value">{{ fleetStore.lowBatteryCount }}</span>
        <span class="kpi-sub">low charge alert</span>
      </div>
      <div class="kpi-cell tone-info">
        <span class="kpi-label">Average Fleet Charge</span>
        <span class="kpi-value">{{ fleetStore.averageSoc }}%</span>
        <span class="kpi-sub">72V / 48V packs</span>
      </div>
      <div class="kpi-cell tone-warn">
        <span class="kpi-label">Lease Overdue</span>
        <span class="kpi-value">{{ fleetStore.overdueCustomers.length }}</span>
        <span class="kpi-sub">installment alerts</span>
      </div>
      <div class="kpi-cell">
        <span class="kpi-label">Swap Stations</span>
        <span class="kpi-value">{{ fleetStore.stations.length }}</span>
        <span class="kpi-sub">Lagos, Abuja, Ibadan</span>
      </div>
    </div>

    <!-- Main Navigation Tabs -->
    <nav class="nav-tab-bar" aria-label="Fleet operations sections">
      <button
        type="button"
        class="tab-link"
        :class="{ active: currentTab === 'map' }"
        @click="currentTab = 'map'"
      >
        <span class="tab-icon">🗺️</span> Live Fleet Map &amp; GPS Tracker
      </button>
      <button
        type="button"
        class="tab-link"
        :class="{ active: currentTab === 'fleet' }"
        @click="currentTab = 'fleet'"
      >
        <span class="tab-icon">🛵</span> Bike &amp; Battery Registry ({{ fleetStore.totalBikes }})
      </button>
      <button
        type="button"
        class="tab-link"
        :class="{ active: currentTab === 'crm' }"
        @click="currentTab = 'crm'"
      >
        <span class="tab-icon">👥</span> Rider Lease Accounts ({{ fleetStore.customers.length }})
      </button>
      <button
        type="button"
        class="tab-link"
        :class="{ active: currentTab === 'stations' }"
        @click="currentTab = 'stations'"
      >
        <span class="tab-icon">⚡</span> Swap Stations &amp; Racks
      </button>
      <button
        type="button"
        class="tab-link"
        :class="{ active: currentTab === 'health' }"
        @click="currentTab = 'health'"
      >
        <span class="tab-icon">🔬</span> Battery Diagnostics Lab
      </button>
    </nav>

    <!-- TAB 1: Live Map & GPRS Tracking -->
    <div v-show="currentTab === 'map'" class="tab-content">
      <BatteryGprsMap
        :bikes="fleetStore.bikes"
        :selected-bike-id="fleetStore.selectedBikeId"
        @select-bike="onSelectBike"
        @toggle-power="onTogglePower"
        @open-crm="openCustomerModal"
      />
    </div>

    <!-- TAB 2: Bike & Battery Registry -->
    <div v-show="currentTab === 'fleet'" class="tab-content">
      <div class="ops-toolbar">
        <select v-model="fleetStore.filterStatus" class="ops-select" aria-label="Filter bikes by status">
          <option value="all">All Bike Statuses</option>
          <option value="active">Active on Road</option>
          <option value="idle">Idle / Parked</option>
          <option value="impounded">Motor Disabled / Impounded</option>
        </select>

        <select v-model="fleetStore.filterSoc" class="ops-select" aria-label="Filter by charge level">
          <option value="all">All Charge Levels</option>
          <option value="low">Low Charge (&lt;= 20%)</option>
          <option value="medium">Medium Charge (21% - 60%)</option>
          <option value="high">High Charge (&gt; 60%)</option>
        </select>

        <input
          v-model="fleetStore.searchQuery"
          type="search"
          class="ops-search"
          placeholder="Search by Bike ID, plate, rider, or battery SN..."
          aria-label="Search bikes"
        />

        <button
          type="button"
          class="bw-btn bw-btn-secondary"
          @click="openSwapModal()"
        >
          Swap Battery
        </button>
      </div>

      <div class="ops-table-wrap">
        <table class="ops-table">
          <thead>
            <tr>
              <th>Bike &amp; Plate</th>
              <th>Assigned Rider</th>
              <th>Battery Serial (IoT)</th>
              <th>Charge Level</th>
              <th>Pack Voltage</th>
              <th>Speed &amp; Odo</th>
              <th>Location</th>
              <th>Motor Power</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="bike in fleetStore.filteredBikes"
              :key="bike.id"
              :class="{ 'row-selected': bike.id === fleetStore.selectedBikeId }"
              @click="fleetStore.selectBike(bike.id)"
            >
              <td>
                <div class="bike-cell">
                  <strong>{{ bike.id }}</strong>
                  <span class="mono-id">{{ bike.plateNumber }}</span>
                </div>
              </td>
              <td>
                <div class="rider-cell">
                  <strong>{{ bike.riderName }}</strong>
                  <span class="sub-text">{{ bike.riderPhone }}</span>
                </div>
              </td>
              <td>
                <div class="battery-cell">
                  <code class="mono-id">{{ bike.batterySn }}</code>
                  <span v-if="bike.id === 'EVB-001'" class="live-pill">Live Yunhe Unit</span>
                </div>
              </td>
              <td>
                <div class="soc-bar-cell">
                  <div class="soc-text" :style="{ color: getSocColor(bike.telemetry.soc) }">
                    <strong>{{ bike.telemetry.soc }}%</strong>
                  </div>
                  <div class="mini-bar">
                    <div
                      class="mini-bar-fill"
                      :style="{ width: bike.telemetry.soc + '%', backgroundColor: getSocColor(bike.telemetry.soc) }"
                    ></div>
                  </div>
                </div>
              </td>
              <td>{{ bike.telemetry.voltage }}V</td>
              <td>
                <div>{{ bike.telemetry.speed }} km/h</div>
                <div class="sub-text">{{ bike.telemetry.mileage }} km</div>
              </td>
              <td>
                <div>{{ bike.telemetry.city }}</div>
                <div class="sub-text font-mono">{{ bike.telemetry.lat.toFixed(3) }}, {{ bike.telemetry.lng.toFixed(3) }}</div>
              </td>
              <td>
                <span class="status-pill" :class="bike.telemetry.d_fet ? 'good' : 'danger'">
                  {{ bike.telemetry.d_fet ? 'Enabled' : 'Cut Off' }}
                </span>
              </td>
              <td class="action-cell">
                <button
                  type="button"
                  class="btn-sm"
                  :class="bike.telemetry.d_fet ? 'btn-danger-sm' : 'btn-good-sm'"
                  :title="bike.telemetry.d_fet ? 'Remotely disable motor discharge' : 'Restore motor power'"
                  @click.stop="onTogglePower(bike.id, !bike.telemetry.d_fet)"
                >
                  {{ bike.telemetry.d_fet ? 'Cut Power' : 'Restore' }}
                </button>
                <button
                  type="button"
                  class="btn-sm"
                  @click.stop="openCustomerModal(bike.assignedCustomerId)"
                >
                  Rider Account
                </button>
              </td>
            </tr>
            <tr v-if="!fleetStore.filteredBikes.length">
              <td colspan="9" class="ops-empty">No bikes matched the chosen filters.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 3: Rider Lease Accounts (CRM) -->
    <div v-show="currentTab === 'crm'" class="tab-content">
      <div class="crm-summary-bar">
        <div class="crm-stat">
          <span class="label">Riders on Installment</span>
          <strong>{{ installmentRidersCount }}</strong>
        </div>
        <div class="crm-stat">
          <span class="label">Outright Buyers</span>
          <strong>{{ outrightBuyersCount }}</strong>
        </div>
        <div class="crm-stat tone-warn">
          <span class="label">Late Payments</span>
          <strong>{{ fleetStore.overdueCustomers.length }}</strong>
        </div>
        <div class="crm-stat tone-good">
          <span class="label">Collection Rate</span>
          <strong>93.5%</strong>
        </div>
      </div>

      <div class="ops-table-wrap">
        <table class="ops-table">
          <thead>
            <tr>
              <th>Rider Name</th>
              <th>Contact / NIN</th>
              <th>Assigned Bike</th>
              <th>Payment Plan</th>
              <th>Balance Remaining</th>
              <th>Installment Due</th>
              <th>Account Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cust in fleetStore.customers" :key="cust.id">
              <td>
                <strong>{{ cust.name }}</strong>
                <div class="sub-text">{{ cust.email }}</div>
              </td>
              <td>
                <div>{{ cust.phone }}</div>
                <div class="sub-text font-mono">NIN: {{ cust.nin }}</div>
              </td>
              <td>
                <span class="mono-id">{{ cust.bikeId }}</span>
              </td>
              <td>
                <span class="plan-tag" :class="cust.purchaseType">
                  {{ cust.purchaseType === 'installment' ? 'Weekly Installment' : 'Outright' }}
                </span>
              </td>
              <td class="font-bold">
                ₦{{ formatMoney(cust.balanceMinor) }}
              </td>
              <td>
                <div v-if="cust.purchaseType === 'installment'">
                  <strong>₦{{ formatMoney(cust.weeklyInstallmentMinor) }}</strong>
                  <div class="sub-text" :class="{ 'text-danger': cust.daysOverdue > 0 }">
                    Due: {{ cust.nextDueDate }}
                  </div>
                </div>
                <div v-else class="sub-text">Paid in Full</div>
              </td>
              <td>
                <span class="status-pill" :class="cust.status">
                  {{ formatCustomerStatus(cust.status) }}
                </span>
                <span v-if="cust.daysOverdue > 0" class="sub-overdue">
                  {{ cust.daysOverdue }}d late
                </span>
              </td>
              <td class="action-cell">
                <button
                  type="button"
                  class="btn-sm btn-primary-sm"
                  @click="openCustomerModal(cust.id)"
                >
                  View Ledger &amp; Pay
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 4: Swap Stations & Racks -->
    <div v-show="currentTab === 'stations'" class="tab-content">
      <div class="stations-grid">
        <div v-for="st in fleetStore.stations" :key="st.id" class="station-card">
          <div class="st-top">
            <div>
              <h3>{{ st.name }}</h3>
              <p class="st-address">{{ st.address }}</p>
            </div>
            <button
              type="button"
              class="btn-sm btn-primary-sm"
              @click="openSwapModal(st.id)"
            >
              Swap at This Hub
            </button>
          </div>

          <div class="st-stats">
            <div class="st-stat-cell">
              <span class="muted">Available Charged</span>
              <strong class="text-good">{{ getReadyCount(st) }} packs</strong>
            </div>
            <div class="st-stat-cell">
              <span class="muted">Charging Bay</span>
              <strong class="text-warn">{{ getChargingCount(st) }} packs</strong>
            </div>
            <div class="st-stat-cell">
              <span class="muted">Total Rack Bays</span>
              <strong>{{ st.totalSlots }} slots</strong>
            </div>
          </div>

          <div class="rack-section">
            <span class="rack-title">Battery Inventory on Rack:</span>
            <div class="battery-rack-strip">
              <div
                v-for="b in st.activeBatteries"
                :key="b.sn"
                class="rack-pack"
                :class="b.status"
              >
                <div class="pack-sn-short">{{ b.sn.slice(-6) }}</div>
                <div class="pack-soc-badge">{{ b.soc }}%</div>
                <div class="pack-status-sub">{{ b.status === 'ready' ? 'Ready' : 'Charging' }}</div>
              </div>
            </div>
          </div>

          <div class="st-foot">
            <span>Operator: <b>{{ st.operatorName }}</b> ({{ st.operatorPhone }})</span>
          </div>
        </div>
      </div>

      <!-- Recent Fleet Swaps Ledger -->
      <div class="swaps-ledger-card">
        <div class="ledger-head">
          <h3>Recent Swap Transactions</h3>
          <span class="sub-text">Real-time log of battery turn-ins and dispensing across stations</span>
        </div>

        <div class="ops-table-wrap">
          <table class="ops-table">
            <thead>
              <tr>
                <th>Swap ID / Timestamp</th>
                <th>Bike ID</th>
                <th>Rider Name</th>
                <th>Station</th>
                <th>Depleted Turned In</th>
                <th>Fresh Dispensed</th>
                <th>Operator</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="swp in fleetStore.swaps" :key="swp.id">
                <td>
                  <strong>{{ swp.id }}</strong>
                  <div class="sub-text">{{ swp.timestamp }}</div>
                </td>
                <td><span class="mono-id">{{ swp.bikeId }}</span></td>
                <td>{{ swp.riderName }}</td>
                <td>{{ swp.stationName }}</td>
                <td>
                  <span class="sn-tag returned">{{ swp.batteryInSn.slice(-10) }} ({{ swp.batteryInSoc }}%)</span>
                </td>
                <td>
                  <span class="sn-tag fresh">{{ swp.batteryOutSn.slice(-10) }} ({{ swp.batteryOutSoc }}%)</span>
                </td>
                <td>{{ swp.operatorName }}</td>
                <td class="font-bold">₦{{ formatMoney(swp.feeMinor) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 5: Battery Diagnostics Lab -->
    <div v-show="currentTab === 'health'" class="tab-content">
      <div class="diag-layout">
        <div class="diag-sidebar">
          <h3>Select Battery to Inspect</h3>
          <div class="diag-bike-list">
            <div
              v-for="b in fleetStore.bikes.slice(0, 30)"
              :key="b.id"
              class="diag-bike-item"
              :class="{ selected: b.id === fleetStore.selectedBikeId }"
              @click="fleetStore.selectBike(b.id)"
            >
              <div class="item-id">{{ b.id }} ({{ b.plateNumber }})</div>
              <div class="item-sub">
                <span>{{ b.batterySn }}</span>
                <strong :style="{ color: getSocColor(b.telemetry.soc) }">{{ b.telemetry.soc }}%</strong>
              </div>
            </div>
          </div>
        </div>

        <div class="diag-main-panel" v-if="fleetStore.selectedBike">
          <div class="diag-head">
            <div>
              <h2>Battery Unit: {{ fleetStore.selectedBike.batterySn }}</h2>
              <p>Installed on <b>{{ fleetStore.selectedBike.id }}</b> (Rider: {{ fleetStore.selectedBike.riderName }})</p>
            </div>
            <div class="diag-actions">
              <button
                type="button"
                class="bw-btn bw-btn-secondary"
                @click="onRebootDTU(fleetStore.selectedBike.id)"
              >
                Reboot Battery DTU
              </button>
              <button
                type="button"
                class="bw-btn"
                :class="fleetStore.selectedBike.telemetry.d_fet ? 'btn-danger-sm' : 'btn-good-sm'"
                @click="onTogglePower(fleetStore.selectedBike.id, !fleetStore.selectedBike.telemetry.d_fet)"
              >
                {{ fleetStore.selectedBike.telemetry.d_fet ? "Disable Motor Power" : "Enable Motor Power" }}
              </button>
            </div>
          </div>

          <div class="diag-kpi-grid">
            <div class="diag-card">
              <span class="lbl">Total Voltage</span>
              <span class="val">{{ fleetStore.selectedBike.telemetry.voltage }} V</span>
              <span class="sub">Nominal 72V Pack</span>
            </div>
            <div class="diag-card">
              <span class="lbl">Current Draw</span>
              <span class="val">{{ fleetStore.selectedBike.telemetry.current }} A</span>
              <span class="sub">{{ fleetStore.selectedBike.telemetry.speed > 0 ? "Under Load" : "Idle" }}</span>
            </div>
            <div class="diag-card">
              <span class="lbl">Cell Temperature</span>
              <span class="val">{{ fleetStore.selectedBike.telemetry.temp }} °C</span>
              <span class="sub text-good">Normal Range</span>
            </div>
            <div class="diag-card">
              <span class="lbl">Charge Cycles</span>
              <span class="val">{{ fleetStore.selectedBike.telemetry.loopSum }}</span>
              <span class="sub">Cycle lifetime count</span>
            </div>
            <div class="diag-card">
              <span class="lbl">Total Cells</span>
              <span class="val">{{ fleetStore.selectedBike.telemetry.cellSum }} Cells</span>
              <span class="sub">Lithium Iron Phosphate (LFP)</span>
            </div>
            <div class="diag-card">
              <span class="lbl">Heartbeat Beacon</span>
              <span class="val text-good">Online</span>
              <span class="sub">GPRS Signal: Excellent</span>
            </div>
          </div>

          <!-- Synthetic Cell Matrix -->
          <div class="cell-matrix-box">
            <h4>23-Cell Balance Grid (Individual String Voltages)</h4>
            <div class="cell-matrix">
              <div v-for="cellIdx in 23" :key="cellIdx" class="cell-chip">
                <span class="cell-num">C{{ cellIdx }}</span>
                <span class="cell-volts">{{ (3.30 + (cellIdx % 5) * 0.01).toFixed(2) }}V</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <BikeCustomerCrmModal
      v-if="activeCustomerForModal"
      :customer="activeCustomerForModal"
      @close="activeCustomerForModal = null"
      @record-payment="handlePaymentRecorded"
    />

    <BatterySwapStationModal
      v-if="swapModalOpen"
      :stations="fleetStore.stations"
      :bikes="fleetStore.bikes"
      :initial-bike-id="swapModalBikeId"
      @close="swapModalOpen = false"
      @execute-swap="handleSwapExecuted"
    />
  </section>
</template>

<script>
import { useBatteryFleetStore } from "../../stores/battery-fleet-store.js";
import BatteryGprsMap from "./BatteryGprsMap.vue";
import BikeCustomerCrmModal from "./BikeCustomerCrmModal.vue";
import BatterySwapStationModal from "./BatterySwapStationModal.vue";

export default {
  name: "BatterySwapOperationsPage",
  components: {
    BatteryGprsMap,
    BikeCustomerCrmModal,
    BatterySwapStationModal
  },
  data() {
    return {
      currentTab: "map",
      activeCustomerForModal: null,
      swapModalOpen: false,
      swapModalBikeId: ""
    };
  },
  computed: {
    fleetStore() {
      return useBatteryFleetStore();
    },
    installmentRidersCount() {
      return this.fleetStore.customers.filter((c) => c.purchaseType === "installment").length;
    },
    outrightBuyersCount() {
      return this.fleetStore.customers.filter((c) => c.purchaseType === "outright").length;
    }
  },
  mounted() {
    // Initial sync from live API
    this.fleetStore.syncLiveYunheTelemetry();
  },
  methods: {
    formatMoney(minor) {
      if (typeof minor !== "number") return "0";
      return (minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 });
    },
    formatCustomerStatus(status) {
      if (status === "current") return "Up to date";
      if (status === "overdue") return "Overdue";
      if (status === "grace_period") return "Grace Period";
      if (status === "paid_off") return "Paid in Full";
      return status;
    },
    getSocColor(soc) {
      if (soc <= 20) return "#ef4444";
      if (soc <= 50) return "#f59e0b";
      return "#10b981";
    },
    getReadyCount(station) {
      if (!station || !Array.isArray(station.activeBatteries)) return 0;
      return station.activeBatteries.filter((b) => b.status === "ready" && b.soc >= 80).length;
    },
    getChargingCount(station) {
      if (!station || !Array.isArray(station.activeBatteries)) return 0;
      return station.activeBatteries.filter((b) => b.status === "charging").length;
    },
    onSelectBike(bikeId) {
      this.fleetStore.selectBike(bikeId);
    },
    async onTogglePower(bikeId, allow) {
      await this.fleetStore.toggleBikeMotorPower(bikeId, allow);
    },
    async onRebootDTU(bikeId) {
      await this.fleetStore.rebootBikeDTU(bikeId);
      alert(`Reboot command sent to battery DTU for bike ${bikeId}. Signal will cycle in 30 seconds.`);
    },
    syncTelemetry() {
      this.fleetStore.syncLiveYunheTelemetry();
    },
    openCustomerModal(customerId) {
      const c = this.fleetStore.customers.find((cust) => cust.id === customerId);
      if (c) {
        this.activeCustomerForModal = c;
      }
    },
    openSwapModal(stationId = "") {
      this.swapModalBikeId = this.fleetStore.selectedBikeId;
      this.swapModalOpen = true;
    },
    handlePaymentRecorded({ customerId, amountMinor, channel, reference }) {
      this.fleetStore.recordPayment(customerId, {
        amountMinor,
        channel,
        reference
      });
      // Update modal ref
      this.activeCustomerForModal = this.fleetStore.customers.find((c) => c.id === customerId);
    },
    handleSwapExecuted(payload) {
      this.fleetStore.executeSwap(payload);
    }
  }
};
</script>

<style scoped>
.ops-page {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1440px;
  margin: 0 auto;
}

.ops-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
}

.oem-tag {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-brand, #10b981);
  margin-bottom: 4px;
}

.ops-head h1 {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-strong);
  margin: 0 0 6px;
}

.ops-head p {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0;
}

.ops-head-actions {
  display: flex;
  gap: 10px;
}

.bw-btn {
  height: 38px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.bw-btn-primary {
  background: var(--color-brand, #10b981);
  color: #ffffff;
}

.bw-btn-primary:hover {
  filter: brightness(1.06);
}

.bw-btn-secondary {
  background: var(--bg-card);
  border-color: var(--border-color);
  color: var(--text-main);
}

.bw-btn-secondary:hover {
  background: var(--bg-page);
}

.spin-icon {
  display: inline-block;
  animation: spin 1s infinite linear;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* KPI Strip */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}

.kpi-cell {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kpi-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
}

.kpi-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-strong);
}

.kpi-sub {
  font-size: 11px;
  color: var(--text-muted);
}

.tone-good .kpi-value {
  color: var(--bev-color-green-600, #16a34a);
}

.tone-danger .kpi-value {
  color: var(--bev-color-red-500, #ef4444);
}

.tone-warn .kpi-value {
  color: var(--bev-color-amber-500, #f59e0b);
}

.tone-info .kpi-value {
  color: #0284c7;
}

/* Tab Navigation */
.nav-tab-bar {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 2px;
  overflow-x: auto;
}

.tab-link {
  background: none;
  border: none;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  transition: all 0.15s;
}

.tab-link:hover {
  color: var(--text-main);
}

.tab-link.active {
  color: var(--color-brand, #10b981);
  border-bottom-color: var(--color-brand, #10b981);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Toolbar & Filters */
.ops-toolbar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.ops-select {
  height: 38px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--bg-card);
  color: var(--text-main);
  font-size: 13px;
}

.ops-search {
  height: 38px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0 12px;
  background: var(--bg-card);
  color: var(--text-main);
  font-size: 13px;
  min-width: 260px;
  flex: 1;
}

/* Tables */
.ops-table-wrap {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow-x: auto;
  background: var(--bg-card);
}

.ops-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.ops-table thead th {
  background: var(--bg-page);
  padding: 12px 16px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.ops-table tbody tr {
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}

.ops-table tbody tr:hover,
.ops-table tbody tr.row-selected {
  background: var(--primary-light, rgba(16, 185, 129, 0.05));
}

.ops-table td {
  padding: 12px 16px;
  vertical-align: middle;
  color: var(--text-main);
  white-space: nowrap;
}

.bike-cell,
.rider-cell,
.battery-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mono-id {
  font-family: var(--bev-font-mono, monospace);
  font-size: 11px;
  background: var(--bg-page);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  display: inline-block;
  width: fit-content;
}

.live-pill {
  font-size: 10px;
  font-weight: 700;
  color: var(--bev-color-green-700, #15803d);
  background: #dcfce7;
  padding: 1px 6px;
  border-radius: 4px;
  width: fit-content;
}

.sub-text {
  font-size: 11px;
  color: var(--text-muted);
}

.font-bold {
  font-weight: 700;
}

.soc-bar-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 90px;
}

.mini-bar {
  height: 6px;
  background: var(--bg-page);
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.mini-bar-fill {
  height: 100%;
  border-radius: 999px;
}

.status-pill {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.status-pill.good,
.status-pill.current {
  background: #dcfce7;
  color: #15803d;
}

.status-pill.danger,
.status-pill.overdue {
  background: #fee2e2;
  color: #dc2626;
}

.status-pill.grace_period {
  background: #fef3c7;
  color: #b45309;
}

.status-pill.paid_off {
  background: #e0f2fe;
  color: #0369a1;
}

.sub-overdue {
  display: block;
  font-size: 11px;
  color: #dc2626;
  font-weight: 600;
}

.action-cell {
  display: flex;
  gap: 6px;
}

.btn-sm {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-sm:hover {
  background: var(--bg-page);
}

.btn-danger-sm {
  background: #fee2e2;
  color: #dc2626;
  border-color: #fecdd3;
}

.btn-good-sm {
  background: #dcfce7;
  color: #15803d;
  border-color: #bbf7d0;
}

.btn-primary-sm {
  background: var(--color-brand, #10b981);
  color: #ffffff;
  border: none;
}

.plan-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.plan-tag.installment {
  background: #e0f2fe;
  color: #0284c7;
}

.plan-tag.outright {
  background: #f1f5f9;
  color: #475569;
}

/* CRM Bar */
.crm-summary-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.crm-stat {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.crm-stat .label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
}

.crm-stat strong {
  font-size: 20px;
  color: var(--text-strong);
}

/* Stations Grid */
.stations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}

.station-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.st-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.st-top h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-strong);
}

.st-address {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.st-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-page);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.st-stat-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.st-stat-cell .muted {
  font-size: 10px;
  color: var(--text-muted);
}

.st-stat-cell strong {
  font-size: 13px;
}

.text-good { color: #16a34a; }
.text-warn { color: #d97706; }

.rack-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rack-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
}

.battery-rack-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.rack-pack {
  background: var(--bg-page);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px;
  min-width: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.rack-pack.ready {
  border-color: #86efac;
  background: #f0fdf4;
}

.rack-pack.charging {
  border-color: #fde68a;
  background: #fffbeb;
}

.pack-sn-short {
  font-family: var(--bev-font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
}

.pack-soc-badge {
  font-size: 12px;
  font-weight: 800;
}

.pack-status-sub {
  font-size: 9px;
  color: var(--text-muted);
}

.st-foot {
  font-size: 11px;
  color: var(--text-muted);
  border-top: 1px solid var(--border-color);
  padding-top: 10px;
}

/* Swaps Ledger Card */
.swaps-ledger-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ledger-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.sn-tag {
  font-family: var(--bev-font-mono, monospace);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.sn-tag.returned {
  background: #fee2e2;
  color: #dc2626;
}

.sn-tag.fresh {
  background: #dcfce7;
  color: #16a34a;
}

/* Diagnostics Lab */
.diag-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
}

.diag-sidebar {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 600px;
}

.diag-sidebar h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
}

.diag-bike-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.diag-bike-item {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-page);
  cursor: pointer;
  transition: all 0.15s;
}

.diag-bike-item:hover,
.diag-bike-item.selected {
  background: var(--primary-light, rgba(16, 185, 129, 0.08));
  border-color: var(--color-brand, #10b981);
}

.item-id {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-strong);
}

.item-sub {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--bev-font-mono, monospace);
}

.diag-main-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.diag-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
}

.diag-head h2 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 800;
}

.diag-head p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.diag-actions {
  display: flex;
  gap: 8px;
}

.diag-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.diag-card {
  background: var(--bg-page);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.diag-card .lbl {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
}

.diag-card .val {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-strong);
}

.diag-card .sub {
  font-size: 11px;
  color: var(--text-muted);
}

.cell-matrix-box {
  background: var(--bg-page);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
}

.cell-matrix-box h4 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 700;
}

.cell-matrix {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px;
}

.cell-chip {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.cell-num {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 600;
}

.cell-volts {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-strong);
  font-family: var(--bev-font-mono, monospace);
}

@media (max-width: 900px) {
  .diag-layout {
    grid-template-columns: 1fr;
  }
}
</style>
