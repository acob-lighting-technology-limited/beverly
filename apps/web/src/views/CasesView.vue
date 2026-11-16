<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CaseState, PresenceRow, SupportCase } from '@beverly-call/shared'
import Icon from '@/components/Icon.vue'
import PageHeader from '@/components/PageHeader.vue'
import Pill from '@/components/Pill.vue'
import KpiTile from '@/components/KpiTile.vue'
import StateBanner from '@/components/StateBanner.vue'
import FilterPopover, { type FilterGroup } from '@/components/FilterPopover.vue'
import { api } from '@/lib/api'
import { useResource } from '@/lib/use-resource'
import { slaLabel } from '@/lib/sla'
import { pad2 } from '@/lib/format'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'

type Filter = 'all' | 'mine' | 'over' | 'done'
const tone: Record<CaseState, string> = { Overdue: 'bad', Working: 'ye', New: 'vi', Done: 'ok' }
const session = useSession()
const toast = useToast()
const isLead = computed(() => session.role === 'supervisor' || session.role === 'admin')

// Agents see the cases they hold; supervisors see all of them.
const res = useResource(() => api<SupportCase[]>(isLead.value ? '/cases' : '/cases/mine'))
const roster = useResource(async () => (isLead.value ? await api<PresenceRow[]>('/presence') : []))
const selId = ref<string | null>(null)
const filter = ref<Filter>('all')
const q = ref('')
const extra = ref<Record<string, string[]>>({})
const note = ref('')
const comment = ref('')
const busy = ref(false)

const cases = computed(() => res.data.value ?? [])
const sel = computed(() => cases.value.find((c) => c.id === selId.value) ?? cases.value.find((c) => c.state !== 'Done') ?? null)
const open = computed(() => cases.value.filter((c) => c.state !== 'Done').length)
const overdue = computed(() => cases.value.filter((c) => c.state === 'Overdue').length)
const fixed = computed(() => cases.value.filter((c) => c.state === 'Done').length)
const groups = computed<FilterGroup[]>(() => [{ key: 'issue', label: 'Issue', options: [...new Set(cases.value.map((c) => c.issue))] }, { key: 'state', label: 'State', options: ['New', 'Working', 'Overdue', 'Done'] }])
const visible = computed(() => cases.value.filter((c) =>
  (filter.value === 'all' || (filter.value === 'mine' && c.agentId === session.user?.id) || (filter.value === 'over' && c.state === 'Overdue') || (filter.value === 'done' && c.state === 'Done')) &&
  (!q.value || `${c.id} ${c.issue} ${c.customer} ${c.by}`.toLowerCase().includes(q.value.toLowerCase())) &&
  (!extra.value.issue?.length || extra.value.issue.includes(c.issue)) && (!extra.value.state?.length || extra.value.state.includes(c.state))))
const ring = computed(() => {
  const c = sel.value
  if (!c) return { pct: 0, text: '' }
  if (c.state === 'Done') return { pct: 100, text: 'Done' }
  return { pct: c.slaMinutes < 0 ? 100 : Math.max(0, Math.min(100, (c.slaMinutes / 60) * 100)), text: c.slaMinutes < 0 ? `-${-c.slaMinutes}m` : `${c.slaMinutes}m` }
})
const canAct = computed(() => !!sel.value && sel.value.state !== 'Done' && (isLead.value || sel.value.agentId === session.user?.id))

function patch(updated: SupportCase): void {
  const i = cases.value.findIndex((c) => c.id === updated.id)
  if (i > -1 && res.data.value) res.data.value[i] = updated
}
async function addComment(): Promise<void> {
  if (!sel.value || !comment.value.trim()) return
  busy.value = true
  try { patch(await api<SupportCase>(`/cases/${sel.value.id}/comments`, { method: 'POST', body: JSON.stringify({ text: comment.value.trim() }) })); comment.value = '' }
  catch { toast.show('Could not add the comment') } finally { busy.value = false }
}
async function resolve(): Promise<void> {
  if (!sel.value) return
  if (!note.value.trim()) { toast.show('Add what fixed it first'); return }
  busy.value = true
  try { patch(await api<SupportCase>(`/cases/${sel.value.id}/resolve`, { method: 'POST', body: JSON.stringify({ note: note.value.trim() }) })); note.value = ''; toast.show(`${sel.value.id} resolved. The customer is told by SMS.`) }
  catch { toast.show('Could not resolve this case') } finally { busy.value = false }
}
async function assign(agentId: string): Promise<void> {
  if (!sel.value || !agentId) return
  try { patch(await api<SupportCase>(`/cases/${sel.value.id}/assign`, { method: 'POST', body: JSON.stringify({ agentId }) })); toast.show('Case reassigned') }
  catch { toast.show('Could not reassign this case') }
}
</script>

<template>
  <section>
    <PageHeader :title="isLead ? 'Escalations' : 'My cases'">
      <div v-hover-scroll class="kp"><KpiTile icon="flag" :value="pad2(open)" label="Open" :metric="isLead ? 'open_cases' : undefined" /><KpiTile icon="clock" :value="pad2(overdue)" label="Overdue" dark :metric="isLead ? 'overdue_cases' : undefined" /><KpiTile icon="check" :value="pad2(fixed)" label="Fixed" /></div>
    </PageHeader>
    <StateBanner :loading="res.loading.value && !res.data.value" :error="res.error.value" what="cases" />
    <div v-if="res.data.value" class="bento">
      <div class="c s8 w2">
        <div class="dtb"><label class="sch"><Icon name="x-srch" /><input v-model="q" type="search" aria-label="Search cases" placeholder="Search cases" /></label>
          <span class="n" aria-live="polite">{{ visible.length }} results</span><FilterPopover v-model="extra" :groups="groups" /></div>
        <div class="ss" style="max-width: 420px">
          <button v-for="f in (['all', 'mine', 'over', 'done'] as Filter[])" :key="f" :class="{ on: filter === f }" @click="filter = f">{{ { all: 'All', mine: 'Mine', over: 'Overdue', done: 'Done' }[f] }}</button></div>
        <div class="scroll"><table class="rt"><thead><tr><th>Case</th><th>Issue</th><th>By</th><th>SLA</th><th>State</th></tr></thead>
          <tbody>
            <tr v-for="c in visible" :key="c.id" tabindex="0" :class="{ sel: c.id === sel?.id }" @click="selId = c.id" @keydown.enter="selId = c.id">
              <td data-label="Case">{{ c.id }}</td><td data-label="Issue">{{ c.issue }}</td><td data-label="By">{{ c.by }}</td>
              <td data-label="SLA"><Pill :tone="slaLabel(c.slaMinutes, c.state === 'Done').tone">{{ slaLabel(c.slaMinutes, c.state === 'Done').text }}</Pill></td>
              <td data-label="State"><Pill :tone="tone[c.state]">{{ c.state }}</Pill></td></tr>
          </tbody></table></div>
        <div v-if="!visible.length" class="ban" style="background: var(--ok); color: var(--okt); margin-top: 8px"><Icon name="check" />{{ cases.length ? 'No cases match.' : 'No escalations here. Nice work.' }}</div>
      </div>

      <div v-if="sel" class="c dk s4 w2 stick">
        <div class="hd"><Icon name="flag" /><b>{{ sel.id }}</b><span class="pill" :class="tone[sel.state]">{{ sel.state }}</span></div>
        <div class="rg" role="img" aria-label="Time left on deadline" :style="{ background: `conic-gradient(${sel.state === 'Overdue' ? '#E5483B' : 'var(--yel)'} 0 ${ring.pct}%, rgba(120,120,130,.3) ${ring.pct}%)` }"><div>{{ ring.text }}</div></div>
        <div class="row"><span>Customer</span><span>{{ sel.customer }}</span></div>
        <div v-if="sel.amount" class="row"><span>Amount</span><span>NGN {{ sel.amount.toLocaleString('en-US') }}</span></div>
        <div class="row"><span>Issue</span><span>{{ sel.issue }}</span></div>
        <label v-if="isLead && sel.state !== 'Done'" class="fl" style="color: #bbb">Assigned to
          <select aria-label="Assign case" :value="sel.agentId ?? ''" @change="assign(($event.target as HTMLSelectElement).value)"><option value="" disabled>Choose an agent</option>
            <option v-for="a in roster.data.value ?? []" :key="a.agentId" :value="a.agentId">{{ a.name }}</option></select></label>
        <div v-else class="row"><span>Held by</span><span>{{ sel.by }}</span></div>
        <div style="margin-top: 8px"><div v-for="(m, i) in sel.comments" :key="i" class="cm"><b>{{ m.by }}</b><span>{{ m.text }}</span><small>{{ m.at }}</small></div>
          <small v-if="!sel.comments.length" style="color: #aaa">No comments yet</small></div>
        <template v-if="canAct">
          <div style="display: flex; gap: 6px; margin-top: 8px"><input v-model="comment" aria-label="Comment" placeholder="Add a comment" maxlength="1000" @keydown.enter.prevent="addComment" /><button class="y" aria-label="Add comment" :disabled="busy" @click="addComment"><Icon name="send" /></button></div>
          <textarea v-model="note" rows="2" aria-label="Resolution note" placeholder="What fixed it?" maxlength="1000" style="margin-top: 8px"></textarea>
          <div class="btns"><button aria-label="Resolve" title="Resolve and text the customer" :disabled="busy" @click="resolve"><Icon name="check" /></button></div>
        </template>
        <p v-else-if="sel.state !== 'Done'" style="color: #aaa; font-size: 12px">Only the agent holding this case, or a supervisor, can change it.</p>
      </div>
    </div>
  </section>
</template>
