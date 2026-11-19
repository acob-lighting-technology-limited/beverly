<template>
  <figure class="hb" :aria-label="summary">
    <div class="hb-bars" role="img" :aria-label="summary">
      <span v-for="h in hours" :key="h.hour" class="hb-col" :title="`${pad(h.hour)}:00, ${h.completed}`">
        <i :class="{ peak: h.hour === peakHour && peak > 0 }" :style="{ height: `${Math.max(3, (h.completed / peak) * 100)}%` }" />
      </span>
    </div>
    <div class="hb-axis" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
  </figure>
</template>

<script setup>
/** Completed handovers for each hour of the day (West Africa time). The busiest hour is highlighted. */
import { computed } from "vue";

const props = defineProps({ hours: { type: Array, required: true } });
const pad = (n) => String(n).padStart(2, "0");
const peak = computed(() => Math.max(0, ...props.hours.map((h) => h.completed)));
const peakHour = computed(() => props.hours.find((h) => h.completed === peak.value)?.hour ?? 0);
const summary = computed(() => (peak.value ? `Handovers by hour. Busiest hour is ${pad(peakHour.value)}:00 with ${peak.value}.` : "Handovers by hour. No handovers yet."));
</script>

<style scoped>
.hb { margin: 0; }
.hb-bars { display: grid; grid-template-columns: repeat(24, 1fr); gap: 4px; height: 140px; align-items: end; }
.hb-col { height: 100%; display: flex; align-items: flex-end; }
.hb-col i { display: block; width: 100%; border-radius: 99px 99px 12px 12px; background: color-mix(in srgb, var(--acob-text) 22%, transparent); transition: height .6s cubic-bezier(.16, 1, .3, 1); }
.hb-col i.peak { background: var(--gel-mid); }
.hb-axis { display: flex; justify-content: space-between; margin-top: 8px; color: var(--acob-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { .hb-col i { transition: none; } }
</style>
