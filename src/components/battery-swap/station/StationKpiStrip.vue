<template>
  <div class="bsv-stations-kpis">
    <div class="bsv-kpi-card">
      <span class="bsv-kpi-icon" aria-hidden="true">🏪</span>
      <div class="bsv-kpi-details">
        <span class="bsv-kpi-val">{{ stationCount }}</span>
        <span class="bsv-kpi-lbl">Active Stations Open</span>
        <span class="bsv-kpi-hint">Across Lagos, Abuja &amp; Ibadan</span>
      </div>
    </div>

    <div class="bsv-kpi-card bsv-kpi-card--green">
      <span class="bsv-kpi-icon" aria-hidden="true">🔋</span>
      <div class="bsv-kpi-details">
        <span class="bsv-kpi-val bsv-kpi-val--green">{{ totalReady }}</span>
        <span class="bsv-kpi-lbl">Ready for Pickup</span>
        <span class="bsv-kpi-hint">Charged &ge; 85% &bull; Ready to ride</span>
      </div>
    </div>

    <div class="bsv-kpi-card bsv-kpi-card--amber">
      <span class="bsv-kpi-icon" aria-hidden="true">⚡</span>
      <div class="bsv-kpi-details">
        <span class="bsv-kpi-val bsv-kpi-val--amber">{{ totalCharging }}</span>
        <span class="bsv-kpi-lbl">Charging Now</span>
        <span class="bsv-kpi-hint">Fast charging in rack bays</span>
      </div>
    </div>

    <div class="bsv-kpi-card bsv-kpi-card--blue">
      <span class="bsv-kpi-icon" aria-hidden="true">🔓</span>
      <div class="bsv-kpi-details">
        <span class="bsv-kpi-val bsv-kpi-val--blue">{{ totalEmptyLockers }}</span>
        <span class="bsv-kpi-lbl">Open Drop-Off Lockers</span>
        <span class="bsv-kpi-hint">Available for incoming packs</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "StationKpiStrip",
  props: {
    stationCount: { type: Number, default: 0 },
    totalReady: { type: Number, default: 0 },
    totalCharging: { type: Number, default: 0 },
    totalEmptyLockers: { type: Number, default: 0 }
  }
};
</script>
