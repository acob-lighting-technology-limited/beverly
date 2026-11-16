<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Customer } from '@beverly-call/shared'
import SidePanel from '@/components/SidePanel.vue'
import Icon from '@/components/Icon.vue'
import { api } from '@/lib/api'
import { maskPhone } from '@/lib/mask'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'

const ui = useUi()
const settings = useSettings()
const router = useRouter()
const q = ref('')
const results = ref<Customer[]>([])
const busy = ref(false)
const error = ref('')
const RECENT = 'bc.recent'
const recent = ref<string[]>((() => { try { return JSON.parse(localStorage.getItem(RECENT) ?? '[]') as string[] } catch { return [] } })())
let timer = 0

watch(q, (v) => {
  clearTimeout(timer)
  if (!v.trim()) { results.value = []; return }
  timer = window.setTimeout(async () => {
    busy.value = true; error.value = ''
    try { results.value = await api<Customer[]>(`/customers?q=${encodeURIComponent(v.trim())}`) }
    catch (e) { error.value = e instanceof Error ? e.message : 'Search failed.' }
    finally { busy.value = false }
  }, 300)
})

function go(c: Customer): void {
  recent.value = [c.name, ...recent.value.filter((n) => n !== c.name)].slice(0, 4)
  try { localStorage.setItem(RECENT, JSON.stringify(recent.value)) } catch { /* storage blocked */ }
  ui.close()
  void router.push({ path: '/cust', query: { open: c.id } })
}
const show = (p: string) => (settings.p.mask ? maskPhone(p) : p)
</script>

<template>
  <SidePanel :open="ui.panel === 'search'" title="Search" @close="ui.close">
    <input v-model="q" type="search" aria-label="Search customers" placeholder="Name, phone or email" />
    <div v-if="!q && recent.length" style="margin-top: 10px"><small class="hq">Recent</small>
      <button v-for="n in recent" :key="n" class="mi" @click="q = n"><Icon name="clock" />{{ n }}</button></div>
    <p v-if="busy" style="color: var(--mut)">Searching…</p>
    <p v-else-if="error" role="alert" style="color: var(--badt)">{{ error }}</p>
    <div style="margin-top: 8px">
      <button v-for="c in results" :key="c.id" class="mi" @click="go(c)"><Icon name="user" />
        <span>{{ c.name }}<small style="display: block; color: var(--mut)">{{ c.area || 'No station' }} · {{ show(c.phone) }}</small></span></button>
      <p v-if="q && !busy && !error && !results.length" style="color: var(--mut)">No match. Try a name, phone or email.</p>
    </div>
  </SidePanel>
</template>
