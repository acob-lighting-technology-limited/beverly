<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSupportCentreStore } from '../stores/support-centre';

const store = useSupportCentreStore();
const router = useRouter();

const filterType = ref<'all' | 'voice' | 'callback' | 'risk'>('all');
const searchQuery = ref('');

const filteredQueue = computed(() => {
  return store.queue.filter((item) => {
    if (filterType.value === 'voice' && item.queueType !== 'voice') return false;
    if (filterType.value === 'callback' && item.queueType !== 'callback') return false;
    if (filterType.value === 'risk' && item.slaRisk !== 'risk') return false;
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      return (
        item.callerName.toLowerCase().includes(q) ||
        item.phone.includes(q) ||
        item.issue.toLowerCase().includes(q)
      );
    }
    return true;
  });
});

function handleTakeCall(id: string) {
  store.takeQueueCall(id);
  router.push('/live-desk');
}

function formatTimer(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
</script>

<template>
  <div class="queue-page">
    <div class="page-head">
      <div>
        <h1>Queue & Workboard</h1>
        <p>Real-time caller queues, priority routing and supervisor backlog management.</p>
      </div>
      <div class="actions">
        <button class="btn btn-primary" @click="store.triggerSimulatedInbound">
          + Simulate Caller (Africa's Talking DID)
        </button>
      </div>
    </div>

    <!-- KPI Summary Row -->
    <div class="kpi-row">
      <div class="kpi-card">
        <span>Active Queue Length</span>
        <b>{{ store.queue.length }} callers</b>
        <small>{{ store.waitingCount }} voice · {{ store.callbackCount }} callbacks</small>
      </div>
      <div class="kpi-card">
        <span>Longest Waiting Contact</span>
        <b class="text-amber">{{ store.longestWaitFormatted }}</b>
        <small>Target: under 05:00 minutes</small>
      </div>
      <div class="kpi-card">
        <span>Service Level (SLA)</span>
        <b class="text-brand">{{ store.serviceLevelPercent }}%</b>
        <small>Answered within 300 seconds</small>
      </div>
      <div class="kpi-card">
        <span>Agent Presence</span>
        <b>Available</b>
        <small>{{ store.agent.name }} · Lagos Desk</small>
      </div>
    </div>

    <!-- Filters & Table -->
    <div class="panel">
      <div class="panel-toolbar">
        <div class="filter-chips">
          <button :class="{ active: filterType === 'all' }" @click="filterType = 'all'">
            All Work ({{ store.queue.length }})
          </button>
          <button :class="{ active: filterType === 'voice' }" @click="filterType = 'voice'">
            Voice Inbound ({{ store.waitingCount }})
          </button>
          <button :class="{ active: filterType === 'callback' }" @click="filterType = 'callback'">
            Callbacks ({{ store.callbackCount }})
          </button>
          <button :class="{ active: filterType === 'risk' }" @click="filterType = 'risk'">
            SLA Risk Only
          </button>
        </div>

        <input
          v-model="searchQuery"
          type="text"
          placeholder="Filter by caller, phone, or issue..."
          class="search-input"
        />
      </div>

      <div class="table-responsive">
        <table class="queue-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Caller</th>
              <th>Reported Issue</th>
              <th>Wait Time</th>
              <th>Priority</th>
              <th>SLA Status</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredQueue" :key="item.id">
              <td>
                <span class="channel-pill" :class="item.queueType">
                  {{ item.queueType === 'voice' ? '📞 Voice' : '🔁 Callback' }}
                </span>
              </td>
              <td>
                <div class="caller-cell">
                  <strong>{{ item.callerName }}</strong>
                  <small>{{ item.phone }}</small>
                </div>
              </td>
              <td>{{ item.issue }}</td>
              <td>
                <span class="mono-timer" :class="item.slaRisk">
                  {{ formatTimer(item.waitSeconds) }}
                </span>
              </td>
              <td>
                <span class="priority-badge" :class="item.priority">{{ item.priority }}</span>
              </td>
              <td>
                <span class="sla-pill" :class="item.slaRisk">
                  {{ item.slaRisk === 'risk' ? 'Breach Risk' : item.slaRisk === 'warning' ? 'Approaching SLA' : 'In Target' }}
                </span>
              </td>
              <td class="text-right">
                <button class="btn btn-table-action" @click="handleTakeCall(item.id)">
                  Take Call ↗
                </button>
              </td>
            </tr>
            <tr v-if="filteredQueue.length === 0">
              <td colspan="7" class="empty-cell">
                No queue items match your filter criteria.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.queue-page {
  padding: 24px 30px 40px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 20px;
}

.page-head h1 {
  font-size: 24px;
  margin: 0;
  color: var(--ink);
  letter-spacing: -0.6px;
}

.page-head p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.btn-primary {
  height: 38px;
  padding: 0 16px;
  background: var(--brand);
  color: oklch(18% 0.02 145);
  border: 1px solid var(--brand);
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 900px) {
  .kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

.kpi-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 16px 20px;
  box-shadow: var(--shadow-sm);
}

.kpi-card span {
  display: block;
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
}

.kpi-card b {
  display: block;
  font: 700 24px var(--mono);
  color: var(--ink);
  margin-top: 4px;
  letter-spacing: -0.5px;
}

.kpi-card small {
  display: block;
  font-size: 11px;
  color: var(--muted);
  margin-top: 4px;
}

.text-amber {
  color: var(--amber-text);
}

.panel {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--r);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.panel-toolbar {
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-chips {
  display: flex;
  gap: 8px;
}

.filter-chips button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: var(--card);
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.filter-chips button.active {
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-color: var(--brand);
}

.search-input {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  font-size: 12px;
  min-width: 260px;
  background: var(--card);
  color: var(--ink);
}

.table-responsive {
  overflow-x: auto;
}

.queue-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}

.queue-table th {
  padding: 12px 18px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
  background: var(--card-subtle);
}

.queue-table td {
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
}

.channel-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--card-subtle);
}

.channel-pill.voice {
  background: var(--blue-soft);
  color: var(--blue);
}

.channel-pill.callback {
  background: var(--amber-soft);
  color: var(--amber-text);
}

.caller-cell strong {
  display: block;
}

.caller-cell small {
  color: var(--muted);
  font-family: var(--mono);
}

.mono-timer {
  font-family: var(--mono);
  font-weight: 700;
  padding: 3px 6px;
  border-radius: 4px;
  background: var(--card-subtle);
}

.mono-timer.warning {
  background: var(--amber-soft);
  color: var(--amber-text);
}

.mono-timer.risk {
  background: var(--red-soft);
  color: var(--red);
}

.priority-badge {
  text-transform: capitalize;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
}

.priority-badge.urgent, .priority-badge.high {
  background: var(--red-soft);
  color: var(--red);
}

.priority-badge.normal {
  background: var(--card-subtle);
  color: var(--muted);
}

.sla-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
}

.sla-pill.risk {
  background: var(--red-soft);
  color: var(--red);
}

.sla-pill.warning {
  background: var(--amber-soft);
  color: var(--amber-text);
}

.sla-pill.safe {
  background: var(--brand-soft);
  color: var(--brand-deep);
}

.text-right {
  text-align: right;
}

.btn-table-action {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--brand);
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 6px;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-table-action:hover {
  background: var(--brand);
  color: oklch(18% 0.02 145);
}

.empty-cell {
  text-align: center;
  padding: 40px;
  color: var(--muted);
}
</style>
