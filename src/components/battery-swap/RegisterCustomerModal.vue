<template>
  <div class="rcm-backdrop" @click.self="$emit('close')">
    <div class="rcm-modal" role="dialog" aria-modal="true" aria-labelledby="rcm-title">
      <!-- Modal Header -->
      <header class="rcm-header">
        <div class="rcm-header-left">
          <div class="rcm-badge">NEW REGISTRATION</div>
          <h2 id="rcm-title" class="rcm-title">Register Customer &amp; Issue Bike</h2>
          <p class="rcm-subtitle">KYC verification, EV asset assignment, and lease agreement.</p>
        </div>
        <button class="rcm-close-btn" aria-label="Close modal" @click="$emit('close')">✕</button>
      </header>

      <!-- Modal Body / Form -->
      <form class="rcm-body" @submit.prevent="handleSubmit">
        <!-- Step Tabs / Sections -->
        <div class="rcm-tabs">
          <button
            type="button"
            class="rcm-tab-btn"
            :class="{ active: currentTab === 'kyc' }"
            @click="currentTab = 'kyc'"
          >
            1. Rider &amp; Guarantor
          </button>
          <button
            type="button"
            class="rcm-tab-btn"
            :class="{ active: currentTab === 'lease' }"
            @click="currentTab = 'lease'"
          >
            2. Asset &amp; Lease Terms
          </button>
        </div>

        <!-- Tab 1: Rider & Guarantor -->
        <div v-show="currentTab === 'kyc'" class="rcm-tab-content">
          <div class="rcm-section-heading">Personal &amp; Contact Details</div>
          <div class="rcm-grid rcm-grid--2">
            <div class="rcm-field">
              <label for="rcm-name">Full Name <span class="req">*</span></label>
              <input
                id="rcm-name"
                v-model.trim="form.name"
                type="text"
                placeholder="e.g. Babatunde Adeleke"
                required
                class="rcm-input"
              />
            </div>
            <div class="rcm-field">
              <label for="rcm-phone">Phone Number <span class="req">*</span></label>
              <input
                id="rcm-phone"
                v-model.trim="form.phone"
                type="tel"
                placeholder="e.g. +234 803 123 4567"
                required
                class="rcm-input font-mono"
              />
            </div>
            <div class="rcm-field">
              <label for="rcm-email">Email Address</label>
              <input
                id="rcm-email"
                v-model.trim="form.email"
                type="email"
                placeholder="e.g. b.adeleke@gmail.com"
                class="rcm-input"
              />
            </div>
            <div class="rcm-field">
              <label for="rcm-nin">National Identity No. (NIN) <span class="req">*</span></label>
              <input
                id="rcm-nin"
                v-model.trim="form.nin"
                type="text"
                maxlength="11"
                placeholder="11-digit NIN"
                required
                class="rcm-input font-mono"
              />
            </div>
          </div>

          <div class="rcm-grid rcm-grid--2">
            <div class="rcm-field">
              <label for="rcm-city">Operating City / Hub <span class="req">*</span></label>
              <select id="rcm-city" v-model="form.city" class="rcm-select">
                <option value="Lagos (Ikeja)">Lagos (Ikeja Hub)</option>
                <option value="Lagos (Victoria Island)">Lagos (VI Commercial Hub)</option>
                <option value="Lagos (Lekki Phase 1)">Lagos (Lekki Hub)</option>
                <option value="Lagos (Yaba & Surulere)">Lagos (Yaba Tech Hub)</option>
                <option value="Abuja (Wuse & Central)">Abuja (Wuse 2 Hub)</option>
                <option value="Ibadan (Bodija & Ring Rd)">Ibadan (Bodija Hub)</option>
                <option value="Akure Delivery Corridor">Akure Corridor</option>
              </select>
            </div>
            <div class="rcm-field">
              <label for="rcm-address">Residential Address</label>
              <input
                id="rcm-address"
                v-model.trim="form.address"
                type="text"
                placeholder="Street address, City"
                class="rcm-input"
              />
            </div>
          </div>

          <div class="rcm-section-heading mt-4">Guarantor Information (Security)</div>
          <div class="rcm-grid rcm-grid--3">
            <div class="rcm-field">
              <label for="rcm-guar-name">Guarantor Name <span class="req">*</span></label>
              <input
                id="rcm-guar-name"
                v-model.trim="form.guarantorName"
                type="text"
                placeholder="e.g. Emeka Okafor"
                required
                class="rcm-input"
              />
            </div>
            <div class="rcm-field">
              <label for="rcm-guar-phone">Guarantor Phone <span class="req">*</span></label>
              <input
                id="rcm-guar-phone"
                v-model.trim="form.guarantorPhone"
                type="tel"
                placeholder="e.g. +234 802 987 6543"
                required
                class="rcm-input font-mono"
              />
            </div>
            <div class="rcm-field">
              <label for="rcm-guar-rel">Relationship</label>
              <select id="rcm-guar-rel" v-model="form.guarantorRelationship" class="rcm-select">
                <option value="Employer / Fleet Lead">Employer / Fleet Lead</option>
                <option value="Family Relative">Family Relative</option>
                <option value="Community Leader">Community Leader</option>
                <option value="Colleague">Colleague</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Tab 2: Asset & Lease Terms -->
        <div v-show="currentTab === 'lease'" class="rcm-tab-content">
          <div class="rcm-section-heading">EV Asset Assignment</div>
          <div class="rcm-field">
            <label for="rcm-bike">Assign EV Bike &amp; Smart Battery</label>
            <select id="rcm-bike" v-model="form.bikeId" class="rcm-select font-mono">
              <option value="">⚡ Auto-assign next available EV Bike</option>
              <option
                v-for="bike in availableBikes"
                :key="bike.id"
                :value="bike.id"
              >
                {{ bike.id }} &bull; {{ bike.model }} &bull; {{ bike.plateNumber }} (SoC: {{ bike.telemetry?.soc }}%)
              </option>
            </select>
            <span class="rcm-help">The assigned bike comes with a swappable Yunhe IoT lithium pack.</span>
          </div>

          <div class="rcm-section-heading mt-4">Lease Agreement &amp; Pricing</div>
          <div class="rcm-model-picker">
            <label
              class="rcm-model-card"
              :class="{ selected: form.purchaseType === 'installment' }"
            >
              <input
                v-model="form.purchaseType"
                type="radio"
                value="installment"
                class="sr-only"
              />
              <div class="model-title">Weekly Rent-to-Own</div>
              <div class="model-desc">Deposit + weekly installments with path to full asset ownership.</div>
            </label>

            <label
              class="rcm-model-card"
              :class="{ selected: form.purchaseType === 'outright' }"
            >
              <input
                v-model="form.purchaseType"
                type="radio"
                value="outright"
                class="sr-only"
              />
              <div class="model-title">Outright Buy</div>
              <div class="model-desc">100% upfront settlement, full title transferred immediately.</div>
            </label>
          </div>

          <div class="rcm-grid rcm-grid--3 mt-3">
            <div class="rcm-field">
              <label for="rcm-total">Total Asset Value (NGN)</label>
              <input
                id="rcm-total"
                v-model.number="form.totalCostNaira"
                type="number"
                min="500000"
                step="50000"
                class="rcm-input font-mono"
              />
            </div>

            <div v-if="form.purchaseType === 'installment'" class="rcm-field">
              <label for="rcm-deposit">Initial Deposit Paid (NGN)</label>
              <input
                id="rcm-deposit"
                v-model.number="form.downPaymentNaira"
                type="number"
                min="0"
                step="25000"
                class="rcm-input font-mono"
              />
            </div>

            <div v-if="form.purchaseType === 'installment'" class="rcm-field">
              <label for="rcm-weekly">Weekly Rate (NGN)</label>
              <input
                id="rcm-weekly"
                v-model.number="form.weeklyInstallmentNaira"
                type="number"
                min="5000"
                step="1000"
                class="rcm-input font-mono"
              />
            </div>
          </div>

          <div class="rcm-grid rcm-grid--2 mt-3">
            <div class="rcm-field">
              <label for="rcm-method">Payment Collection Channel</label>
              <select id="rcm-method" v-model="form.preferredMethod" class="rcm-select">
                <option value="Beverly Wallet">Beverly Wallet (Auto-Debit)</option>
                <option value="Paystack">Paystack Direct Debit</option>
                <option value="Bank Transfer">Bank Transfer (Zenith / GTB)</option>
                <option value="Agent POS">Beverly Hub POS / Cash</option>
              </select>
            </div>
            <div class="rcm-field">
              <label>Estimated Pay-Off Term</label>
              <div class="rcm-calc-chip">
                {{ payoffWeeksText }}
              </div>
            </div>
          </div>

          <!-- Financial Snapshot Banner -->
          <div class="rcm-summary-banner">
            <div class="summary-col">
              <span class="lbl">Asset Value</span>
              <strong class="val">₦{{ formatNaira(form.totalCostNaira) }}</strong>
            </div>
            <div class="summary-col">
              <span class="lbl">Initial Payment</span>
              <strong class="val text-success">
                ₦{{ formatNaira(form.purchaseType === 'installment' ? form.downPaymentNaira : form.totalCostNaira) }}
              </strong>
            </div>
            <div class="summary-col">
              <span class="lbl">Remaining Balance</span>
              <strong class="val">
                ₦{{ formatNaira(calculatedBalance) }}
              </strong>
            </div>
          </div>
        </div>

        <!-- Form Error Alert -->
        <div v-if="errorMessage" class="rcm-error" role="alert">
          {{ errorMessage }}
        </div>

        <!-- Form Footer Actions -->
        <footer class="rcm-footer">
          <div class="rcm-footer-left">
            <button
              v-if="currentTab === 'lease'"
              type="button"
              class="rcm-btn rcm-btn--ghost"
              @click="currentTab = 'kyc'"
            >
              &larr; Back to Rider Info
            </button>
          </div>
          <div class="rcm-footer-right">
            <button
              type="button"
              class="rcm-btn rcm-btn--ghost"
              @click="$emit('close')"
            >
              Cancel
            </button>
            <button
              v-if="currentTab === 'kyc'"
              type="button"
              class="rcm-btn rcm-btn--primary"
              @click="proceedToLease"
            >
              Next: Asset &amp; Lease &rarr;
            </button>
            <button
              v-else
              type="submit"
              class="rcm-btn rcm-btn--primary"
              :disabled="submitting"
            >
              <span v-if="submitting">Registering…</span>
              <span v-else>⚡ Complete Registration &amp; Issue Bike</span>
            </button>
          </div>
        </footer>
      </form>
    </div>
  </div>
</template>

<script>
import { useBatteryFleetStore } from "../../stores/battery-fleet-store.js";

export default {
  name: "RegisterCustomerModal",
  emits: ["close", "registered"],
  data() {
    return {
      currentTab: "kyc",
      submitting: false,
      errorMessage: "",
      form: {
        name: "",
        phone: "+234 ",
        email: "",
        nin: "",
        city: "Lagos (Ikeja)",
        address: "",
        guarantorName: "",
        guarantorPhone: "+234 ",
        guarantorRelationship: "Employer / Fleet Lead",
        bikeId: "",
        purchaseType: "installment",
        totalCostNaira: 1450000,
        downPaymentNaira: 300000,
        weeklyInstallmentNaira: 25000,
        preferredMethod: "Beverly Wallet"
      }
    };
  },
  computed: {
    fleetStore() {
      return useBatteryFleetStore();
    },
    availableBikes() {
      if (!this.fleetStore.bikes) return [];
      return this.fleetStore.bikes.slice(0, 30);
    },
    calculatedBalance() {
      if (this.form.purchaseType === "outright") return 0;
      return Math.max(0, this.form.totalCostNaira - this.form.downPaymentNaira);
    },
    payoffWeeksText() {
      if (this.form.purchaseType === "outright") return "Immediate (0 Weeks)";
      if (!this.form.weeklyInstallmentNaira || this.form.weeklyInstallmentNaira <= 0) return "—";
      const weeks = Math.ceil(this.calculatedBalance / this.form.weeklyInstallmentNaira);
      return `${weeks} Weeks (~${(weeks / 4.3).toFixed(1)} Months)`;
    }
  },
  methods: {
    formatNaira(val) {
      if (!val || isNaN(val)) return "0";
      return Number(val).toLocaleString("en-NG");
    },
    proceedToLease() {
      this.errorMessage = "";
      if (!this.form.name || this.form.name.length < 3) {
        this.errorMessage = "Please enter the rider's full legal name.";
        return;
      }
      if (!this.form.phone || this.form.phone.length < 10) {
        this.errorMessage = "Please enter a valid phone number.";
        return;
      }
      if (!this.form.nin || this.form.nin.length < 6) {
        this.errorMessage = "Please enter a valid NIN (National Identity Number).";
        return;
      }
      if (!this.form.guarantorName || !this.form.guarantorPhone) {
        this.errorMessage = "Guarantor full name and contact phone are required.";
        return;
      }
      this.currentTab = "lease";
    },
    handleSubmit() {
      this.errorMessage = "";
      if (!this.form.name || !this.form.phone) {
        this.currentTab = "kyc";
        this.errorMessage = "Rider details are required.";
        return;
      }

      this.submitting = true;
      try {
        const newCustomer = this.fleetStore.registerCustomer({
          name: this.form.name,
          phone: this.form.phone,
          email: this.form.email,
          nin: this.form.nin,
          city: this.form.city,
          address: this.form.address,
          guarantorName: this.form.guarantorName,
          guarantorPhone: this.form.guarantorPhone,
          guarantorRelationship: this.form.guarantorRelationship,
          bikeId: this.form.bikeId,
          purchaseType: this.form.purchaseType,
          totalCostMinor: Math.round(this.form.totalCostNaira * 100),
          downPaymentMinor: Math.round(this.form.downPaymentNaira * 100),
          weeklyInstallmentMinor: Math.round(this.form.weeklyInstallmentNaira * 100),
          preferredMethod: this.form.preferredMethod
        });

        this.$emit("registered", newCustomer);
        this.$emit("close");
      } catch (err) {
        console.error("[RegisterCustomerModal] Error registering:", err);
        this.errorMessage = err.message || "Failed to register customer. Please try again.";
      } finally {
        this.submitting = false;
      }
    }
  }
};
</script>

<style scoped>
.rcm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow-y: auto;
}

.rcm-modal {
  width: 100%;
  max-width: 680px;
  background: var(--acob-card-bg, #0b1810);
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: var(--acob-radius-lg, 12px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  color: var(--acob-text, #f2f7f3);
  max-height: 90vh;
  overflow: hidden;
}

.rcm-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
}

.rcm-badge {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--acob-brand-mint, #7dfc9a);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.rcm-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--acob-text, #f2f7f3);
}

.rcm-subtitle {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
}

.rcm-close-btn {
  background: transparent;
  border: none;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;
}
.rcm-close-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.rcm-tabs {
  display: flex;
  background: var(--acob-surface, rgba(10, 22, 15, 0.9));
  border-bottom: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
}

.rcm-tab-btn {
  flex: 1;
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.rcm-tab-btn.active {
  color: var(--acob-brand-mint, #7dfc9a);
  border-bottom-color: var(--acob-brand-mint, #7dfc9a);
  background: rgba(125, 252, 154, 0.04);
}

.rcm-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.rcm-tab-content {
  padding: 20px 24px;
}

.rcm-section-heading {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--acob-brand-mint, #7dfc9a);
  margin-bottom: 12px;
}

.mt-3 { margin-top: 14px; }
.mt-4 { margin-top: 20px; }

.rcm-grid {
  display: grid;
  gap: 12px;
}
.rcm-grid--2 { grid-template-columns: repeat(2, 1fr); }
.rcm-grid--3 { grid-template-columns: repeat(3, 1fr); }

.rcm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rcm-field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--acob-muted, rgba(242, 247, 243, 0.75));
}
.req { color: #ef4444; }

.rcm-input,
.rcm-select {
  padding: 9px 12px;
  background: var(--acob-chip, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: var(--acob-radius-md, 8px);
  color: var(--acob-text, #f2f7f3);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.15s;
}

.rcm-input:focus,
.rcm-select:focus {
  border-color: var(--acob-brand-mint, #7dfc9a);
}

.rcm-select option {
  background: #0b1810;
  color: #fff;
}

.rcm-help {
  font-size: 0.7rem;
  color: var(--acob-subtle, rgba(242, 247, 243, 0.5));
}

.rcm-model-picker {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.rcm-model-card {
  padding: 12px 14px;
  border-radius: var(--acob-radius-md, 8px);
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  background: var(--acob-surface, rgba(10, 22, 15, 0.8));
  cursor: pointer;
  transition: all 0.15s;
}
.rcm-model-card:hover {
  border-color: rgba(125, 252, 154, 0.3);
}
.rcm-model-card.selected {
  border-color: var(--acob-brand-mint, #7dfc9a);
  background: rgba(125, 252, 154, 0.08);
}

.model-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--acob-text, #f2f7f3);
  margin-bottom: 2px;
}

.model-desc {
  font-size: 0.72rem;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
}

.rcm-calc-chip {
  padding: 9px 12px;
  background: rgba(125, 252, 154, 0.06);
  border: 1px solid rgba(125, 252, 154, 0.2);
  border-radius: var(--acob-radius-md, 8px);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--acob-brand-mint, #7dfc9a);
}

.rcm-summary-banner {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-top: 18px;
  padding: 14px 18px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.1));
  border-radius: var(--acob-radius-md, 8px);
}

.summary-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: center;
}
.summary-col .lbl {
  font-size: 0.68rem;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
  text-transform: uppercase;
}
.summary-col .val {
  font-size: 1.1rem;
  font-weight: 800;
  font-family: var(--acob-font-mono, monospace);
}
.text-success { color: var(--acob-brand-mint, #7dfc9a); }

.rcm-error {
  margin: 0 24px 14px;
  padding: 8px 14px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 6px;
  color: #ef4444;
  font-size: 0.8rem;
}

.rcm-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: var(--acob-surface, rgba(10, 22, 15, 0.95));
  border-top: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
}

.rcm-footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rcm-btn {
  padding: 8px 16px;
  border-radius: var(--acob-radius-md, 8px);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.rcm-btn--ghost {
  background: transparent;
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  color: var(--acob-muted, rgba(242, 247, 243, 0.7));
}
.rcm-btn--ghost:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.rcm-btn--primary {
  background: var(--acob-brand, #008000);
  border: 1px solid var(--acob-brand-mint, #7dfc9a);
  color: #fff;
}
.rcm-btn--primary:hover:not(:disabled) {
  background: #009900;
  box-shadow: 0 0 12px rgba(125, 252, 154, 0.35);
}
.rcm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 640px) {
  .rcm-grid--2,
  .rcm-grid--3,
  .rcm-model-picker {
    grid-template-columns: 1fr;
  }
  .rcm-summary-banner {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
