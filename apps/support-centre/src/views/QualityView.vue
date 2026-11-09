<script setup lang="ts">
import { ref } from 'vue';
import { useSupportCentreStore } from '../stores/support-centre';
import type { QualityRecord } from '../types';

const store = useSupportCentreStore();

const selectedRecord = ref<QualityRecord | null>(store.qualityRecords[0] || null);
const isPlaying = ref(false);

function togglePlay() {
  isPlaying.value = !isPlaying.value;
}

function saveScorecard() {
  if (!selectedRecord.value) return;
  // Calculate score based on checklist
  const checks = Object.values(selectedRecord.value.checklist);
  const passed = checks.filter(Boolean).length;
  selectedRecord.value.score = Math.round((passed / checks.length) * 100);
  selectedRecord.value.evaluated = true;
  alert(`Quality evaluation saved! Overall score: ${selectedRecord.value.score}%`);
}
</script>

<template>
  <div class="quality-page">
    <div class="page-head">
      <div>
        <h1>Quality & Recording Reviews</h1>
        <p>Supervisor call evaluation, NDPA consent auditing and agent coaching scorecards.</p>
      </div>
    </div>

    <div class="quality-layout">
      <!-- Left: Recordings List -->
      <div class="panel">
        <div class="panel-header">
          <h3>Interaction Recordings</h3>
          <small>{{ store.qualityRecords.length }} calls captured</small>
        </div>

        <div class="recordings-list">
          <div
            v-for="rec in store.qualityRecords"
            :key="rec.id"
            class="rec-item"
            :class="{ active: selectedRecord?.id === rec.id }"
            @click="selectedRecord = rec; isPlaying = false"
          >
            <div class="play-icon">▶</div>
            <div class="rec-info">
              <strong>{{ rec.customerName }}</strong>
              <small>{{ rec.agentName }} · {{ rec.recordedAt }}</small>
            </div>
            <div class="rec-score">
              <span class="score-badge" :class="{ pass: rec.score >= 85 }">{{ rec.score }}%</span>
              <small>{{ rec.duration }}</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Player & Scorecard -->
      <div v-if="selectedRecord" class="panel detail-panel">
        <div class="panel-header">
          <div>
            <h3>{{ selectedRecord.customerName }} · Call Review</h3>
            <small>{{ selectedRecord.callId }} · Handled by {{ selectedRecord.agentName }}</small>
          </div>
          <span class="score-badge large" :class="{ pass: selectedRecord.score >= 85 }">
            Score: {{ selectedRecord.score }}%
          </span>
        </div>

        <div class="panel-body">
          <!-- Audio Player Mock -->
          <div class="player-card">
            <div class="player-controls">
              <button class="btn-play" @click="togglePlay">
                {{ isPlaying ? '⏸ Pause' : '▶ Play Audio' }}
              </button>
              <div class="audio-waveform" :class="{ playing: isPlaying }">
                <span v-for="i in 36" :key="i" class="wave-bar" :style="{ height: `${20 + (i * 7) % 35}px` }"></span>
              </div>
              <span class="player-timer">{{ selectedRecord.duration }}</span>
            </div>
            <div class="consent-tag">
              ✓ Verified: Mandatory Recording & Data Privacy consent announced prior to connection
            </div>
          </div>

          <!-- Evaluation Scorecard -->
          <div class="scorecard-section">
            <h4>Quality Evaluation Scorecard</h4>
            <div class="checklist">
              <label class="check-item">
                <input type="checkbox" v-model="selectedRecord.checklist.greeting" />
                <div>
                  <strong>Standard Greeting & Brand Identity</strong>
                  <span>Agent introduced Beverly CRM & stated their name clearly</span>
                </div>
              </label>

              <label class="check-item">
                <input type="checkbox" v-model="selectedRecord.checklist.verification" />
                <div>
                  <strong>Customer Identity Verification</strong>
                  <span>Phone number and STS meter address validated before account disclosure</span>
                </div>
              </label>

              <label class="check-item">
                <input type="checkbox" v-model="selectedRecord.checklist.diagnosis" />
                <div>
                  <strong>Effective Problem Diagnosis</strong>
                  <span>Active listening, correct categorization and avoided repetitive questioning</span>
                </div>
              </label>

              <label class="check-item">
                <input type="checkbox" v-model="selectedRecord.checklist.accuracy" />
                <div>
                  <strong>Technical & Operational Accuracy</strong>
                  <span>Correct tariff explanations, vending checks and zero unapproved financial promises</span>
                </div>
              </label>

              <label class="check-item">
                <input type="checkbox" v-model="selectedRecord.checklist.policyCompliance" />
                <div>
                  <strong>Escalation Policy Compliance</strong>
                  <span>Followed maker-checker routing to Finance or Field when required</span>
                </div>
              </label>

              <label class="check-item">
                <input type="checkbox" v-model="selectedRecord.checklist.documentation" />
                <div>
                  <strong>Accurate Case Documentation</strong>
                  <span>Documented caller statements, evidence and clear next action in case file</span>
                </div>
              </label>
            </div>

            <div class="coaching-notes">
              <label>Supervisor Feedback & Coaching Notes</label>
              <textarea v-model="selectedRecord.notes" rows="3" class="form-textarea" placeholder="Provide constructive feedback for the agent..."></textarea>
            </div>
          </div>
        </div>

        <div class="panel-footer">
          <button class="btn btn-save" @click="saveScorecard">
            Save Quality Evaluation ✓
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quality-page {
  padding: 24px 30px 40px;
}

.page-head {
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

.quality-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 20px;
  align-items: start;
}

@media (max-width: 960px) {
  .quality-layout {
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

.panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--ink);
}

.panel-header small {
  color: var(--muted);
  font-family: var(--mono);
  font-size: 11px;
}

.recordings-list {
  max-height: 580px;
  overflow-y: auto;
}

.rec-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  transition: background 0.15s ease;
}

.rec-item:hover {
  background: var(--card-subtle);
}

.rec-item.active {
  background: var(--brand-soft);
}

.play-icon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--blue-soft);
  color: var(--blue);
  display: grid;
  place-items: center;
  font-size: 11px;
}

.rec-info {
  flex: 1;
  min-width: 0;
}

.rec-info strong {
  display: block;
  font-size: 13px;
  color: var(--ink);
}

.rec-info small {
  display: block;
  color: var(--muted);
  font-size: 11px;
}

.rec-score {
  text-align: right;
}

.score-badge {
  font: 700 12px var(--mono);
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--amber-soft);
  color: var(--amber-text);
}

.score-badge.pass {
  background: var(--brand-soft);
  color: var(--brand-deep);
}

.score-badge.large {
  font-size: 13px;
  padding: 4px 10px;
}

.rec-score small {
  display: block;
  font: 10px var(--mono);
  color: var(--muted);
  margin-top: 2px;
}

.panel-body {
  padding: 24px;
}

/* Audio Player */
.player-card {
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 18px 20px;
  margin-bottom: 24px;
}

.player-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn-play {
  height: 36px;
  padding: 0 14px;
  background: var(--brand);
  color: oklch(18% 0.02 145);
  border: none;
  border-radius: 6px;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
}

.audio-waveform {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 3px;
  height: 40px;
}

.wave-bar {
  flex: 1;
  background: var(--line-strong);
  border-radius: 2px;
  transition: all 0.2s ease;
}

.audio-waveform.playing .wave-bar {
  background: var(--brand);
  animation: wave 0.8s infinite ease-in-out alternate;
}

@keyframes wave {
  0% { transform: scaleY(0.4); }
  100% { transform: scaleY(1.2); }
}

.player-timer {
  font: 700 13px var(--mono);
  color: var(--ink);
}

.consent-tag {
  margin-top: 12px;
  font-size: 11px;
  color: var(--brand-deep);
  font-weight: 600;
}

/* Scorecard */
.scorecard-section h4 {
  margin: 0 0 14px;
  font-size: 14px;
  color: var(--ink);
}

.checklist {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.check-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 6px;
  cursor: pointer;
  background: var(--card);
}

.check-item input {
  margin-top: 3px;
}

.check-item strong {
  display: block;
  font-size: 13px;
  color: var(--ink);
}

.check-item span {
  display: block;
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}

.coaching-notes label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 6px;
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  font-size: 13px;
  background: var(--card);
  color: var(--ink);
}

.panel-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--line);
  background: var(--canvas);
  display: flex;
  justify-content: flex-end;
}

.btn-save {
  height: 38px;
  padding: 0 18px;
  background: var(--brand);
  color: oklch(18% 0.02 145);
  border: 1px solid var(--brand);
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
}
</style>
