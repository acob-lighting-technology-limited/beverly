<template>
  <div class="abm-backdrop" @click.self="$emit('close')">
    <div class="abm-modal" role="dialog" aria-modal="true" aria-labelledby="abm-title">
      <header class="abm-header">
        <div>
          <div class="abm-badge">MERCHANT INVENTORY</div>
          <h2 id="abm-title" class="abm-title">Add Merchant Battery</h2>
          <p class="abm-subtitle">Register new Yunhe swappable lithium battery pack into fleet operations.</p>
        </div>
        <button class="abm-close" @click="$emit('close')">✕</button>
      </header>

      <form class="abm-body" @submit.prevent="handleSubmit">
        <div class="abm-grid abm-grid--2">
          <div class="abm-field">
            <label for="abm-number">Battery Part Number <span class="req">*</span></label>
            <input
              id="abm-number"
              v-model.trim="form.batteryNumber"
              type="text"
              placeholder="e.g. BT104802512EST0250911001"
              required
              class="abm-input font-mono"
            />
          </div>
          <div class="abm-field">
            <label for="abm-sn">Battery Serial Number (SN) <span class="req">*</span></label>
            <input
              id="abm-sn"
              v-model.trim="form.sn"
              type="text"
              placeholder="e.g. B100072509010001"
              required
              class="abm-input font-mono"
            />
          </div>
        </div>

        <div class="abm-grid abm-grid--2">
          <div class="abm-field">
            <label for="abm-imsi">SIM Card IMSI <span class="req">*</span></label>
            <input
              id="abm-imsi"
              v-model.trim="form.imsi"
              type="text"
              placeholder="e.g. 460240085271115"
              required
              class="abm-input font-mono"
            />
          </div>
          <div class="abm-field">
            <label for="abm-capacity">Rated Capacity (AH)</label>
            <input
              id="abm-capacity"
              v-model.number="form.capacityAh"
              type="number"
              step="0.01"
              class="abm-input font-mono"
            />
          </div>
        </div>

        <div class="abm-grid abm-grid--2">
          <div class="abm-field">
            <label for="abm-cells">Series Cell Configuration</label>
            <select id="abm-cells" v-model.number="form.cellCount" class="abm-select">
              <option :value="15">15S Series (48V / 54V Nominal)</option>
              <option :value="23">23S Series (72V / 76.8V High Capacity)</option>
            </select>
          </div>
          <div class="abm-field">
            <label for="abm-station">Initial Assignment</label>
            <select id="abm-station" v-model="form.assignedStationId" class="abm-select">
              <option :value="null">-- Reserve Inventory / Unassigned --</option>
              <option v-for="st in fleetStore.stations" :key="st.id" :value="st.id">
                {{ st.name }} ({{ st.city }})
              </option>
            </select>
          </div>
        </div>

        <div v-if="errorMsg" class="abm-error">{{ errorMsg }}</div>

        <footer class="abm-footer">
          <button type="button" class="abm-btn abm-btn--ghost" @click="$emit('close')">Cancel</button>
          <button type="submit" class="abm-btn abm-btn--primary" :disabled="submitting">
            {{ submitting ? 'Adding...' : '⚡ Add Battery to Fleet' }}
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>

<script>
import { useBatteryFleetStore } from "../stores/battery-fleet-store.js";

export default {
  name: "AddBatteryModal",
  emits: ["close", "added"],
  data() {
    return {
      submitting: false,
      errorMsg: "",
      form: {
        batteryNumber: "",
        sn: "",
        imsi: "",
        capacityAh: 20.93,
        cellCount: 15,
        assignedStationId: null
      }
    };
  },
  computed: {
    fleetStore() {
      return useBatteryFleetStore();
    }
  },
  methods: {
    handleSubmit() {
      this.errorMsg = "";
      if (!this.form.batteryNumber || !this.form.sn || !this.form.imsi) {
        this.errorMsg = "Please fill in all required battery identification fields.";
        return;
      }
      this.submitting = true;
      try {
        const newBat = this.fleetStore.addBattery(this.form);
        this.$emit("added", newBat);
        this.$emit("close");
      } catch (err) {
        this.errorMsg = err.message || "Failed to add battery.";
      } finally {
        this.submitting = false;
      }
    }
  }
};
</script>

<style scoped>
.abm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.abm-modal {
  width: 100%;
  max-width: 580px;
  background: var(--acob-card-bg, #0b1810);
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: var(--acob-radius-lg, 12px);
  color: var(--acob-text, #f2f7f3);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.abm-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
}
.abm-badge {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--acob-brand-mint, #7dfc9a);
  text-transform: uppercase;
}
.abm-title {
  margin: 4px 0 2px;
  font-size: 1.2rem;
  font-weight: 800;
}
.abm-subtitle {
  margin: 0;
  font-size: 0.8rem;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
}
.abm-close {
  background: transparent;
  border: none;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
  font-size: 1.1rem;
  cursor: pointer;
}
.abm-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.abm-grid--2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.abm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.abm-field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--acob-muted, rgba(242, 247, 243, 0.75));
}
.req { color: #ef4444; }
.abm-input,
.abm-select {
  padding: 9px 12px;
  background: var(--acob-chip, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: var(--acob-radius-md, 8px);
  color: #fff;
  font-size: 0.85rem;
  outline: none;
}
.abm-select option {
  background: #0b1810;
  color: #fff;
}
.abm-input:focus,
.abm-select:focus {
  border-color: var(--acob-brand-mint, #7dfc9a);
}
.abm-error {
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 6px;
  color: #ef4444;
  font-size: 0.8rem;
}
.abm-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
}
.abm-btn {
  padding: 8px 16px;
  border-radius: var(--acob-radius-md, 8px);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.abm-btn--ghost {
  background: transparent;
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  color: var(--acob-muted, rgba(242, 247, 243, 0.7));
}
.abm-btn--primary {
  background: var(--acob-brand, #008000);
  border: 1px solid var(--acob-brand-mint, #7dfc9a);
  color: #fff;
}
.abm-btn--primary:hover:not(:disabled) {
  background: #009900;
  box-shadow: 0 0 12px rgba(125, 252, 154, 0.35);
}
@media (max-width: 580px) {
  .abm-grid--2 { grid-template-columns: 1fr; }
}
</style>
