<template>
  <div class="bim-backdrop" @click.self="$emit('close')">
    <div class="bim-modal" role="dialog" aria-modal="true" aria-labelledby="bim-title">
      <header class="bim-header">
        <div>
          <div class="bim-badge">BULK INTAKE</div>
          <h2 id="bim-title" class="bim-title">Batch Import Merchant Batteries</h2>
          <p class="bim-subtitle">Paste list of battery serial numbers or import spreadsheet data.</p>
        </div>
        <button class="bim-close" @click="$emit('close')">✕</button>
      </header>

      <div class="bim-body">
        <div class="bim-field">
          <label for="bim-textarea">
            Paste Battery SNs &amp; Part Numbers (One per line: SN, PartNo, IMSI)
          </label>
          <textarea
            id="bim-textarea"
            v-model="bulkText"
            rows="6"
            placeholder="B100072509010050, BT104802512EST0250911050, 460240085271250&#10;B100072509010051, BT104802512EST0250911051, 460240085271251"
            class="bim-textarea font-mono"
          ></textarea>
        </div>

        <div class="bim-field">
          <label for="bim-target-station">Assign Imported Batteries To Station (Optional)</label>
          <select id="bim-target-station" v-model="targetStationId" class="bim-select">
            <option :value="null">-- Reserve Inventory / Unassigned --</option>
            <option v-for="st in fleetStore.stations" :key="st.id" :value="st.id">
              {{ st.name }} ({{ st.city }})
            </option>
          </select>
        </div>

        <div v-if="parsedCount > 0" class="bim-preview-box">
          <span class="preview-text">Ready to register: <strong>{{ parsedCount }} valid battery packs</strong></span>
        </div>

        <div v-if="feedbackMsg" class="bim-feedback" :class="feedbackSuccess ? 'success' : 'error'">
          {{ feedbackMsg }}
        </div>

        <footer class="bim-footer">
          <button type="button" class="bim-btn bim-btn--ghost" @click="$emit('close')">Cancel</button>
          <button
            type="button"
            class="bim-btn bim-btn--primary"
            :disabled="parsedCount === 0 || importing"
            @click="handleImport"
          >
            {{ importing ? 'Importing...' : '⚡ Import ' + parsedCount + ' Batteries' }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script>
import { useBatteryFleetStore } from "../../stores/battery-fleet-store.js";

export default {
  name: "BatchImportBatteriesModal",
  emits: ["close", "imported"],
  data() {
    return {
      bulkText: "",
      targetStationId: null,
      importing: false,
      feedbackMsg: "",
      feedbackSuccess: true
    };
  },
  computed: {
    fleetStore() {
      return useBatteryFleetStore();
    },
    parsedItems() {
      const lines = (this.bulkText || "").split("\n").map((l) => l.trim()).filter(Boolean);
      const items = [];
      for (const line of lines) {
        const parts = line.split(/[,\t]+/).map((p) => p.trim());
        if (parts[0]) {
          const sn = parts[0];
          const batteryNumber = parts[1] || `BT104802512EST025091${Math.floor(1000 + Math.random() * 9000)}`;
          const imsi = parts[2] || `460240085${Math.floor(100000 + Math.random() * 900000)}`;
          items.push({
            sn,
            batteryNumber,
            imsi,
            assignedStationId: this.targetStationId
          });
        }
      }
      return items;
    },
    parsedCount() {
      return this.parsedItems.length;
    }
  },
  methods: {
    handleImport() {
      if (!this.parsedItems.length) return;
      this.importing = true;
      try {
        const count = this.fleetStore.batchImportBatteries(this.parsedItems);
        this.feedbackMsg = `Successfully imported ${count} battery packs.`;
        this.feedbackSuccess = true;
        this.$emit("imported", count);
        setTimeout(() => {
          this.$emit("close");
        }, 1200);
      } catch (err) {
        this.feedbackMsg = err.message || "Failed to import batteries.";
        this.feedbackSuccess = false;
      } finally {
        this.importing = false;
      }
    }
  }
};
</script>

<style scoped>
.bim-backdrop {
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
.bim-modal {
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
.bim-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
}
.bim-badge {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #38bdf8;
  text-transform: uppercase;
}
.bim-title {
  margin: 4px 0 2px;
  font-size: 1.2rem;
  font-weight: 800;
}
.bim-subtitle {
  margin: 0;
  font-size: 0.8rem;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
}
.bim-close {
  background: transparent;
  border: none;
  color: var(--acob-muted, rgba(242, 247, 243, 0.65));
  font-size: 1.1rem;
  cursor: pointer;
}
.bim-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.bim-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bim-field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--acob-muted, rgba(242, 247, 243, 0.75));
}
.bim-textarea,
.bim-select {
  padding: 9px 12px;
  background: var(--acob-chip, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  border-radius: var(--acob-radius-md, 8px);
  color: #fff;
  font-size: 0.82rem;
  outline: none;
}
.bim-select option {
  background: #0b1810;
  color: #fff;
}
.bim-textarea:focus,
.bim-select:focus {
  border-color: #38bdf8;
}
.bim-preview-box {
  padding: 10px 14px;
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 6px;
  font-size: 0.82rem;
  color: #38bdf8;
}
.bim-feedback {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
}
.bim-feedback.success {
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.35);
  color: var(--acob-brand-mint, #7dfc9a);
}
.bim-feedback.error {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #ef4444;
}
.bim-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--acob-line, rgba(255, 255, 255, 0.08));
}
.bim-btn {
  padding: 8px 16px;
  border-radius: var(--acob-radius-md, 8px);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.bim-btn--ghost {
  background: transparent;
  border: 1px solid var(--acob-line, rgba(255, 255, 255, 0.12));
  color: var(--acob-muted, rgba(242, 247, 243, 0.7));
}
.bim-btn--primary {
  background: #0284c7;
  border: 1px solid #38bdf8;
  color: #fff;
}
.bim-btn--primary:hover:not(:disabled) {
  background: #0369a1;
}
.bim-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
