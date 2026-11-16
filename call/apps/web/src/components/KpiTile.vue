<script setup lang="ts">
import { ref } from 'vue'
import type { MetricKey } from '@beverly-call/shared'
import Icon from '@/components/Icon.vue'
import KpiModal from '@/components/KpiModal.vue'

/** A KPI tile. Give it a `metric` and it opens a trend modal (24h, 7d, 30d) when clicked or activated by keyboard. */
const props = defineProps<{ icon: string; value: string | number; label: string; dark?: boolean; metric?: MetricKey }>()
const open = ref(false)
function activate(): void { if (props.metric) open.value = true }
</script>

<template>
  <div class="fk" :class="{ d: dark }" :role="metric ? 'button' : undefined" :tabindex="metric ? 0 : undefined"
       :aria-label="metric ? `${label}, ${value}. Open details` : undefined" @click="activate" @keydown.enter.prevent="activate" @keydown.space.prevent="activate">
    <Icon :name="icon" /><b>{{ value }}</b><small>{{ label }}</small>
  </div>
  <KpiModal v-if="metric" :open="open" :metric="metric" :label="label" :icon="icon" @close="open = false" />
</template>
