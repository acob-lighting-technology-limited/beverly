<template>
  <div class="bdm-backdrop" @click.self="$emit('close')">
    <div class="bdm-modal" role="dialog" aria-modal="true" aria-labelledby="bdm-title">
      <header class="bdm-header">
        <div>
          <div class="bdm-badge">LOCKER CABINET REPLENISHMENT</div>
          <h2 id="bdm-title" class="bdm-title">Batch Battery Distribution</h2>
          <p class="bdm-subtitle">Transfer available fully-charged batteries to swap station locker bays.</p>
        </div>
        <button class="bdm-close" @click="$emit('close')">✕</button>
      </header>

      <div class="bdm-body">
        <div class="bdm-field">
          <label for="bdm-station">Target Swap Station / Depot <span class="req">*</span></label>
          <select id="bdm-station" v-model="selectedStationId" class="bdm-select">
            <option v-for="st in fleetStore.stations" :key="st.id" :value="st.id">
              {{ st.name }} &bull; {{ st.city }} ({{ st.activeBatteries.length }}/{{ st.totalSlots }} bays filled)
            </option>
          </select>
        </div>

        <div class="bdm-field">
          <label>Select Charged Batteries to Allocate ({{ selectedSns.length }} selected)</label>
          <div class="bdm-battery-picker">
            <label
              v-for="bat in candidateBatteries"
              :key="bat.sn"
              class="bdm-battery-chip"
              :class="{ selected: selectedSns.includes(bat.sn) }"
            >
              <input
                type="checkbox"
                :value="bat.sn"
                v-model="selectedSns"
                class="sr-only"
              />
              <div class="bat-row">
                <span class="bat-sn font-mono">{{ bat.sn }}</span>
                <span class="bat-soc text-mint">{{ bat.soc }}%</span>
              </div>
              <div class="bat-sub">
                <span>{{ bat.voltage }}V</span> &bull; <span>{{ bat.capacityAh }}AH</span> &bull; <span>{{ bat.assignedStationName || 'Reserve' }}</span>
              </div>
            </label>
          </div>
        </div>

        <div v-if="feedback" class="bdm-feedback">{{ feedback }}</div>

        <footer class="bdm-footer">
          <button type="button" class="bdm-btn bdm-btn--ghost" @click="$emit('close')">Cancel</button>
          <button
            type="button"
            class="bdm-btn bdm-btn--primary"
            :disabled="!selectedStationId || selectedSns.length === 0 || distributing"
            @click="handleDistribute"
          >
            {{ distributing ? 'Distributing...' : '⚡ Distribute ' + selectedSns.length + ' Batteries' }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script>
import { useBatteryFleetStore } from "../stores/battery-fleet-store.js";

export default {
  name: "BatchDistributeModal",
  emits: ["close", "distributed"],
  data() {
    return {
      selectedStationId: "",
      selectedSns: [],
      distributing: false,
      feedback: ""
    };
  },
  computed: {
    fleetStore() {
      return useBatteryFleetStore();
    },
    candidateBatteries() {
      if (!this.fleetStore.batteries) return [];
      // Pick batteries that have high charge or are unassigned/reserve
      return this.fleetStore.batteries.filter((b) => b.soc >= 60).slice(0, 40);
    }
  },
  mounted() {
    if (this.fleetStore.stations && this.fleetStore.stations.length) {
      this.selectedStationId = this.fleetStore.stations[0].id;
    }
  },
  methods: {
    handleDistribute() {
      if (!this.selectedStationId || !this.selectedSns.length) return;
      this.distributing = true;
      try {
        const count = this.fleetStore.distributeBatteries({
          stationId: this.selectedStationId,
          batterySns: this.selectedSns
        });
        this.feedback = `Successfully allocated ${count} batteries to station lockers.`;
        this.$emit("distributed", count);
        setTimeout(() => {
          this.$emit("close");
        }, 1200);
      } catch (err) {
        this.feedback = "Error: " + err.message;
      } finally {
        this.distributing = false;
      }
    }
  }
};
</script>

<style scoped>
.bdm-backdrop {
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
.bdm-modal {
  width: 100%;
  max-width: 640px;
  background: var(--acob-card-bg, #0b1810);
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: var(--acob-radius-lg, 12px);
  color: var(--acob-text, #f2f7f3);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.bdm-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
}
.bdm-badge {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--acob-brand-mint, #7dfc9a);
  text-transform: uppercase;
}
.bdm-title {
  margin: 4px 0 2px;
  font-size: 1.2rem;
  font-weight: 800;
}
.bdm-subtitle {
  margin: 0;
  font-size: 0.8rem;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
}
.bdm-close {
  background: transparent;
  border: none;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
  font-size: 1.1rem;
  cursor: pointer;
}
.bdm-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.bdm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bdm-field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--acob-muted, rgba(242, 247, 243, 0.75));
}
.req { color: #ef4444; }
.bdm-select {
  padding: 9px 12px;
  background: var(--acob-chip, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: var(--acob-radius-md, 8px);
  color: #fff;
  font-size: 0.85rem;
  outline: none;
}
.bdm-select option { background: #0b1810; color: #fff; }
.bdm-battery-picker {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
}
.bdm-battery-chip {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.15s;
}
.bdm-battery-chip:hover {
  border-color: rgba(125, 252, 154, 0.3);
}
.bdm-battery-chip.selected {
  border-color: var(--acob-brand-mint, #7dfc9a);
  background: rgba(125, 252, 154, 0.12);
}
.bat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.bat-sn {
  font-size: 11px;
  font-weight: 700;
}
.bat-soc {
  font-size: 11.5px;
  font-weight: 800;
}
.bat-sub {
  font-size: 10px;
  color: var(--acob-muted, rgba(242, 247, 243, 0.6));
  margin-top: 2px;
}
.text-mint { color: var(--acob-brand-mint, #7dfc9a); }
.sr-only { position: absolute; opacity: 0; pointer-events: none; }
.bdm-feedback {
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.35);
  color: var(--acob-brand-mint, #7dfc9a);
  font-size: 0.8rem;
}
.bdm-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
}
.bdm-btn {
  padding: 8px 16px;
  border-radius: var(--acob-radius-md, 8px);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.bdm-btn--ghost {
  background: transparent;
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  color: var(--acob-muted, rgba(242, 247, 243, 0.7));
}
.bdm-btn--primary {
  background: var(--acob-brand, #008000);
  border: 1px solid var(--acob-brand-mint, #7dfc9a);
  color: #fff;
}
.bdm-btn--primary:hover:not(:disabled) {
  background: #009900;
  box-shadow: 0 0 12px rgba(125, 252, 154, 0.35);
}
.bdm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
@media (max-width: 580px) {
  .bdm-battery-picker { grid-template-columns: 1fr; }
}
</style>
