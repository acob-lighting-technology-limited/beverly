<template>
  <ol v-if="items.length" class="bl">
    <li v-for="item in items" :key="item.key ?? item.label">
      <div class="bl-top">
        <span class="bl-label">{{ item.label }}</span>
        <b class="bl-value">{{ item.display ?? item.value }}</b>
      </div>
      <div class="bl-track" role="img" :aria-label="`${item.label}: ${item.display ?? item.value}`">
        <i :style="{ width: width(item.value) }" />
      </div>
      <small v-if="item.note" class="bl-note">{{ item.note }}</small>
    </li>
  </ol>
  <p v-else class="bl-empty">{{ empty }}</p>
</template>

<script setup>
/** A ranked list drawn as horizontal bars, all on one scale. Shows its empty text when there is nothing to rank. */
import { computed } from "vue";

const props = defineProps({
  items: { type: Array, default: () => [] },
  empty: { type: String, default: "Nothing to show yet." }
});
const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)));
const width = (value) => `${Math.max(2, (value / max.value) * 100)}%`;
</script>

<style scoped>
.bl { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.bl-top { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; margin-bottom: 6px; }
.bl-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bl-value { font-variant-numeric: tabular-nums; }
.bl-track { height: 12px; padding: 2px; border-radius: 99px; background: var(--surface-inset); box-shadow: inset 0 2px 4px rgba(var(--gel-shade-rgb), .14), inset 0 -1px 0 var(--surface-rim); }
.bl-track i { display: block; height: 100%; border-radius: 99px; background: var(--gel-mid); transition: width .6s cubic-bezier(.16, 1, .3, 1); }
.bl-note { display: block; margin-top: 4px; color: var(--acob-muted); font-size: 12px; }
.bl-empty { margin: 0; color: var(--acob-muted); font-size: 14px; }
@media (prefers-reduced-motion: reduce) { .bl-track i { transition: none; } }
</style>
