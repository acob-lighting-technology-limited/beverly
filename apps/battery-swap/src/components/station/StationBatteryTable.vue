<template>
  <div class="bsv-sc-rack">
    <div class="bsv-table-responsive">
      <table class="bsv-rack-table">
        <thead>
          <tr>
            <th>Battery Pack</th>
            <th>Charge Level</th>
            <th class="bsv-td-center">Power (Volts)</th>
            <th class="bsv-td-center">Temperature</th>
            <th>Readiness Status</th>
            <th class="bsv-td-right">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="bat in batteries" :key="bat.sn">
            <td>
              <div class="bsv-bat-id-cell">
                <span class="bsv-mono bsv-sn-sm">#{{ bat.sn.slice(-6) }}</span>
                <span class="bsv-sub-sn">{{ bat.sn }}</span>
              </div>
            </td>
            <td>
              <div class="bsv-mini-soc">
                <div class="bsv-mini-soc-wrap">
                  <div
                    class="bsv-mini-soc-fill"
                    :style="{ width: bat.soc + '%', background: getChargeColor(bat.soc) }"
                  />
                </div>
                <span class="bsv-soc-number" :style="{ color: getChargeColor(bat.soc) }">
                  {{ bat.soc }}%
                </span>
              </div>
            </td>
            <td class="bsv-td-center font-mono">{{ bat.v }}V</td>
            <td class="bsv-td-center">
              <span :class="bat.temp > 35 ? 'text-amber' : 'text-normal'">
                {{ bat.temp }}°C ({{ bat.temp > 35 ? 'Warm' : 'Normal' }})
              </span>
            </td>
            <td>
              <span
                class="bsv-bat-status"
                :class="bat.status === 'ready' ? 'bsv-bat-status--ready' : 'bsv-bat-status--charging'"
              >
                {{ bat.status === 'ready' ? '✓ Ready to Ride' : '↻ Charging Up' }}
              </span>
            </td>
            <td class="bsv-td-right">
              <button
                v-if="bat.status === 'ready'"
                class="bsv-btn-take-pack"
                @click="handleSelect(bat.sn)"
              >
                Select
              </button>
              <span v-else class="bsv-charging-hint">Waiting</span>
            </td>
          </tr>
          <tr v-if="!batteries || batteries.length === 0">
            <td colspan="6" class="bsv-table-empty">
              No battery packs currently in this cabinet rack.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { getChargeColor } from "../../composables/useStationManager.js";

export default {
  name: "StationBatteryTable",
  props: {
    batteries: { type: Array, default: () => [] },
    stationId: { type: String, default: "" }
  },
  emits: ["select-battery"],
  methods: {
    getChargeColor,
    handleSelect(sn) {
      this.$emit("select-battery", sn);
    }
  }
};
</script>
