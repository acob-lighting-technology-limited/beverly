<template>
  <article class="bsv-station-card">
    <!-- Station Header -->
    <div class="bsv-sc-header">
      <div class="bsv-sc-title-row">
        <div class="bsv-station-name-wrap">
          <h2 class="bsv-sc-name">{{ station.name }}</h2>
          <span class="bsv-city-badge">{{ station.city }}</span>
        </div>
        <span class="bsv-status-badge bsv-status-badge--open">
          <span class="bsv-dot" /> Open
        </span>
      </div>

      <!-- Address & Directions -->
      <div class="bsv-sc-meta-row">
        <div class="bsv-sc-address">
          <svg class="bsv-meta-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span>{{ station.address }}</span>
        </div>
        <a
          :href="getMapDirectionsUrl(station)"
          target="_blank"
          rel="noopener noreferrer"
          class="bsv-directions-link"
          title="Get GPS driving directions to this station"
        >
          <span>Directions &rarr;</span>
        </a>
      </div>

      <!-- Attendant Contact Info -->
      <div class="bsv-sc-operator">
        <span class="bsv-operator-label">Attendant:</span>
        <strong class="bsv-operator-name">{{ station.operatorName }}</strong>
        <span class="bsv-sep">&bull;</span>
        <a :href="'tel:' + station.operatorPhone" class="bsv-phone-link" title="Call station attendant directly">
          <svg class="bsv-meta-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          {{ station.operatorPhone }}
        </a>
      </div>
    </div>

    <!-- Plain Language Locker Availability Bar -->
    <div class="bsv-sc-capacity">
      <div class="bsv-cap-labels">
        <span class="bsv-cap-title">Locker Availability</span>
        <div class="bsv-cap-breakdown">
          <span class="bsv-stat-tag bsv-stat-tag--green">
            <strong>{{ readyList.length }}</strong> ready to take
          </span>
          <span class="bsv-stat-tag bsv-stat-tag--amber">
            <strong>{{ chargingList.length }}</strong> charging up
          </span>
          <span class="bsv-stat-tag bsv-stat-tag--blue">
            <strong>{{ emptySlotsCount }}</strong> open drop-off lockers
          </span>
        </div>
      </div>

      <div class="bsv-cap-bar-wrap" :aria-label="`Station has ${readyList.length} ready packs out of ${station.totalSlots || 8} total bays`">
        <div
          class="bsv-cap-bar bsv-cap-bar--ready"
          :style="{ width: (readyList.length / (station.totalSlots || 8) * 100) + '%' }"
          title="Ready for immediate swap"
        />
        <div
          class="bsv-cap-bar bsv-cap-bar--charging"
          :style="{ width: (chargingList.length / (station.totalSlots || 8) * 100) + '%' }"
          title="Charging up"
        />
      </div>
    </div>

    <!-- View Mode 1: Interactive Physical Locker Cabinet -->
    <StationLockerCabinet
      v-if="viewMode === 'cabinet'"
      :station="station"
      @select-battery="onSelectBattery"
      @open-swap="onOpenSwap"
      @door-click="onDoorClick"
    />

    <!-- View Mode 2: Detailed Battery Table -->
    <StationBatteryTable
      v-else
      :batteries="station.activeBatteries || []"
      :station-id="station.id"
      @select-battery="onSelectBattery"
    />

    <!-- Station Footer Action -->
    <div class="bsv-sc-footer">
      <div class="bsv-footer-info">
        <span class="bsv-fee-note">Fee: <strong>₦800</strong></span>
        <span class="bsv-time-note">&bull; 60s swap</span>
      </div>
      <button
        class="bsv-btn-swap-here"
        :disabled="readyList.length === 0"
        @click="onOpenSwap(station.id)"
      >
        <span v-if="readyList.length > 0">⚡ Record Swap</span>
        <span v-else>⚠️ Packs Recharging</span>
      </button>
    </div>
  </article>
</template>

<script>
import StationLockerCabinet from "./StationLockerCabinet.vue";
import StationBatteryTable from "./StationBatteryTable.vue";
import {
  readyBatteries,
  chargingBatteries,
  getEmptySlotsCount,
  getMapDirectionsUrl
} from "../../composables/useStationManager.js";

export default {
  name: "StationCard",
  components: {
    StationLockerCabinet,
    StationBatteryTable
  },
  props: {
    station: { type: Object, required: true },
    viewMode: { type: String, default: "cabinet" }
  },
  emits: ["select-battery", "open-swap", "door-click"],
  computed: {
    readyList() {
      return readyBatteries(this.station);
    },
    chargingList() {
      return chargingBatteries(this.station);
    },
    emptySlotsCount() {
      return getEmptySlotsCount(this.station);
    }
  },
  methods: {
    getMapDirectionsUrl,
    onSelectBattery(sn) {
      this.$emit("select-battery", { stationId: this.station.id, batterySn: sn });
    },
    onOpenSwap(stationId) {
      this.$emit("open-swap", stationId || this.station.id);
    },
    onDoorClick(payload) {
      this.$emit("door-click", payload);
    }
  }
};
</script>
