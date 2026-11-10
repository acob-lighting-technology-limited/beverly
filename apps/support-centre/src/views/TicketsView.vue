<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { api } from '../lib/api';

// ═══════════════════════════════════════════════════════════════════════
//  Types (mirrored from admin/Support.vue — single source of truth)
// ═══════════════════════════════════════════════════════════════════════
interface Ticket {
  id: string;
  reference: string;
  subject: string;
  status: string;
  category: string;
  priority: string;
  requester_actor_type: string;
  requester_name?: string;
  assigned_to_user_id?: string;
  last_message_at: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════════════════════════════
const tickets = ref<Ticket[]>([]);
const ticketStats = ref<Record<string, number>>({});
const ticketStatus = ref('');
const ticketSearch = ref('');
const selTicket = ref<Ticket | null>(null);
const ticketDetail = ref<any>(null);
const ticketDetailError = ref(false);
const staffReply = ref('');
const internalNote = ref(false);
const busy = ref(false);
const loading = ref(false);

// ═══════════════════════════════════════════════════════════════════════
//  API Actions
// ═══════════════════════════════════════════════════════════════════════
async function loadTickets() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (ticketStatus.value) params.set('status', ticketStatus.value);
    if (ticketSearch.value) params.set('search', ticketSearch.value);
    const qs = params.toString();
    const [list, stats] = await Promise.all([
      api.get<{ tickets: Ticket[] }>(`/api/v1/admin/support/tickets${qs ? `?${qs}` : ''}`),
      api.get<Record<string, number>>('/api/v1/admin/support/tickets/stats'),
    ]);
    tickets.value = list.tickets ?? [];
    ticketStats.value = stats ?? {};
  } catch {
    // offline — keep existing
  } finally {
    loading.value = false;
  }
}

async function openTicket(t: Ticket) {
  selTicket.value = t;
  ticketDetail.value = null;
  ticketDetailError.value = false;
  staffReply.value = '';
  internalNote.value = false;
  try {
    ticketDetail.value = await api.get(`/api/v1/admin/support/tickets/${t.id}`);
  } catch {
    ticketDetailError.value = true;
  }
}

async function patchTicket(patch: Record<string, unknown>) {
  if (!selTicket.value) return;
  busy.value = true;
  try {
    await api.patch(`/api/v1/admin/support/tickets/${selTicket.value.id}`, patch);
    await openTicket(selTicket.value);
    await loadTickets();
  } catch { /* ignore */ } finally { busy.value = false; }
}

async function sendStaffReply() {
  if (!selTicket.value || !staffReply.value.trim()) return;
  busy.value = true;
  try {
    await api.post(`/api/v1/admin/support/tickets/${selTicket.value.id}/messages`, {
      body: staffReply.value.trim(),
      internal: internalNote.value,
    });
    staffReply.value = '';
    await openTicket(selTicket.value);
    await loadTickets();
  } catch { /* ignore */ } finally { busy.value = false; }
}

// ═══════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════
function statusBadge(s: string): string {
  return ({
    open: 'pill-warn',
    pending: 'pill-brand',
    awaiting_customer: 'pill-warn',
    resolved: 'pill-ok',
    closed: 'pill-dim',
  } as Record<string, string>)[s] ?? 'pill-dim';
}
function priorityBadge(p: string): string {
  return ({
    low: 'pill-dim',
    normal: 'pill-brand',
    high: 'pill-warn',
    urgent: 'pill-danger',
  } as Record<string, string>)[p] ?? 'pill-dim';
}
function fmt(s: string) { return s ? new Date(s).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' }) : '—'; }
function pretty(s: string) { return s.replace(/_/g, ' '); }

const filteredTickets = computed(() => {
  const q = ticketSearch.value.trim().toLowerCase();
  if (!q) return tickets.value;
  return tickets.value.filter(t =>
    t.subject.toLowerCase().includes(q) ||
    t.reference.toLowerCase().includes(q) ||
    (t.requester_name ?? '').toLowerCase().includes(q)
  );
});

onMounted(loadTickets);
</script>

<template>
  <div class="tv-root">

    <!-- ═══ KPI Strip ═══ -->
    <div class="tv-kpis" aria-label="Ticket overview">
      <div class="tv-kpi">
        <span>Total</span>
        <strong>{{ ticketStats.total ?? tickets.length }}</strong>
      </div>
      <div class="tv-kpi pill-warn-bg">
        <span>Open</span>
        <strong>{{ ticketStats.open ?? 0 }}</strong>
      </div>
      <div class="tv-kpi">
        <span>Pending</span>
        <strong>{{ ticketStats.pending ?? 0 }}</strong>
      </div>
      <div class="tv-kpi">
        <span>Awaiting</span>
        <strong>{{ ticketStats.awaiting_customer ?? 0 }}</strong>
      </div>
      <div class="tv-kpi pill-ok-bg">
        <span>Resolved</span>
        <strong>{{ ticketStats.resolved ?? 0 }}</strong>
      </div>
    </div>

    <!-- ═══ Filter Bar ═══ -->
    <div class="tv-filter">
      <div class="tv-search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          v-model="ticketSearch"
          class="tv-input"
          placeholder="Search subject, reference, or requester…"
          @keyup.enter="loadTickets"
          aria-label="Search tickets"
        />
      </div>
      <select v-model="ticketStatus" class="tv-select" @change="loadTickets" aria-label="Filter by status">
        <option value="">All statuses</option>
        <option value="open">Open</option>
        <option value="pending">Pending</option>
        <option value="awaiting_customer">Awaiting customer</option>
        <option value="resolved">Resolved</option>
        <option value="closed">Closed</option>
      </select>
      <button class="tv-btn tv-btn-ghost" :disabled="loading" @click="loadTickets">
        {{ loading ? 'Loading…' : 'Refresh' }}
      </button>
    </div>

    <!-- ═══ Tickets Table ═══ -->
    <div class="tv-table-wrap">
      <table class="tv-table" aria-label="Support tickets">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Subject</th>
            <th>From</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Updated</th>
            <th aria-label="Actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="t in filteredTickets"
            :key="t.id"
            class="tv-row"
            :class="{ 'tv-row--active': selTicket?.id === t.id }"
            @click="openTicket(t)"
          >
            <td class="mono">{{ t.reference }}</td>
            <td class="tv-subject">{{ t.subject }}</td>
            <td>{{ t.requester_name || t.requester_actor_type }}</td>
            <td><span :class="['pill', priorityBadge(t.priority)]">{{ t.priority }}</span></td>
            <td><span :class="['pill', statusBadge(t.status)]">{{ pretty(t.status) }}</span></td>
            <td class="dim small">{{ fmt(t.last_message_at) }}</td>
            <td @click.stop>
              <button class="tv-btn tv-btn-ghost tv-btn-sm" @click="openTicket(t)">Open</button>
            </td>
          </tr>
          <tr v-if="!filteredTickets.length && !loading">
            <td colspan="7">
              <div class="tv-empty">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <strong>No tickets found</strong>
                <span>Tickets raised by customers and vendors appear here.</span>
                <button class="tv-btn tv-btn-primary tv-btn-sm" @click="loadTickets">Refresh</button>
              </div>
            </td>
          </tr>
          <tr v-else-if="loading">
            <td colspan="7"><div class="tv-empty"><span>Loading tickets…</span></div></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ═══ Ticket Detail Modal ═══ -->
    <div v-if="selTicket" class="tv-backdrop" @click.self="selTicket = null">
      <div class="tv-modal" role="dialog" aria-modal="true" :aria-labelledby="`ticket-title-${selTicket.id}`">
        <div class="tv-modal-head">
          <div>
            <h2 :id="`ticket-title-${selTicket.id}`" class="mono">{{ selTicket.reference }}</h2>
            <p class="dim small">{{ selTicket.subject }}</p>
          </div>
          <div class="tv-modal-controls">
            <select
              v-if="ticketDetail"
              :value="ticketDetail.status"
              class="tv-select tv-select-sm"
              @change="patchTicket({ status: ($event.target as HTMLSelectElement).value })"
              aria-label="Change ticket status"
            >
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="awaiting_customer">Awaiting customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              v-if="ticketDetail"
              :value="ticketDetail.priority"
              class="tv-select tv-select-sm"
              @change="patchTicket({ priority: ($event.target as HTMLSelectElement).value })"
              aria-label="Change priority"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <button class="tv-btn tv-btn-ghost tv-btn-sm" :disabled="busy" @click="patchTicket({ assign_to_me: true })">
              Assign to me
            </button>
            <button class="tv-btn tv-btn-ghost" aria-label="Close ticket" @click="selTicket = null">✕</button>
          </div>
        </div>

        <div class="tv-modal-body">
          <!-- Thread -->
          <div class="tv-thread">
            <div v-if="ticketDetailError" role="alert" class="tv-alert">
              <span>Ticket could not load.</span>
              <button class="tv-btn tv-btn-ghost tv-btn-sm" @click="openTicket(selTicket!)">Try again</button>
            </div>
            <p v-else-if="!ticketDetail" class="dim">Loading thread…</p>
            <p v-else-if="!ticketDetail.support_ticket_messages?.length" class="dim">No messages yet.</p>
            <div
              v-for="m in ticketDetail?.support_ticket_messages"
              :key="m.id"
              :class="['tv-msg', m.sender_actor_type === 'staff' ? 'tv-msg--staff' : 'tv-msg--user', m.is_internal && 'tv-msg--internal']"
            >
              <div class="tv-msg-meta">
                <span class="tv-msg-who">
                  {{ m.sender_actor_type === 'staff' ? 'Staff' : (m.sender_name || m.sender_actor_type) }}
                  <em v-if="m.is_internal"> · internal note</em>
                </span>
                <span class="dim xsmall">{{ fmt(m.created_at) }}</span>
              </div>
              <p class="tv-msg-body">{{ m.body }}</p>
            </div>
          </div>

          <!-- Reply Box -->
          <div class="tv-reply">
            <label class="tv-internal-check">
              <input v-model="internalNote" type="checkbox" />
              Internal note <span class="dim small">(hidden from customer)</span>
            </label>
            <textarea
              v-model="staffReply"
              class="tv-textarea"
              rows="3"
              placeholder="Write a reply to this ticket…"
              aria-label="Staff reply"
            />
          </div>
        </div>

        <div class="tv-modal-foot">
          <button class="tv-btn tv-btn-ghost" @click="selTicket = null">Close</button>
          <button
            class="tv-btn tv-btn-primary"
            :disabled="!staffReply.trim() || busy"
            @click="sendStaffReply"
          >
            {{ busy ? 'Sending…' : 'Send Reply' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.tv-root { display: flex; flex-direction: column; gap: var(--s-4, 1rem); }

/* KPI Strip */
.tv-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: var(--s-3, .75rem);
}
.tv-kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--s-3, .75rem) var(--s-4, 1rem);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 10px;
  background: var(--surface, #fff);
}
.tv-kpi span { font-size: 11px; color: var(--mut, #64748b); text-transform: uppercase; letter-spacing: .04em; }
.tv-kpi strong { font-size: 1.5rem; font-family: var(--font-mono, monospace); color: var(--text, #0f172a); line-height: 1; }
.pill-warn-bg { background: oklch(from var(--warn, #f59e0b) l c h / .08); border-color: oklch(from var(--warn, #f59e0b) l c h / .3); }
.pill-ok-bg { background: oklch(from var(--brand-500, #10b981) l c h / .08); border-color: oklch(from var(--brand-500, #10b981) l c h / .3); }

/* Filter */
.tv-filter { display: flex; gap: var(--s-2, .5rem); flex-wrap: wrap; align-items: center; }
.tv-search { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 200px; padding: 0 10px; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; background: var(--surface, #fff); }
.tv-search svg { flex-shrink: 0; color: var(--mut, #64748b); }
.tv-input { flex: 1; border: none; background: transparent; padding: 7px 0; font-size: 13px; color: var(--text, #0f172a); outline: none; }
.tv-select { padding: 7px 10px; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; background: var(--surface, #fff); font-size: 13px; color: var(--text, #0f172a); cursor: pointer; }
.tv-select-sm { padding: 4px 8px; font-size: 12px; }

/* Table */
.tv-table-wrap { overflow-x: auto; border: 1px solid var(--border, #e2e8f0); border-radius: 10px; background: var(--surface, #fff); }
.tv-table { width: 100%; min-width: 700px; border-collapse: collapse; font-size: 13px; }
.tv-table th { padding: 10px 12px; text-align: left; font-size: 11px; color: var(--mut, #64748b); text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid var(--border, #e2e8f0); background: var(--surface-2, #f8fafc); }
.tv-table td { padding: 11px 12px; border-bottom: 1px solid var(--border, #e2e8f0); vertical-align: middle; }
.tv-row { cursor: pointer; transition: background .12s; }
.tv-row:hover { background: var(--surface-2, #f8fafc); }
.tv-row--active { background: oklch(from var(--brand-500, #10b981) l c h / .07) !important; }
.tv-subject { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mono { font-family: var(--font-mono, monospace); }
.dim { color: var(--mut, #64748b); }
.small { font-size: 12px; }
.xsmall { font-size: 11px; }

/* Pills */
.pill { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.pill-brand { background: oklch(from var(--brand-500, #10b981) l c h / .12); color: var(--brand-500, #10b981); }
.pill-warn { background: oklch(from #f59e0b l c h / .12); color: #b45309; }
.pill-ok { background: oklch(from var(--brand-500, #10b981) l c h / .12); color: var(--brand-500, #10b981); }
.pill-dim { background: var(--surface-2, #f1f5f9); color: var(--mut, #64748b); }
.pill-danger { background: oklch(from var(--danger, #ef4444) l c h / .12); color: var(--danger, #ef4444); }

/* Empty */
.tv-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 48px 24px; color: var(--mut, #64748b); }
.tv-empty strong { color: var(--text, #0f172a); }

/* Buttons */
.tv-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px; border: none; font-size: 13px; font-weight: 500; cursor: pointer; transition: background .12s; }
.tv-btn:disabled { opacity: .5; cursor: not-allowed; }
.tv-btn-sm { padding: 4px 10px; font-size: 12px; }
.tv-btn-ghost { background: var(--surface-2, #f1f5f9); color: var(--text, #0f172a); }
.tv-btn-ghost:hover:not(:disabled) { background: var(--border, #e2e8f0); }
.tv-btn-primary { background: var(--brand-500, #10b981); color: #fff; }
.tv-btn-primary:hover:not(:disabled) { background: var(--brand-600, #059669); }

/* Modal */
.tv-backdrop { position: fixed; inset: 0; z-index: 400; background: oklch(0 0 0 / .4); display: grid; place-items: center; padding: var(--s-4, 1rem); }
.tv-modal { width: min(840px, 100%); max-height: 90vh; display: flex; flex-direction: column; border-radius: 14px; background: var(--surface, #fff); border: 1px solid var(--border, #e2e8f0); box-shadow: 0 20px 60px oklch(0 0 0 / .2); overflow: hidden; }
.tv-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 24px 16px; border-bottom: 1px solid var(--border, #e2e8f0); }
.tv-modal-head h2 { margin: 0; font-size: 1.1rem; }
.tv-modal-controls { display: flex; gap: 8px; align-items: center; flex-shrink: 0; flex-wrap: wrap; }
.tv-modal-body { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 20px; }
.tv-modal-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 24px; border-top: 1px solid var(--border, #e2e8f0); }

/* Thread */
.tv-thread { display: flex; flex-direction: column; gap: 12px; }
.tv-alert { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid oklch(from var(--danger, #ef4444) l c h / .3); border-radius: 8px; background: oklch(from var(--danger, #ef4444) l c h / .06); color: var(--danger, #ef4444); }
.tv-msg { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; max-width: 85%; }
.tv-msg--user { background: var(--surface-2, #f8fafc); border: 1px solid var(--border, #e2e8f0); align-self: flex-start; }
.tv-msg--staff { background: oklch(from var(--brand-500, #10b981) l c h / .08); border: 1px solid oklch(from var(--brand-500, #10b981) l c h / .2); align-self: flex-end; }
.tv-msg--internal { background: oklch(from #f59e0b l c h / .08); border: 1px solid oklch(from #f59e0b l c h / .25); }
.tv-msg-meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.tv-msg-who { font-size: 11px; font-weight: 600; color: var(--mut, #64748b); }
.tv-msg-body { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text, #0f172a); }

/* Reply */
.tv-reply { display: flex; flex-direction: column; gap: 8px; }
.tv-internal-check { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
.tv-textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; background: var(--surface, #fff); font-size: 13px; color: var(--text, #0f172a); resize: vertical; font-family: inherit; }
.tv-textarea:focus { outline: 2px solid var(--brand-500, #10b981); outline-offset: -1px; }
</style>
