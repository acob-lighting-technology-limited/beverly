<script setup lang="ts">
/**
 * Portal access picker — which Beverly staff portals an account may sign in to.
 * Writes users.portal_access through POST/PATCH /api/v1/admin/access/users.
 * The catalog comes from GET /api/v1/admin/access → portals, so labels match
 * backend/wallet/src/services/staff-portal-access.ts.
 */
import { computed } from 'vue';

export interface StaffPortalOption {
    key: string;
    label: string;
    description?: string;
}

/* Pre-load fallback only; the server catalog replaces it. */
const FALLBACK_PORTALS: StaffPortalOption[] = [
    { key: 'crm', label: 'Beverly CRM' },
    { key: 'staff_wallet', label: 'Beverly Staff Wallet' },
    { key: 'call', label: 'Beverly Call' },
    { key: 'pue', label: 'Beverly PUE' },
];

const props = withDefaults(defineProps<{
    modelValue: string[];
    portals?: StaffPortalOption[];
    disabled?: boolean;
    /** Super admins always reach every portal; shown checked and locked. */
    lockedAll?: boolean;
    /** Prefix for stable data-testid selectors. */
    testId?: string;
}>(), {
    portals: () => [],
    disabled: false,
    lockedAll: false,
    testId: 'portal-access',
});

const emit = defineEmits<{ (e: 'update:modelValue', value: string[]): void }>();

const options = computed(() => (props.portals.length ? props.portals : FALLBACK_PORTALS));
const selected = computed(() => new Set(props.lockedAll ? options.value.map((p) => p.key) : props.modelValue));

function toggle(key: string) {
    if (props.disabled || props.lockedAll) return;
    const next = new Set(props.modelValue);
    if (next.has(key)) next.delete(key); else next.add(key);
    // Keep catalog order so saved lists compare cleanly.
    emit('update:modelValue', options.value.map((p) => p.key).filter((k) => next.has(k)));
}
</script>

<template>
  <fieldset class="pap" :disabled="disabled || lockedAll" :data-testid="testId">
    <legend class="bw-sr-only">Portal access</legend>
    <label
      v-for="portal in options"
      :key="portal.key"
      :class="['pap-option', selected.has(portal.key) && 'is-on']"
    >
      <input
        type="checkbox"
        :checked="selected.has(portal.key)"
        :disabled="disabled || lockedAll"
        :data-testid="`${testId}-${portal.key}`"
        @change="toggle(portal.key)"
      />
      <span class="pap-text">
        <span class="pap-label">{{ portal.label }}</span>
        <span v-if="portal.description" class="pap-desc">{{ portal.description }}</span>
      </span>
    </label>
  </fieldset>
</template>

<style scoped>
.pap {
    margin: 0;
    padding: 0;
    border: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
}
.pap-option {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background: var(--surface-2);
    cursor: pointer;
    transition: border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
}
.pap-option:hover { border-color: var(--brand); }
.pap-option.is-on { border-color: var(--brand); background: var(--surface-3); }
.pap:disabled .pap-option { cursor: not-allowed; opacity: .75; }
.pap-option input { margin-top: 2px; accent-color: var(--brand); }
.pap-option input:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.pap-text { display: grid; gap: 2px; min-width: 0; }
.pap-label { color: var(--text); font-size: var(--t-sm); font-weight: 700; }
.pap-desc { color: var(--text-muted); font-size: var(--t-xs); }
</style>
