<template>
  <figure class="tc" :aria-label="summary">
    <svg :viewBox="`0 0 ${W} ${H}`" class="tc-svg" role="img" :aria-label="summary" @pointermove="onMove" @pointerleave="hover = null">
      <!-- grid and axis -->
      <g class="tc-grid">
        <g v-for="t in yTicks" :key="t.y">
          <line :x1="PAD_L" :x2="W - PAD_R" :y1="t.y" :y2="t.y" />
          <text :x="PAD_L - 8" :y="t.y + 4" text-anchor="end">{{ t.label }}</text>
        </g>
      </g>
      <g class="tc-xlabels">
        <text v-for="l in xLabels" :key="l.i" :x="l.x" :y="H - 6" text-anchor="middle">{{ l.text }}</text>
      </g>

      <!-- bars: the count series -->
      <g class="tc-bars">
        <rect
          v-for="(b, i) in barRects" :key="i" :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="4"
          :class="{ 'is-hover': hover === i }"
        />
      </g>

      <!-- line: the money series, on its own scale -->
      <g v-if="line">
        <path :d="areaPath" class="tc-area" />
        <path :d="linePath" class="tc-line" />
        <circle v-if="hover !== null" :cx="pointX(hover)" :cy="lineY(line[hover])" r="5" class="tc-dot" />
      </g>

      <line v-if="hover !== null" :x1="pointX(hover)" :x2="pointX(hover)" :y1="PAD_T" :y2="H - PAD_B" class="tc-cursor" />
    </svg>

    <div v-if="hover !== null" class="tc-tip" :style="{ left: tipLeft + '%' }" role="status">
      <strong>{{ labels[hover] }}</strong>
      <span>{{ barLabel }}: <b>{{ bars[hover] }}</b></span>
      <span v-if="line">{{ lineLabel }}: <b>{{ lineFormat(line[hover]) }}</b></span>
    </div>

    <figcaption class="tc-legend">
      <span><i class="tc-key tc-key--bar" />{{ barLabel }}</span>
      <span v-if="line"><i class="tc-key tc-key--line" />{{ lineLabel }}</span>
    </figcaption>
  </figure>
</template>

<script setup>
/**
 * Daily trend: bars for a count, a line for money, each on its own scale. Drawn as plain SVG from the
 * numbers it is given, so a day with nothing is a true zero and an empty series draws an empty chart.
 */
import { computed, ref } from "vue";

const props = defineProps({
  labels: { type: Array, required: true },
  bars: { type: Array, required: true },
  line: { type: Array, default: null },
  barLabel: { type: String, default: "Count" },
  lineLabel: { type: String, default: "Amount" },
  lineFormat: { type: Function, default: (v) => String(v) },
  /** Draw the line on the same scale as the bars (both are counts of the same thing). */
  sharedScale: { type: Boolean, default: false }
});

const W = 720, H = 260, PAD_L = 44, PAD_R = 16, PAD_T = 14, PAD_B = 28;
const hover = ref(null);

const n = computed(() => props.labels.length);
const innerW = W - PAD_L - PAD_R;
const innerH = H - PAD_T - PAD_B;
const step = computed(() => (n.value ? innerW / n.value : innerW));
const nice = (max) => { if (max <= 4) return 4; const p = 10 ** Math.floor(Math.log10(max)); const m = Math.ceil(max / p); return (m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
const barMax = computed(() => nice(Math.max(0, ...props.bars)));
const lineMax = computed(() => (props.sharedScale ? barMax.value : props.line ? Math.max(1, ...props.line) : 1));

const barRects = computed(() => props.bars.map((v, i) => {
  const h = (v / barMax.value) * innerH;
  const w = Math.max(3, Math.min(28, step.value * 0.58));
  return { x: PAD_L + step.value * i + (step.value - w) / 2, y: PAD_T + innerH - h, w, h };
}));
const pointX = (i) => PAD_L + step.value * i + step.value / 2;
const lineY = (v) => PAD_T + innerH - (v / lineMax.value) * innerH * 0.94;
const linePath = computed(() => (props.line ? props.line.map((v, i) => `${i ? "L" : "M"}${pointX(i).toFixed(1)} ${lineY(v).toFixed(1)}`).join(" ") : ""));
const areaPath = computed(() => (props.line && n.value ? `${linePath.value} L${pointX(n.value - 1).toFixed(1)} ${PAD_T + innerH} L${pointX(0).toFixed(1)} ${PAD_T + innerH} Z` : ""));
const yTicks = computed(() => [0, 0.5, 1].map((f) => ({ y: PAD_T + innerH - f * innerH, label: String(Math.round(barMax.value * f)) })));
const xLabels = computed(() => {
  const every = Math.max(1, Math.ceil(n.value / 7));
  return props.labels.map((text, i) => ({ i, text: text.slice(5).replace("-", "/"), x: pointX(i) })).filter((l) => l.i % every === 0 || l.i === n.value - 1);
});
const tipLeft = computed(() => Math.min(86, Math.max(14, ((pointX(hover.value ?? 0)) / W) * 100)));
const summary = computed(() => {
  const total = props.bars.reduce((a, b) => a + b, 0);
  return `${props.barLabel} per day over ${n.value} days, ${total} in total.`;
});

function onMove(event) {
  const box = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width) * W - PAD_L;
  const i = Math.floor(x / step.value);
  hover.value = i >= 0 && i < n.value ? i : null;
}
</script>

<style scoped>
.tc { position: relative; margin: 0; }
.tc-svg { width: 100%; height: auto; display: block; overflow: visible; }
.tc-grid line { stroke: var(--acob-line); stroke-width: 1; }
.tc-grid text, .tc-xlabels text { fill: var(--acob-muted); font: 600 12px var(--acob-font-sans); font-variant-numeric: tabular-nums; }
.tc-bars rect { fill: color-mix(in srgb, var(--acob-text) 22%, transparent); transition: fill .15s ease; }
.tc-bars rect.is-hover { fill: color-mix(in srgb, var(--acob-text) 45%, transparent); }
.tc-line { fill: none; stroke: var(--gel-deep); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.tc-area { fill: color-mix(in srgb, var(--gel-mid) 30%, transparent); }
.tc-dot { fill: var(--gel-mid); stroke: var(--acob-text); stroke-width: 2; }
.tc-cursor { stroke: var(--acob-line-strong); stroke-dasharray: 3 4; }
.tc-tip { position: absolute; top: 0; transform: translateX(-50%); display: grid; gap: 2px; padding: 10px 14px; border-radius: 18px; font-size: 13px; pointer-events: none; white-space: nowrap; background: var(--acob-menu-bg); border: 1px solid var(--surface-border); box-shadow: var(--lg-shadow); }
.tc-tip b { font-variant-numeric: tabular-nums; }
.tc-legend { display: flex; gap: 18px; margin-top: 8px; font-size: 13px; color: var(--acob-muted); }
.tc-key { display: inline-block; width: 12px; height: 12px; margin-right: 8px; border-radius: 99px; vertical-align: -1px; }
.tc-key--bar { background: color-mix(in srgb, var(--acob-text) 30%, transparent); }
.tc-key--line { background: var(--gel-deep); border-radius: 99px; height: 4px; vertical-align: 3px; }
</style>
