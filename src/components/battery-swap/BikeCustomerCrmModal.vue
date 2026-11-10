<template>
  <div class="crm-modal-backdrop" @click.self="$emit('close')">
    <div class="crm-modal" role="dialog" aria-modal="true" :aria-label="'Rider Account: ' + (activeCustomer ? activeCustomer.name : 'Rider')">
      <header class="crm-header" v-if="activeCustomer">
        <div class="crm-title-group">
          <h2>{{ activeCustomer.name }}</h2>
          <span class="status-badge" :class="activeCustomer.status">
            {{ formatStatus(activeCustomer.status) }}
          </span>
          <span v-if="activeCustomer.daysOverdue > 0" class="overdue-tag">
            {{ activeCustomer.daysOverdue }} days late
          </span>
        </div>
        <button class="close-btn" aria-label="Close" @click="$emit('close')">✕</button>
      </header>

      <div class="crm-body" v-if="activeCustomer">
        <!-- Identity & Vehicle Bar -->
        <div class="info-strip">
          <div class="info-cell">
            <span class="label">Phone Number</span>
            <span class="val">{{ activeCustomer.phone }}</span>
          </div>
          <div class="info-cell">
            <span class="label">NIN</span>
            <span class="val font-mono">{{ activeCustomer.nin }}</span>
          </div>
          <div class="info-cell">
            <span class="label">Guarantor</span>
            <span class="val">{{ activeCustomer.guarantorName }} ({{ activeCustomer.guarantorPhone }})</span>
          </div>
          <div class="info-cell">
            <span class="label">Assigned Bike</span>
            <span class="val font-mono">{{ activeCustomer.bikeId }}</span>
          </div>
          <div class="info-cell">
            <span class="label">Current Battery</span>
            <span class="val font-mono">{{ activeCustomer.batterySn }}</span>
          </div>
        </div>

        <!-- Installment & Financial Ledger Card -->
        <div class="lease-card">
          <div class="lease-top">
            <div>
              <span class="lease-type-tag">{{ activeCustomer.purchaseType === 'installment' ? 'Weekly Installment Lease' : 'Outright Purchase' }}</span>
              <h3>Payment Progress</h3>
            </div>
            <div class="amount-summary">
              <span class="balance-label">Balance Remaining:</span>
              <span class="balance-val">₦{{ formatNaira(activeCustomer.balanceMinor) }}</span>
            </div>
          </div>

          <div class="progress-wrap">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: paymentPercentage + '%' }"></div>
            </div>
            <div class="progress-meta">
              <span>₦{{ formatNaira(activeCustomer.paidMinor) }} paid ({{ paymentPercentage }}%)</span>
              <span>Total: ₦{{ formatNaira(activeCustomer.totalCostMinor) }}</span>
            </div>
          </div>

          <!-- Weekly Schedule Info -->
          <div class="installment-metrics" v-if="activeCustomer.purchaseType === 'installment'">
            <div class="metric-item">
              <span class="sub-lbl">Weekly Rate</span>
              <strong>₦{{ formatNaira(activeCustomer.weeklyInstallmentMinor) }}</strong>
            </div>
            <div class="metric-item">
              <span class="sub-lbl">Next Due Date</span>
              <strong :class="{ 'text-danger': activeCustomer.daysOverdue > 0 }">{{ activeCustomer.nextDueDate }}</strong>
            </div>
            <div class="metric-item">
              <span class="sub-lbl">Payment Channel</span>
              <strong>{{ activeCustomer.preferredMethod }}</strong>
            </div>
          </div>
        </div>

        <!-- Action Box: Record Payment -->
        <div class="payment-action-box" v-if="activeCustomer.balanceMinor > 0">
          <h4>Record Lease Payment</h4>
          <div class="payment-form">
            <div class="form-group">
              <label>Amount (NGN)</label>
              <input type="number" v-model.number="paymentAmount" min="1000" step="1000" />
            </div>
            <div class="form-group">
              <label>Payment Channel</label>
              <select v-model="paymentChannel">
                <option value="Paystack">Paystack Direct</option>
                <option value="Bank Transfer">Bank Transfer (Zenith/GTB)</option>
                <option value="Cash / POS">Cash / Agent POS</option>
              </select>
            </div>
            <div class="form-group">
              <label>Reference (Optional)</label>
              <input type="text" v-model="paymentReference" placeholder="e.g. pstk_tr_990182" />
            </div>
            <div class="form-group form-action">
              <button
                type="button"
                class="btn-submit-pay"
                :disabled="isSubmitting || paymentAmount <= 0"
                @click="submitPayment"
              >
                {{ isSubmitting ? "Recording..." : "Log ₦" + (paymentAmount || 0).toLocaleString() }}
              </button>
            </div>
          </div>
          <div v-if="submitMessage" class="feedback-msg" :class="{ success: submitSuccess, error: !submitSuccess }">
            {{ submitMessage }}
          </div>
        </div>

        <!-- Ledger Tabs: Payments vs Battery Swaps -->
        <div class="ledger-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeSubTab === 'payments' }"
            @click="activeSubTab = 'payments'"
          >
            Payment Ledger ({{ activeCustomer.payments ? activeCustomer.payments.length : 0 }})
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeSubTab === 'swaps' }"
            @click="activeSubTab = 'swaps'"
          >
            Battery Swaps ({{ activeCustomer.swaps ? activeCustomer.swaps.length : 0 }})
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
              <tr v-for="p in activeCustomer.payments" :key="p.id">
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
              <tr v-if="!activeCustomer.payments || !activeCustomer.payments.length">
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
                <th>Swap ID / Date</th>
                <th>Station</th>
                <th>Depleted In</th>
                <th>Fresh Out</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in activeCustomer.swaps" :key="s.id">
                <td>
                  <strong>{{ s.id }}</strong>
                  <div class="sub-date">{{ s.date }}</div>
                </td>
                <td>{{ s.stationName }}</td>
                <td>
                  <span class="font-mono">{{ s.batteryInSn }}</span>
                  <div class="sub-soc">Charge: {{ s.batteryInSoc }}%</div>
                </td>
                <td>
                  <span class="font-mono">{{ s.batteryOutSn }}</span>
                  <div class="sub-soc good">Charge: {{ s.batteryOutSoc }}%</div>
                </td>
                <td>₦{{ formatNaira(s.feeMinor) }}</td>
              </tr>
              <tr v-if="!activeCustomer.swaps || !activeCustomer.swaps.length">
                <td colspan="5" class="empty-state">No battery swap history found for this rider.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else class="crm-body empty-state-box">
        <p>No customer found for this bike record.</p>
        <button class="btn-cancel" @click="$emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>

<script>
import { useBatteryFleetStore } from "../../stores/battery-fleet-store.js";
import YunheBatteryDetailModal from "./YunheBatteryDetailModal.vue";

export default {
  name: "BikeCustomerCrmModal",
  props: {
    customer: {
      type: Object,
      default: null
    },
    bikeId: {
      type: String,
      default: ""
    }
  },
  emits: ["close", "record-payment"],
  setup() {
    const fleetStore = useBatteryFleetStore();
    return { fleetStore };
  },
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
    activeCustomer() {
      if (this.customer) return this.customer;
      if (this.bikeId && this.fleetStore) {
        return this.fleetStore.customers.find((c) => c.bikeId === this.bikeId) || null;
      }
      return null;
    },
    paymentPercentage() {
      if (!this.activeCustomer || !this.activeCustomer.totalCostMinor) return 0;
      const pct = (this.activeCustomer.paidMinor / this.activeCustomer.totalCostMinor) * 100;
      return Math.min(100, Math.round(pct));
    }
  },
  methods: {
    getSocColor(soc) {
      if (soc > 50) return "var(--acob-brand-mint, #00D084)";
      if (soc > 20) return "var(--acob-brand-accent, #FF9900)";
      return "var(--acob-coral-bright, #FF5555)";
    },
    openDiagnosticsModal() {
      this.showDetailModal = true;
    },
    async handleToggleImmobilizer(cmd) {
      if (!this.assignedBattery) return;
      this.executingCommand = true;
      this.iotCommandFeedback = "";
      try {
        const res = await this.fleetStore.executeYunheCommand(this.assignedBattery.sn, cmd);
        this.iotCommandSuccess = res.success;
        this.iotCommandFeedback = res.message;
        if (cmd === "turn_off_d_fet" || cmd === "turn_off_cd_fet") {
          this.assignedBattery.immobilized = true;
          this.assignedBattery.fetState = "d_off";
        } else if (cmd === "enable_cd_fet") {
          this.assignedBattery.immobilized = false;
          this.assignedBattery.fetState = "normal";
        }
      } catch (err) {
        this.iotCommandSuccess = false;
        this.iotCommandFeedback = err.message || "Command failed";
      } finally {
        this.executingCommand = false;
      }
    },
    onCommandExecuted(res) {
      this.iotCommandSuccess = res.success;
      this.iotCommandFeedback = res.message;
    },
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
      if (!this.paymentAmount || this.paymentAmount <= 0 || !this.activeCustomer) return;

      this.isSubmitting = true;
      this.submitMessage = "";

      try {
        const minor = Math.round(this.paymentAmount * 100);
        const ref = this.paymentReference.trim() || `${this.paymentChannel === 'Paystack' ? 'pstk_' : 'trf_'}${Date.now().toString(36)}`;

        if (this.fleetStore && typeof this.fleetStore.recordPayment === "function") {
          this.fleetStore.recordPayment(this.activeCustomer.id, {
            amountMinor: minor,
            channel: this.paymentChannel,
            reference: ref
          });
        }

        this.$emit("record-payment", {
          customerId: this.activeCustomer.id,
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
  font-size: 20px;
  font-weight: 700;
  color: var(--acob-text);
}

.status-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-badge.current {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}

.status-badge.overdue {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.status-badge.grace_period {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.status-badge.paid_off {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

.overdue-tag {
  font-size: 11px;
  background: #ef4444;
  color: #ffffff;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 700;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  color: var(--acob-text-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.close-btn:hover {
  background: var(--acob-surface-hover);
  color: var(--acob-text);
}

.crm-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  background: var(--acob-surface);
  border: 1px solid var(--acob-line);
  padding: 12px 16px;
  border-radius: 10px;
}

.info-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-cell .label {
  font-size: 11px;
  color: var(--acob-text-muted);
}

.info-cell .val {
  font-size: 13px;
  font-weight: 600;
  color: var(--acob-text);
}

.font-mono {
  font-family: monospace;
}

.lease-card {
  background: var(--acob-surface);
  border: 1px solid var(--acob-line);
  border-radius: 12px;
  padding: 18px;
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
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 2px;
}

.lease-top h3 {
  margin: 0;
  font-size: 16px;
  color: var(--acob-text);
}

.amount-summary {
  text-align: right;
}

.balance-label {
  display: block;
  font-size: 11px;
  color: var(--acob-text-muted);
}

.balance-val {
  font-size: 18px;
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
  background: var(--acob-line);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--acob-brand);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--acob-text-muted);
}

.installment-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--acob-line);
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-item .sub-lbl {
  font-size: 11px;
  color: var(--acob-text-muted);
}

.metric-item strong {
  font-size: 13.5px;
  color: var(--acob-text);
}

.text-danger {
  color: #ef4444 !important;
}

.payment-action-box {
  background: var(--acob-surface);
  border: 1px dashed var(--acob-line);
  border-radius: 12px;
  padding: 16px 20px;
}

.payment-action-box h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--acob-text);
}

.payment-form {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr auto;
  gap: 12px;
  align-items: flex-end;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 11px;
  font-weight: 600;
  color: var(--acob-text-muted);
}

.form-group input,
.form-group select {
  height: 38px;
  background: var(--acob-panel);
  border: 1px solid var(--acob-line);
  border-radius: 6px;
  color: var(--acob-text);
  padding: 0 10px;
  font-size: 13px;
  outline: none;
}

.form-group input:focus,
.form-group select:focus {
  border-color: var(--acob-brand);
}

.btn-submit-pay {
  height: 38px;
  padding: 0 16px;
  background: var(--acob-brand);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.btn-submit-pay:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.feedback-msg {
  margin-top: 10px;
  font-size: 12.5px;
  padding: 8px 12px;
  border-radius: 6px;
}

.feedback-msg.success {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}

.feedback-msg.error {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.ledger-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--acob-line);
  padding-bottom: 8px;
}

.tab-btn {
  background: transparent;
  border: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--acob-text-muted);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.tab-btn.active {
  background: var(--acob-surface-hover);
  color: var(--acob-text);
}

.table-wrap {
  overflow-x: auto;
}

.crm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}

.crm-table th {
  text-align: left;
  padding: 8px 12px;
  color: var(--acob-text-muted);
  font-weight: 600;
  border-bottom: 1px solid var(--acob-line);
}

.crm-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--acob-line);
}

.sub-date {
  font-size: 11px;
  color: var(--acob-text-muted);
}

.channel-pill {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.channel-pill.paystack {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

.channel-pill.transfer {
  background: rgba(168, 85, 247, 0.12);
  color: #a855f7;
}

.status-pill.good {
  color: #22c55e;
  font-weight: 600;
}

.sub-soc {
  font-size: 11px;
  color: #ef4444;
}

.sub-soc.good {
  color: #22c55e;
}

.empty-state {
  text-align: center;
  color: var(--acob-text-muted);
  padding: 24px;
}

.empty-state-box {
  text-align: center;
  padding: 40px;
}

/* ── Battery IoT & Immobilizer Controls ── */
.battery-iot-card {
  background: linear-gradient(180deg, rgba(0, 208, 132, 0.04) 0%, rgba(20, 28, 22, 0.6) 100%);
  border: 1px solid rgba(0, 208, 132, 0.25);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.battery-iot-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.iot-badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.iot-badge {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(0, 208, 132, 0.15);
  color: var(--acob-brand-mint, #00D084);
}

.signal-tag {
  font-size: 11px;
  color: var(--acob-text-muted, #8b949e);
  font-family: monospace;
}

.fet-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding: 2px 7px;
  border-radius: 4px;
}

.fet-enabled {
  background: rgba(0, 208, 132, 0.12);
  color: var(--acob-brand-mint, #00D084);
}

.fet-disabled {
  background: rgba(255, 85, 85, 0.18);
  color: var(--acob-coral-bright, #FF5555);
  animation: pulse-danger 2s infinite ease-in-out;
}

@keyframes pulse-danger {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.iot-part-title {
  margin: 0;
  font-size: 15px;
  color: var(--acob-text, #ffffff);
}

.iot-quick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-iot-inspect {
  background: rgba(0, 208, 132, 0.1);
  border: 1px solid rgba(0, 208, 132, 0.3);
  color: var(--acob-brand-mint, #00D084);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-iot-inspect:hover {
  background: rgba(0, 208, 132, 0.2);
  border-color: var(--acob-brand-mint, #00D084);
}

.btn-iot-immobilize {
  background: rgba(255, 85, 85, 0.15);
  border: 1px solid rgba(255, 85, 85, 0.35);
  color: var(--acob-coral-bright, #FF5555);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-iot-immobilize:hover:not(:disabled) {
  background: rgba(255, 85, 85, 0.25);
  border-color: #ff5555;
}

.btn-iot-rearm {
  background: rgba(0, 208, 132, 0.18);
  border: 1px solid rgba(0, 208, 132, 0.4);
  color: var(--acob-brand-mint, #00D084);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-iot-rearm:hover:not(:disabled) {
  background: rgba(0, 208, 132, 0.3);
}

.iot-stats-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 10px 12px;
}

@media (max-width: 768px) {
  .iot-stats-row {
    grid-template-columns: repeat(3, 1fr);
  }
}

.iot-stat-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-lbl {
  font-size: 10px;
  color: var(--acob-text-muted, #8b949e);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-val {
  font-size: 13px;
  color: var(--acob-text, #ffffff);
}

.iot-command-feedback {
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(255, 85, 85, 0.15);
  border: 1px solid rgba(255, 85, 85, 0.3);
  color: var(--acob-coral-bright, #FF5555);
}

.iot-command-feedback.feedback-success {
  background: rgba(0, 208, 132, 0.12);
  border-color: rgba(0, 208, 132, 0.3);
  color: var(--acob-brand-mint, #00D084);
}
</style>
