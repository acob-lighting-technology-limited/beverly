<template>
  <div class="bsv-cabinet-view">
    <div class="bsv-cabinet-header">
      <span class="bsv-cab-title">Charging Cabinet Lockers ({{ station.totalSlots || 8 }} Bays)</span>
      <span class="bsv-cab-hint">Tap any ready green door to swap that pack</span>
    </div>

    <div class="bsv-locker-grid">
      <div
        v-for="slot in computedSlots"
        :key="slot.doorNumber"
        class="bsv-locker-door"
        :class="{
          'bsv-locker-door--ready': slot.status === 'ready',
          'bsv-locker-door--charging': slot.status === 'charging',
          'bsv-locker-door--empty': slot.status === 'empty'
        }"
        @click="handleLockerClick(slot)"
      >
        <div class="bsv-door-top">
          <span class="bsv-door-num">Door {{ slot.doorNumber }}</span>
          <span class="bsv-door-indicator" />
        </div>

        <div v-if="slot.status === 'ready' && slot.battery" class="bsv-door-content">
          <span class="bsv-charge-big">{{ slot.battery.soc }}%</span>
          <span class="bsv-door-status-lbl">Ready to Take</span>
          <span class="bsv-door-volt">{{ slot.battery.v }}V &bull; {{ slot.battery.temp }}°C</span>
          <button class="bsv-door-take-btn" @click.stop="handleSelect(slot.battery.sn)">
            Select Pack
          </button>
        </div>

        <div v-else-if="slot.status === 'charging' && slot.battery" class="bsv-door-content">
          <span class="bsv-charge-big bsv-charge-big--amber">{{ slot.battery.soc }}%</span>
          <span class="bsv-door-status-lbl">Charging Up</span>
          <span class="bsv-door-est">~{{ Math.max(10, Math.round((100 - slot.battery.soc) * 0.8)) }}m left</span>
        </div>

        <div v-else class="bsv-door-content bsv-door-content--empty">
          <span class="bsv-empty-icon">📥</span>
          <span class="bsv-door-status-lbl">Open Locker</span>
          <span class="bsv-door-drop-hint">Place depleted battery here</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getLockerSlots } from "../../../composables/useStationManager.js";

export default {
  name: "StationLockerCabinet",
  props: {
    station: { type: Object, required: true },
    slots: { type: Array, default: null }
  },
  emits: ["select-battery", "open-swap", "door-click"],
  computed: {
    computedSlots() {
      if (this.slots && this.slots.length > 0) return this.slots;
      return getLockerSlots(this.station);
    }
  },
  methods: {
    handleSelect(sn) {
      this.$emit("select-battery", sn);
    },
    handleLockerClick(slot) {
      this.$emit("door-click", { station: this.station, slot });
      if (slot.status === "ready" && slot.battery) {
        this.$emit("select-battery", slot.battery.sn);
      } else if (slot.status === "empty") {
        this.$emit("open-swap", this.station.id);
      }
    }
  }
};
</script>
