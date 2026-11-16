<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Recording } from '@beverly-call/shared'
import Icon from '@/components/Icon.vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiTile from '@/components/KpiTile.vue'
import StateBanner from '@/components/StateBanner.vue'
import { api } from '@/lib/api'
import { useResource } from '@/lib/use-resource'
import { clock, shortDate } from '@/lib/format'
import { maskPhone } from '@/lib/mask'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'

const settings = useSettings()
const toast = useToast()
const recs = useResource(() => api<Recording[]>('/recordings'))
const q = ref('')
const playing = ref<{ id: string; url: string; caller: string } | null>(null)

const rows = computed(() => (recs.data.value ?? []).filter((r) => !q.value || `${r.caller} ${r.agentId}`.toLowerCase().includes(q.value.toLowerCase())))
const held = computed(() => (recs.data.value ?? []).filter((r) => r.legalHold).length)
const show = (p: string) => (settings.p.mask ? maskPhone(p) : p)
// Decorative waveform shaped from the recording id so each one looks different.
const bars = (id: string): number[] => Array.from({ length: 28 }, (_, i) => 20 + ((id.charCodeAt(i % id.length) * (i + 3)) % 70))

async function play(r: Recording): Promise<void> {
  try { playing.value = { id: r.id, url: (await api<{ url: string }>(`/recordings/${r.id}/url`)).url, caller: r.caller } }
  catch (e) {
    playing.value = null
    const m = e instanceof Error ? e.message : ''
    toast.show(m.includes('409') ? 'This recording is still being saved. Try again shortly.' : m.includes('503') ? 'Playback is unavailable right now.' : 'Could not open this recording.')
  }
}
async function hold(r: Recording): Promise<void> {
  try { await api(`/recordings/${r.id}/hold`, { method: 'POST', body: JSON.stringify({ hold: !r.legalHold }) }); toast.show(r.legalHold ? 'Legal hold released' : 'Held for legal review'); void recs.reload() }
  catch { toast.show('Could not change the hold') }
}
</script>

<template>
  <section>
    <PageHeader title="Recordings">
      <div v-if="recs.data.value" v-hover-scroll class="kp"><KpiTile icon="db" :value="recs.data.value.length" label="Recordings" /><KpiTile icon="lock" :value="held" label="Legal hold" dark /><KpiTile icon="clock" value="90d" label="Retention" /></div></PageHeader>
    <StateBanner :loading="recs.loading.value" :error="recs.error.value" what="recordings" />
    <div v-if="recs.data.value" class="bento">
      <div class="c s7 w2">
        <div class="dtb"><label class="sch"><Icon name="x-srch" /><input v-model="q" type="search" aria-label="Search recordings" placeholder="Search by caller or agent" /></label><span class="n" aria-live="polite">{{ rows.length }} results</span></div>
        <div class="scroll"><table class="rt"><thead><tr><th>Date</th><th>Caller</th><th>Agent</th><th>Length</th><th>Expires</th><th class="act">Actions</th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id" :class="{ sel: r.id === playing?.id }">
              <td data-label="Date">{{ shortDate(r.date) }}</td><td data-label="Caller">{{ show(r.caller) }}</td><td data-label="Agent">{{ r.agentId.slice(0, 8) }}</td><td data-label="Length">{{ clock(r.seconds) }}</td>
              <td data-label="Expires"><span v-if="r.legalHold" class="pill ye">Legal hold</span><template v-else>{{ shortDate(r.expiresAt) }}</template></td>
              <td class="act"><div class="acs"><button :aria-label="`Play recording from ${show(r.caller)}`" title="Play" @click="play(r)"><Icon name="x-play" /></button>
                <button :aria-label="r.legalHold ? 'Release legal hold' : 'Hold for legal review'" :title="r.legalHold ? 'Release hold' : 'Hold for review'" @click="hold(r)"><Icon name="lock" /></button></div></td></tr>
            <tr v-if="!rows.length"><td colspan="6" style="color: var(--mut)">No recordings match.</td></tr>
          </tbody></table></div>
      </div>
      <div class="c dk s5 w2 stick">
        <div class="hd"><Icon name="play" /><b>Playback</b></div>
        <template v-if="playing">
          <div class="wave" aria-hidden="true"><i v-for="(h, i) in bars(playing.id)" :key="i" :style="{ height: `${h}%` }"></i></div>
          <audio :key="playing.id" :src="playing.url" controls autoplay preload="none" style="width: 100%"></audio>
          <p style="color: #bbb; font-size: 12px">Every play is logged. Link expires in 5 minutes.</p></template>
        <p v-else style="color: #bbb">Choose a recording to listen.</p>
      </div>
    </div>
  </section>
</template>
