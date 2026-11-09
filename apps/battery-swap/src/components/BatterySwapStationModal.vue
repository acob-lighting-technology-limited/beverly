<template>
  <div class="swap-modal-backdrop" @click.self="$emit('close')">
    <div class="swap-modal" role="dialog" aria-modal="true" aria-label="Swap EV Battery">
      <!-- ── Header ────────────────────────────────────────────── -->
      <header class="swap-modal-head">
        <div>
          <div class="modal-pill-tag">
            <span class="pulse-dot" /> Express Swap
          </div>
          <h2 class="modal-title">Record Battery Swap</h2>
          <p class="modal-subtitle">
            Instant pack exchange &bull; ₦800 via Beverly Wallet
          </p>
        </div>
        <button class="close-btn" aria-label="Close modal" @click="$emit('close')">✕</button>
      </header>

      <!-- ── Body ──────────────────────────────────────────────── -->
      <div class="swap-modal-body">
        <!-- Station & Bike Selection -->
        <div class="selection-grid">
          <div class="input-block">
            <label class="field-label">
              <span>Station Hub</span>
            </label>
            <select v-model="selectedStationId" class="select-field" @change="onStationChanged">
              <option v-for="s in effectiveStations" :key="s.id" :value="s.id">
                {{ s.name }} ({{ getAvailableBatteriesCount(s) }} ready)
              </option>
            </select>
          </div>

          <div class="input-block">
            <label class="field-label">
              <span>EV Bike &amp; Rider</span>
            </label>
            <select v-model="selectedBikeId" class="select-field" @change="onBikeChanged">
              <option v-for="b in effectiveBikes" :key="b.id" :value="b.id">
                {{ b.id }} &bull; {{ b.riderName }} ({{ b.telemetry.soc }}%)
              </option>
            </select>
          </div>
        </div>

        <!-- Visual Exchange Comparison -->
        <div class="swap-exchange-card">
          <!-- Low Battery Out of Bike (Deposit) -->
          <div class="pack-bay in-bay">
            <div class="bay-header">
              <span class="bay-step-badge">STEP 1</span>
              <span class="bay-label">Depleted Pack</span>
            </div>
            
            <div v-if="targetBike" class="pack-details">
              <div class="pack-id-row">
                <span class="pack-name">Check-In</span>
                <span class="pack-sn">#{{ targetBike.batterySn.slice(-6) }}</span>
              </div>
              <div class="soc-pill low">
                <span>Charge:</span>
                <strong>{{ targetBike.telemetry.soc }}% Low</strong>
              </div>
              <div class="pack-meta-row">
                <span>{{ targetBike.telemetry.voltage }}V</span>
                <span>&bull;</span>
                <span>Bike: {{ targetBike.id }}</span>
              </div>
            </div>
          </div>

          <!-- Direct 1-to-1 Arrow -->
          <div class="exchange-arrow" aria-hidden="true">
            <span class="arrow-symbol">⇄</span>
            <span class="arrow-label">Swap</span>
          </div>

          <!-- Fully Charged Battery (Take Out) -->
          <div class="pack-bay out-bay">
            <div class="bay-header">
              <span class="bay-step-badge bay-step-badge--green">STEP 2</span>
              <span class="bay-label">Fresh Pack</span>
            </div>

            <div v-if="selectedStation && readyBatteries.length > 0" class="pack-details">
              <select v-model="selectedReplacementSn" class="select-field select-field--highlight">
                <option v-for="(bat, idx) in readyBatteries" :key="bat.sn" :value="bat.sn">
                  Door {{ idx + 1 }} &bull; #{{ bat.sn.slice(-6) }} ({{ bat.soc }}% &bull; {{ bat.v }}V)
                </option>
              </select>

              <div v-if="chosenReplacement" class="soc-pill good">
                <span>Charge:</span>
                <strong>{{ chosenReplacement.soc }}% Full</strong>
              </div>

              <div v-if="chosenReplacement" class="pack-meta-row">
                <span>{{ chosenReplacement.v }}V</span>
                <span>&bull;</span>
                <span>{{ chosenReplacement.temp }}°C</span>
              </div>
            </div>

            <div v-else class="empty-rack-warning">
              <span class="empty-icon">⚠️</span>
              <strong>No charged packs ready</strong>
              <p>Batteries are currently recharging.</p>
            </div>
          </div>
        </div>

        <!-- Transparent Pricing & Account Details -->
        <div class="details-strip">
          <div class="detail-col">
            <span class="detail-label">Attendant</span>
            <strong class="detail-value">{{ operatorName }}</strong>
          </div>
          <div class="detail-col">
            <span class="detail-label">Swap Fee</span>
            <strong class="detail-value detail-value--brand">₦800.00</strong>
          </div>
          <div class="detail-col">
            <span class="detail-label">Billing</span>
            <strong class="detail-value">Rider Wallet</strong>
          </div>
        </div>

        <!-- Error & Success Notification Banners -->
        <div v-if="errorText" class="notification-banner notification-banner--error">
          <span class="banner-icon">⚠️</span>
          <span>{{ errorText }}</span>
        </div>
        
        <div v-if="successText" class="notification-banner notification-banner--success">
          <span class="banner-icon">✅</span>
          <div>
            <strong>{{ successText }}</strong>
            <p>New pack assigned. Depleted pack secured in charging locker.</p>
          </div>
        </div>
      </div>

      <!-- ── Footer Actions ────────────────────────────────────── -->
      <footer class="swap-modal-foot">
        <template v-if="successText">
          <button type="button" class="btn-confirm" @click="$emit('close')">
            ✓ Done &amp; Close
          </button>
        </template>
        <template v-else>
          <button type="button" class="btn-cancel" @click="$emit('close')">
            Cancel
          </button>
          <button
            type="button"
            class="btn-confirm"
            :disabled="!canExecute || isProcessing"
            @click="submitSwap"
          >
            <span v-if="isProcessing">Processing Swap…</span>
            <span v-else>⚡ Confirm Swap &amp; Unlock Locker (₦800.00)</span>
          </button>
        </template>
      </footer>
    </div>
  </div>
</template>

<script>
import { useBatteryFleetStore } from "../stores/battery-fleet-store.js";

export default {
  name: "BatterySwapStationModal",
  props: {
    stations: { type: Array, default: () => [] },
    bikes: { type: Array, default: () => [] },
    initialBikeId: { type: String, default: "" },
    initialStationId: { type: String, default: "" },
    bikeId: { type: String, default: "" },
    stationId: { type: String, default: "" },
    presetReplacementSn: { type: String, default: "" }
  },
  emits: ["close", "execute-swap"],
  setup() {
    const fleetStore = useBatteryFleetStore();
    return { fleetStore };
  },
  data() {
    const defaultStationId = this.stationId || this.initialStationId || (this.stations[0]?.id) || (this.fleetStore?.stations[0]?.id) || "";
    const defaultBikeId = this.bikeId || this.initialBikeId || (this.bikes[0]?.id) || (this.fleetStore?.bikes[0]?.id) || "";
    return {
      selectedStationId: defaultStationId,
      selectedBikeId: defaultBikeId,
      selectedReplacementSn: this.presetReplacementSn || "",
      operatorName: "Chidi O.",
      isProcessing: false,
      errorText: "",
      successText: ""
    };
  },
  computed: {
    effectiveStations() {
      if (Array.isArray(this.stations) && this.stations.length > 0) return this.stations;
      return this.fleetStore?.stations || [];
    },
    effectiveBikes() {
      if (Array.isArray(this.bikes) && this.bikes.length > 0) return this.bikes;
      return this.fleetStore?.bikes || [];
    },
    selectedStation() {
      return this.effectiveStations.find((s) => s.id === this.selectedStationId) || this.effectiveStations[0] || null;
    },
    targetBike() {
      return this.effectiveBikes.find((b) => b.id === this.selectedBikeId) || null;
    },
    readyBatteries() {
      if (!this.selectedStation || !Array.isArray(this.selectedStation.activeBatteries)) return [];
      const ready = this.selectedStation.activeBatteries.filter((b) => b.status === "ready" && b.soc >= 75);
      if (ready.length > 0) return ready;
      return this.selectedStation.activeBatteries.filter((b) => b.soc >= 70);
    },
    chosenReplacement() {
      return this.readyBatteries.find((b) => b.sn === this.selectedReplacementSn) || this.readyBatteries[0] || null;
    },
    canExecute() {
      return Boolean(this.targetBike && this.chosenReplacement && !this.successText);
    }
  },
  watch: {
    readyBatteries: {
      immediate: true,
      handler(val) {
        if (!this.selectedReplacementSn && val && val.length > 0) {
          this.selectedReplacementSn = val[0].sn;
        }
      }
    },
    presetReplacementSn(newSn) {
      if (newSn) {
        this.selectedReplacementSn = newSn;
      }
    }
  },
  methods: {
    getAvailableBatteriesCount(station) {
      if (!station || !Array.isArray(station.activeBatteries)) return 0;
      return station.activeBatteries.filter((b) => b.status === "ready" && b.soc >= 80).length;
    },
    onStationChanged() {
      this.errorText = "";
      this.successText = "";
      if (this.selectedStation && this.selectedStation.operatorName) {
        this.operatorName = this.selectedStation.operatorName;
      }
      if (this.readyBatteries.length > 0) {
        this.selectedReplacementSn = this.readyBatteries[0].sn;
      } else {
        this.selectedReplacementSn = "";
      }
    },
    onBikeChanged() {
      this.errorText = "";
      this.successText = "";
    },
    async submitSwap() {
      if (!this.canExecute) return;
      this.isProcessing = true;
      this.errorText = "";
      this.successText = "";

      try {
        const result = await this.fleetStore.executeSwap({
          bikeId: this.targetBike.id,
          stationId: this.selectedStation.id,
          newBatterySn: this.chosenReplacement.sn,
          operatorName: this.operatorName,
          feeMinor: 80000 // ₦800
        });

        if (result && result.success) {
          this.successText = `Swap confirmed! Locker door has opened. Take Battery #${this.chosenReplacement.sn.slice(-6)} (${this.chosenReplacement.soc}% full).`;
          this.$emit("execute-swap", result.swap);
          setTimeout(() => {
            this.$emit("close");
          }, 2600);
        } else {
          this.errorText = result?.error || "Failed to complete swap. Please check the rider's wallet balance.";
        }
      } catch (err) {
        this.errorText = err?.message || "An unexpected error occurred during battery swap.";
      } finally {
        this.isProcessing = false;
      }
    }
  }
};
</script>

<style scoped>
/* ─────────────────────────────────────────────────────────────
   SWAP MODAL STYLING (BEVERLY WALLET DESIGN TOKENS)
   ───────────────────────────────────────────────────────────── */
.swap-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--scrim, rgba(0, 0, 0, 0.72));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal, 1000);
  padding: 1rem;
  box-sizing: border-box;
}

.swap-modal {
  width: 100%;
  max-width: 680px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--canvas, var(--acob-bg, #0a0e14));
  border: 1px solid var(--border-bright, rgba(255, 255, 255, 0.15));
  border-radius: var(--r-2xl, 20px);
  box-shadow: var(--shadow-4, 0 24px 64px rgba(0, 0, 0, 0.5));
  color: var(--text, #ffffff);
  overflow: hidden;
  font-family: var(--font-sans);
  animation: bsv-modal-enter 0.22s var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
}

@keyframes bsv-modal-enter {
  from { opacity: 0; transform: scale(0.96) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* Modal Header */
.swap-modal-head {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.modal-pill-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.18rem 0.55rem;
  border-radius: 9999px;
  background: rgba(34, 197, 94, 0.12);
  color: var(--brand, #22c55e);
  font-size: 0.68rem;
  font-weight: 700;
  margin-bottom: 0.4rem;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand, #22c55e);
  box-shadow: 0 0 8px var(--brand, #22c55e);
}

.modal-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text, #ffffff);
  letter-spacing: -0.02em;
}

.modal-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: var(--text-dim, #94a3b8);
  line-height: 1.4;
}

.close-btn {
  background: var(--surface-2, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  color: var(--text-dim, #94a3b8);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text, #ffffff);
}

/* Modal Body */
.swap-modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Selection Grid */
.selection-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.input-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text, #ffffff);
}

.field-hint {
  font-size: 0.68rem;
  font-weight: 400;
  color: var(--text-muted, #94a3b8);
}

.select-field {
  width: 100%;
  box-sizing: border-box;
  padding: 0.65rem 0.75rem;
  background: var(--surface, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: var(--r-md, 8px);
  color: var(--text, #ffffff);
  font-size: 0.82rem;
  font-family: var(--font-sans);
  outline: none;
  cursor: pointer;
}

.select-field:focus {
  border-color: var(--brand, #22c55e);
}

.select-field--highlight {
  border-color: rgba(34, 197, 94, 0.4);
  background: rgba(34, 197, 94, 0.04);
}

/* Visual Exchange Comparison */
.swap-exchange-card {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.85rem;
  padding: 1.15rem;
  background: var(--surface, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: var(--r-xl, 14px);
}

.pack-bay {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 1rem;
  border-radius: var(--r-lg, 10px);
  background: var(--surface-2, rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
}

.in-bay {
  border-color: rgba(239, 68, 68, 0.2);
}

.out-bay {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.02);
}

.bay-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bay-step-badge {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.bay-step-badge--green {
  background: rgba(34, 197, 94, 0.15);
  color: var(--brand, #22c55e);
}

.bay-label {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text, #ffffff);
}

.pack-details {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.pack-id-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pack-name {
  font-size: 0.78rem;
  color: var(--text-dim, #94a3b8);
}

.pack-sn {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text, #ffffff);
}

.soc-pill {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.6rem;
  border-radius: var(--r-md, 8px);
  font-size: 0.76rem;
}

.soc-pill.low {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.soc-pill.good {
  background: rgba(34, 197, 94, 0.12);
  color: var(--brand, #22c55e);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.pack-meta-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.68rem;
  color: var(--text-muted, #64748b);
}

.pack-instruction {
  margin: 0.2rem 0 0;
  font-size: 0.68rem;
  color: var(--text-dim, #94a3b8);
  line-height: 1.35;
}

.pack-instruction--green {
  color: var(--brand, #22c55e);
}

.exchange-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.arrow-symbol {
  font-size: 1.4rem;
  color: var(--brand, #22c55e);
}

.arrow-label {
  font-size: 0.65rem;
  color: var(--text-muted, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.select-pack-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-dim, #94a3b8);
}

.empty-rack-warning {
  padding: 1rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  color: #f59e0b;
  font-size: 0.78rem;
}

.empty-rack-warning p {
  margin: 0;
  font-size: 0.7rem;
  color: var(--text-dim, #94a3b8);
}

/* Details Strip */
.details-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: var(--surface-2, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  border-radius: var(--r-lg, 10px);
}

.detail-col {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.detail-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-muted, #64748b);
  text-transform: uppercase;
}

.detail-value {
  font-size: 0.82rem;
  color: var(--text, #ffffff);
}

.detail-value--brand {
  color: var(--brand, #22c55e);
  font-weight: 800;
  font-size: 0.95rem;
}

/* Notification Banners */
.notification-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--r-md, 8px);
  font-size: 0.8rem;
}

.notification-banner--error {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.notification-banner--success {
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: var(--brand, #22c55e);
}

.notification-banner--success p {
  margin: 0.2rem 0 0;
  font-size: 0.72rem;
  color: var(--text-dim, #94a3b8);
}

/* Modal Footer */
.swap-modal-foot {
  padding: 1.15rem 1.5rem;
  border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-cancel {
  padding: 0.6rem 1.25rem;
  border-radius: var(--r-md, 8px);
  background: transparent;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  color: var(--text-dim, #94a3b8);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  min-height: 42px;
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text, #ffffff);
}

.btn-confirm {
  padding: 0.65rem 1.4rem;
  border-radius: var(--r-md, 8px);
  background: var(--brand, #22c55e);
  color: #041208;
  font-size: 0.84rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  min-height: 42px;
  box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3);
  transition: all 0.15s ease;
}

.btn-confirm:hover:not(:disabled) {
  background: #16a34a;
  transform: translateY(-1px);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

/* Responsive Breakpoints */
@media (max-width: 640px) {
  .swap-modal-backdrop {
    padding: 0;
    align-items: flex-end;
  }
  .swap-modal {
    max-height: 92vh;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  .selection-grid {
    grid-template-columns: 1fr;
  }
  .swap-exchange-card {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  .exchange-arrow {
    transform: rotate(90deg);
    padding: 0.25rem 0;
  }
  .details-strip {
    grid-template-columns: 1fr;
  }
  .swap-modal-foot {
    flex-direction: column-reverse;
  }
  .swap-modal-foot button {
    width: 100%;
  }
}
</style>
