<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '@/components/Icon.vue'

export interface FilterGroup { key: string; label: string; options: string[] }
const props = defineProps<{ groups: FilterGroup[]; modelValue: Record<string, string[]> }>()
const emit = defineEmits<{ 'update:modelValue': [v: Record<string, string[]>] }>()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const count = computed(() => Object.values(props.modelValue).reduce((n, a) => n + a.length, 0))

function toggle(k: string, v: string): void {
  const cur = props.modelValue[k] ?? []
  emit('update:modelValue', { ...props.modelValue, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] })
}
const clear = (): void => emit('update:modelValue', {})
const away = (e: MouseEvent): void => { if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false }
const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') open.value = false }
onMounted(() => { document.addEventListener('click', away); document.addEventListener('keydown', esc) })
onBeforeUnmount(() => { document.removeEventListener('click', away); document.removeEventListener('keydown', esc) })
</script>

<template>
  <div ref="root" class="fpw">
    <button type="button" class="fbtn" :class="{ on: count > 0 }" aria-haspopup="dialog" :aria-expanded="open" title="Filter" @click="open = !open">
      <Icon name="x-filter" /><span class="ft2">Filter</span><b v-if="count" class="fb">{{ count }}</b></button>
    <div v-if="open" class="fpop" role="dialog" aria-label="Filters">
      <div class="fph"><b>Filters</b><button type="button" class="fcl" :disabled="!count" @click="clear">Clear all</button></div>
      <div v-for="g in groups" :key="g.key" class="fg"><small>{{ g.label }}</small>
        <div class="fch"><button v-for="o in g.options" :key="o" type="button" class="fc" :class="{ on: (modelValue[g.key] ?? []).includes(o) }" :aria-pressed="(modelValue[g.key] ?? []).includes(o)" @click="toggle(g.key, o)">{{ o }}</button></div></div>
    </div>
  </div>
</template>

<style scoped>
.fpw { position: relative; }
</style>
