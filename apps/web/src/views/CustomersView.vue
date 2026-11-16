<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Customer, CustomerDetail, CustomerFull } from '@beverly-call/shared'
import Icon from '@/components/Icon.vue'
import KpiTile from '@/components/KpiTile.vue'
import Modal from '@/components/Modal.vue'
import StateBanner from '@/components/StateBanner.vue'
import FilterPopover, { type FilterGroup } from '@/components/FilterPopover.vue'
import ViewToggle, { type ViewMode } from '@/components/ViewToggle.vue'
import { api } from '@/lib/api'
import { maskPhone } from '@/lib/mask'
import { shortDate, pad2 } from '@/lib/format'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'
import { useSession } from '@/stores/session'

const settings = useSettings()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const session = useSession()

/* ---- directory ---- */
const q = ref('')
const list = ref<Customer[]>([])
const loading = ref(true)
const error = ref('')
const chip = ref<'all' | 'prepaid' | 'postpaid' | 'low'>('all')
const extra = ref<Record<string, string[]>>({})
const VIEW_KEY = 'bc.cust.view'
const view = ref<ViewMode>((() => { try { return (localStorage.getItem(VIEW_KEY) as ViewMode) || 'cards' } catch { return 'cards' } })())
const setView = (v: ViewMode): void => { view.value = v; try { localStorage.setItem(VIEW_KEY, v) } catch { /* storage blocked */ } }
let timer = 0

async function search(): Promise<void> {
  loading.value = true; error.value = ''
  try { list.value = await api<Customer[]>(`/customers?q=${encodeURIComponent(q.value.trim())}`) }
  catch (e) { error.value = e instanceof Error ? e.message : 'Lookup failed.' }
  finally { loading.value = false }
}
function onInput(): void { clearTimeout(timer); timer = window.setTimeout(search, 300) }

const LOW = 1500
const isLow = (c: Customer): boolean => c.balance !== null && c.balance < LOW
const groups = computed<FilterGroup[]>(() => [
  { key: 'area', label: 'Area', options: [...new Set(list.value.map((c) => c.area).filter(Boolean))].sort() },
  { key: 'type', label: 'Account type', options: ['Prepaid', 'Postpaid'] },
])
const shown = computed(() => list.value.filter((c) =>
  (chip.value === 'all' || (chip.value === 'prepaid' && c.balance !== null) || (chip.value === 'postpaid' && c.balance === null) || (chip.value === 'low' && isLow(c))) &&
  (!extra.value.area?.length || extra.value.area.includes(c.area)) &&
  (!extra.value.type?.length || extra.value.type.includes(c.balance === null ? 'Postpaid' : 'Prepaid'))))
const lowCount = computed(() => list.value.filter(isLow).length)
const show = (p: string) => (settings.p.mask ? maskPhone(p) : p)
const initials = (n: string) => n.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
const money = (n: number | null) => (n === null ? 'Bill account' : `NGN ${n.toLocaleString('en-US')}`)

/* ---- detail ---- */
const sel = ref<Customer | null>(null)
const detail = ref<CustomerDetail | null>(null)
const full = ref<CustomerFull | null>(null)
const detailError = ref('')

async function open(c: Customer): Promise<void> {
  sel.value = c; detail.value = null; full.value = null; detailError.value = ''
  if (route.query.open !== c.id) void router.replace({ path: '/cust', query: { open: c.id } })
  const id = encodeURIComponent(c.id)
  const [d, f] = await Promise.allSettled([api<CustomerDetail>(`/customers/${id}/detail`), api<CustomerFull>(`/customers/${id}/full`)])
  if (d.status === 'fulfilled') detail.value = d.value; else detailError.value = 'Purchase history could not be loaded.'
  if (f.status === 'fulfilled') full.value = f.value
}
function back(): void { sel.value = null; void router.replace({ path: '/cust' }) }
async function openById(id: string): Promise<void> {
  const known = list.value.find((c) => c.id === id)
  if (known) return open(known)
  try { const r = await api<Customer[]>(`/customers?q=${encodeURIComponent(id)}`); const hit = r.find((c) => c.id === id) ?? r[0]; if (hit) await open(hit) } catch { /* directory still usable */ }
}
onMounted(async () => { await search(); if (typeof route.query.open === 'string') await openById(route.query.open) })
watch(() => route.query.open, (id) => { if (typeof id === 'string' && sel.value?.id !== id) void openById(id); if (!id) sel.value = null })

const lastContacted = computed(() => (full.value?.lastContacted ? shortDate(full.value.lastContacted) : 'No contact yet'))
const jump = (id: string): void => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
const STAGES = computed(() => [['Reported', full.value?.stages.reported ?? 0, 100], ['Escalated', full.value?.stages.escalated ?? 0, 82], ['Working', full.value?.stages.working ?? 0, 64], ['Fixed', full.value?.stages.fixed ?? 0, 46]] as const)
const canSms = computed(() => !!sel.value)

/* ---- actions ---- */
async function copy(t: string): Promise<void> { try { await navigator.clipboard.writeText(t); toast.show('Copied') } catch { toast.show('Copy is blocked in this browser') } }
const smsOpen = ref(false); const sms = ref('')
const noteOpen = ref(false); const note = ref('')
async function sendSms(): Promise<void> {
  if (!sel.value || !sms.value.trim()) return
  try { const r = await api<{ result: string }>('/customers/sms', { method: 'POST', body: JSON.stringify({ phone: sel.value.phone, text: sms.value.trim(), customerRef: sel.value.id }) }); toast.show(r.result === 'sent' ? 'SMS sent' : 'SMS not sent: the carrier is not configured'); smsOpen.value = false; sms.value = '' }
  catch { toast.show('SMS failed') }
}
async function saveNote(): Promise<void> {
  if (!sel.value || !note.value.trim()) return
  try { await api(`/customers/${encodeURIComponent(sel.value.id)}/notes`, { method: 'POST', body: JSON.stringify({ text: note.value.trim() }) }); toast.show('Note saved'); noteOpen.value = false; note.value = ''; full.value = await api<CustomerFull>(`/customers/${encodeURIComponent(sel.value.id)}/full`) }
  catch { toast.show('Could not save the note') }
}
async function book(): Promise<void> {
  if (!sel.value) return
  try { await api('/callbacks', { method: 'POST', body: JSON.stringify({ phone: sel.value.phone, customerRef: sel.value.id, reason: 'Scheduled from the customer page', minutes: 30 }) }); toast.show('Callback booked for 30 minutes'); full.value = await api<CustomerFull>(`/customers/${encodeURIComponent(sel.value.id)}/full`) }
  catch { toast.show('Could not book the callback') }
}
const canCall = computed(() => session.role === 'agent' || session.role === 'supervisor')
</script>

<template>
  <section>
    <!-- Directory -->
    <div v-if="!sel">
      <div class="head"><div class="ht"><h1>Customers</h1></div>
        <div v-hover-scroll class="kp"><KpiTile icon="users" :value="pad2(list.length)" label="Customers" /><KpiTile icon="wallet" :value="pad2(lowCount)" label="Low wallet" dark /></div></div>
      <div class="cdh">
        <label class="sch"><Icon name="users" /><input v-model="q" type="search" aria-label="Search customers" placeholder="Search by name, meter or phone" @input="onInput" /></label>
        <FilterPopover v-model="extra" :groups="groups" /><ViewToggle :model-value="view" @update:model-value="setView" />
      </div>
      <div v-hover-scroll class="chs" role="group" aria-label="Quick filters">
        <button v-for="c in ([['all', 'All'], ['prepaid', 'Prepaid'], ['postpaid', 'Postpaid'], ['low', 'Low wallet']] as const)" :key="c[0]" :class="{ on: chip === c[0] }" @click="chip = c[0]">{{ c[1] }}</button></div>
      <div class="cnt" aria-live="polite" style="margin: 8px 2px">{{ shown.length }} of {{ list.length }} customers</div>
      <StateBanner :loading="loading" :error="error" what="customers" />
      <div v-if="!loading && !error && !shown.length" class="ban">No customer found. Try a meter number, phone or name.</div>
      <div v-if="view === 'cards'" class="cgrid">
        <button v-for="c in shown" :key="c.id" class="cc2" :aria-label="`Open ${c.name}`" @click="open(c)">
          <span class="cav" style="background: var(--yel)">{{ initials(c.name) }}</span><b>{{ c.name }}</b>
          <span class="wl"><em>{{ money(c.balance) }}</em><small>{{ c.balance === null ? 'Postpaid' : 'Wallet' }}</small></span>
          <small>{{ c.area }} · {{ show(c.phone) }}</small>
          <span class="ft"><span v-if="isLow(c)" class="pill ye">Low wallet</span><span v-else class="pill vi">All good</span></span></button>
      </div>
      <div v-else class="c"><div class="scroll"><table class="rt cust-t"><thead><tr><th>Customer</th><th>Meter</th><th>Phone</th><th>Area</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody><tr v-for="c in shown" :key="c.id" tabindex="0" @click="open(c)" @keydown.enter="open(c)">
          <td data-label="Customer"><span class="nmc"><span class="cav" style="background: var(--yel)">{{ initials(c.name) }}</span>{{ c.name }}</span></td><td data-label="Meter">{{ c.meter }}</td><td data-label="Phone">{{ show(c.phone) }}</td>
          <td data-label="Area">{{ c.area }}</td><td data-label="Balance">{{ money(c.balance) }}</td><td data-label="Status"><span class="pill" :class="isLow(c) ? 'ye' : 'vi'">{{ isLow(c) ? 'Low wallet' : 'All good' }}</span></td></tr></tbody></table></div></div>
    </div>

    <!-- Detail -->
    <div v-else>
      <div class="head"><div class="ht"><button class="ib" aria-label="Back to all customers" @click="back"><Icon name="lft" /></button><h1>{{ sel.name }}</h1></div>
        <div v-hover-scroll class="kp"><KpiTile icon="bolt" :value="pad2(detail?.purchases.length ?? 0)" label="Recent vends" /><KpiTile icon="flag" :value="pad2(full?.stages.reported ?? 0)" label="Cases" dark /><KpiTile icon="clock" :value="pad2(full?.callbacks.length ?? 0)" label="Callbacks" /></div></div>
      <div class="bento"><div class="hero">
        <div class="pc"><div class="pa">{{ initials(sel.name) }}</div><b style="font-weight: 400; font-size: 18px">{{ sel.name }}</b><div style="color: var(--mut)">{{ sel.accountType }}, {{ sel.area }}</div>
          <div class="ia"><button v-if="canCall" aria-label="Schedule callback" title="Book a callback" @click="book"><Icon name="clock" /></button>
            <button aria-label="SMS" title="Send SMS" :disabled="!canSms" @click="smsOpen = true"><Icon name="mail" /></button>
            <button aria-label="Add note" title="Add note" @click="noteOpen = true"><Icon name="plus" /></button></div></div>
        <div class="dr">
          <div><Icon name="bolt" /><div class="tx"><small>Meter number</small><b>{{ sel.meter }}</b></div><button aria-label="Copy meter" @click="copy(sel.meter)"><Icon name="copy" /></button></div>
          <div><Icon name="phone" /><div class="tx"><small>Phone</small><b>{{ show(sel.phone) }}</b></div><button aria-label="Copy phone" @click="copy(sel.phone)"><Icon name="copy" /></button></div>
          <div><Icon name="wallet" /><div class="tx"><small>{{ sel.balance === null ? 'Account type' : 'Wallet balance' }}</small><b>{{ money(sel.balance) }}</b></div></div>
          <div><Icon name="clock" /><div class="tx"><small>Last contacted</small><b>{{ lastContacted }}</b></div></div></div>
      </div>
      <div v-hover-scroll class="jm" role="navigation" aria-label="Jump to section">
        <button @click="jump('sx-h')">History</button><button @click="jump('sx-t')">Cases</button><button @click="jump('sx-l')">Timeline</button><button @click="jump('sx-n')">Notes</button><button @click="jump('sx-c')">Callbacks</button></div>

      <StateBanner :loading="!detail && !detailError && !full" :error="detailError" what="history" />
      <div class="col s8 w2">
        <div id="sx-h" class="c fr"><div class="hd"><Icon name="wallet" /><b>Recent purchases</b></div>
          <div v-for="p in detail?.purchases ?? []" :key="p.id" class="row"><span>{{ shortDate(p.at) }} · NGN {{ p.amount.toLocaleString('en-US') }}<small style="display: block; color: var(--mut)">{{ p.tokenMasked }}</small></span><span class="pill" :class="p.status === 'success' || p.status === 'completed' ? 'ok' : 'ye'">{{ p.status }}</span></div>
          <p v-if="detail && !detail.purchases.length" style="color: var(--mut)">No purchases found.</p></div>
        <div id="sx-l" class="c fr"><div class="hd"><Icon name="clock" /><b>Timeline</b></div>
          <div v-for="(e, i) in full?.timeline ?? []" :key="i" class="row"><span>{{ shortDate(e.at) }} {{ e.text }}</span><span class="pill" :class="e.tone">{{ e.kind }}</span></div>
          <p v-if="full && !full.timeline.length" style="color: var(--mut)">Nothing recorded for this customer yet.</p></div>
      </div>
      <div class="col s4 w2">
        <div id="sx-t" class="c fr"><div class="hd"><Icon name="chart" /><b>Case stages</b></div>
          <div class="fn"><div v-for="s in STAGES" :key="s[0]" :style="{ width: `${s[2]}%` }"><span>{{ s[0] }}</span><b>{{ s[1] }}</b></div></div>
          <div v-for="t in detail?.tickets ?? []" :key="t.ref" class="row"><span>{{ t.ref }}<small style="display: block; color: var(--mut)">{{ t.category }}</small></span><span class="pill" :class="t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'ok' : 'bad'">{{ t.status.toLowerCase() }}</span></div></div>
        <div id="sx-n" class="c fr"><div class="hd"><Icon name="note" /><b>Notes</b></div>
          <div v-for="(n, i) in full?.notes ?? []" :key="i" class="cm"><b>{{ n.by }}</b><span>{{ n.text }}</span><small>{{ shortDate(n.at) }}</small></div>
          <p v-if="full && !full.notes.length" style="color: var(--mut)">No notes yet.</p></div>
        <div id="sx-c" class="c fr"><div class="hd"><Icon name="clock" /><b>Callbacks</b></div>
          <div v-for="b in full?.callbacks ?? []" :key="b.id" class="row"><span>{{ shortDate(b.scheduledFor) }}</span><span class="pill vi">{{ b.status }}</span></div>
          <p v-if="full && !full.callbacks.length" style="color: var(--mut)">No callbacks.</p></div>
      </div></div>
    </div>

    <Modal :open="smsOpen" title="Text the customer" @close="smsOpen = false">
      <p style="color: var(--mut); margin: 0">To {{ sel ? show(sel.phone) : '' }}</p>
      <textarea v-model="sms" rows="3" maxlength="320" placeholder="Type a message" data-autofocus></textarea>
      <template #footer><button @click="smsOpen = false">Cancel</button><button class="y" @click="sendSms">Send</button></template>
    </Modal>
    <Modal :open="noteOpen" title="Add a note" @close="noteOpen = false">
      <textarea v-model="note" rows="3" maxlength="1000" placeholder="What should the next agent know?" data-autofocus></textarea>
      <template #footer><button @click="noteOpen = false">Cancel</button><button class="y" @click="saveNote">Save note</button></template>
    </Modal>
  </section>
</template>
