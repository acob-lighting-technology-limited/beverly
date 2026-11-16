<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { LANGUAGE_NAMES, type CoachingEntry, type LanguageCode, type PresenceRow, type WallSnapshot } from '@beverly-call/shared'
import Icon from '@/components/Icon.vue'
import KpiTile from '@/components/KpiTile.vue'
import StateBanner from '@/components/StateBanner.vue'
import FilterPopover, { type FilterGroup } from '@/components/FilterPopover.vue'
import ViewToggle, { type ViewMode } from '@/components/ViewToggle.vue'
import { api } from '@/lib/api'
import { useResource } from '@/lib/use-resource'
import { clock, pad2, shortDate } from '@/lib/format'
import { maskPhone } from '@/lib/mask'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'

const settings = useSettings()
const toast = useToast()
const wall = useResource(() => api<WallSnapshot>('/wall'))
const roster = useResource(() => api<PresenceRow[]>('/presence'))
const coaching = useResource(() => api<CoachingEntry[]>('/coaching'))
let t = 0
// Refresh quietly every 15s while the screen is open; skipped when the tab is hidden.
onMounted(() => { t = window.setInterval(() => { if (!document.hidden) { void wall.reload(); void roster.reload() } }, 15000) })
onBeforeUnmount(() => clearInterval(t))

/* ---- agents: search, filter, card or table ---- */
const VIEW_KEY = 'bc.wall.view'
const view = ref<ViewMode>((() => { try { return (localStorage.getItem(VIEW_KEY) as ViewMode) || 'cards' } catch { return 'cards' } })())
const setView = (v: ViewMode): void => { view.value = v; try { localStorage.setItem(VIEW_KEY, v) } catch { /* storage blocked */ } }
const q = ref('')
const filters = ref<Record<string, string[]>>({})
const selected = ref<string | null>(null)

interface Row { id: string; name: string; langs: LanguageCode[]; state: 'Busy' | 'Wrap' | 'Free' | 'Break' | 'Away' | 'Offline'; tone: string; since: number; onCall: boolean }
const STATE: Record<string, { label: Row['state']; tone: string }> = { busy: { label: 'Busy', tone: 'bad' }, acw: { label: 'Wrap', tone: 'ye' }, available: { label: 'Free', tone: 'ok' }, break: { label: 'Break', tone: 'vi' }, away: { label: 'Away', tone: 'vi' } }
const rows = computed<Row[]>(() => (roster.data.value ?? []).map((a) => {
  const s = a.online ? STATE[a.status] ?? { label: 'Away' as const, tone: 'vi' } : { label: 'Offline' as const, tone: 'vi' }
  return { id: a.agentId, name: a.name, langs: a.languages, state: s.label, tone: s.tone, since: a.sinceSeconds, onCall: a.status === 'busy' && a.online }
}))
const groups = computed<FilterGroup[]>(() => [
  { key: 'state', label: 'State', options: ['Free', 'Busy', 'Wrap', 'Break', 'Away', 'Offline'] },
  { key: 'lang', label: 'Language', options: Object.values(LANGUAGE_NAMES) },
])
const shown = computed(() => rows.value.filter((r) =>
  (!q.value || r.name.toLowerCase().includes(q.value.toLowerCase())) &&
  (!(filters.value.state?.length) || filters.value.state.includes(r.state)) &&
  (!(filters.value.lang?.length) || r.langs.some((l) => filters.value.lang!.includes(LANGUAGE_NAMES[l])))))
const sel = computed(() => rows.value.find((r) => r.id === selected.value) ?? null)
const firstName = (n: string): string => n.split(' ')[0] ?? n

/* ---- supervisor tools ---- */
type Mode = 'listen' | 'whisper' | 'barge'
const mode = ref<Mode | null>(null)
const prompt = ref('')
const NOTE: Record<Mode, string> = { listen: 'Listening to @. The agent cannot hear you.', whisper: 'Whispering to @. The customer cannot hear you.', barge: 'Barged in on @. Everyone can hear you.' }
async function monitor(m: Mode, agent: Row | null = sel.value): Promise<void> {
  if (!agent) { toast.show('Choose an agent first'); return }
  selected.value = agent.id
  try {
    if (mode.value === m) { await api('/monitor', { method: 'POST', body: JSON.stringify({ mode: 'end', agentId: agent.id }) }); mode.value = null; void coaching.reload(); return }
    await api('/monitor', { method: 'POST', body: JSON.stringify({ mode: m, agentId: agent.id }) })
    mode.value = m; void coaching.reload()
  } catch { toast.show(`${firstName(agent.name)} is not on a call`) }
}
async function sendPrompt(): Promise<void> {
  if (!sel.value) { toast.show('Choose an agent first'); return }
  if (!prompt.value.trim()) { toast.show('Type a prompt first'); return }
  try { await api('/coaching', { method: 'POST', body: JSON.stringify({ agentId: sel.value.id, text: prompt.value.trim() }) }); toast.show(`Prompt sent to ${sel.value.name}`); prompt.value = ''; void coaching.reload() }
  catch { toast.show('Could not send the prompt') }
}

/* ---- charts ---- */
const langCounts = computed(() => {
  const m = new Map<LanguageCode, number>()
  for (const r of rows.value) for (const l of r.langs) m.set(l, (m.get(l) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
})
const PALETTE = ['var(--yel)', '#fff', '#B9B4A0', '#E5483B', '#8F7AD6']
const donut = computed(() => {
  const total = langCounts.value.reduce((n, [, c]) => n + c, 0) || 1
  let at = 0
  return `conic-gradient(${langCounts.value.map(([, c], i) => { const from = at; at += (c / total) * 100; return `${PALETTE[i % PALETTE.length]} ${from}% ${at}%` }).join(', ') || 'var(--panel) 0 100%'})`
})
const hourly = computed(() => wall.data.value?.hourly ?? [])
const peak = computed(() => Math.max(1, ...hourly.value))
const line = computed(() => hourly.value.map((v, i) => `${((i * 600) / 23).toFixed(1)},${(130 - (v / peak.value) * 110).toFixed(1)}`).join(' '))
const hover = ref<{ x: number; text: string } | null>(null)
function onMove(e: PointerEvent): void {
  const svg = e.currentTarget as SVGElement, r = svg.getBoundingClientRect()
  const h = Math.min(23, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * 23)))
  hover.value = { x: (h * 600) / 23, text: `${pad2(h)}:00, ${hourly.value[h] ?? 0} calls` }
}
const free = computed(() => rows.value.filter((r) => r.state === 'Free').length)
const show = (p: string) => (settings.p.mask ? maskPhone(p) : p)
</script>

<template>
  <section>
    <div class="head"><div class="ht"><h1>Live wall</h1><span class="chip" id="live"><i class="ld2"></i><span>Live</span></span></div>
      <div v-if="wall.data.value" v-hover-scroll class="kp">
        <KpiTile icon="phone" :value="pad2(wall.data.value.activeCalls)" label="Active calls" metric="calls" />
        <KpiTile icon="wait" :value="pad2(wall.data.value.waitingCallbacks)" label="Callbacks waiting" dark />
        <KpiTile icon="users" :value="pad2(free)" label="Agents free" />
        <KpiTile icon="check" :value="`${wall.data.value.serviceLevelPct}%`" label="Service level" metric="service_level" dark />
        <KpiTile icon="alert" :value="`${wall.data.value.abandonedPct}%`" label="Abandoned" metric="abandoned" />
        <KpiTile icon="flag" :value="pad2(wall.data.value.overdueCases)" label="Overdue cases" metric="overdue_cases" dark />
      </div>
    </div>
    <StateBanner :loading="wall.loading.value && !wall.data.value" :error="wall.error.value" what="the live wall" />
    <div v-if="wall.data.value" class="bento">
      <div class="c s8 w2">
        <div class="hd"><Icon name="users" /><b>Agents</b></div>
        <div class="dtb">
          <label class="sch"><Icon name="x-srch" /><input v-model="q" type="search" aria-label="Search agents" placeholder="Search agents" /></label>
          <span class="n" aria-live="polite">{{ shown.length }} {{ shown.length === 1 ? 'agent' : 'agents' }}</span>
          <FilterPopover v-model="filters" :groups="groups" /><ViewToggle :model-value="view" @update:model-value="setView" />
        </div>

        <div v-if="view === 'cards'" class="cgrid" role="list">
          <div v-for="r in shown" :key="r.id" class="cc2 agc" role="listitem" tabindex="0" :class="{ sel: r.id === selected }" :aria-label="`${r.name}, ${r.state}`" @click="selected = r.id" @keydown.enter="selected = r.id">
            <span class="cav" style="background: var(--yel)">{{ r.name.split(' ').map((w) => w[0]).join('').slice(0, 2) }}</span>
            <b>{{ r.name }}</b>
            <span class="wl"><span class="pill" :class="r.tone">{{ r.state }}</span><small>{{ clock(r.since) }}</small></span>
            <small>{{ r.langs.map((l) => l.toUpperCase()).join(' ') }}</small>
            <span class="ft">
              <button :class="{ y: mode === 'listen' && r.id === selected }" aria-label="Listen" title="Listen" :disabled="!r.onCall" @click.stop="monitor('listen', r)"><Icon name="ear" /></button>
              <button :class="{ y: mode === 'whisper' && r.id === selected }" aria-label="Whisper" title="Whisper" :disabled="!r.onCall" @click.stop="monitor('whisper', r)"><Icon name="mic" /></button>
              <button :class="{ y: mode === 'barge' && r.id === selected }" aria-label="Barge in" title="Barge in" :disabled="!r.onCall" @click.stop="monitor('barge', r)"><Icon name="phone" /></button>
              <button aria-label="Send coaching prompt" title="Coach" @click.stop="selected = r.id; ($refs.coachInput as HTMLInputElement | undefined)?.focus()"><Icon name="send" /></button>
            </span>
          </div>
        </div>
        <div v-else class="scroll"><table class="rt"><thead><tr><th>Agent</th><th>Lang</th><th>State</th><th>Since</th><th class="act">Actions</th></tr></thead>
          <tbody><tr v-for="r in shown" :key="r.id" tabindex="0" :class="{ sel: r.id === selected }" @click="selected = r.id" @keydown.enter="selected = r.id">
            <td data-label="Agent">{{ r.name }}</td><td data-label="Lang">{{ r.langs.map((l) => l.toUpperCase()).join(' ') }}</td>
            <td data-label="State"><span class="pill" :class="r.tone">{{ r.state }}</span></td><td data-label="Since">{{ clock(r.since) }}</td>
            <td class="act"><div class="acs">
              <button aria-label="Listen" title="Listen" :disabled="!r.onCall" @click.stop="monitor('listen', r)"><Icon name="ear" /></button>
              <button aria-label="Whisper" title="Whisper" :disabled="!r.onCall" @click.stop="monitor('whisper', r)"><Icon name="mic" /></button>
              <button aria-label="Barge in" title="Barge in" :disabled="!r.onCall" @click.stop="monitor('barge', r)"><Icon name="phone" /></button></div></td></tr></tbody></table></div>
        <div v-if="!shown.length" class="ban" style="margin-top: 8px">{{ rows.length ? 'No agent matches. Clear the search or filters.' : 'No agents are signed in right now.' }}</div>

        <div v-if="mode && sel" class="ban" style="margin-top: 8px"><Icon name="ear" /><span>{{ NOTE[mode].replace('@', sel.name) }}</span></div>
        <div style="display: flex; gap: 6px; margin-top: 8px">
          <input ref="coachInput" v-model="prompt" aria-label="Coach prompt" :placeholder="`Coach prompt for ${sel ? firstName(sel.name) : 'an agent'}`" maxlength="300" @keydown.enter.prevent="sendPrompt" />
          <button class="y" aria-label="Send prompt" title="Send prompt" @click="sendPrompt"><Icon name="send" /></button></div>
        <div class="btns">
          <button :class="{ y: mode === 'listen' }" aria-label="Listen" title="Listen" @click="monitor('listen')"><Icon name="ear" /></button>
          <button :class="{ y: mode === 'whisper' }" aria-label="Whisper" title="Whisper" @click="monitor('whisper')"><Icon name="mic" /></button>
          <button :class="{ y: mode === 'barge' }" aria-label="Barge in" title="Barge in" @click="monitor('barge')"><Icon name="phone" /></button></div>
      </div>

      <div class="c dk s4 w2 stick">
        <div class="hd"><Icon name="alert" /><b>Alerts</b></div>
        <div v-for="a in wall.data.value.alerts" :key="a" class="row"><span>{{ a }}</span></div>
        <div v-if="!wall.data.value.alerts.length" class="row"><span>Nothing needs attention</span><span class="pill ok">Clear</span></div>
        <div class="hd" style="margin-top: 12px"><Icon name="globe" /><b>Languages</b></div>
        <div class="donut" :style="{ background: donut }" role="img" :aria-label="`Agents by language: ${langCounts.map(([l, c]) => `${LANGUAGE_NAMES[l]} ${c}`).join(', ') || 'none'}`"><div style="color: #1f1f22">{{ langCounts.length }}</div></div>
        <div v-for="([l, c], i) in langCounts" :key="l" class="row"><span><i :style="{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', marginRight: '6px', background: PALETTE[i % PALETTE.length] }"></i>{{ LANGUAGE_NAMES[l] }}</span><span>{{ c }}</span></div>
      </div>

      <div class="c s8 w2">
        <div class="hd"><Icon name="chart" /><b>Calls per hour, today</b></div>
        <svg viewBox="0 0 600 150" width="100%" role="img" aria-label="Calls per hour today" @pointermove="onMove" @pointerleave="hover = null">
          <polygon :points="`0,150 ${line} 600,150`" style="fill: color-mix(in srgb, var(--yel) 35%, transparent)" />
          <polyline :points="line" fill="none" stroke="var(--yel)" stroke-width="3" stroke-linejoin="round" />
          <template v-if="hover"><line :x1="hover.x" :x2="hover.x" y1="0" y2="150" stroke="currentColor" stroke-dasharray="3 4" opacity=".6" /><text :x="Math.min(hover.x + 6, 470)" y="14" font-size="12" fill="currentColor">{{ hover.text }}</text></template>
        </svg>
      </div>
      <div class="c s4 w2">
        <div class="hd"><Icon name="note" /><b>Coaching log</b></div>
        <div v-for="(c, i) in coaching.data.value ?? []" :key="i" class="row"><span>{{ c.text }}</span><small>{{ shortDate(c.at) }}</small></div>
        <p v-if="coaching.data.value && !coaching.data.value.length" style="color: var(--mut); margin: 4px 0">Nothing yet. Send a prompt or listen in.</p>
      </div>
      <div v-if="wall.data.value.calls.length" class="c s12 w2">
        <div class="hd"><Icon name="phone" /><b>Calls in progress</b></div>
        <div class="scroll"><table class="rt"><thead><tr><th>Agent</th><th>Caller</th><th>Duration</th></tr></thead>
          <tbody><tr v-for="c in wall.data.value.calls" :key="c.id"><td data-label="Agent">{{ c.agentName }}</td><td data-label="Caller">{{ show(c.caller) }}</td><td data-label="Duration">{{ clock(c.seconds) }}</td></tr></tbody></table></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.agc { cursor: pointer; }
.agc.sel { outline: 2px solid var(--yel); }
.agc .ft button { width: 34px; height: 34px; min-width: 0; padding: 0; }
.agc .ft button:disabled { opacity: 0.35; cursor: default; }
</style>
