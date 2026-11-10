<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ d: { l: string; v: number }[] }>();
const C = 251.3;
const cols = [
  'var(--primary)',
  'color-mix(in oklch, var(--primary) 55%, var(--card))',
  'var(--warn)',
  'var(--destructive)',
];

const segs = computed(() => {
  const t = props.d.reduce((s, x) => s + x.v, 0) || 1;
  let o = 0;
  return props.d.map((x, i) => {
    const l = (x.v / t) * C;
    const r = {
      l: x.l,
      da: `${l} ${C - l}`,
      off: -o,
      c: cols[i % 4],
      pct: Math.round((x.v / t) * 100),
    };
    o += l;
    return r;
  });
});
</script>

<template>
  <div class="row">
    <svg viewBox="0 0 100 100" width="130" height="130" role="img">
      <circle
        v-for="s in segs"
        :key="s.l"
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke-width="16"
        :stroke-dasharray="s.da"
        :stroke-dashoffset="s.off"
        transform="rotate(-90 50 50)"
        :style="{ stroke: s.c }"
      />
    </svg>
    <div>
      <div v-for="s in segs" :key="s.l" style="font-size: 13px; margin: 4px 0;">
        <span
          :style="{ background: s.c }"
          style="display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px;"
        ></span>
        {{ s.l }} {{ s.pct }}%
      </div>
    </div>
  </div>
</template>
