<template>
  <div class="crm-modal-backdrop" @click.self="$emit('close')">
    <div class="crm-modal" role="dialog" aria-modal="true" :aria-label="'Rider Account: ' + customer.name">
      <header class="crm-header">
        <div class="crm-title-group">
          <h2>{{ customer.name }}</h2>
          <span class="status-badge" :class="customer.status">
            {{ formatStatus(customer.status) }}
          </span>
          <span v-if="customer.daysOverdue > 0" class="overdue-tag">
            {{ customer.daysOverdue }} days late
          </span>
        </div>
        <button class="close-btn" aria-label="Close" @click="$emit('close')">✕</button>
      </header>

      <div class="crm-body">
        <!-- Identity & Vehicle Bar -->
        <div class="info-strip">
          <div class="info-cell">
            <span class="label">Phone Number</span>
            <span class="val">{{ customer.phone }}</span>
          </div>
          <div class="info-cell">
            <span class="label">NIN</span>
            <span class="val font-mono">{{ customer.nin }}</span>
          </div>
          <div class="info-cell">
            <span class="label">Guarantor</span>
            <span class="val">{{ customer.guarantorName }} ({{ customer.guarantorPhone }})</span>
          </div>
          <div class="info-cell">
            <span class="label">Assigned Bike</span>
            <span class="val font-mono">{{ customer.bikeId }}</span>
          </div>
          <div class="info-cell">
            <span class="label">Current Battery</span>
            <span class="val font-mono">{{ customer.batterySn }}</span>
          </div>
        </div>

        <!-- Installment & Financial Ledger Card -->
        <div class="lease-card">
          <div class="lease-top">
            <div>
              <span class="lease-type-tag">{{ customer.purchaseType === 'installment' ? 'Weekly Installment Lease' : 'Outright Purchase' }}</span>
              <h3>Payment Progress</h3>
            </div>
            <div class="amount-summary">
              <span class="balance-label">Balance Remaining:</span>
              <strong class="balance-num">₦{{ formatNaira(customer.balanceMinor) }}</strong>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="progress-wrap">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: paymentPercentage + '%' }"></div>
            </div>
            <div class="progress-labels">
              <span>Paid: ₦{{ formatNaira(customer.paidMinor) }}</span>
              <span>Total: ₦{{ formatNaira(customer.totalCostMinor) }} ({{ paymentPercentage }}%)</span>
            </div>
          </div>

          <div v-if="customer.purchaseType === 'installment'" class="installment-metrics">
            <div class="metric-box">
              <span class="sub">Weekly Due</span>
              <strong>₦{{ formatNaira(customer.weeklyInstallmentMinor) }}</strong>
            </div>
            <div class="metric-box">
              <span class="sub">Next Payment Date</span>
              <strong :class="{ 'text-danger': customer.daysOverdue > 0 }">{{ customer.nextDueDate }}</strong>
            </div>
            <div class="metric-box">
              <span class="sub">Preferred Channel</span>
              <strong>{{ customer.preferredMethod }}</strong>
            </div>
          </div>
        </div>

        <!-- Payment Input / Logging Form -->
        <div class="payment-action-box">
          <h4>Record Rider Payment</h4>
          <div class="action-grid">
            <div class="field-group">
              <label>Amount (₦)</label>
              <input
                v-model.number="paymentAmount"
                type="number"
                placeholder="25,000"
                min="1000"
                step="500"
              />
            </div>
            <div class="field-group">
              <label>Payment Method</label>
              <select v-model="paymentChannel">
                <option value="Paystack">Paystack (Card / USSD / Virtual Account)</option>
                <option value="Bank Transfer">Direct Bank Transfer</option>
              </select>
            </div>
            <div class="field-group">
              <label>Bank or Paystack Reference</label>
              <input
                v-model="paymentReference"
                type="text"
                placeholder="e.g. pstk_tr_938174 or GTB/REF/20261028"
              />
            </div>
            <div class="field-btn">
              <button
                type="button"
                class="record-btn"
                :disabled="!paymentAmount || isSubmitting"
                @click="submitPayment"
              >
                {{ isSubmitting ? "Recording..." : "Confirm Payment" }}
              </button>
            </div>
          </div>
          <p v-if="submitMessage" class="feedback-msg" :class="submitSuccess ? 'good' : 'bad'">
            {{ submitMessage }}
          </p>
        </div>

        <!-- History Tabs: Payments vs Battery Swaps -->
        <div class="sub-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeSubTab === 'payments' }"
            @click="activeSubTab = 'payments'"
          >
            Payment History ({{ customer.payments ? customer.payments.length : 0 }})
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeSubTab === 'swaps' }"
            @click="activeSubTab = 'swaps'"
          >
            Battery Swaps ({{ customer.swaps ? customer.swaps.length : 0 }})
          </button>
        </div>

        <!-- Payments Table -->
        <div v-if="activeSubTab === 'payments'" class="table-wrap">
          <table class="crm-table">
            <thead>
              <tr>
                <th>Receipt / Date</th>
                <th>Amount</th>
                <th>Channel</th>
                <th>Reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in customer.payments" :key="p.id">
                <td>
                  <strong>{{ p.id }}</strong>
                  <div class="sub-date">{{ p.date }}</div>
                </td>
                <td class="font-bold">₦{{ formatNaira(p.amountMinor) }}</td>
                <td>
                  <span class="channel-pill" :class="p.channel === 'Paystack' ? 'paystack' : 'transfer'">
                    {{ p.channel }}
                  </span>
                </td>
                <td><code class="font-mono">{{ p.reference }}</code></td>
                <td><span class="status-pill good">Confirmed</span></td>
              </tr>
              <tr v-if="!customer.payments || !customer.payments.length">
                <td colspan="5" class="empty-state">No payment records logged yet.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Battery Swaps Table -->
        <div v-if="activeSubTab === 'swaps'" class="table-wrap">
          <table class="crm-table">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Swap Station</th>
                <th>Returned Battery</th>
                <th>Received Battery</th>
                <th>Swap Fee</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in customer.swaps" :key="s.id">
                <td>{{ s.date }}</td>
                <td>{{ s.stationName }}</td>
                <td>
                  <span class="sn-tag returned">{{ s.batteryInSn }} ({{ s.batteryInSoc }}%)</span>
                </td>
                <td>
                  <span class="sn-tag fresh">{{ s.batteryOutSn }} ({{ s.batteryOutSoc }}%)</span>
                </td>
                <td>₦{{ formatNaira(s.feeMinor) }}</td>
              </tr>
              <tr v-if="!customer.swaps || !customer.swaps.length">
                <td colspan="5" class="empty-state">No battery swaps recorded for this bike yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "BikeCustomerCrmModal",
  props: {
    customer: {
      type: Object,
      required: true
    }
  },
  emits: ["close", "record-payment"],
  data() {
    return {
      activeSubTab: "payments",
      paymentAmount: 25000,
      paymentChannel: "Paystack",
      paymentReference: "",
      isSubmitting: false,
      submitMessage: "",
      submitSuccess: false
    };
  },
  computed: {
    paymentPercentage() {
      if (!this.customer || !this.customer.totalCostMinor) return 0;
      const pct = (this.customer.paidMinor / this.customer.totalCostMinor) * 100;
      return Math.min(100, Math.round(pct));
    }
  },
  methods: {
    formatNaira(minor) {
      if (typeof minor !== "number") return "0";
      return (minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 });
    },
    formatStatus(status) {
      if (status === "current") return "Up to date";
      if (status === "overdue") return "Overdue";
      if (status === "grace_period") return "In Grace Period";
      if (status === "paid_off") return "Paid in Full";
      return status;
    },
    async submitPayment() {
      if (!this.paymentAmount || this.paymentAmount <= 0) return;

      this.isSubmitting = true;
      this.submitMessage = "";

      try {
        const minor = Math.round(this.paymentAmount * 100);
        const ref = this.paymentReference.trim() || `${this.paymentChannel === 'Paystack' ? 'pstk_' : 'trf_'}${Date.now().toString(36)}`;

        this.$emit("record-payment", {
          customerId: this.customer.id,
          amountMinor: minor,
          channel: this.paymentChannel,
          reference: ref
        });

        this.submitSuccess = true;
        this.submitMessage = `Successfully logged ₦${this.paymentAmount.toLocaleString()} payment via ${this.paymentChannel}.`;
        this.paymentReference = "";
      } catch (err) {
        this.submitSuccess = false;
        this.submitMessage = "Failed to record payment. Please try again.";
      } finally {
        this.isSubmitting = false;
      }
    }
  }
};
</script>

<style scoped>
.crm-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(3, 9, 10, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 16px;
  backdrop-filter: blur(4px);
}

.crm-modal {
  background: var(--acob-panel);
  border: 1px solid var(--acob-line);
  color: var(--acob-text);
  font-family: var(--acob-font-sans);
  border-radius: 16px;
  width: 840px;
  max-width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--acob-panel-shadow, 0 20px 40px rgba(0, 0, 0, 0.25));
  display: flex;
  flex-direction: column;
}

.crm-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--acob-line);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.crm-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.crm-title-group h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--acob-text);
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--acob-muted);
  cursor: pointer;
  padding: 4px 8px;
}

.status-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  text-transform: uppercase;
}

.status-badge.current {
  background: rgba(0, 128, 0, 0.12);
  color: var(--acob-brand);
  border: 1px solid rgba(0, 128, 0, 0.25);
}

.status-badge.overdue {
  background: rgba(239, 68, 68, 0.12);
  color: var(--color-danger);
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.status-badge.grace_period {
  background: rgba(184, 134, 46, 0.12);
  color: var(--acob-gold);
  border: 1px solid rgba(184, 134, 46, 0.25);
}

.status-badge.paid_off {
  background: rgba(34, 197, 94, 0.15);
  color: var(--acob-brand-bright);
  border: 1px solid rgba(34, 197, 94, 0.30);
}

.overdue-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-danger);
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.20);
  padding: 2px 8px;
  border-radius: 6px;
}

.crm-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  background: var(--acob-bg);
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--acob-line);
}

.info-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.info-cell .label {
  font-size: 11px;
  font-weight: 600;
  color: var(--acob-muted);
  text-transform: uppercase;
}

.info-cell .val {
  font-size: 13px;
  font-weight: 600;
  color: var(--acob-text);
}

.font-mono {
  font-family: var(--acob-font-mono);
}

.lease-card {
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 12px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.lease-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.lease-type-tag {
  font-size: 11px;
  font-weight: 700;
  color: var(--acob-brand);
  text-transform: uppercase;
}

.lease-top h3 {
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--acob-text);
}

.amount-summary {
  text-align: right;
}

.balance-label {
  font-size: 12px;
  color: var(--acob-muted);
  display: block;
}

.balance-num {
  font-size: 20px;
  font-weight: 800;
  color: var(--acob-text);
}

.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-bar {
  height: 8px;
  background: var(--acob-bg);
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid var(--acob-line);
}

.progress-fill {
  height: 100%;
  background: var(--acob-brand);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--acob-muted);
}

.installment-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--acob-line);
}

.metric-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-box .sub {
  font-size: 11px;
  color: var(--acob-muted);
}

.metric-box strong {
  font-size: 14px;
  color: var(--acob-text);
}

.text-danger {
  color: var(--color-danger) !important;
}

.payment-action-box {
  background: var(--acob-bg);
  border: 1px solid var(--acob-line);
  border-radius: 12px;
  padding: 16px 20px;
}

.payment-action-box h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: var(--acob-text);
}

.action-grid {
  display: grid;
  grid-template-columns: 140px 180px 1fr auto;
  gap: 12px;
  align-items: flex-end;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-group label {
  font-size: 11px;
  font-weight: 600;
  color: var(--acob-muted);
}

.field-group input,
.field-group select {
  height: 36px;
  border-radius: 6px;
  border: 1px solid var(--acob-line);
  background: var(--acob-chip);
  padding: 0 10px;
  font-size: 13px;
  color: var(--acob-text);
}

.record-btn {
  height: 36px;
  padding: 0 16px;
  background: var(--acob-brand);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.record-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}

.record-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.feedback-msg {
  margin: 10px 0 0;
  font-size: 12px;
  font-weight: 600;
}

.feedback-msg.good {
  color: var(--acob-brand);
}

.feedback-msg.bad {
  color: var(--color-danger);
}

.sub-tabs {
  display: flex;
  gap: 10px;
  border-bottom: 1px solid var(--acob-line);
  padding-bottom: 4px;
}

.tab-btn {
  background: none;
  border: none;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--acob-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.tab-btn.active {
  color: var(--acob-brand);
  border-bottom-color: var(--acob-brand);
}

.table-wrap {
  border: 1px solid var(--acob-line);
  border-radius: 8px;
  overflow-x: auto;
}

.crm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.crm-table th {
  background: var(--acob-panel);
  padding: 8px 12px;
  text-align: left;
  font-size: 11px;
  color: var(--acob-muted);
  border-bottom: 1px solid var(--acob-line);
}

.crm-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--acob-line);
  color: var(--acob-text);
}

.sub-date {
  font-size: 11px;
  color: var(--acob-muted);
}

.channel-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.channel-pill.paystack {
  background: rgba(0, 128, 0, 0.10);
  color: var(--acob-brand);
}

.channel-pill.transfer {
  background: var(--acob-chip);
  color: var(--acob-muted);
}

.status-pill.good {
  background: rgba(0, 128, 0, 0.10);
  color: var(--acob-brand);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.sn-tag {
  font-family: var(--acob-font-mono);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.sn-tag.returned {
  background: rgba(239, 68, 68, 0.10);
  color: var(--color-danger);
}

.sn-tag.fresh {
  background: rgba(0, 128, 0, 0.10);
  color: var(--acob-brand-bright);
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--acob-muted);
}

@media (max-width: 768px) {
  .action-grid {
    grid-template-columns: 1fr;
  }
}
</style>
