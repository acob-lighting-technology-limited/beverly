<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ d: number[]; labels: string[] }>();

const pts = computed(() => {
  const m = Math.max(...props.d, 1);
  return props.d.map((val, i) => [
    10 + i * (280 / Math.max(props.d.length - 1, 1)),
    98 - (val / m) * 70,
  ]);
});

const path = computed(() => {
  return pts.value.map((a, i) => `${i ? 'L' : 'M'}${a[0].toFixed(1)} ${a[1].toFixed(1)}`).join(' ');
});

const area = computed(() => `${path.value} L290 98 L10 98 Z`);
</script>

<template>
  <svg class="chart" viewBox="0 0 300 112" role="img">
    <path :d="area" style="fill: color-mix(in oklch, var(--primary) 14%, transparent)" />
    <path :d="path" fill="none" style="stroke: var(--primary)" stroke-width="2.5" stroke-linejoin="round" />
    <circle v-for="(a, i) in pts" :key="i" :cx="a[0]" :cy="a[1]" r="3" style="fill: var(--primary)" />
    <text
      v-for="(l, i) in labels"
      :key="i"
      :x="10 + i * (280 / Math.max(labels.length - 1, 1))"
      y="109"
      text-anchor="middle"
      font-size="8"
      style="fill: var(--muted-foreground)"
    >
      {{ l }}
    </text>
  </svg>
</template>
