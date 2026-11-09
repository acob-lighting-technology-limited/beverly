<template>
  <section class="bsv-swap-log" aria-labelledby="swap-log-heading">
    <div class="bsv-swap-log-header">
      <div>
        <h2 id="swap-log-heading" class="bsv-swap-log-title">Recent Battery Swap History</h2>
        <p class="bsv-swap-log-sub">Transparent record of real-time battery exchanges completed across all hubs</p>
      </div>
      <span class="bsv-badge-count">{{ swaps.length }} Recorded Swaps</span>
    </div>

    <div class="bsv-swap-log-table-wrap">
      <table class="bsv-swap-log-table">
        <thead>
          <tr>
            <th>Date &amp; Time</th>
            <th>EV Bike</th>
            <th>Rider Name</th>
            <th>Returned Low Battery</th>
            <th>New Battery Received</th>
            <th>Station Hub</th>
            <th>Fee Paid</th>
            <th>Attendant</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="swap in swaps" :key="swap.id">
            <td class="bsv-td-ts">{{ formatTimestamp(swap.timestamp) }}</td>
            <td>
              <span class="bsv-mono bsv-bike-tag">{{ swap.bikeId }}</span>
            </td>
            <td class="bsv-rider-name">{{ swap.riderName }}</td>
            <td>
              <div class="bsv-pack-exchange-cell">
                <span class="bsv-mono bsv-sn-sm">#{{ (swap.batteryInSn || '').slice(-6) }}</span>
                <span class="bsv-soc-tag bsv-soc-tag--low">{{ swap.batteryInSoc }}% Depleted</span>
              </div>
            </td>
            <td>
              <div class="bsv-pack-exchange-cell">
                <span class="bsv-mono bsv-sn-sm">#{{ (swap.batteryOutSn || '').slice(-6) }}</span>
                <span class="bsv-soc-tag bsv-soc-tag--high">{{ swap.batteryOutSoc }}% Fresh</span>
              </div>
            </td>
            <td class="bsv-td-station">
              <strong>{{ swap.stationName }}</strong>
            </td>
            <td class="bsv-td-fee">
              <span class="bsv-fee-badge">{{ fmtNaira(swap.feeMinor) }}</span>
            </td>
            <td class="bsv-td-operator">{{ swap.operatorName }}</td>
          </tr>
          <tr v-if="swaps.length === 0">
            <td colspan="8" class="bsv-table-empty">
              No swaps recorded yet. Use the "Swap Battery Now" button above to perform your first swap.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script>
import { formatTimestamp, fmtNaira } from "../../../composables/useStationManager.js";

export default {
  name: "StationSwapHistory",
  props: {
    swaps: { type: Array, default: () => [] }
  },
  methods: {
    formatTimestamp,
    fmtNaira
  }
};
</script>
