<script setup lang="ts">
import { ref } from 'vue';
import { useSupportCentreStore } from '../stores/support-centre';

const emit = defineEmits<{ (e: 'close'): void }>();
const store = useSupportCentreStore();

const target = ref<'Finance' | 'Field Operations'>('Finance');
const reason = ref('');

function submitEscalate() {
  if (!reason.value.trim()) return;
  store.escalateActiveCase(target.value, reason.value.trim());
  emit('close');
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-card">
      <div class="modal-header">
        <div>
          <h3>Escalate Case</h3>
          <p v-if="store.activeCase">Case #{{ store.activeCase.reference }} · Hand off to specialised team</p>
        </div>
        <button class="btn-close" @click="emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>Target Operational Department *</label>
          <div class="department-options">
            <label class="dept-card" :class="{ selected: target === 'Finance' }">
              <input type="radio" v-model="target" value="Finance" name="dept">
              <div>
                <strong>Finance Operations</strong>
                <span>Payment gateway reconciliation, uncredited deposits & double-debit refund reviews</span>
              </div>
            </label>
            <label class="dept-card" :class="{ selected: target === 'Field Operations' }">
              <input type="radio" v-model="target" value="Field Operations" name="dept">
              <div>
                <strong>Field Operations & Dispatches</strong>
                <span>On-site technician dispatch, physical meter repair, CT/PT inspection & line repairs</span>
              </div>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>Escalation Justification & Evidence *</label>
          <textarea
            v-model="reason"
            rows="4"
            class="form-textarea"
            placeholder="Document caller details, troubleshooting already attempted, transaction IDs, or physical failure symptoms..."
            required
          ></textarea>
        </div>

        <div class="alert-box">
          <b>SLA Note:</b> Escalating transfers case ownership to the department lead queue with full audit history and active countdown timer.
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-cancel" @click="emit('close')">Cancel</button>
        <button class="btn btn-escalate" :disabled="!reason.trim()" @click="submitEscalate">
          Submit Escalation
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 540px;
  overflow: hidden;
}

.modal-header {
  padding: 18px 24px;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--ink);
}

.modal-header p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
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
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin-bottom: 8px;
}

.department-options {
  display: grid;
  gap: 10px;
}

.dept-card {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dept-card.selected {
  border-color: var(--brand);
  background: var(--brand-soft);
}

.dept-card strong {
  display: block;
  color: var(--ink);
  font-size: 13px;
}

.dept-card span {
  display: block;
  color: var(--muted);
  font-size: 11px;
  margin-top: 2px;
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--card);
  color: var(--ink);
  font-size: 13px;
}

.form-textarea:focus {
  outline: 2px solid var(--brand);
}

.alert-box {
  background: var(--amber-soft);
  border: 1px solid color-mix(in srgb, var(--amber) 30%, transparent);
  border-radius: 6px;
  padding: 12px;
  font-size: 11px;
  color: var(--amber-text);
  line-height: 1.4;
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

.btn-escalate {
  background: var(--blue);
  border: 1px solid var(--blue);
  color: white;
}

.btn-escalate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
