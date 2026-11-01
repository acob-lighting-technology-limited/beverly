<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '../lib/api';

const props = defineProps<{ context: any }>();
const profile = ref<any>(null);
const unavailable = ref(false);
let request = 0;
watch(() => [props.context?.customer_id, props.context?.vendor_organization_id], async ([customerId, vendorId]) => {
    const current = ++request;
    profile.value = null;
    unavailable.value = false;
    const id = customerId || vendorId;
    if (!id) return;
    try {
        const res = await api.get<any>(`/api/v1/admin/${customerId ? 'customers' : 'vendors'}/${encodeURIComponent(id)}`);
        if (current === request) profile.value = res.customer ?? res.vendor ?? null;
    } catch { if (current === request) unavailable.value = true; }
}, { immediate: true });
</script>

<template>
  <aside class="support-requester" aria-label="Requester details">
    <strong>Requester details</strong>
    <span>{{ context.requester_name || context.display_name || context.requester_actor_type }}</span>
    <template v-if="profile">
      <span v-if="profile.phone || profile.contact_phone">{{ profile.phone || profile.contact_phone }}</span>
      <span v-if="profile.email || profile.contact_email">{{ profile.email || profile.contact_email }}</span>
      <span v-if="profile.status">{{ profile.status }}</span>
    </template>
    <small v-else-if="unavailable">Profile details unavailable.</small>
    <strong>Related meters</strong>
    <span v-if="context.meter_context == null">Not recorded</span>
    <span v-else-if="!context.meter_context.length">No meter involved</span>
    <span v-for="meter in context.meter_context || []" :key="`${meter.meter_id}:${meter.station_id}`">{{ meter.meter_id }}<template v-if="meter.station_id"> · {{ meter.station_id }}</template></span>
    <router-link v-if="context.customer_id" :to="`/customers/${context.customer_id}`">Open customer profile</router-link>
    <router-link v-else-if="context.vendor_organization_id" :to="`/vendors/${context.vendor_organization_id}`">Open vendor profile</router-link>
  </aside>
</template>

<style scoped>
.support-requester { display: flex; flex-direction: column; gap: .4rem; padding: .85rem; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--glass-bg); overflow-wrap: anywhere; }
.support-requester strong { margin-top: .25rem; }
.support-requester span, .support-requester small { font-size: .875rem; }
.support-requester a { color: var(--brand); font-weight: 700; padding: .45rem 0; }
</style>
