<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AlertLimits, AuditRow, CallFlowStep, Connection, Outage, RetentionStatus, RoleSummary, StaffUser } from '@beverly-call/shared'
import Icon from '@/components/Icon.vue'
import PageHeader from '@/components/PageHeader.vue'
import StateBanner from '@/components/StateBanner.vue'
import { api } from '@/lib/api'
import { useResource } from '@/lib/use-resource'
import { shortDate } from '@/lib/format'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'

const session = useSession()
const toast = useToast()
// Only a real admin can change settings; an admin previewing another view sees them read-only.
const canEdit = computed(() => session.user?.role === 'admin' && !session.viewAs)

const audit = useResource(() => api<AuditRow[]>('/audit'))
const retention = useResource(() => api<RetentionStatus>('/admin/retention'))
const connections = useResource(() => api<Connection[]>('/admin/connections'))
const users = useResource(() => api<StaffUser[]>('/admin/users'))
const roles = useResource(() => api<RoleSummary[]>('/admin/roles'))
const number = useResource(() => api<{ virtualNumber: string | null; retentionDays: number }>('/admin/number'))
const limitsRes = useResource(() => api<AlertLimits>('/admin/settings/alert_limits'))
const flowRes = useResource(() => api<CallFlowStep[]>('/admin/settings/call_flow'))
const outagesRes = useResource(() => api<Outage[]>('/admin/settings/outages'))
const repliesRes = useResource(() => api<string[]>('/admin/settings/saved_replies'))

const limits = ref<AlertLimits | null>(null)
const flow = ref<CallFlowStep[]>([])
const outages = ref<Outage[]>([])
const replies = ref<string[]>([])
watch(() => limitsRes.data.value, (v) => { if (v) limits.value = { ...v } }, { immediate: true })
watch(() => flowRes.data.value, (v) => { if (v) flow.value = v.map((s) => ({ ...s })) }, { immediate: true })
watch(() => outagesRes.data.value, (v) => { if (v) outages.value = v.map((o) => ({ ...o })) }, { immediate: true })
watch(() => repliesRes.data.value, (v) => { if (v) replies.value = [...v] }, { immediate: true })

async function save<T>(key: string, value: T, label: string): Promise<void> {
  try { await api(`/admin/settings/${key}`, { method: 'PUT', body: JSON.stringify(value) }); toast.show(`${label} saved`); void audit.reload() }
  catch { toast.show(`Could not save ${label.toLowerCase()}. Check the values.`) }
}
function move(i: number, d: -1 | 1): void {
  const j = i + d
  if (j < 0 || j >= flow.value.length) return
  const a = flow.value;[a[i], a[j]] = [a[j]!, a[i]!]
}
const addOutage = (): void => { outages.value.push({ area: '', message: '', until: '' }) }
const addReply = (): void => { replies.value.push('') }

const verifyMsg = ref('')
async function verify(): Promise<void> {
  try { const r = await api<{ checked: number; brokenAt: number | null }>('/admin/audit/verify'); verifyMsg.value = r.brokenAt === null ? `Chain intact: ${r.checked} entries checked.` : `Chain broken at entry ${r.brokenAt + 1}. Investigate now.` }
  catch { verifyMsg.value = 'Could not verify the chain.' }
}
function reloadAll(): void { void connections.reload(); void retention.reload() }
</script>

<template>
  <section>
    <PageHeader title="Admin" />
    <p v-if="!canEdit" class="ban" role="status">You are viewing settings read-only{{ session.viewAs ? ' while previewing another role' : '' }}.</p>
    <div class="bento">
      <div class="c s12 w2">
        <div class="hd"><Icon name="fwd" /><b>Call flow</b></div>
        <StateBanner :loading="flowRes.loading.value" :error="flowRes.error.value" what="the call flow" />
        <div v-hover-scroll class="flow">
          <div v-for="(s, i) in flow" :key="s.id" class="nd" :class="{ d: i === 0 }">{{ s.title }}
            <input v-if="canEdit" v-model="s.detail" :aria-label="`${s.title} detail`" maxlength="80" /><small v-else>{{ s.detail }}</small>
            <span v-if="canEdit" class="mv"><button :aria-label="`Move ${s.title} earlier`" :disabled="i === 0" @click="move(i, -1)"><Icon name="lft" /></button><button :aria-label="`Move ${s.title} later`" :disabled="i === flow.length - 1" @click="move(i, 1)"><Icon name="rgt" /></button></span></div>
        </div>
        <div v-if="canEdit" class="btns"><button class="y" aria-label="Save call flow" @click="save('call_flow', flow, 'Call flow')"><Icon name="check" /></button></div>
      </div>

      <div class="c s6"><div class="hd"><Icon name="alert" /><b>Alert limits</b></div>
        <StateBanner :loading="limitsRes.loading.value" :error="limitsRes.error.value" what="alert limits" />
        <template v-if="limits">
          <label class="sw"><span>Longest wait</span><b>{{ limits.longestWaitSeconds }}s</b></label><input v-model.number="limits.longestWaitSeconds" type="range" min="20" max="180" :disabled="!canEdit" aria-label="Longest wait" />
          <label class="sw"><span>Abandon rate</span><b>{{ limits.abandonRatePct }}%</b></label><input v-model.number="limits.abandonRatePct" type="range" min="1" max="15" :disabled="!canEdit" aria-label="Abandon rate" />
          <label class="sw"><span>Credit left</span><b>{{ limits.creditDays }}d</b></label><input v-model.number="limits.creditDays" type="range" min="1" max="14" :disabled="!canEdit" aria-label="Credit days" />
          <div v-if="canEdit" class="btns"><button class="y" aria-label="Save alert limits" @click="save('alert_limits', limits, 'Alert limits')"><Icon name="check" /></button></div></template></div>

      <div class="c s6"><div class="hd"><Icon name="alert" /><b>Outages shown to agents</b></div>
        <p style="color: var(--mut); margin: 2px 0 6px">When a caller’s area matches, the agent sees the banner on the call.</p>
        <div v-for="(o, i) in outages" :key="i" style="display: grid; grid-template-columns: 1fr 1.6fr 80px auto; gap: 6px; margin-bottom: 6px">
          <input v-model="o.area" placeholder="Area" aria-label="Outage area" :disabled="!canEdit" maxlength="80" /><input v-model="o.message" placeholder="Message" aria-label="Outage message" :disabled="!canEdit" maxlength="200" />
          <input v-model="o.until" placeholder="Until" aria-label="Back by" :disabled="!canEdit" maxlength="40" /><button v-if="canEdit" :aria-label="`Remove outage ${i + 1}`" @click="outages.splice(i, 1)"><Icon name="x" /></button></div>
        <p v-if="!outages.length" style="color: var(--mut)">No active outages.</p>
        <div v-if="canEdit" class="btns"><button aria-label="Add outage" @click="addOutage"><Icon name="plus" /></button><button class="y" aria-label="Save outages" @click="save('outages', outages.filter((o) => o.area && o.message), 'Outages')"><Icon name="check" /></button></div></div>

      <div class="c s6"><div class="hd"><Icon name="note" /><b>Saved replies</b></div>
        <div v-for="(_, i) in replies" :key="i" style="display: flex; gap: 6px; margin-bottom: 6px"><input v-model="replies[i]" :aria-label="`Reply ${i + 1}`" :disabled="!canEdit" maxlength="300" /><button v-if="canEdit" :aria-label="`Remove reply ${i + 1}`" @click="replies.splice(i, 1)"><Icon name="x" /></button></div>
        <div v-if="canEdit" class="btns"><button aria-label="Add reply" @click="addReply"><Icon name="plus" /></button><button class="y" aria-label="Save replies" @click="save('saved_replies', replies.filter(Boolean), 'Saved replies')"><Icon name="check" /></button></div></div>

      <div class="c s6"><div class="hd"><Icon name="db" /><b>Retention proof</b>
        <span v-if="retention.data.value" class="pill" :class="retention.data.value.pendingPurge || retention.data.value.lastFailed ? 'ye' : 'ok'">{{ retention.data.value.pendingPurge || retention.data.value.lastFailed ? 'Needs attention' : 'On schedule' }}</span></div>
        <StateBanner :loading="retention.loading.value" :error="retention.error.value" what="retention status" />
        <template v-if="retention.data.value">
          <div class="row"><span>Retention</span><span>{{ retention.data.value.retentionDays }} days</span></div>
          <div class="row"><span>Last purge</span><span>{{ retention.data.value.lastRunAt ? shortDate(retention.data.value.lastRunAt) : 'Never run' }}</span></div>
          <div class="row"><span>Deleted last run</span><span>{{ retention.data.value.lastDeleted }}</span></div>
          <div class="row"><span>Held for legal review</span><span>{{ retention.data.value.lastHeld }}</span></div>
          <div class="row"><span>Failed last run</span><span>{{ retention.data.value.lastFailed }}</span></div>
          <div class="row"><span>Expired, waiting to purge</span><span>{{ retention.data.value.pendingPurge }}</span></div></template></div>

      <div class="c dk s6"><div class="hd"><Icon name="db" /><b>Connections</b><button aria-label="Refresh connections" style="margin-left: auto; height: 30px" @click="reloadAll"><Icon name="auto" /></button></div>
        <StateBanner :loading="connections.loading.value" :error="connections.error.value" what="connections" />
        <div v-for="c in connections.data.value ?? []" :key="c.name" class="row"><span>{{ c.name }}<small style="display: block; color: #bbb">{{ c.detail }}</small></span><span class="pill" :class="c.ok ? 'ok' : 'ye'">{{ c.ok ? 'Connected' : 'Check' }}</span></div></div>

      <div class="c s6"><div class="hd"><Icon name="phone" /><b>Number</b></div>
        <div class="row"><span>Virtual number</span><span>{{ number.data.value?.virtualNumber ?? 'Not set' }}</span></div><div class="row"><span>Recording kept</span><span>{{ number.data.value?.retentionDays ?? 90 }} days</span></div></div>

      <div class="c s7 w2"><div class="hd"><Icon name="users" /><b>Staff with call access</b></div>
        <StateBanner :loading="users.loading.value" :error="users.error.value" what="staff" />
        <div class="scroll"><table class="rt"><thead><tr><th>Name</th><th>Role</th><th>Active</th><th>Last login</th></tr></thead>
          <tbody><tr v-for="u in users.data.value ?? []" :key="u.id"><td data-label="Name">{{ u.name }}</td><td data-label="Role">{{ u.roleLabel ?? u.role.replace('custom-call-centre-', '') }}</td><td data-label="Active"><span class="pill" :class="u.active ? 'ok' : 'vi'">{{ u.active ? 'Active' : 'Off' }}</span></td><td data-label="Last login">{{ u.lastLogin ? shortDate(u.lastLogin) : 'Never' }}</td></tr></tbody></table></div>
        <p style="color: var(--mut); font-size: 12px; margin: 6px 0 0">Accounts, roles and portal access are managed in Beverly (Wallet Admin, Users): role Call Centre Agent or Supervisor, portal access “call”.</p></div>

      <div class="c s12 w2"><div class="hd"><Icon name="lock" /><b>Beverly roles</b></div>
        <StateBanner :loading="roles.loading.value" :error="roles.error.value" what="roles" />
        <div class="scroll"><table class="rt"><thead><tr><th>Role</th><th>People</th><th>Permissions</th><th>Description</th></tr></thead>
          <tbody><tr v-for="r in roles.data.value ?? []" :key="r.roleKey"><td data-label="Role">{{ r.label }}<small style="display: block; color: var(--mut)">{{ r.roleKey }}</small></td><td data-label="People">{{ r.people }}</td><td data-label="Permissions">{{ r.permissions }}</td><td data-label="Description" style="white-space: normal">{{ r.description ?? '' }}</td></tr></tbody></table></div></div>

      <div class="c s5 w2"><div class="hd"><Icon name="db" /><b>Audit log</b><span class="pill ok">Tamper-evident</span><button v-if="canEdit" aria-label="Verify audit chain" title="Verify the whole chain" style="height: 30px" @click="verify"><Icon name="check" /></button></div>
        <p v-if="verifyMsg" role="status" style="margin: 2px 0 6px">{{ verifyMsg }}</p>
        <StateBanner :loading="audit.loading.value" :error="audit.error.value" what="the audit log" />
        <div v-for="a in audit.data.value ?? []" :key="a.seq" class="row"><span>{{ a.action }}<small style="display: block; color: var(--mut)">{{ a.actorRole }} · {{ a.entity }} {{ a.entityId.slice(0, 12) }}</small></span><small>{{ shortDate(a.at) }}</small></div>
        <div v-if="audit.data.value && !audit.data.value.length" style="color: var(--mut)">No activity yet.</div></div>
    </div>
  </section>
</template>
