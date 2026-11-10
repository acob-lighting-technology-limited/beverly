<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ d: number[]; labels: string[] }>();
const m = computed(() => Math.max(...props.d, 1));
</script>

<template>
  <svg class="chart" viewBox="0 0 300 120" role="img">
    <g v-for="(v, i) in d" :key="i">
      <rect
        :x="12 + i * (276 / d.length)"
        :y="98 - (v / m) * 80"
        :width="(276 / d.length) - 8"
        :height="(v / m) * 80"
        rx="3"
        style="fill: var(--primary)"
      />
      <text
        :x="12 + i * (276 / d.length) + ((276 / d.length) - 8) / 2"
        y="112"
        text-anchor="middle"
        font-size="8"
        style="fill: var(--muted-foreground)"
      >
        {{ labels[i] }}
      </text>
    </g>
  </svg>
</template>
