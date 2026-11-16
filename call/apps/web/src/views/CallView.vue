<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { ActiveCall, CustomerDetail } from '@beverly-call/shared'
import Icon from '@/components/Icon.vue'
import Modal from '@/components/Modal.vue'
import CallDesk from '@/components/CallDesk.vue'
import { api } from '@/lib/api'
import { clock, shortDate } from '@/lib/format'
import { maskPhone } from '@/lib/mask'
import { playDtmf } from '@/lib/tones'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'
import { useUi } from '@/stores/ui'
import { usePresence } from '@/stores/presence'

const router = useRouter()
const settings = useSettings()
const toast = useToast()
const ui = useUi()
const presence = usePresence()

const call = ref<ActiveCall | null>(null)
const loading = ref(true)
const secs = ref(0)
const held = ref(false)
const muted = ref(false)
const popup = ref<'keypad' | 'transfer' | null>(null)
const dialled = ref('')
const colleagues = ref<{ agentId: string; name: string; languages: string[] }[]>([])
const wrapOpen = ref(false)
const outcome = ref('Resolved on the call')
const notes = ref('')
let tick = 0
let poll = 0

async function load(): Promise<void> {
  try {
    const c = await api<ActiveCall | null>('/calls/active')
    if (c && c.id !== call.value?.id) { held.value = false; muted.value = false }
    call.value = c
    if (c) secs.value = Math.max(0, Math.floor((Date.now() - Date.parse(c.startedAt)) / 1000))
  } finally { loading.value = false }
}
onMounted(() => {
  void load()
  tick = window.setInterval(() => { if (call.value) secs.value++ }, 1000)
  poll = window.setInterval(() => { if (!document.hidden && !wrapOpen.value) void load() }, 5000)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => { clearInterval(tick); clearInterval(poll); document.removeEventListener('keydown', onKey) })

const initials = computed(() => (call.value?.name ?? '').replace(/[^A-Za-z ]/g, '').split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '#')
const number = computed(() => (call.value ? (settings.p.mask ? maskPhone(call.value.number) : call.value.number) : ''))

/* ---- clickable context chips open detail modals ---- */
type Chip = 'meter' | 'wallet' | 'ticket' | 'outage' | null
const chip = ref<Chip>(null)
const detail = ref<CustomerDetail | null>(null)
const detailErr = ref('')
async function openChip(c: Exclude<Chip, null>): Promise<void> {
  chip.value = c
  if ((c === 'wallet' || c === 'ticket') && call.value?.customer && !detail.value) {
    detailErr.value = ''
    try { detail.value = await api<CustomerDetail>(`/customers/${encodeURIComponent(call.value.customer.id)}/detail`) }
    catch { detailErr.value = 'Could not load the details.' }
  }
}
const openTickets = computed(() => (detail.value?.tickets ?? []).filter((t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED'))
const chipTitle = computed(() => ({ meter: 'Meter', wallet: 'Wallet', ticket: 'Open cases', outage: 'Outage', '': '' })[chip.value ?? ''])
function openCustomer(): void { if (call.value?.customer) void router.push({ path: '/cust', query: { open: call.value.customer.id } }) }

/* ---- controls ---- */
async function togglePopup(p: 'keypad' | 'transfer'): Promise<void> {
  popup.value = popup.value === p ? null : p
  if (popup.value === 'transfer') { try { colleagues.value = await api('/presence/available') } catch { colleagues.value = [] } }
  if (popup.value === 'keypad') dialled.value = ''
}
function press(k: string): void { dialled.value += k; playDtmf(k, settings.p.sounds) }
async function transfer(agentId: string, name: string, warm: boolean): Promise<void> {
  if (!call.value) return
  try { await api(`/calls/${call.value.id}/transfer`, { method: 'POST', body: JSON.stringify({ toAgentId: agentId, warm }) }); toast.show(warm ? `Warm transfer to ${name}` : `Transferred to ${name}`); popup.value = null; await load() }
  catch { toast.show(`${name} is no longer available`); popup.value = null }
}
async function saveWrap(): Promise<void> {
  if (!call.value) return
  try {
    await api(`/calls/${call.value.id}/wrap-up`, { method: 'POST', body: JSON.stringify({ outcome: outcome.value, notes: notes.value }) })
    toast.show('Wrap-up saved'); wrapOpen.value = false; notes.value = ''; detail.value = null
    await presence.set('available'); await load()
  } catch { toast.show('Could not save the wrap-up') }
}
function onKey(e: KeyboardEvent): void {
  if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName) || e.ctrlKey || e.metaKey || e.altKey || !call.value) return
  const k = e.key.toLowerCase()
  if (k === 'm') muted.value = !muted.value
  else if (k === 'h') held.value = !held.value
  else if (k === 'k') void togglePopup('keypad')
  else if (k === 't') void togglePopup('transfer')
  else if (k === 'n') ui.openDesk('notes')
}
let touchY = 0
const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0]!.clientY }
const onTouchEnd = (e: TouchEvent) => { if (touchY - e.changedTouches[0]!.clientY > 70 && call.value) ui.openDesk('contact') }
</script>

<template>
  <section id="call" :class="{ hold: held }">
    <div class="cf" @touchstart.passive="onTouchStart" @touchend="onTouchEnd">
      <div class="ct"><span class="rec">REC</span></div>
      <div v-if="loading" class="mid"><div class="sub">Checking for your active call…</div></div>
      <div v-else-if="!call" class="mid"><div class="nm">No active call</div><div class="sub">{{ presence.status === 'available' ? 'You are available. Calls will appear here.' : 'Set yourself to Available to receive calls.' }}</div></div>
      <template v-else>
        <div class="mid">
          <div class="av" aria-hidden="true">{{ initials }}</div>
          <div class="nm">{{ call.name }}</div><div class="sub">{{ number }}</div>
          <div class="tm">{{ clock(secs) }}</div>
          <div v-if="held" id="hd2">On hold</div>
          <div v-hover-scroll class="ctx" role="group" aria-label="Caller context">
            <button v-if="call.customer" class="chipb" @click="openChip('meter')"><Icon name="bolt" />{{ call.customer.meter }}</button>
            <button v-if="call.customer" class="chipb" @click="openChip('wallet')"><Icon name="wallet" />{{ call.customer.balance === null ? 'Bill account' : `NGN ${call.customer.balance.toLocaleString('en-US')}` }}</button>
            <button v-if="call.openTickets" class="chipb w" @click="openChip('ticket')"><Icon name="flag" />{{ call.openTickets === 1 ? 'Open ticket' : `${call.openTickets} open tickets` }}</button>
            <button v-if="call.outage" class="chipb" @click="openChip('outage')"><Icon name="alert" />{{ call.outage }}</button>
          </div>
        </div>
        <div v-if="popup" class="pop on" role="dialog" :aria-label="popup === 'keypad' ? 'Keypad' : 'Transfer'">
          <template v-if="popup === 'keypad'">
            <div style="min-height: 26px; text-align: center; font-size: 22px" aria-live="polite">{{ dialled }}</div>
            <div class="kg"><button v-for="k in '123456789*0#'.split('')" :key="k" @click="press(k)">{{ k }}</button></div>
          </template>
          <template v-else>
            <div v-for="a in colleagues" :key="a.agentId" class="row"><span>{{ a.name }}<small style="display: block; color: var(--mut)">{{ a.languages.join(' ').toUpperCase() }}, free</small></span>
              <span><button :aria-label="`Warm transfer to ${a.name}, talk first`" title="Warm transfer, talk first" @click="transfer(a.agentId, a.name, true)"><Icon name="phone" /></button>
                <button :aria-label="`Transfer to ${a.name} now`" title="Transfer now" @click="transfer(a.agentId, a.name, false)"><Icon name="fwd" /></button></span></div>
            <p v-if="!colleagues.length" style="color: var(--mut); margin: 6px">No colleague is free right now.</p>
          </template>
        </div>
        <div class="ctl">
          <button aria-label="More" title="More (N for notes)" @click="ui.openDesk('contact')"><Icon name="more" /></button>
          <button aria-label="Hold" title="Hold (H)" :aria-pressed="held" @click="held = !held"><Icon name="pause" /></button>
          <button aria-label="Mute" title="Mute (M)" :aria-pressed="muted" @click="muted = !muted"><Icon name="mic" /></button>
          <button aria-label="Keypad" title="Keypad (K)" :aria-pressed="popup === 'keypad'" @click="togglePopup('keypad')"><Icon name="keys" /></button>
          <button aria-label="Transfer" title="Transfer (T)" :aria-pressed="popup === 'transfer'" @click="togglePopup('transfer')"><Icon name="fwd" /></button>
          <button class="end" aria-label="End call" title="End call" @click="wrapOpen = true"><Icon name="phone" style="transform: rotate(135deg)" /></button>
        </div>
      </template>
    </div>

    <CallDesk :call="call" @changed="load" />

    <Modal :open="chip !== null" :title="chipTitle" @close="chip = null">
      <template v-if="chip === 'meter' && call?.customer">
        <div class="row"><span>Customer</span><span>{{ call.customer.name }}</span></div>
        <div class="row"><span>Meter number</span><b style="font-weight: 400">{{ call.customer.meter }}</b></div>
        <div class="row"><span>Account</span><span>{{ call.customer.balance === null ? 'Postpaid' : 'Prepaid' }}</span></div>
        <div class="row"><span>Caller</span><span>{{ number }}</span></div>
      </template>
      <template v-else-if="chip === 'wallet' && call?.customer">
        <div class="row"><span>{{ call.customer.balance === null ? 'Account' : 'Wallet balance' }}</span><b style="font-weight: 400">{{ call.customer.balance === null ? 'Bill account' : `NGN ${call.customer.balance.toLocaleString('en-US')}` }}</b></div>
        <p v-if="detailErr" role="alert" style="color: var(--badt)">{{ detailErr }}</p>
        <div v-for="p in detail?.purchases ?? []" :key="p.id" class="row"><span>{{ shortDate(p.at) }} · NGN {{ p.amount.toLocaleString('en-US') }}<small style="display: block; color: var(--mut)">{{ p.tokenMasked }}</small></span><span class="pill" :class="p.status === 'delivered' ? 'ok' : 'ye'">{{ p.status }}</span></div>
        <p v-if="detail && !detail.purchases.length" style="color: var(--mut)">No recent purchases.</p>
      </template>
      <template v-else-if="chip === 'ticket'">
        <p v-if="detailErr" role="alert" style="color: var(--badt)">{{ detailErr }}</p>
        <div v-for="t in openTickets" :key="t.ref" class="row"><span>{{ t.ref }}<small style="display: block; color: var(--mut)">{{ t.category }} · {{ shortDate(t.createdAt) }}</small></span><span class="pill bad">{{ t.status.toLowerCase() }}</span></div>
        <p v-if="detail && !openTickets.length" style="color: var(--mut)">No open cases.</p>
      </template>
      <template v-else-if="chip === 'outage' && call"><div class="ban"><Icon name="alert" />{{ call.outage }}</div><p style="color: var(--mut)">Tell the caller when power is due back.</p></template>
      <template #footer>
        <button v-if="call?.customer && chip !== 'outage'" @click="openCustomer">Open customer</button>
        <button class="y" @click="chip = null">Close</button>
      </template>
    </Modal>

    <Modal :open="wrapOpen" title="After-call wrap-up" @close="wrapOpen = false">
      <label class="fl">Outcome<select v-model="outcome"><option>Resolved on the call</option><option>Escalated to wallet staff</option><option>Callback needed</option><option>Customer dropped</option></select></label>
      <label class="fl">Notes<textarea v-model="notes" rows="3" placeholder="What happened?" maxlength="2000"></textarea></label>
      <template #footer><button @click="wrapOpen = false">Cancel</button><button class="y" @click="saveWrap">Save</button></template>
    </Modal>
  </section>
</template>

<style scoped>
.chipb { height: auto; min-height: 30px; padding: 5px 11px; font-size: 11px; display: inline-flex; gap: 5px; align-items: center; background: var(--call-chip); color: var(--ink); border-radius: 99px; flex: none; white-space: nowrap; }
.chipb.w { background: var(--bad); color: var(--badt); }
.chipb:hover { filter: brightness(0.95); }
.chipb :deep(.i) { width: 14px; height: 14px; }
.ctx { flex-wrap: nowrap; overflow-x: auto; max-width: 100%; padding: 2px; }
</style>
