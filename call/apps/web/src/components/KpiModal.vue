<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Metric, MetricKey, MetricPeriod } from '@beverly-call/shared'
import Modal from '@/components/Modal.vue'
import Icon from '@/components/Icon.vue'
import { api } from '@/lib/api'
import { useToast } from '@/stores/toast'
import { useSession } from '@/stores/session'
import type { ScreenId } from '@/types'

const props = defineProps<{ open: boolean; metric: MetricKey; label: string; icon: string }>()
const emit = defineEmits<{ close: [] }>()
const router = useRouter()
const toast = useToast()
const session = useSession()

const period = ref<MetricPeriod>('24h')
const data = ref<Metric | null>(null)
const error = ref('')
const loading = ref(false)
const RELATED: Record<MetricKey, ScreenId> = { calls: 'rep', handle_time: 'rep', abandoned: 'rep', service_level: 'rep', open_cases: 'cases', overdue_cases: 'cases' }

async function load(): Promise<void> {
  loading.value = true; error.value = ''
  try { data.value = await api<Metric>(`/metrics/${props.metric}?period=${period.value}`) }
  catch { error.value = 'Could not load this trend.'; data.value = null }
  finally { loading.value = false }
}
watch(() => props.open, (o) => { if (o) { period.value = '24h'; void load() } })
watch(period, () => { if (props.open) void load() })

const points = computed(() => {
  const s = data.value?.series ?? []
  if (s.length < 2) return ''
  const max = Math.max(...s.map((x) => x.value), 1)
  return s.map((x, i) => `${((i * 300) / (s.length - 1)).toFixed(1)},${(86 - (x.value / max) * 80).toFixed(1)}`).join(' ')
})
const fmt = (n: number): string => (data.value?.unit === 'seconds' ? `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, '0')}` : data.value?.unit === '%' ? `${n}%` : String(n))
const related = computed(() => RELATED[props.metric])
const canGo = computed(() => session.screens.includes(related.value))
async function copy(): Promise<void> { try { await navigator.clipboard.writeText(`${props.label}: ${fmt(data.value?.current ?? 0)}`); toast.show('Copied') } catch { toast.show('Copy is blocked in this browser') } }
function go(): void { emit('close'); void router.push(`/${related.value}`) }
</script>

<template>
  <Modal :open="open" :title="label" @close="emit('close')">
    <div class="ss" role="group" aria-label="Period" style="margin-bottom: 8px">
      <button v-for="p in (['24h', '7d', '30d'] as MetricPeriod[])" :key="p" :class="{ on: period === p }" @click="period = p">{{ p }}</button></div>
    <p v-if="loading" style="color: var(--mut)">Loading…</p>
    <p v-else-if="error" role="alert" style="color: var(--badt)">{{ error }}</p>
    <template v-else-if="data">
      <div style="display: flex; align-items: baseline; gap: 10px"><div class="kn">{{ fmt(data.current) }}</div>
        <span class="pill" :class="data.deltaPct >= 0 ? 'ok' : 'bad'">{{ data.deltaPct >= 0 ? 'Up' : 'Down' }} {{ Math.abs(data.deltaPct) }}%</span></div>
      <svg viewBox="0 0 300 90" width="100%" role="img" :aria-label="`${label} trend`"><polygon v-if="points" :points="`0,90 ${points} 300,90`" style="fill: color-mix(in srgb, var(--yel) 35%, transparent)" /><polyline :points="points" fill="none" stroke="var(--yel)" stroke-width="2.5" stroke-linejoin="round" /></svg>
      <div class="kb"><div class="kv"><small>Low</small><b>{{ fmt(data.low) }}</b></div><div class="kv"><small>Average</small><b>{{ fmt(data.avg) }}</b></div><div class="kv"><small>High</small><b>{{ fmt(data.high) }}</b></div></div>
    </template>
    <template #footer><button aria-label="Copy value" @click="copy"><Icon name="copy" /></button><button v-if="canGo" class="y" @click="go">Open {{ related === 'rep' ? 'reports' : 'escalations' }}</button></template>
  </Modal>
</template>
