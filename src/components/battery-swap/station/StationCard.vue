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
          <span class="bsv-dot" /> Open &bull; Attendant on Duty
        </span>
      </div>

      <!-- Address & Directions -->
      <div class="bsv-sc-meta-row">
        <div class="bsv-sc-address">
          <span class="bsv-icon">📍</span>
          <span>{{ station.address }}</span>
        </div>
        <a
          :href="getMapDirectionsUrl(station)"
          target="_blank"
          rel="noopener noreferrer"
          class="bsv-directions-link"
          title="Get GPS driving directions to this station"
        >
          <span>Get Directions &rarr;</span>
        </a>
      </div>

      <!-- Attendant Contact Info -->
      <div class="bsv-sc-operator">
        <span class="bsv-operator-label">Station Attendant:</span>
        <strong class="bsv-operator-name">{{ station.operatorName }}</strong>
        <span class="bsv-sep">&bull;</span>
        <a :href="'tel:' + station.operatorPhone" class="bsv-phone-link" title="Call station attendant directly">
          📞 {{ station.operatorPhone }}
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
        <span class="bsv-fee-note">Fixed swap fee: <strong>₦800</strong></span>
        <span class="bsv-time-note">&bull; Takes &lt; 60 seconds</span>
      </div>
      <button
        class="bsv-btn-swap-here"
        :disabled="readyList.length === 0"
        @click="onOpenSwap(station.id)"
      >
        <span v-if="readyList.length > 0">⚡ Swap Battery at This Station</span>
        <span v-else>⚠️ No Ready Batteries at This Hub</span>
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
} from "../../../composables/useStationManager.js";

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
