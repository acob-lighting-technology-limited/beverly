<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSupportCentreStore } from '../stores/support-centre';
import ResolveCaseModal from '../components/ResolveCaseModal.vue';
import EscalateModal from '../components/EscalateModal.vue';

const store = useSupportCentreStore();

const activeQueueTab = ref<'voice' | 'callback'>('voice');
const showResolveModal = ref(false);
const showEscalateModal = ref(false);
const showTransferMenu = ref(false);

const filteredQueueItems = computed(() => {
  return store.queue.filter((q) => q.queueType === activeQueueTab.value);
});

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function handleNotesInput(e: Event) {
  const target = e.target as HTMLTextAreaElement;
  store.updateCaseNotes(target.value);
}

function handleTransfer(target: string) {
  showTransferMenu.value = false;
  alert(`Call transferred to ${target}. Logging transfer audit record.`);
  store.endActiveCall();
}
</script>

<template>
  <div class="live-desk-page">
    <div class="page-head">
      <div>
        <h1>Live Desk</h1>
        <p>Handle active calls, resolve cases and protect customer service continuity in one place.</p>
      </div>
      <div class="shift-info">
        <b>{{ new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() }}</b>
        <div>{{ store.agent.shift }}</div>
      </div>
    </div>

    <div class="live-grid">
      <!-- ════════════ Left Column: Live Queue ════════════ -->
      <section class="panel queue-panel">
        <div class="panel-title">
          <h2>Live queue</h2>
          <small>Power & Meter Desk</small>
        </div>

        <div class="queue-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeQueueTab === 'voice' }"
            @click="activeQueueTab = 'voice'"
          >
            Waiting ({{ store.waitingCount }})
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeQueueTab === 'callback' }"
            @click="activeQueueTab = 'callback'"
          >
            Callbacks ({{ store.callbackCount }})
          </button>
        </div>

        <div class="queue-summary">
          <div class="metric">
            <span>Within 5 min SLA</span>
            <b>{{ store.serviceLevelPercent }}%</b>
          </div>
          <div class="metric">
            <span>Longest wait</span>
            <b class="metric-amber">{{ store.longestWaitFormatted }}</b>
          </div>
        </div>

        <div class="queue-list">
          <div
            v-for="item in filteredQueueItems"
            :key="item.id"
            class="q-item"
            :class="{ active: store.activeCall?.caller.phone === item.phone }"
            @click="store.takeQueueCall(item.id)"
            title="Click to accept this call immediately"
          >
            <div class="phone-mark">↗</div>
            <div class="q-info">
              <strong>{{ item.callerName }}</strong>
              <small>{{ item.issue }} · {{ item.phone }}</small>
            </div>
            <div class="timer" :class="{ risk: item.slaRisk === 'risk', warning: item.slaRisk === 'warning' }">
              {{ formatTimer(item.waitSeconds) }}
            </div>
          </div>

          <div v-if="filteredQueueItems.length === 0" class="empty-queue">
            No waiting {{ activeQueueTab }} contacts in queue.
          </div>
        </div>

        <div class="queue-foot">
          <button class="btn btn-simulate" @click="store.triggerSimulatedInbound">
            ⚡ Simulate Inbound Call (Nigeria DID)
          </button>
        </div>
      </section>

      <!-- ════════════ Center Column: Active Call & Case ════════════ -->
      <section class="center-col">
        <!-- Call Card -->
        <section v-if="store.activeCall" class="panel active-call">
          <div class="call-ribbon">
            <span class="ribbon-dot">●</span>
            Recording active · Customer consent captured at {{ store.activeCall.recordingConsentCapturedAt }}
          </div>

          <div class="call-body">
            <div class="call-party">
              <div class="call-avatar">{{ store.activeCall.caller.avatar }}</div>
              <div>
                <strong>{{ store.activeCall.caller.name }}</strong>
                <span>{{ store.activeCall.caller.phone }} · <b class="verified-text">Verified customer</b></span>
              </div>
              <div class="call-time">
                <b class="timer-display">{{ formatTimer(store.activeCall.durationSeconds) }}</b>
                <span>Connected call</span>
              </div>
            </div>

            <div class="call-meta">
              <span>Meter <b>{{ store.activeCall.caller.meterNumber }}</b></span>
              <span>Station <b>{{ store.activeCall.caller.station }}</b></span>
              <span>Account <b>{{ store.activeCall.caller.accountId }}</b></span>
            </div>

            <div class="call-controls">
              <button
                class="btn btn-ctrl"
                :class="{ active: store.activeCall.isMuted }"
                @click="store.toggleMute"
              >
                {{ store.activeCall.isMuted ? 'Unmute 🔇' : 'Mute 🎙️' }}
              </button>

              <button
                class="btn btn-ctrl"
                :class="{ active: store.activeCall.isOnHold }"
                @click="store.toggleHold"
              >
                {{ store.activeCall.isOnHold ? 'Resume Call' : 'Hold ⏸️' }}
              </button>

              <div class="transfer-wrapper">
                <button class="btn btn-ctrl" @click="showTransferMenu = !showTransferMenu">
                  Transfer ▾
                </button>
                <div v-if="showTransferMenu" class="dropdown-menu">
                  <button @click="handleTransfer('Supervisor Escalation Queue')">Supervisor Queue</button>
                  <button @click="handleTransfer('Finance Operations')">Finance Operations</button>
                  <button @click="handleTransfer('Field Dispatch Desk')">Field Dispatch Desk</button>
                </div>
              </div>

              <button class="btn btn-end" @click="store.endActiveCall">
                End call ✕
              </button>
            </div>
          </div>
        </section>

        <!-- No Active Call Placeholder -->
        <section v-else class="panel idle-call">
          <div class="idle-content">
            <div class="idle-icon">📞</div>
            <h3>Station Ready · Standing By</h3>
            <p>Agent status is set to <b>{{ store.presence.replace('_', ' ') }}</b>. Take next caller from queue or wait for inbound screen-pop.</p>
            <button
              v-if="store.queue.length > 0"
              class="btn btn-take-next"
              @click="store.takeQueueCall(store.queue[0].id)"
            >
              Answer Longest Waiting Caller ({{ store.queue[0].callerName }})
            </button>
          </div>
        </section>

        <!-- Active Case Card -->
        <section v-if="store.activeCase" class="panel case">
          <div class="case-top">
            <div class="case-kicker">
              <span>OPEN CASE · #{{ store.activeCase.reference }}</span>
              <span>SLA remaining: {{ store.activeCase.slaRemainingMinutes }} mins</span>
            </div>
            <h3>{{ store.activeCase.title }}</h3>
            <div class="badges">
              <span class="badge" :class="store.activeCase.priority">{{ store.activeCase.priority }} priority</span>
              <span class="badge sla">SLA Due in {{ store.activeCase.slaRemainingMinutes }} min</span>
              <span v-if="store.activeCase.status !== 'open'" class="badge status-badge">
                {{ store.activeCase.status.replace('_', ' ') }}
              </span>
            </div>
          </div>

          <div class="case-facts">
            <div class="fact">
              <label>Category</label>
              <b>{{ store.activeCase.category.replace('_', ' ').toUpperCase() }}</b>
            </div>
            <div class="fact">
              <label>Owner</label>
              <b>{{ store.activeCase.owner }}</b>
            </div>
            <div class="fact">
              <label>Last payment</label>
              <b>{{ store.activeCase.lastPaymentSummary }}</b>
            </div>
            <div class="fact">
              <label>Purchase status</label>
              <b>{{ store.activeCase.purchaseStatus }}</b>
            </div>
          </div>

          <div class="notes">
            <label>Case notes & investigation log</label>
            <textarea
              class="note-box"
              :value="store.activeCase.notes"
              @input="handleNotesInput"
              placeholder="Record caller statements, vending checks, and root-cause details..."
            ></textarea>
          </div>

          <div class="case-foot">
            <button class="btn btn-escalate-trigger" @click="showEscalateModal = true">
              Escalate to Dept ▾
            </button>
            <button
              v-if="store.activeCase.status !== 'resolved'"
              class="btn btn-resolve"
              @click="showResolveModal = true"
            >
              Resolve case ✓
            </button>
            <span v-else class="resolved-stamp">Case Resolved</span>
          </div>
        </section>
      </section>

      <!-- ════════════ Right Column: Customer 360 ════════════ -->
      <section v-if="store.activeCustomer" class="panel customer-panel">
        <div class="panel-title">
          <h2>Customer 360</h2>
          <small class="account-link">Account {{ store.activeCustomer.id }}</small>
        </div>

        <div class="customer-body">
          <div class="customer-id">
            <div class="call-avatar">{{ store.activeCustomer.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) }}</div>
            <div>
              <strong>{{ store.activeCustomer.name }}</strong>
              <small>Customer since {{ store.activeCustomer.customerSince }}</small>
            </div>
            <span class="status-pill">{{ store.activeCustomer.status }}</span>
          </div>

          <div class="customer-row">
            <label>Meter Number</label>
            <b>{{ store.activeCustomer.meter.number }}<br><small>{{ store.activeCustomer.meter.type }}</small></b>
          </div>

          <div class="customer-row">
            <label>Wallet balance</label>
            <b class="balance-badge">₦{{ store.activeCustomer.walletBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 }) }}</b>
          </div>

          <div class="customer-row">
            <label>Last payment</label>
            <b>₦{{ store.activeCustomer.lastPayment.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 }) }}<br><small class="text-brand">{{ store.activeCustomer.lastPayment.status }}</small></b>
          </div>

          <div class="customer-row">
            <label>Service Area</label>
            <b>{{ store.activeCustomer.serviceArea }}</b>
          </div>
        </div>

        <div class="panel-title timeline-head">
          <h2>Interaction timeline</h2>
          <small>Audit Log</small>
        </div>

        <div class="timeline">
          <div
            v-for="event in store.activeCustomer.timeline"
            :key="event.id"
            class="event"
            :class="{ live: event.isLive }"
          >
            <b>{{ event.title }}</b>
            <span>{{ event.subtitle }}</span>
            <time>{{ event.time }}</time>
          </div>
        </div>

        <div class="panel-foot">
          <p class="live-policy-note">
            <b>Live data policy:</b> Payment, wallet and meter records are read-only in Support Centre. Use authorised Beverly maker-checker workflows for value release.
          </p>
        </div>
      </section>
    </div>

    <!-- Modals -->
    <ResolveCaseModal v-if="showResolveModal" @close="showResolveModal = false" />
    <EscalateModal v-if="showEscalateModal" @close="showEscalateModal = false" />
  </div>
</template>

<style scoped>
.live-desk-page {
  padding: 24px 30px 30px;
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-head h1 {
  font-size: 24px;
  line-height: 1.1;
  color: var(--ink);
  letter-spacing: -0.7px;
  margin: 0;
}

.page-head p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.shift-info {
  font: 11px var(--mono);
  color: var(--muted);
  text-align: right;
}

.shift-info b {
  color: var(--ink);
  font-size: 12px;
}

.live-grid {
  display: grid;
  grid-template-columns: minmax(260px, 0.85fr) minmax(440px, 1.4fr) minmax(280px, 0.9fr);
  gap: 18px;
  align-items: start;
}

@media (max-width: 1200px) {
  .live-grid {
    grid-template-columns: 1fr 1.4fr;
  }
}

@media (max-width: 860px) {
  .live-grid {
    grid-template-columns: 1fr;
  }
}

.panel {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--r);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.panel-title {
  min-height: 50px;
  padding: 0 16px;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title h2 {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  margin: 0;
}

.panel-title small {
  color: var(--muted);
  font: 11px var(--mono);
}

/* ════════════ Queue Styles ════════════ */
.queue-tabs {
  display: flex;
  border-bottom: 1px solid var(--line);
  background: var(--card-subtle);
}

.tab-btn {
  flex: 1;
  padding: 10px 12px;
  font-weight: 700;
  font-size: 12px;
  color: var(--muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn.active {
  color: var(--brand-deep);
  border-color: var(--brand);
  background: var(--card);
}

.queue-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--line);
}

.metric {
  padding: 12px 16px;
}

.metric + .metric {
  border-left: 1px solid var(--line);
}

.metric span {
  display: block;
  color: var(--muted);
  font-size: 11px;
}

.metric b {
  display: block;
  color: var(--ink);
  font: 700 22px var(--mono);
  letter-spacing: -1px;
  margin-top: 2px;
}

.metric-amber {
  color: var(--amber-text);
}

.queue-list {
  max-height: 480px;
  overflow-y: auto;
}

.q-item {
  display: grid;
  grid-template-columns: 30px 1fr auto;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
  align-items: center;
  cursor: pointer;
  transition: background 0.15s ease;
}

.q-item:hover {
  background: var(--card-subtle);
}

.q-item.active {
  background: var(--brand-soft);
  box-shadow: inset 3px 0 0 var(--brand);
}

.phone-mark {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--blue-soft);
  color: var(--blue);
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 12px;
}

.q-info strong {
  display: block;
  color: var(--ink);
  font-size: 12px;
}

.q-info small {
  display: block;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 135px;
}

.timer {
  font: 11px var(--mono);
  font-weight: 700;
  padding: 3px 6px;
  border-radius: 4px;
  background: var(--card-subtle);
  color: var(--muted);
}

.timer.warning {
  background: var(--amber-soft);
  color: var(--amber-text);
}

.timer.risk {
  background: var(--red-soft);
  color: var(--red);
}

.empty-queue {
  padding: 32px 16px;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
}

.queue-foot {
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  background: var(--canvas);
}

.btn-simulate {
  width: 100%;
  height: 34px;
  background: var(--card);
  border: 1px dashed var(--brand);
  border-radius: 6px;
  color: var(--brand-deep);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-simulate:hover {
  background: var(--brand-soft);
}

/* ════════════ Active Call Styles ════════════ */
.center-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.active-call {
  border-color: color-mix(in srgb, var(--blue) 50%, var(--line));
  box-shadow: 0 0 0 1px var(--blue-soft), var(--shadow);
}

.call-ribbon {
  background: var(--blue-soft);
  color: var(--blue);
  padding: 8px 16px;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ribbon-dot {
  color: var(--red);
  animation: blink 1.2s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.call-body {
  padding: 18px 20px 16px;
}

.call-party {
  display: flex;
  align-items: center;
  gap: 12px;
}

.call-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--brand-deep);
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 15px;
}

.call-party strong {
  display: block;
  font-size: 17px;
  color: var(--ink);
  letter-spacing: -0.3px;
}

.call-party span {
  display: block;
  color: var(--muted);
  font-size: 12px;
  margin-top: 2px;
}

.verified-text {
  color: var(--brand-deep);
}

.call-time {
  margin-left: auto;
  text-align: right;
}

.timer-display {
  display: block;
  color: var(--blue);
  font: 700 26px var(--mono);
  letter-spacing: -1px;
}

.call-time span {
  display: block;
  color: var(--muted);
  font-size: 11px;
}

.call-meta {
  display: flex;
  gap: 18px;
  border-top: 1px solid var(--line);
  margin-top: 16px;
  padding-top: 12px;
  font-size: 12px;
  color: var(--muted);
}

.call-meta b {
  color: var(--ink);
  font-weight: 700;
}

.call-controls {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  align-items: center;
}

.btn-ctrl {
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--card);
  color: var(--ink);
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
}

.btn-ctrl.active {
  background: var(--amber-soft);
  border-color: var(--amber);
  color: var(--amber-text);
}

.btn-end {
  margin-left: auto;
  height: 36px;
  padding: 0 16px;
  background: var(--red);
  border: 1px solid var(--red);
  border-radius: 6px;
  color: white;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
}

.btn-end:hover {
  filter: brightness(1.1);
}

.transfer-wrapper {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: var(--card);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  box-shadow: var(--shadow);
  z-index: 100;
  min-width: 180px;
  padding: 4px 0;
}

.dropdown-menu button {
  width: 100%;
  padding: 8px 14px;
  text-align: left;
  background: none;
  border: none;
  font-size: 12px;
  color: var(--ink);
  cursor: pointer;
}

.dropdown-menu button:hover {
  background: var(--card-subtle);
}

.idle-call {
  padding: 36px 24px;
  text-align: center;
}

.idle-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.idle-content h3 {
  margin: 0;
  font-size: 16px;
  color: var(--ink);
}

.idle-content p {
  color: var(--muted);
  font-size: 12px;
  max-width: 380px;
  margin: 6px auto 16px;
}

.btn-take-next {
  height: 38px;
  padding: 0 18px;
  background: var(--brand);
  border: 1px solid var(--brand);
  border-radius: 6px;
  color: oklch(18% 0.02 145);
  font-weight: 700;
  cursor: pointer;
}

/* ════════════ Case Styles ════════════ */
.case-top {
  padding: 18px 20px 14px;
}

.case-kicker {
  font: 11px var(--mono);
  color: var(--muted);
  display: flex;
  justify-content: space-between;
}

.case h3 {
  font-size: 18px;
  letter-spacing: -0.35px;
  color: var(--ink);
  margin: 8px 0 10px;
}

.badges {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}

.badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 5px;
}

.badge.high, .badge.urgent {
  color: var(--red);
  background: var(--red-soft);
}

.badge.normal, .badge.low {
  color: var(--blue);
  background: var(--blue-soft);
}

.badge.sla {
  color: var(--amber-text);
  background: var(--amber-soft);
}

.status-badge {
  background: var(--card-subtle);
  color: var(--muted);
  text-transform: capitalize;
}

.case-facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.fact {
  padding: 10px 20px;
}

.fact:nth-child(odd) {
  border-right: 1px solid var(--line);
}

.fact label,
.customer-row label {
  display: block;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.fact b {
  color: var(--ink);
  font-size: 12px;
}

.notes {
  padding: 14px 20px;
}

.notes label {
  font-weight: 700;
  font-size: 12px;
  color: var(--ink);
  display: block;
  margin-bottom: 6px;
}

.note-box {
  width: 100%;
  height: 72px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 10px;
  color: var(--ink);
  background: var(--card);
  font-size: 12px;
  resize: vertical;
}

.note-box:focus {
  outline: 2px solid var(--brand);
}

.case-foot {
  display: flex;
  padding: 0 20px 18px;
  gap: 10px;
  align-items: center;
}

.btn-escalate-trigger {
  height: 38px;
  padding: 0 14px;
  border: 1px solid var(--line-strong);
  background: var(--card);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
  cursor: pointer;
}

.btn-resolve {
  margin-left: auto;
  height: 38px;
  padding: 0 18px;
  background: var(--brand);
  border: 1px solid var(--brand);
  border-radius: 6px;
  color: oklch(18% 0.02 145);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.resolved-stamp {
  margin-left: auto;
  font-size: 12px;
  font-weight: 800;
  color: var(--brand-deep);
  background: var(--brand-soft);
  padding: 6px 12px;
  border-radius: 6px;
}

/* ════════════ Customer 360 Styles ════════════ */
.customer-body {
  padding: 0 18px;
}

.customer-id {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}

.customer-id .call-avatar {
  width: 38px;
  height: 38px;
  font-size: 12px;
}

.customer-id strong {
  display: block;
  color: var(--ink);
  font-size: 14px;
}

.customer-id small {
  color: var(--muted);
  font-size: 11px;
}

.status-pill {
  margin-left: auto;
  padding: 3px 8px;
  border-radius: 5px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  font-weight: 700;
  font-size: 10px;
}

.customer-row {
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.customer-row b {
  color: var(--ink);
  font-size: 12px;
  text-align: right;
}

.customer-row small {
  color: var(--muted);
  font-size: 11px;
}

.balance-badge {
  color: var(--brand-deep) !important;
  background: var(--brand-soft);
  padding: 2px 6px;
  border-radius: 4px;
}

.timeline-head {
  margin-top: 4px;
}

.timeline {
  padding: 4px 18px 16px;
}

.event {
  position: relative;
  padding: 10px 0 10px 18px;
  border-left: 1px solid var(--line);
}

.event:before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--brand);
  position: absolute;
  left: -4px;
  top: 15px;
}

.event.live:before {
  background: var(--blue);
  box-shadow: 0 0 0 3px var(--blue-soft);
}

.event:first-child {
  border-left-color: transparent;
}

.event b {
  display: block;
  font-size: 12px;
  color: var(--ink);
}

.event span {
  display: block;
  color: var(--muted);
  font-size: 11px;
}

.event time {
  font: 10px var(--mono);
  color: var(--faint);
}

.panel-foot {
  padding: 12px 18px;
  background: var(--card-subtle);
  border-top: 1px solid var(--line);
}

.live-policy-note {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.4;
}

.live-policy-note b {
  color: var(--ink);
}
</style>
