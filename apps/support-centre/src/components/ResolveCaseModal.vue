<script setup lang="ts">
import { ref } from 'vue';
import { useSupportCentreStore } from '../stores/support-centre';

const emit = defineEmits<{ (e: 'close'): void }>();
const store = useSupportCentreStore();

const resolutionCode = ref('TOKEN_REISSUED');
const resolutionNotes = ref('');

const codes = [
  { value: 'TOKEN_REISSUED', label: 'Token re-issued via STS SMS retry' },
  { value: 'RECONCILED_DEPOSIT', label: 'Payment confirmed & wallet credited' },
  { value: 'ADVISED_CUSTOMER', label: 'Customer guidance / tariff policy clarified' },
  { value: 'HARDWARE_RESET', label: 'Remote meter reset / STS pulse normal' },
  { value: 'ESCALATION_RESOLVED', label: 'Resolved after cross-team review' },
];

function submitResolve() {
  store.resolveActiveCase(resolutionCode.value, resolutionNotes.value);
  emit('close');
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-card">
      <div class="modal-header">
        <div>
          <h3>Resolve Support Case</h3>
          <p v-if="store.activeCase">Case #{{ store.activeCase.reference }} · {{ store.activeCase.title }}</p>
        </div>
        <button class="btn-close" @click="emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>Resolution Code *</label>
          <select v-model="resolutionCode" class="form-select">
            <option v-for="c in codes" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>Resolution Summary & Proof of Action *</label>
          <textarea
            v-model="resolutionNotes"
            rows="4"
            class="form-textarea"
            placeholder="Explain how the issue was resolved, confirmation sent to caller, and verification steps taken..."
          ></textarea>
        </div>

        <div class="notice-box">
          <b>Audit & Policy Check:</b> Resolving this case documents closure in the customer timeline and notifies the team supervisor. Vending transactions and wallet mutations remain locked and audit-proven.
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-cancel" @click="emit('close')">Cancel</button>
        <button class="btn btn-confirm" @click="submitResolve">Confirm Resolution</button>
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
  max-width: 520px;
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
  font-family: var(--mono);
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
  margin-bottom: 6px;
}

.form-select,
.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--card);
  color: var(--ink);
  font-size: 13px;
}

.form-select:focus,
.form-textarea:focus {
  outline: 2px solid var(--brand);
}

.notice-box {
  background: var(--brand-soft);
  border: 1px solid color-mix(in srgb, var(--brand) 30%, transparent);
  border-radius: 6px;
  padding: 12px;
  font-size: 11px;
  color: var(--brand-deep);
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

.btn-confirm {
  background: var(--brand);
  border: 1px solid var(--brand);
  color: oklch(18% 0.02 145);
}
</style>
