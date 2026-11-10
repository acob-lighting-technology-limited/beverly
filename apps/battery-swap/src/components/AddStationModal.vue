<template>
  <div class="asm-backdrop" @click.self="$emit('close')">
    <div class="asm-modal" role="dialog" aria-modal="true" aria-labelledby="asm-title">
      <header class="asm-header">
        <div>
          <div class="asm-badge">SITE MANAGEMENT</div>
          <h2 id="asm-title" class="asm-title">Create Swap Station Hub</h2>
          <p class="asm-subtitle">Register new Beverly swap depot, configure locker cabinet &amp; assign operator.</p>
        </div>
        <button class="asm-close" @click="$emit('close')">✕</button>
      </header>

      <form class="asm-body" @submit.prevent="handleSubmit">
        <div class="asm-grid asm-grid--2">
          <div class="asm-field">
            <label for="asm-name">Site / Hub Name <span class="req">*</span></label>
            <input
              id="asm-name"
              v-model.trim="form.name"
              type="text"
              placeholder="e.g. Station 6 - Lekki Expressway Hub"
              required
              class="asm-input"
            />
          </div>
          <div class="asm-field">
            <label for="asm-city">City / State <span class="req">*</span></label>
            <select id="asm-city" v-model="form.city" class="asm-select">
              <option value="Lagos">Lagos State</option>
              <option value="Abuja">Abuja FCT</option>
              <option value="Ibadan">Ibadan, Oyo State</option>
              <option value="Akure">Akure, Ondo State</option>
            </select>
          </div>
        </div>

        <div class="asm-field">
          <label for="asm-addr">Detailed Address <span class="req">*</span></label>
          <input
            id="asm-addr"
            v-model.trim="form.address"
            type="text"
            placeholder="Plot / Street address, landmark"
            required
            class="asm-input"
          />
        </div>

        <div class="asm-grid asm-grid--3">
          <div class="asm-field">
            <label for="asm-slots">Locker Bays / Doors</label>
            <input
              id="asm-slots"
              v-model.number="form.totalSlots"
              type="number"
              min="4"
              max="24"
              class="asm-input font-mono"
            />
          </div>
          <div class="asm-field">
            <label for="asm-lat">Latitude</label>
            <input
              id="asm-lat"
              v-model.number="form.lat"
              type="number"
              step="0.0001"
              class="asm-input font-mono"
            />
          </div>
          <div class="asm-field">
            <label for="asm-lng">Longitude</label>
            <input
              id="asm-lng"
              v-model.number="form.lng"
              type="number"
              step="0.0001"
              class="asm-input font-mono"
            />
          </div>
        </div>

        <div class="asm-grid asm-grid--2">
          <div class="asm-field">
            <label for="asm-op-name">Hub Lead Operator Name</label>
            <input
              id="asm-op-name"
              v-model.trim="form.operatorName"
              type="text"
              placeholder="e.g. Chidi Okonkwo"
              class="asm-input"
            />
          </div>
          <div class="asm-field">
            <label for="asm-op-phone">Operator Phone Number</label>
            <input
              id="asm-op-phone"
              v-model.trim="form.operatorPhone"
              type="tel"
              placeholder="e.g. +234 803 111 2233"
              class="asm-input font-mono"
            />
          </div>
        </div>

        <div v-if="errorMsg" class="asm-error">{{ errorMsg }}</div>

        <footer class="asm-footer">
          <button type="button" class="asm-btn asm-btn--ghost" @click="$emit('close')">Cancel</button>
          <button type="submit" class="asm-btn asm-btn--primary" :disabled="submitting">
            {{ submitting ? 'Deploying...' : '⚡ Deploy Swap Station' }}
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>

<script>
import { useBatteryFleetStore } from "../stores/battery-fleet-store.js";

export default {
  name: "AddStationModal",
  emits: ["close", "created"],
  data() {
    return {
      submitting: false,
      errorMsg: "",
      form: {
        name: "",
        address: "",
        city: "Lagos",
        lat: 6.4474,
        lng: 3.4844,
        totalSlots: 12,
        operatorName: "",
        operatorPhone: "+234 "
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
      if (!this.form.name || !this.form.address) {
        this.errorMsg = "Station name and detailed address are required.";
        return;
      }
      this.submitting = true;
      try {
        const newStation = this.fleetStore.addStation(this.form);
        this.$emit("created", newStation);
        this.$emit("close");
      } catch (err) {
        this.errorMsg = err.message || "Failed to create station.";
      } finally {
        this.submitting = false;
      }
    }
  }
};
</script>

<style scoped>
.asm-backdrop {
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
.asm-modal {
  width: 100%;
  max-width: 600px;
  background: var(--acob-card-bg, #0b1810);
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: var(--acob-radius-lg, 12px);
  color: var(--acob-text, #f2f7f3);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.asm-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
}
.asm-badge {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--acob-brand-mint, #7dfc9a);
  text-transform: uppercase;
}
.asm-title {
  margin: 4px 0 2px;
  font-size: 1.2rem;
  font-weight: 800;
}
.asm-subtitle {
  margin: 0;
  font-size: 0.8rem;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
}
.asm-close {
  background: transparent;
  border: none;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
  font-size: 1.1rem;
  cursor: pointer;
}
.asm-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.asm-grid--2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.asm-grid--3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.asm-field { display: flex; flex-direction: column; gap: 6px; }
.asm-field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--acob-muted, rgba(242, 247, 243, 0.75));
}
.req { color: #ef4444; }
.asm-input, .asm-select {
  padding: 9px 12px;
  background: var(--acob-chip, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: var(--acob-radius-md, 8px);
  color: #fff;
  font-size: 0.85rem;
  outline: none;
}
.asm-select option { background: #0b1810; color: #fff; }
.asm-input:focus, .asm-select:focus { border-color: var(--acob-brand-mint, #7dfc9a); }
.asm-error {
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 6px;
  color: #ef4444;
  font-size: 0.8rem;
}
.asm-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
}
.asm-btn {
  padding: 8px 16px;
  border-radius: var(--acob-radius-md, 8px);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.asm-btn--ghost {
  background: transparent;
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  color: var(--acob-muted, rgba(242, 247, 243, 0.7));
}
.asm-btn--primary {
  background: var(--acob-brand, #008000);
  border: 1px solid var(--acob-brand-mint, #7dfc9a);
  color: #fff;
}
.asm-btn--primary:hover:not(:disabled) {
  background: #009900;
  box-shadow: 0 0 12px rgba(125, 252, 154, 0.35);
}
@media (max-width: 580px) {
  .asm-grid--2, .asm-grid--3 { grid-template-columns: 1fr; }
}
</style>
