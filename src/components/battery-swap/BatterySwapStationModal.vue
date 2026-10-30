<template>
  <div class="swap-modal-backdrop" @click.self="$emit('close')">
    <div class="swap-modal" role="dialog" aria-modal="true" aria-label="Execute Battery Swap">
      <header class="swap-modal-head">
        <div>
          <h2>Record Battery Swap</h2>
          <p class="sub-head">Take rider's depleted battery and dispense a fully charged pack</p>
        </div>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </header>

      <div class="swap-modal-body">
        <!-- Station & Bike Selection -->
        <div class="selection-grid">
          <div class="input-block">
            <label>Swap Station</label>
            <select v-model="selectedStationId" @change="onStationChanged">
              <option v-for="s in stations" :key="s.id" :value="s.id">
                {{ s.name }} ({{ getAvailableBatteriesCount(s) }} ready)
              </option>
            </select>
          </div>

          <div class="input-block">
            <label>Incoming EV Bike</label>
            <select v-model="selectedBikeId" @change="onBikeChanged">
              <option v-for="b in bikes" :key="b.id" :value="b.id">
                {{ b.id }} - {{ b.riderName }} ({{ b.telemetry.soc }}% SOC)
              </option>
            </select>
          </div>
        </div>

        <!-- Swap Comparison Card -->
        <div class="swap-exchange-card">
          <!-- Depleted In -->
          <div class="pack-bay in-bay">
            <span class="bay-label">Incoming Depleted Battery</span>
            <div class="pack-details" v-if="targetBike">
              <span class="pack-sn">{{ targetBike.batterySn }}</span>
              <div class="soc-pill low">
                <span>Charge Level:</span>
                <strong>{{ targetBike.telemetry.soc }}%</strong>
              </div>
              <span class="pack-volt">Voltage: {{ targetBike.telemetry.voltage }}V</span>
              <span class="pack-sub">Will be placed into charging slot</span>
            </div>
          </div>

          <div class="exchange-arrow">
            <span>⇄</span>
          </div>

          <!-- Fresh Out -->
          <div class="pack-bay out-bay">
            <span class="bay-label">Dispense Charged Battery</span>
            <div class="pack-details" v-if="selectedStation">
              <label class="select-label">Select from rack:</label>
              <select v-model="selectedReplacementSn" class="battery-select">
                <option v-for="bat in readyBatteries" :key="bat.sn" :value="bat.sn">
                  {{ bat.sn }} ({{ bat.soc }}% • {{ bat.v }}V)
                </option>
              </select>
              <div v-if="chosenReplacement" class="soc-pill good">
                <span>Ready to Mount:</span>
                <strong>{{ chosenReplacement.soc }}%</strong>
              </div>
            </div>
            <div v-else class="empty-rack">
              No charged packs currently available at this station.
            </div>
          </div>
        </div>

        <!-- Transaction Details -->
        <div class="details-strip">
          <div class="detail-col">
            <span class="muted">Operator</span>
            <strong>{{ operatorName }}</strong>
          </div>
          <div class="detail-col">
            <span class="muted">Standard Swap Fee</span>
            <strong>₦800.00</strong>
          </div>
          <div class="detail-col">
            <span class="muted">Payment Account</span>
            <strong>Rider Beverly Wallet</strong>
          </div>
        </div>

        <div v-if="errorText" class="error-banner">
          {{ errorText }}
        </div>
        <div v-if="successText" class="success-banner">
          {{ successText }}
        </div>
      </div>

      <footer class="swap-modal-foot">
        <button type="button" class="btn-cancel" @click="$emit('close')">Cancel</button>
        <button
          type="button"
          class="btn-confirm"
          :disabled="!canExecute || isProcessing"
          @click="submitSwap"
        >
          {{ isProcessing ? "Executing Swap..." : "Confirm & Hand Over Battery" }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script>
export default {
  name: "BatterySwapStationModal",
  props: {
    stations: {
      type: Array,
      required: true
    },
    bikes: {
      type: Array,
      required: true
    },
    initialBikeId: {
      type: String,
      default: ""
    },
    initialStationId: {
      type: String,
      default: ""
    }
  },
  emits: ["close", "execute-swap"],
  data() {
    return {
      selectedStationId: this.initialStationId || this.stations[0]?.id || "",
      selectedBikeId: this.initialBikeId || this.bikes[0]?.id || "",
      selectedReplacementSn: "",
      operatorName: "Chidi O.",
      isProcessing: false,
      errorText: "",
      successText: ""
    };
  },
  computed: {
    selectedStation() {
      return this.stations.find((s) => s.id === this.selectedStationId) || this.stations[0];
    },
    targetBike() {
      return this.bikes.find((b) => b.id === this.selectedBikeId) || null;
    },
    readyBatteries() {
      if (!this.selectedStation || !Array.isArray(this.selectedStation.activeBatteries)) return [];
      return this.selectedStation.activeBatteries.filter((b) => b.status === "ready" && b.soc >= 80);
    },
    chosenReplacement() {
      return this.readyBatteries.find((b) => b.sn === this.selectedReplacementSn) || null;
    },
    canExecute() {
      return Boolean(this.targetBike && this.selectedStation && this.selectedReplacementSn);
    }
  },
  mounted() {
    this.updateReplacementDefault();
  },
  methods: {
    getAvailableBatteriesCount(station) {
      if (!station || !Array.isArray(station.activeBatteries)) return 0;
      return station.activeBatteries.filter((b) => b.status === "ready" && b.soc >= 80).length;
    },
    onStationChanged() {
      this.updateReplacementDefault();
    },
    onBikeChanged() {
      this.errorText = "";
    },
    updateReplacementDefault() {
      if (this.readyBatteries.length > 0) {
        this.selectedReplacementSn = this.readyBatteries[0].sn;
      } else {
        this.selectedReplacementSn = "";
      }
    },
    async submitSwap() {
      if (!this.canExecute) return;
      this.isProcessing = true;
      this.errorText = "";
      this.successText = "";

      try {
        this.$emit("execute-swap", {
          bikeId: this.targetBike.id,
          stationId: this.selectedStation.id,
          batteryOutSn: this.selectedReplacementSn,
          operatorName: this.operatorName
        });

        this.successText = `Swap complete! Fresh battery ${this.selectedReplacementSn} assigned to ${this.targetBike.id}.`;
        setTimeout(() => {
          this.$emit("close");
        }, 1200);
      } catch (err) {
        this.errorText = err.message || "Could not complete swap.";
      } finally {
        this.isProcessing = false;
      }
    }
  }
};
</script>

<style scoped>
.swap-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(3, 9, 10, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1250;
  padding: 16px;
  backdrop-filter: blur(4px);
}

.swap-modal {
  background: var(--acob-panel);
  border: 1px solid var(--acob-line);
  border-radius: 16px;
  width: 680px;
  max-width: 100%;
  box-shadow: var(--bev-shadow-xl, 0 20px 40px rgba(0, 0, 0, 0.25));
  display: flex;
  flex-direction: column;
}

.swap-modal-head {
  padding: 20px 24px;
  border-bottom: 1px solid var(--acob-line);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.swap-modal-head h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--acob-text);
}

.sub-head {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--acob-muted);
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--acob-muted);
  cursor: pointer;
}

.swap-modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.selection-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.input-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-block label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--acob-muted);
}

.input-block select {
  height: 38px;
  border-radius: 8px;
  border: 1px solid var(--acob-line);
  background: var(--acob-bg);
  color: var(--acob-text);
  padding: 0 10px;
  font-size: 13px;
}

.input-block select option {
  background: var(--acob-panel);
}

.swap-exchange-card {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  background: var(--acob-bg);
  border: 1px solid var(--acob-line);
  border-radius: 12px;
  padding: 18px;
}

.pack-bay {
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bay-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--acob-muted);
}

.pack-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pack-sn {
  font-family: var(--acob-font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--acob-text);
}

.soc-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
}

.soc-pill.low {
  background: rgba(239, 68, 68, 0.10);
  color: var(--color-danger);
}

.soc-pill.good {
  background: rgba(0, 128, 0, 0.10);
  color: var(--acob-brand);
}

.pack-volt {
  font-size: 12px;
  color: var(--acob-muted);
}

.pack-sub {
  font-size: 11px;
  color: var(--acob-muted);
}

.select-label {
  font-size: 11px;
  color: var(--acob-muted);
}

.battery-select {
  height: 34px;
  border-radius: 6px;
  border: 1px solid var(--acob-line);
  background: var(--acob-bg);
  color: var(--acob-text);
  font-size: 12px;
  padding: 0 8px;
}

.exchange-arrow {
  font-size: 24px;
  color: var(--acob-brand);
  display: flex;
  align-items: center;
  justify-content: center;
}

.details-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 12px 16px;
  background: var(--acob-chip);
  border-radius: 8px;
  border: 1px solid var(--acob-line);
}

.detail-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-col .muted {
  font-size: 11px;
  color: var(--acob-muted);
}

.detail-col strong {
  font-size: 13px;
  color: var(--acob-text);
}

.error-banner {
  background: rgba(239, 68, 68, 0.10);
  color: var(--color-danger);
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
}

.success-banner {
  background: rgba(0, 128, 0, 0.10);
  color: var(--acob-brand);
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
}

.swap-modal-foot {
  padding: 16px 24px;
  border-top: 1px solid var(--acob-line);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-cancel {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--acob-line);
  background: var(--acob-chip);
  color: var(--acob-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-confirm {
  padding: 8px 18px;
  border-radius: 6px;
  border: none;
  background: var(--acob-brand);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .selection-grid,
  .swap-exchange-card {
    grid-template-columns: 1fr;
  }
  .exchange-arrow {
    transform: rotate(90deg);
  }
}
</style>
