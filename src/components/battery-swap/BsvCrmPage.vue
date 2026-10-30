<template>
  <div class="bsv-crm-page" role="main" aria-label="Rider Lease CRM">
    <!-- 1. Page Header -->
    <header class="page-header">
      <div class="header-content">
        <div class="header-badge">
          <span class="badge-dot"></span>
          <span>Beverly EV Fleet Operations &bull; Lease Management System</span>
        </div>
        <h1 class="header-title">Rider Lease CRM</h1>
        <p class="header-subtitle">Installment tracking, payment records &amp; lease management</p>
      </div>
      <div class="header-actions">
        <button
          type="button"
          class="refresh-btn"
          :disabled="fleetStore.loading"
          title="Sync live fleet telemetry and records"
          @click="refreshData"
        >
          <span class="btn-icon" :class="{ 'spin-icon': fleetStore.loading }">&#x21bb;</span>
          <span>{{ fleetStore.loading ? "Syncing..." : "Sync Fleet Data" }}</span>
        </button>
      </div>
    </header>

    <!-- 2. KPI Tiles Row (5 tiles) -->
    <section class="kpi-row" aria-label="Key Performance Indicators">
      <!-- Tile 1: Total Riders -->
      <div class="kpi-tile">
        <div class="kpi-label">Total Riders</div>
        <div class="kpi-value">{{ totalRiders }}</div>
        <div class="kpi-sub">Registered rider accounts</div>
      </div>

      <!-- Tile 2: Paid Off -->
      <div class="kpi-tile">
        <div class="kpi-label">Paid Off</div>
        <div class="kpi-value value-green">
          <span class="check-icon">&#x2713;</span>
          {{ paidOffCount }}
        </div>
        <div class="kpi-sub">Complete asset ownership</div>
      </div>

      <!-- Tile 3: Current -->
      <div class="kpi-tile">
        <div class="kpi-label">Current</div>
        <div class="kpi-value">{{ currentCount }}</div>
        <div class="kpi-sub">Up-to-date weekly leases</div>
      </div>

      <!-- Tile 4: Overdue (Red accent color) -->
      <div class="kpi-tile kpi-tile-overdue">
        <div class="kpi-label label-red">Overdue</div>
        <div class="kpi-value value-red">{{ overdueCount }}</div>
        <div class="kpi-sub sub-red">Requires immediate action</div>
      </div>

      <!-- Tile 5: Revenue This Month (₦ formatted amount) -->
      <div class="kpi-tile">
        <div class="kpi-label">Revenue This Month</div>
        <div class="kpi-value value-currency">{{ formattedTotalRevenue }}</div>
        <div class="kpi-sub">Total capital collected</div>
      </div>
    </section>

    <!-- 3. Overdue Alert Banner (shown only if overdueCustomers.length > 0) -->
    <aside
      v-if="overdueCustomers.length > 0"
      class="overdue-banner"
      role="alert"
      aria-live="assertive"
    >
      <div class="banner-icon-col">&#x26a0;&#xfe0f;</div>
      <div class="banner-body">
        <h2 class="banner-headline">
          {{ overdueCustomers.length }} riders are overdue &mdash; take action now
        </h2>
        <p class="banner-text">
          Weekly lease payments have lapsed. Contact riders directly, reach out to registered guarantors, or restrict motor power discharge to stop unserviced mileage.
        </p>
      </div>
      <div class="banner-cta">
        <button
          type="button"
          class="banner-filter-btn"
          @click="statusFilter = 'overdue'"
        >
          View Overdue Riders ({{ overdueCustomers.length }})
        </button>
      </div>
    </aside>

    <!-- 4. Filter Toolbar -->
    <section class="filter-toolbar" aria-label="Rider search and filters">
      <div class="search-box">
        <span class="search-icon">&#x1f50d;</span>
        <input
          v-model="searchQuery"
          type="search"
          class="search-input"
          placeholder="Search by rider name, phone, bike ID, or NIN..."
          aria-label="Search riders by name, phone, bike ID, or NIN"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="search-clear-btn"
          aria-label="Clear search"
          @click="searchQuery = ''"
        >
          &times;
        </button>
      </div>

      <div class="status-filters" role="group" aria-label="Filter by payment status">
        <button
          type="button"
          class="status-pill"
          :class="{ active: statusFilter === 'all' }"
          @click="statusFilter = 'all'"
        >
          All <span class="pill-count">({{ totalRiders }})</span>
        </button>
        <button
          type="button"
          class="status-pill"
          :class="{ active: statusFilter === 'current' }"
          @click="statusFilter = 'current'"
        >
          Current <span class="pill-count">({{ currentCount }})</span>
        </button>
        <button
          type="button"
          class="status-pill pill-overdue"
          :class="{ active: statusFilter === 'overdue' }"
          @click="statusFilter = 'overdue'"
        >
          Overdue <span class="pill-count">({{ overdueCount }})</span>
        </button>
        <button
          type="button"
          class="status-pill"
          :class="{ active: statusFilter === 'paid_off' }"
          @click="statusFilter = 'paid_off'"
        >
          Paid Off <span class="pill-count">({{ paidOffCount }})</span>
        </button>
        <button
          type="button"
          class="status-pill"
          :class="{ active: statusFilter === 'grace_period' }"
          @click="statusFilter = 'grace_period'"
        >
          Grace Period <span class="pill-count">({{ gracePeriodCount }})</span>
        </button>
      </div>
    </section>

    <!-- 5. CRM Table (Full width, sticky header) -->
    <section class="crm-table-section" aria-label="Rider Accounts Table">
      <div class="table-container">
        <table class="crm-table">
          <thead>
            <tr>
              <th scope="col" class="th-rider">Rider</th>
              <th scope="col" class="th-contact">Contact</th>
              <th scope="col" class="th-bike">Bike Assigned</th>
              <th scope="col" class="th-purchase">Purchase Type</th>
              <th scope="col" class="th-progress">Progress</th>
              <th scope="col" class="th-due">Next Due</th>
              <th scope="col" class="th-overdue">Overdue</th>
              <th scope="col" class="th-balance">Balance</th>
              <th scope="col" class="th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="customer in filteredCustomers"
              :key="customer.id"
              class="crm-row"
              :class="{
                'row-overdue': customer.status === 'overdue',
                'row-paid-off': customer.status === 'paid_off'
              }"
            >
              <!-- Rider Column -->
              <td class="td-rider">
                <div class="rider-name-group">
                  <span class="rider-name">{{ customer.name }}</span>
                  <span
                    v-if="customer.status === 'paid_off'"
                    class="paid-checkmark"
                    title="Asset fully paid off"
                    aria-label="Paid off"
                  >
                    &#x2713;
                  </span>
                </div>
                <div class="rider-sub font-mono">NIN: {{ customer.nin }}</div>
              </td>

              <!-- Contact Column -->
              <td class="td-contact">
                <div class="contact-phone">{{ customer.phone }}</div>
                <div class="contact-email">{{ customer.email }}</div>
              </td>

              <!-- Bike Assigned Column -->
              <td class="td-bike">
                <span class="bike-chip font-mono">{{ customer.bikeId }}</span>
                <div class="battery-sub font-mono">{{ customer.batterySn }}</div>
              </td>

              <!-- Purchase Type Column -->
              <td class="td-purchase">
                <span
                  class="purchase-badge"
                  :class="customer.purchaseType === 'installment' ? 'badge-installment' : 'badge-outright'"
                >
                  {{ customer.purchaseType === 'installment' ? 'Weekly Lease' : 'Outright Buy' }}
                </span>
              </td>

              <!-- Progress Column -->
              <td class="td-progress">
                <div class="progress-wrap">
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getProgressPercentage(customer) + '%' }"
                    ></div>
                  </div>
                  <div class="progress-numbers">
                    <span class="progress-pct">{{ getProgressPercentage(customer) }}%</span>
                    <span class="progress-amounts">
                      {{ formatNaira(customer.paidMinor) }}
                    </span>
                  </div>
                </div>
              </td>

              <!-- Next Due Column -->
              <td class="td-due">
                <template v-if="customer.purchaseType === 'installment' && customer.status !== 'paid_off'">
                  <div
                    class="due-date"
                    :class="{ 'due-date-danger': customer.status === 'overdue' }"
                  >
                    {{ customer.nextDueDate || '—' }}
                  </div>
                  <div class="due-rate">
                    {{ formatNaira(customer.weeklyInstallmentMinor) }}/wk
                  </div>
                </template>
                <template v-else>
                  <span class="paid-in-full-text">Paid in Full</span>
                </template>
              </td>

              <!-- Overdue Column (red text if overdue, blank if current) -->
              <td class="td-overdue">
                <span
                  v-if="customer.status === 'overdue'"
                  class="overdue-text"
                >
                  {{ customer.daysOverdue }}d overdue
                </span>
                <span v-else class="overdue-blank"></span>
              </td>

              <!-- Balance Column -->
              <td class="td-balance">
                <div class="balance-amount">
                  {{ formatNaira(customer.balanceMinor) }}
                </div>
              </td>

              <!-- Actions Column -->
              <td class="td-actions">
                <button
                  type="button"
                  class="btn-open-profile"
                  :aria-label="'Open Profile for ' + customer.name"
                  @click="openCustomerProfile(customer)"
                >
                  Open Profile
                </button>
              </td>
            </tr>

            <!-- Empty State -->
            <tr v-if="filteredCustomers.length === 0">
              <td colspan="9" class="empty-state-cell">
                <div class="empty-state">
                  <div class="empty-state-icon">&#x1f50e;</div>
                  <h3>No rider accounts found</h3>
                  <p>
                    No riders matched your current filter criteria. Try clearing the search query or switching status filters.
                  </p>
                  <button
                    type="button"
                    class="btn-reset-filters"
                    @click="resetFilters"
                  >
                    Reset Filters
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 6. Payment Activity Feed (last 10 payments from swaps log) -->
    <section class="activity-section" aria-label="Payment activity feed">
      <div class="activity-header">
        <div class="activity-header-text">
          <h2 class="activity-title">Payment Activity Feed</h2>
          <p class="activity-subtitle">Last 10 swap fee and lease payments recorded across Beverly swap hubs</p>
        </div>
        <div class="activity-hub-badge">Beverly Swap Logs</div>
      </div>

      <div class="activity-grid">
        <article
          v-for="swap in recentSwaps"
          :key="swap.id"
          class="activity-card"
        >
          <div class="activity-card-top">
            <div class="activity-rider-info">
              <span class="activity-rider-name">{{ swap.riderName }}</span>
              <span class="activity-bike-id font-mono">{{ swap.bikeId }}</span>
            </div>
            <div class="activity-fee">
              {{ formatNaira(swap.feeMinor) }}
            </div>
          </div>

          <div class="activity-station-row">
            <span class="station-icon">&#x26a1;</span>
            <span class="station-name">{{ swap.stationName }}</span>
          </div>

          <div class="activity-battery-exchange font-mono">
            <span class="soc-pill soc-in" title="Depleted battery received">
              In: {{ swap.batteryInSoc }}%
            </span>
            <span class="exchange-arrow">&rarr;</span>
            <span class="soc-pill soc-out" title="Fresh charged battery dispatched">
              Out: {{ swap.batteryOutSoc }}%
            </span>
          </div>

          <div class="activity-card-bottom">
            <span class="activity-channel-badge">{{ swap.paymentMethod }}</span>
            <time class="activity-timestamp">{{ swap.timestamp }}</time>
          </div>
        </article>
      </div>
    </section>

    <!-- Customer CRM Modal -->
    <BikeCustomerCrmModal
      v-if="showCrmModal && selectedCustomerForCrm"
      :customer="selectedCustomerForCrm"
      @close="closeCrmModal"
      @record-payment="handleRecordPayment"
    />
  </div>
</template>

<script>
import { useBatteryFleetStore } from "../../stores/battery-fleet-store.js";
import BikeCustomerCrmModal from "./BikeCustomerCrmModal.vue";

export default {
  name: "BsvCrmPage",
  components: {
    BikeCustomerCrmModal
  },
  props: {
    route: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      searchQuery: "",
      statusFilter: "all",
      selectedBikeForCrm: "",
      showCrmModal: false
    };
  },
  computed: {
    fleetStore() {
      return useBatteryFleetStore();
    },
    customers() {
      return this.fleetStore.customers || [];
    },
    overdueCustomers() {
      return this.fleetStore.overdueCustomers || [];
    },
    totalRiders() {
      return this.customers.length;
    },
    paidOffCount() {
      return this.customers.filter((c) => c.status === "paid_off").length;
    },
    currentCount() {
      return this.customers.filter((c) => c.status === "current").length;
    },
    overdueCount() {
      return this.overdueCustomers.length;
    },
    gracePeriodCount() {
      return this.customers.filter((c) => c.status === "grace_period").length;
    },
    totalRevenueMinor() {
      if (!this.customers.length) return 0;
      return this.customers.reduce((sum, c) => sum + (c.paidMinor || 0), 0);
    },
    formattedTotalRevenue() {
      return this.formatNaira(this.totalRevenueMinor);
    },
    recentSwaps() {
      if (!this.fleetStore.swaps) return [];
      return this.fleetStore.swaps.slice(0, 10);
    },
    selectedCustomerForCrm() {
      if (!this.selectedBikeForCrm || !this.customers.length) return null;
      return this.customers.find((c) => c.bikeId === this.selectedBikeForCrm) || null;
    },
    filteredCustomers() {
      let list = this.customers;

      if (this.statusFilter !== "all") {
        list = list.filter((c) => c.status === this.statusFilter);
      }

      if (this.searchQuery && this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase().trim();
        list = list.filter((c) => {
          const name = (c.name || "").toLowerCase();
          const phone = (c.phone || "").toLowerCase();
          const bikeId = (c.bikeId || "").toLowerCase();
          const nin = (c.nin || "").toLowerCase();
          return name.includes(q) || phone.includes(q) || bikeId.includes(q) || nin.includes(q);
        });
      }

      return list;
    }
  },
  mounted() {
    if (this.fleetStore && typeof this.fleetStore.syncLiveYunheTelemetry === "function") {
      this.fleetStore.syncLiveYunheTelemetry();
    }
  },
  methods: {
    formatNaira(minor) {
      if (typeof minor !== "number" || isNaN(minor)) return "₦0";
      return (minor / 100).toLocaleString("en-NG", {
        style: "currency",
        currency: "NGN",
        minimumFractionDigits: 0
      });
    },
    getProgressPercentage(customer) {
      if (!customer || !customer.totalCostMinor) return 0;
      const pct = (customer.paidMinor / customer.totalCostMinor) * 100;
      return Math.min(100, Math.max(0, Math.round(pct)));
    },
    openCustomerProfile(customer) {
      if (customer && customer.bikeId) {
        this.selectedBikeForCrm = customer.bikeId;
        this.showCrmModal = true;
      }
    },
    closeCrmModal() {
      this.showCrmModal = false;
      this.selectedBikeForCrm = "";
    },
    handleRecordPayment(payload) {
      if (payload && payload.customerId) {
        this.fleetStore.recordPayment(payload.customerId, {
          amountMinor: payload.amountMinor,
          channel: payload.channel,
          reference: payload.reference
        });
      }
    },
    resetFilters() {
      this.searchQuery = "";
      this.statusFilter = "all";
    },
    refreshData() {
      if (this.fleetStore && typeof this.fleetStore.syncLiveYunheTelemetry === "function") {
        this.fleetStore.syncLiveYunheTelemetry();
      }
    }
  }
};
</script>

<style scoped>
.bsv-crm-page {
  flex: 1 1 0%;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--acob-bg);
  color: var(--acob-text);
  font-family: var(--acob-font-sans);
  padding: 28px 36px 64px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.bsv-crm-page::-webkit-scrollbar {
  width: 6px;
}

.bsv-crm-page::-webkit-scrollbar-track {
  background: transparent;
}

.bsv-crm-page::-webkit-scrollbar-thumb {
  background: rgba(21, 128, 61, 0.30);
  border-radius: 3px;
}

.bsv-crm-page::-webkit-scrollbar-thumb:hover {
  background: rgba(21, 128, 61, 0.50);
}

/* Typography & Helpers */
.font-mono {
  font-family: var(--acob-font-mono);
}

/* 1. Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
  padding-bottom: 8px;
}

.header-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--acob-brand);
  margin-bottom: 6px;
}

.badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--acob-brand);
  box-shadow: 0 0 8px var(--acob-brand);
}

.header-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--acob-text);
  margin: 0 0 6px;
}

.header-subtitle {
  font-size: 14px;
  color: var(--acob-muted);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px;
  border-radius: 8px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  color: var(--acob-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--acob-surface-hover);
  border-color: var(--acob-line-strong);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 16px;
  line-height: 1;
}

.spin-icon {
  display: inline-block;
  animation: spin 1s infinite linear;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 2. KPI Tiles Row (5 tiles) */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

@media (max-width: 1200px) {
  .kpi-row {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}

.kpi-tile {
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 12px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.kpi-tile:hover {
  border-color: var(--acob-line-strong);
}

.kpi-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--acob-muted);
}

.kpi-value {
  font-size: 26px;
  font-weight: 800;
  color: var(--acob-text);
  line-height: 1.1;
  letter-spacing: -0.01em;
}

.value-green {
  color: var(--acob-brand-bright);
  display: flex;
  align-items: center;
  gap: 6px;
}

.check-icon {
  font-size: 20px;
  line-height: 1;
}

.kpi-tile-overdue {
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.06);
}

.kpi-tile-overdue:hover {
  border-color: var(--color-danger);
}

.label-red {
  color: var(--color-danger);
}

.value-red {
  color: var(--color-danger);
}

.sub-red {
  color: rgba(239, 68, 68, 0.85);
}

.value-currency {
  font-size: 22px;
  color: var(--acob-brand);
}

.kpi-sub {
  font-size: 12px;
  color: var(--acob-muted);
}

/* 3. Overdue Alert Banner */
.overdue-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(184, 134, 46, 0.08);
  border: 1px solid var(--acob-gold);
  border-radius: 10px;
  padding: 16px 20px;
}

.banner-icon-col {
  font-size: 24px;
  line-height: 1;
}

.banner-body {
  flex: 1;
}

.banner-headline {
  font-size: 15px;
  font-weight: 700;
  color: var(--acob-gold);
  margin: 0 0 4px;
}

.banner-text {
  font-size: 13px;
  color: #fef3c7;
  margin: 0;
  opacity: 0.9;
  line-height: 1.4;
}

.banner-cta {
  flex-shrink: 0;
}

.banner-filter-btn {
  background: var(--acob-gold);
  color: var(--acob-bg);
  font-weight: 700;
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.banner-filter-btn:hover {
  filter: brightness(1.1);
  box-shadow: 0 0 12px rgba(184, 134, 46, 0.4);
}

/* 4. Filter Toolbar */
.filter-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 280px;
  max-width: 480px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: var(--acob-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 40px;
  padding: 0 36px 0 36px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 8px;
  color: var(--acob-text);
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.search-input:focus {
  border-color: var(--acob-brand);
  background: var(--acob-surface);
}

.search-input::placeholder {
  color: var(--acob-muted);
}

.search-clear-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--acob-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-clear-btn:hover {
  color: var(--acob-text);
}

.status-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.status-pill {
  height: 36px;
  padding: 0 14px;
  border-radius: 20px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  color: var(--acob-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.status-pill:hover {
  background: var(--acob-surface-hover);
  color: var(--acob-text);
}

.status-pill.active {
  background: rgba(0, 128, 0, 0.10);
  border-color: var(--acob-brand);
  color: var(--acob-brand);
}

.status-pill.pill-overdue.active {
  background: rgba(239, 68, 68, 0.18);
  border-color: var(--color-danger);
  color: #fca5a5;
}

.pill-count {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.8;
}

/* 5. CRM Table (Full width, sticky header) */
.crm-table-section {
  width: 100%;
}

.table-container {
  width: 100%;
  overflow-x: auto;
  max-height: 640px;
  border-radius: 12px;
  border: 1px solid var(--acob-line);
  background: var(--acob-surface);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
}

.crm-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}

.crm-table thead th {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--acob-panel);
  padding: 14px 16px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--acob-muted);
  border-bottom: 1px solid var(--acob-line);
  white-space: nowrap;
}

.crm-row {
  transition: background-color 0.15s ease;
}

.crm-row td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--acob-line);
  vertical-align: middle;
}

.crm-row:hover td {
  background-color: var(--acob-chip);
}

/* Overdue rows have a red left border */
.crm-row.row-overdue {
  border-left: 3px solid var(--color-danger);
  background-color: rgba(239, 68, 68, 0.04);
}

.crm-row.row-overdue:hover td {
  background-color: rgba(239, 68, 68, 0.06);
}

/* Paid off rows */
.crm-row.row-paid-off {
  background-color: rgba(0, 128, 0, 0.02);
}

/* Table Cells */
.rider-name-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rider-name {
  font-weight: 700;
  color: var(--acob-text);
  font-size: 14px;
}

.paid-checkmark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: rgba(34, 197, 94, 0.2);
  color: var(--acob-brand-bright);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.rider-sub {
  font-size: 11px;
  color: var(--acob-muted);
  margin-top: 3px;
}

.contact-phone {
  font-weight: 500;
  color: var(--acob-text);
}

.contact-email {
  font-size: 11px;
  color: var(--acob-muted);
  margin-top: 2px;
}

.bike-chip {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(0, 128, 0, 0.08);
  border: 1px solid rgba(0, 128, 0, 0.20);
  font-size: 12px;
  font-weight: 700;
  color: var(--acob-brand);
}

.battery-sub {
  font-size: 10px;
  color: var(--acob-muted);
  margin-top: 3px;
  letter-spacing: 0.02em;
}

.purchase-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge-installment {
  background: rgba(0, 128, 0, 0.08);
  color: var(--acob-brand);
  border: 1px solid rgba(0, 128, 0, 0.20);
}

.badge-outright {
  background: var(--acob-chip);
  color: var(--acob-muted);
  border: 1px solid var(--acob-line);
}

/* Progress Bar */
.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 140px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--acob-line);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--acob-brand);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-numbers {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.progress-pct {
  font-weight: 700;
  color: var(--acob-text);
}

.progress-amounts {
  color: var(--acob-muted);
  font-size: 10px;
}

.due-date {
  font-weight: 600;
  color: var(--acob-text);
  font-size: 13px;
}

.due-date-danger {
  color: var(--color-danger);
}

.due-rate {
  font-size: 11px;
  color: var(--acob-muted);
  margin-top: 2px;
}

.paid-in-full-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--acob-brand-bright);
}

/* Overdue Column */
.overdue-text {
  display: inline-block;
  color: var(--color-danger);
  font-weight: 700;
  font-size: 12px;
}

.overdue-blank {
  display: inline-block;
}

.balance-amount {
  font-size: 13px;
  font-weight: 800;
  color: var(--acob-text);
  white-space: nowrap;
}

/* Action button */
.btn-open-profile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 14px;
  border-radius: 6px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  color: var(--acob-muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-open-profile:hover {
  background: rgba(0, 128, 0, 0.08);
  border-color: var(--acob-brand);
  color: var(--acob-brand);
}

/* Empty State */
.empty-state-cell {
  text-align: center;
  padding: 48px 16px !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 360px;
  margin: 0 auto;
}

.empty-state-icon {
  font-size: 32px;
  line-height: 1;
}

.empty-state h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--acob-text);
  margin: 0;
}

.empty-state p {
  font-size: 13px;
  color: var(--acob-muted);
  margin: 0;
  line-height: 1.4;
}

.btn-reset-filters {
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  color: var(--acob-brand);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-reset-filters:hover {
  background: rgba(0, 128, 0, 0.08);
  border-color: var(--acob-brand);
}

/* 6. Payment Activity Feed */
.activity-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 12px;
}

.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}

.activity-title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--acob-text);
  margin: 0 0 4px;
}

.activity-subtitle {
  font-size: 13px;
  color: var(--acob-muted);
  margin: 0;
}

.activity-hub-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--acob-brand);
  background: rgba(0, 128, 0, 0.10);
  border: 1px solid rgba(0, 128, 0, 0.20);
  padding: 4px 10px;
  border-radius: 12px;
}

.activity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.activity-card {
  background: var(--acob-surface);
  border: 1px solid var(--acob-line);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.activity-card:hover {
  border-color: var(--acob-line-strong);
  transform: translateY(-1px);
}

.activity-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.activity-rider-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.activity-rider-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--acob-text);
}

.activity-bike-id {
  font-size: 11px;
  color: var(--acob-muted);
}

.activity-fee {
  font-size: 14px;
  font-weight: 800;
  color: var(--acob-brand);
}

.activity-station-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--acob-muted);
}

.station-icon {
  color: var(--acob-gold);
  font-size: 13px;
}

.station-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-battery-exchange {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.soc-pill {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.soc-in {
  background: rgba(239, 68, 68, 0.10);
  color: var(--color-danger);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.soc-out {
  background: rgba(0, 128, 0, 0.10);
  color: var(--acob-brand-bright);
  border: 1px solid rgba(0, 128, 0, 0.3);
}

.exchange-arrow {
  color: var(--acob-muted);
}

.activity-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 4px;
  border-top: 1px solid var(--acob-line);
  font-size: 11px;
}

.activity-channel-badge {
  color: var(--acob-muted);
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  padding: 2px 6px;
  border-radius: 4px;
}

.activity-timestamp {
  color: var(--acob-muted);
  font-size: 10px;
}
</style>
