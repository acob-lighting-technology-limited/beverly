<script setup lang="ts">
import { ref } from 'vue';
import { useSupportCentreStore } from '../stores/support-centre';

const store = useSupportCentreStore();

const showNewIncident = ref(false);
const newTitle = ref('');
const newArea = ref('');
const newStations = ref('');
const newMeters = ref(150);
const newMessage = ref('');

function createIncident() {
  if (!newTitle.value.trim()) return;
  store.incidents.unshift({
    id: `INC-2026-${String(store.incidents.length + 1).padStart(2, '0')}`,
    title: newTitle.value.trim(),
    area: newArea.value.trim() || 'Central Distribution Network',
    affectedStations: newStations.value.split(',').map((s) => s.trim()).filter(Boolean),
    affectedMeters: Number(newMeters.value) || 0,
    status: 'investigating',
    owner: store.agent.name,
    startedAt: new Date().toISOString(),
    nextUpdate: 'Within 30 mins',
    customerMessage: newMessage.value.trim() || 'Engineers are investigating grid anomaly. Updates will follow.',
  });

  newTitle.value = '';
  newArea.value = '';
  newStations.value = '';
  newMessage.value = '';
  showNewIncident.value = false;
}

function updateStatus(incId: string, newStatus: 'investigating' | 'identified' | 'monitoring' | 'resolved') {
  const inc = store.incidents.find((i) => i.id === incId);
  if (inc) {
    inc.status = newStatus;
  }
}
</script>

<template>
  <div class="incidents-page">
    <div class="page-head">
      <div>
        <h1>Incident Command Centre</h1>
        <p>Coordinate minigrid outages, feeder trips and emergency customer communication scripts.</p>
      </div>
      <button class="btn btn-incident" @click="showNewIncident = true">
        + Declare Major Incident
      </button>
    </div>

    <!-- Active Incident Banners -->
    <div class="incidents-list">
      <div
        v-for="inc in store.incidents"
        :key="inc.id"
        class="incident-card"
        :class="inc.status"
      >
        <div class="incident-header">
          <div>
            <div class="incident-badge">
              <span class="status-indicator"></span>
              {{ inc.id }} · {{ inc.status.toUpperCase() }}
            </div>
            <h2>{{ inc.title }}</h2>
            <div class="incident-meta">
              <span>Area: <b>{{ inc.area }}</b></span>
              <span>·</span>
              <span>Affected Stations: <b>{{ inc.affectedStations.join(', ') || 'Grid-wide' }}</b></span>
              <span>·</span>
              <span>Impact: <b>{{ inc.affectedMeters }} meters</b></span>
            </div>
          </div>

          <div class="status-actions">
            <select :value="inc.status" @change="(e) => updateStatus(inc.id, (e.target as HTMLSelectElement).value as any)" class="status-select">
              <option value="investigating">Investigating</option>
              <option value="identified">Identified</option>
              <option value="monitoring">Monitoring</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div class="customer-broadcast">
          <label>Approved Customer Script & IVR Announcement</label>
          <p>{{ inc.customerMessage }}</p>
        </div>

        <div class="incident-foot">
          <span>Incident Commander: <b>{{ inc.owner }}</b></span>
          <span>Next Scheduled Review: <b>{{ inc.nextUpdate }}</b></span>
        </div>
      </div>
    </div>

    <!-- Declare Incident Modal -->
    <div v-if="showNewIncident" class="modal-overlay" @click.self="showNewIncident = false">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Declare Network Incident</h3>
          <button class="btn-close" @click="showNewIncident = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>Incident Title *</label>
            <input v-model="newTitle" type="text" placeholder="e.g. Lekki Phase 1 11kV Feeder Transformer Trip" class="form-input" />
          </div>

          <div class="form-group">
            <label>Geographic Area Affected</label>
            <input v-model="newArea" type="text" placeholder="e.g. Lekki Phase 1, Admiralty Way" class="form-input" />
          </div>

          <div class="form-group">
            <label>Affected Minigrid Stations (Comma separated)</label>
            <input v-model="newStations" type="text" placeholder="e.g. Lekki Central, Admiralty Mini-Grid" class="form-input" />
          </div>

          <div class="form-group">
            <label>Estimated Meters Impacted</label>
            <input v-model="newMeters" type="number" class="form-input" />
          </div>

          <div class="form-group">
            <label>Customer Broadcast Script (Africa's Talking IVR & Support Agent Pop-up)</label>
            <textarea v-model="newMessage" rows="3" class="form-textarea" placeholder="Approved guidance for agents handling incoming calls..."></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-cancel" @click="showNewIncident = false">Cancel</button>
          <button class="btn btn-confirm" @click="createIncident">Publish Incident Notice</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.incidents-page {
  padding: 24px 30px 40px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
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

.btn-incident {
  height: 38px;
  padding: 0 16px;
  background: var(--red);
  color: white;
  border: 1px solid var(--red);
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
}

.incidents-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.incident-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--r);
  box-shadow: var(--shadow);
  padding: 20px 24px;
}

.incident-card.investigating {
  border-left: 5px solid var(--red);
}

.incident-card.identified,
.incident-card.monitoring {
  border-left: 5px solid var(--amber);
}

.incident-card.resolved {
  border-left: 5px solid var(--brand);
}

.incident-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.incident-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: 11px var(--mono);
  font-weight: 800;
  color: var(--muted);
  margin-bottom: 6px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.incident-card.investigating .status-indicator {
  background: var(--red);
}

.incident-card.monitoring .status-indicator {
  background: var(--amber);
}

.incident-card.resolved .status-indicator {
  background: var(--brand);
}

.incident-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--ink);
}

.incident-meta {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.incident-meta b {
  color: var(--ink);
}

.status-select {
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--card);
  color: var(--ink);
  font-weight: 700;
  font-size: 12px;
}

.customer-broadcast {
  margin-top: 18px;
  background: var(--card-subtle);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 14px 18px;
}

.customer-broadcast label {
  display: block;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin-bottom: 4px;
}

.customer-broadcast p {
  margin: 0;
  font-size: 13px;
  color: var(--ink);
  line-height: 1.5;
}

.incident-foot {
  margin-top: 16px;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--muted);
  font-family: var(--mono);
}

.incident-foot b {
  color: var(--ink);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  z-index: 99999;
  display: grid;
  place-items: center;
  padding: 16px;
}

.modal-card {
  background: var(--card);
  border: 1px solid var(--line-strong);
  border-radius: var(--r);
  width: 100%;
  max-width: 520px;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  padding: 18px 24px;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--ink);
}

.btn-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--muted);
}

.modal-body {
  padding: 20px 24px;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 6px;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--card);
  color: var(--ink);
  font-size: 13px;
}

.modal-footer {
  padding: 14px 24px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background: var(--canvas);
}

.btn {
  height: 38px;
  padding: 0 16px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
}

.btn-cancel {
  background: var(--card);
  border: 1px solid var(--line-strong);
  color: var(--ink);
}

.btn-confirm {
  background: var(--red);
  border: 1px solid var(--red);
  color: white;
}
</style>
