<script setup lang="ts">
import { escalationPriorityLabel, humanStatus, purchaseTone } from '@/lib/status'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CASE_SLA_MINUTES, type ActiveCall, type CallNote, type CaseCategory, type CustomerDetail } from '@beverly-call/shared'
import SidePanel from '@/components/SidePanel.vue'
import Icon from '@/components/Icon.vue'
import { api } from '@/lib/api'
import { shortDate } from '@/lib/format'
import { maskPhone } from '@/lib/mask'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'
import { useUi } from '@/stores/ui'

const props = defineProps<{ call: ActiveCall | null }>()
const emit = defineEmits<{ changed: [] }>()
const ui = useUi()
const toast = useToast()
const settings = useSettings()
const router = useRouter()

const TABS = [{ id: 'contact', icon: 'user', label: 'Contact' }, { id: 'vending', icon: 'bolt', label: 'Vending' }, { id: 'notes', icon: 'note', label: 'Notes' }, { id: 'escalate', icon: 'flag', label: 'Escalate' }] as const
const phone = computed(() => (props.call ? (settings.p.mask ? maskPhone(props.call.number) : props.call.number) : ''))

/* ---- data for the open call ---- */
const detail = ref<CustomerDetail | null>(null)
const notes = ref<CallNote[]>([])
const err = ref('')
watch(() => [ui.panel, props.call?.id] as const, async ([p]) => {
  if (p !== 'desk' || !props.call) return
  err.value = ''
  const c = props.call
  const [d, n] = await Promise.allSettled([c.customer ? api<CustomerDetail>(`/customers/${encodeURIComponent(c.customer.id)}/detail`) : Promise.resolve(null), api<CallNote[]>(`/calls/${c.id}/notes`)])
  detail.value = d.status === 'fulfilled' ? d.value : null
  notes.value = n.status === 'fulfilled' ? n.value : []
  if (d.status === 'rejected') err.value = 'Purchase history could not be loaded.'
}, { immediate: true })

/* ---- Contact actions ---- */
async function copy(t: string): Promise<void> { try { await navigator.clipboard.writeText(t); toast.show('Copied') } catch { toast.show('Copy is blocked in this browser') } }
const sms = ref('')
async function sendSms(): Promise<void> {
  if (!props.call || !sms.value.trim()) return
  try { const r = await api<{ result: string }>('/customers/sms', { method: 'POST', body: JSON.stringify({ phone: props.call.number, text: sms.value.trim(), customerRef: props.call.customer?.id }) }); toast.show(r.result === 'sent' ? 'SMS sent' : 'SMS not sent: carrier not configured'); sms.value = '' }
  catch { toast.show('SMS failed') }
}
async function scheduleCallback(): Promise<void> {
  if (!props.call) return
  try { await api('/callbacks', { method: 'POST', body: JSON.stringify({ phone: props.call.number, customerRef: props.call.customer?.id, language: props.call.language, reason: 'Requested during call', minutes: 30 }) }); toast.show('Callback booked for 30 minutes'); }
  catch { toast.show('Could not book the callback') }
}

/* ---- Vending: three checks and a reason before the token is released ---- */
const checks = ref({ name: false, meter: false, lastVend: false })
const reason = ref('')
const purchaseId = ref('')
const token = ref('')
const REASONS = ['Customer asked for the token', 'Resend failed', 'Verified by supervisor'] as const
const ready = computed(() => checks.value.name && checks.value.meter && checks.value.lastVend && !!reason.value && !!purchaseId.value)
watch(() => props.call?.id, () => { checks.value = { name: false, meter: false, lastVend: false }; reason.value = ''; purchaseId.value = ''; token.value = '' })
watch(ready, (r) => { if (!r) token.value = '' })
async function reveal(): Promise<void> {
  if (!ready.value || !props.call?.customer) return
  try { token.value = (await api<{ token: string }>(`/customers/${encodeURIComponent(props.call.customer.id)}/token-reveal`, { method: 'POST', body: JSON.stringify({ purchaseId: purchaseId.value, verified: { name: true, meter: true, lastVend: true }, reason: reason.value }) })).token; toast.show('Reveal logged') }
  catch { toast.show('Could not release the token') }
}

/* ---- Notes ---- */
const note = ref('')
async function addNote(): Promise<void> {
  if (!props.call || !note.value.trim()) return
  await api(`/calls/${props.call.id}/notes`, { method: 'POST', body: JSON.stringify({ text: note.value.trim() }) })
  note.value = ''; notes.value = await api<CallNote[]>(`/calls/${props.call.id}/notes`)
}
async function draft(): Promise<void> { if (props.call) note.value = (await api<{ text: string }>(`/calls/${props.call.id}/summary`)).text }

/* ---- Escalate ---- */
const CATS: { id: CaseCategory; label: string }[] = [
  { id: 'wallet_debited_no_token', label: 'Wallet debited, no token' }, { id: 'token_not_received', label: 'Token not received' },
  { id: 'meter_rejected_token', label: 'Meter rejected token' }, { id: 'wrong_meter_credited', label: 'Wrong meter number' },
  { id: 'hardware_fault', label: 'Hardware fault' }, { id: 'meter_tamper', label: 'Meter tamper' }, { id: 'billing_dispute', label: 'Billing dispute' }, { id: 'other', label: 'Other' },
]
const category = ref<CaseCategory>('wallet_debited_no_token')
const priority = ref<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM')
const amount = ref(0)
const caseNote = ref('')
const sla = computed(() => CASE_SLA_MINUTES[category.value])
async function escalate(): Promise<void> {
  if (!props.call) return
  try {
    const c = await api<{ id: string }>('/cases', { method: 'POST', body: JSON.stringify({ category: category.value, priority: priority.value, customerRef: props.call.customer?.id ?? props.call.number, customerPhone: props.call.number, meterNumber: props.call.customer?.meter, callId: props.call.id, amountNgn: amount.value, notes: caseNote.value || undefined }) })
    toast.show(`${c.id} escalated. Customer will be texted when it is fixed.`); caseNote.value = ''; emit('changed'); ui.close()
  } catch { toast.show('Could not escalate this case') }
}
function openCustomer(): void { if (props.call?.customer) { ui.close(); void router.push({ path: '/cust', query: { open: props.call.customer.id } }) } }
</script>

<template>
  <SidePanel :open="ui.panel === 'desk'" title="Call details" @close="ui.close">
    <template #head>
      <div class="tb" role="tablist" style="display: flex; gap: 4px; background: var(--panel); border-radius: 99px; padding: 3px">
        <button v-for="t in TABS" :key="t.id" role="tab" :aria-selected="ui.deskTab === t.id" :aria-label="t.label" :title="t.label" :class="{ on: ui.deskTab === t.id }" style="width: 38px; height: 34px; padding: 0; background: transparent" :style="ui.deskTab === t.id ? { background: 'var(--dark)', color: '#fff' } : {}" @click="ui.deskTab = t.id"><Icon :name="t.icon" /></button>
      </div>
    </template>
    <p v-if="!call" style="color: var(--mut)">No active call.</p>
    <template v-else>
      <div v-if="ui.deskTab === 'contact'">
        <div class="pc"><div class="pa">{{ call.name.slice(0, 2).toUpperCase() }}</div><b style="font-weight: 400; font-size: 18px">{{ call.customer?.name ?? 'Unknown caller' }}</b>
          <div style="color: var(--mut)">{{ phone }}</div>
          <div class="ia"><button aria-label="Schedule callback" title="Book a callback" @click="scheduleCallback"><Icon name="clock" /></button>
            <button v-if="call.customer" aria-label="Open customer" title="Open customer" @click="openCustomer"><Icon name="user" /></button></div></div>
        <div class="dr"><div v-if="call.customer"><Icon name="bolt" /><div class="tx"><small>Meter number</small><b>{{ call.customer.meter }}</b></div><button aria-label="Copy meter" @click="copy(call.customer.meter)"><Icon name="copy" /></button></div>
          <div><Icon name="phone" /><div class="tx"><small>Phone</small><b>{{ phone }}</b></div><button aria-label="Copy phone" @click="copy(call.number)"><Icon name="copy" /></button></div></div>
        <h3>Text the customer</h3>
        <div style="display: flex; gap: 6px"><input v-model="sms" aria-label="SMS text" placeholder="Type a message" maxlength="320" /><button class="y" aria-label="Send SMS" @click="sendSms"><Icon name="send" /></button></div>
      </div>

      <div v-else-if="ui.deskTab === 'vending'">
        <p v-if="!call.customer" style="color: var(--mut)">This caller is not matched to a customer, so there is no purchase history to check.</p>
        <template v-else>
          <div class="c" style="margin-bottom: 10px"><div class="hd"><Icon name="user" /><b>Verify the caller</b></div>
            <label class="sw"><span>Name confirmed</span><input v-model="checks.name" type="checkbox" /></label>
            <label class="sw"><span>Meter confirmed</span><input v-model="checks.meter" type="checkbox" /></label>
            <label class="sw"><span>Last vend confirmed</span><input v-model="checks.lastVend" type="checkbox" /></label>
            <label class="sw"><span>Reason for reveal</span><select v-model="reason" style="width: 55%"><option value="">Choose a reason</option><option v-for="r in REASONS" :key="r">{{ r }}</option></select></label>
            <label class="sw"><span>Purchase</span><select v-model="purchaseId" style="width: 55%"><option value="">Choose</option><option v-for="p in detail?.purchases ?? []" :key="p.id" :value="p.id">{{ shortDate(p.at) }}, NGN {{ p.amount.toLocaleString('en-US') }}</option></select></label>
            <div class="row"><b style="font-weight: 300">{{ token || '•••• •••• •••• ••••' }}</b><small style="color: var(--mut)">{{ token ? 'Reveal logged' : ready ? 'Ready to reveal' : 'Tick all three, choose a reason and a purchase' }}</small></div>
            <div class="btns"><button class="y" :disabled="!ready || !!token" @click="reveal">Reveal token</button></div></div>
          <div class="c"><div class="hd"><Icon name="wallet" /><b>{{ call.customer.balance === null ? 'Bill account' : `NGN ${call.customer.balance.toLocaleString('en-US')}` }}</b><span class="pill ye">Token hidden</span></div>
            <p v-if="err" role="alert" style="color: var(--badt)">{{ err }}</p>
            <div v-for="p in detail?.purchases ?? []" :key="p.id" class="row"><span>{{ shortDate(p.at) }} · NGN {{ p.amount.toLocaleString('en-US') }}<small style="display: block; color: var(--mut)">{{ p.tokenMasked }}</small></span><span class="pill" :class="purchaseTone(p.status)">{{ humanStatus(p.status) }}</span></div></div>
        </template>
      </div>

      <div v-else-if="ui.deskTab === 'notes'">
        <div class="bub"><p v-for="(n, i) in notes" :key="i" :class="{ s: i % 2 }">{{ n.text }}</p></div>
        <p v-if="!notes.length" style="color: var(--mut)">No notes on this call yet.</p>
        <div style="display: flex; gap: 6px"><input v-model="note" aria-label="Add a note" placeholder="Type a note" maxlength="1000" @keydown.enter.prevent="addNote" />
          <button class="y" aria-label="Save note" @click="addNote"><Icon name="send" /></button><button aria-label="Draft summary" title="Draft summary" @click="draft"><Icon name="note" /></button></div>
      </div>

      <div v-else class="c dk">
        <div class="hd"><Icon name="flag" /><b>Escalate to wallet staff</b></div>
        <select v-model="category" aria-label="Category"><option v-for="c in CATS" :key="c.id" :value="c.id">{{ c.label }}</option></select>
        <label class="fl">Priority<select v-model="priority"><option v-for="p in (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const)" :key="p" :value="p">{{ escalationPriorityLabel(p) }}</option></select></label>
        <label class="fl">Amount involved (NGN)<input v-model.number="amount" type="number" min="0" /></label>
        <textarea v-model="caseNote" rows="2" aria-label="Notes" placeholder="What happened?" maxlength="1000" style="margin-top: 8px"></textarea>
        <p style="color: #ccc; margin: 6px 0 0">Deadline for this kind of case: {{ sla >= 60 ? `${sla / 60} hours` : `${sla} minutes` }}. The customer is texted when it is fixed.</p>
        <div class="btns"><button class="y" style="flex: 1" aria-label="Send escalation" @click="escalate"><Icon name="send" /></button></div>
      </div>
    </template>
  </SidePanel>
</template>
