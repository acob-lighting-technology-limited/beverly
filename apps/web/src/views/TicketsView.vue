<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SupportPriority, SupportStats, SupportStatus, SupportTicket, SupportTicketDetail } from '@beverly-call/shared'
import Icon from '@/components/Icon.vue'
import KpiTile from '@/components/KpiTile.vue'
import StateBanner from '@/components/StateBanner.vue'
import { api } from '@/lib/api'
import { useResource } from '@/lib/use-resource'
import { pad2, shortDate } from '@/lib/format'
import { humanStatus, supportPriorityTone, supportStatusTone } from '@/lib/status'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'

const session = useSession()
const toast = useToast()

const STATUSES: SupportStatus[] = ['open', 'pending', 'awaiting_customer', 'resolved', 'closed']
const PRIORITIES: SupportPriority[] = ['low', 'normal', 'high', 'urgent']

const status = ref<SupportStatus | ''>('')
const mine = ref(false)
const q = ref('')
let timer = 0
const tickets = useResource(() => api<SupportTicket[]>(`/support/tickets?${new URLSearchParams({ ...(status.value ? { status: status.value } : {}), ...(q.value.trim() ? { search: q.value.trim() } : {}), ...(mine.value ? { mine: '1' } : {}) })}`))
const stats = useResource(() => api<SupportStats>('/support/stats'))
watch([status, mine], () => void tickets.reload())
function onSearch(): void { clearTimeout(timer); timer = window.setTimeout(() => void tickets.reload(), 300) }

/* ---- one open ticket with its conversation ---- */
const open = ref<SupportTicketDetail | null>(null)
const loadingOpen = ref(false)
const reply = ref('')
const internal = ref(false)
const busy = ref(false)
const bottom = ref<HTMLElement | null>(null)

async function show(t: SupportTicket): Promise<void> {
  loadingOpen.value = true
  try { open.value = await api<SupportTicketDetail>(`/support/tickets/${t.id}`) }
  catch { toast.show('Could not open that ticket'); open.value = null }
  finally { loadingOpen.value = false }
}
function applyDetail(d: SupportTicketDetail): void {
  open.value = d
  const i = tickets.data.value?.findIndex((x) => x.id === d.id) ?? -1
  if (i > -1 && tickets.data.value) { const { messages: _m, ...rest } = d; tickets.data.value[i] = rest }
  void stats.reload()
}
async function change(patch: Record<string, unknown>, done: string): Promise<void> {
  if (!open.value) return
  busy.value = true
  try { applyDetail(await api<SupportTicketDetail>(`/support/tickets/${open.value.id}`, { method: 'PATCH', body: JSON.stringify(patch) })); toast.show(done) }
  catch { toast.show('Beverly did not accept that change') } finally { busy.value = false }
}
async function send(): Promise<void> {
  if (!open.value || !reply.value.trim()) return
  busy.value = true
  try {
    applyDetail(await api<SupportTicketDetail>(`/support/tickets/${open.value.id}/messages`, { method: 'POST', body: JSON.stringify({ body: reply.value.trim(), internal: internal.value }) }))
    toast.show(internal.value ? 'Internal note added' : 'Reply sent to the customer'); reply.value = ''; internal.value = false
    setTimeout(() => bottom.value?.scrollIntoView({ block: 'end' }), 0)
  } catch { toast.show('Could not send that message') } finally { busy.value = false }
}
const assignedToMe = computed(() => !!open.value?.assignedTo && open.value.assignedTo === session.user?.id)
const closed = computed(() => open.value?.status === 'closed')
</script>

<template>
  <section>
    <div class="head"><div class="ht"><h1>Support tickets</h1></div>
      <div v-if="stats.data.value" v-hover-scroll class="kp">
        <KpiTile icon="flag" :value="pad2(stats.data.value.open)" label="Open" />
        <KpiTile icon="clock" :value="pad2(stats.data.value.pending)" label="Pending" dark />
        <KpiTile icon="users" :value="pad2(stats.data.value.awaiting_customer)" label="Awaiting customer" />
        <KpiTile icon="check" :value="pad2(stats.data.value.resolved)" label="Resolved" dark />
      </div>
    </div>
    <div class="bento">
      <div class="c s7 w2">
        <div class="dtb"><label class="sch"><Icon name="x-srch" /><input v-model="q" type="search" aria-label="Search tickets" placeholder="Search by subject or reference" @input="onSearch" /></label>
          <span class="n" aria-live="polite">{{ tickets.data.value?.length ?? 0 }} tickets</span></div>
        <div v-hover-scroll class="chs" role="group" aria-label="Status">
          <button :class="{ on: status === '' && !mine }" @click="status = ''; mine = false">All</button>
          <button :class="{ on: mine }" @click="mine = !mine">Mine</button>
          <button v-for="s in STATUSES" :key="s" :class="{ on: status === s }" @click="status = status === s ? '' : s">{{ humanStatus(s) }}</button>
        </div>
        <StateBanner :loading="tickets.loading.value && !tickets.data.value" :error="tickets.error.value" what="tickets" />
        <div v-if="tickets.data.value" class="scroll"><table class="rt"><thead><tr><th>Ticket</th><th>Subject</th><th>From</th><th>Priority</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>
            <tr v-for="t in tickets.data.value" :key="t.id" tabindex="0" :class="{ sel: t.id === open?.id }" @click="show(t)" @keydown.enter="show(t)">
              <td data-label="Ticket">{{ t.reference }}</td><td data-label="Subject" style="white-space: normal">{{ t.subject }}</td><td data-label="From">{{ t.requesterName }}</td>
              <td data-label="Priority"><span class="pill" :class="supportPriorityTone(t.priority)">{{ humanStatus(t.priority) }}</span></td>
              <td data-label="Status"><span class="pill" :class="supportStatusTone(t.status)">{{ humanStatus(t.status) }}</span></td>
              <td data-label="Updated">{{ t.lastMessageAt ? shortDate(t.lastMessageAt) : '' }}</td></tr>
            <tr v-if="!tickets.data.value.length"><td colspan="6" style="color: var(--mut)">No tickets match.</td></tr>
          </tbody></table></div>
      </div>

      <div v-if="open || loadingOpen" class="c dk s5 w2 stick">
        <p v-if="loadingOpen" style="color: #bbb">Opening…</p>
        <template v-else-if="open">
          <div class="hd"><Icon name="flag" /><b>{{ open.reference }}</b><span class="pill" :class="supportStatusTone(open.status)">{{ humanStatus(open.status) }}</span></div>
          <div style="font-size: 15px; margin: 2px 0 6px">{{ open.subject }}</div>
          <div class="row"><span>From</span><span>{{ open.requesterName }} ({{ open.requesterType }})</span></div>
          <div class="row"><span>Category</span><span>{{ humanStatus(open.category) }}</span></div>
          <div v-if="open.meterContext" class="row"><span>Meter</span><span>{{ open.meterContext }}</span></div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px">
            <label class="fl" style="color: #bbb">Status<select :value="open.status" :disabled="busy" aria-label="Status" @change="change({ status: ($event.target as HTMLSelectElement).value }, 'Status updated')"><option v-for="s in STATUSES" :key="s" :value="s">{{ humanStatus(s) }}</option></select></label>
            <label class="fl" style="color: #bbb">Priority<select :value="open.priority" :disabled="busy" aria-label="Priority" @change="change({ priority: ($event.target as HTMLSelectElement).value }, 'Priority updated')"><option v-for="p in PRIORITIES" :key="p" :value="p">{{ humanStatus(p) }}</option></select></label>
          </div>
          <div class="btns">
            <button v-if="!assignedToMe" class="y" :disabled="busy" @click="change({ assignToMe: true }, 'Assigned to you')">Take it</button>
            <button v-else :disabled="busy" @click="change({ unassign: true }, 'Released')">Release</button>
          </div>
          <div style="margin-top: 10px; max-height: 300px; overflow: auto" aria-live="polite">
            <div v-for="m in open.messages" :key="m.id" class="cm"><b>{{ m.sender }}<span v-if="m.internal" class="pill ye" style="margin-left: 6px">Internal</span></b><span>{{ m.body }}</span><small>{{ shortDate(m.at) }}</small></div>
            <div ref="bottom"></div>
          </div>
          <template v-if="!closed">
            <textarea v-model="reply" rows="3" maxlength="4000" aria-label="Message" :placeholder="internal ? 'Internal note for the team' : 'Reply to the customer'" style="margin-top: 8px"></textarea>
            <label class="sw" style="color: #ddd"><span>Internal note (the customer will not see it)</span><input v-model="internal" type="checkbox" /></label>
            <div class="btns"><button class="y" aria-label="Send message" :disabled="busy || !reply.trim()" @click="send"><Icon name="send" /></button></div>
          </template>
          <p v-else style="color: #bbb">This ticket is closed.</p>
        </template>
      </div>
    </div>
  </section>
</template>
