<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

type Meter = { meter_id: string; station_id: string | null };
const props = defineProps<{ modelValue: Meter[] | null; loadMeters: () => Promise<{ meters: Meter[] }> }>();
const emit = defineEmits<{ 'update:modelValue': [value: Meter[] | null] }>();
const meters = ref<Meter[]>([]);
const loading = ref(false);
const error = ref(false);
const search = ref('');
const selected = (meter: Meter) => props.modelValue?.some(item => item.meter_id === meter.meter_id && item.station_id === meter.station_id) ?? false;
const filtered = computed(() => meters.value.filter(m => `${m.meter_id} ${m.station_id ?? ''}`.toLowerCase().includes(search.value.trim().toLowerCase())));
async function load() {
    loading.value = true;
    error.value = false;
    try { meters.value = (await props.loadMeters()).meters ?? []; }
    catch { error.value = true; }
    finally { loading.value = false; }
}
function toggle(meter: Meter, checked: boolean) {
    const current = (props.modelValue ?? []).filter(item => item.meter_id !== meter.meter_id || item.station_id !== meter.station_id);
    if (checked) current.push(meter);
    emit('update:modelValue', current.length ? current : null);
}
onMounted(load);
</script>

<template>
  <fieldset class="support-meter-picker">
    <legend>Which meters need help?</legend>
    <label class="support-meter-option"><input type="checkbox" :checked="modelValue?.length === 0" @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked ? [] : null)" /> No meter involved</label>
    <p v-if="loading" role="status">Loading your meters…</p>
    <p v-else-if="error" role="alert">Meters could not load. <button type="button" @click="load">Try again</button></p>
    <template v-else-if="meters.length">
      <label class="support-meter-search">Find a meter <input v-model="search" type="search" placeholder="Meter or station" /></label>
      <div class="support-meter-list">
        <label v-for="meter in filtered" :key="`${meter.meter_id}:${meter.station_id}`" class="support-meter-option">
          <input type="checkbox" :checked="selected(meter)" :disabled="!selected(meter) && (modelValue?.length ?? 0) >= 20" @change="toggle(meter, ($event.target as HTMLInputElement).checked)" />
          <span>{{ meter.meter_id }} <small v-if="meter.station_id">· {{ meter.station_id }}</small></span>
        </label>
        <p v-if="!filtered.length">No matching meters.</p>
      </div>
      <small>Select up to 20 meters.</small>
    </template>
    <p v-else>No meters are available.</p>
  </fieldset>
</template>

<style scoped>
.support-meter-picker { min-width: 0; margin: .75rem 0; padding: .75rem; border: 1px solid var(--glass-border, #34444b); border-radius: 12px; }
legend { padding: 0 .25rem; font-weight: 700; }
.support-meter-option { display: flex; align-items: center; gap: .6rem; min-height: 44px; cursor: pointer; }
.support-meter-option input { width: 18px; height: 18px; accent-color: var(--brand); }
.support-meter-option small, small { color: var(--text-muted); }
.support-meter-search { display: grid; gap: .3rem; margin: .5rem 0; }
.support-meter-search input { width: 100%; min-height: 44px; padding: .5rem .7rem; color: var(--text); background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 8px; }
.support-meter-list { max-height: 180px; overflow: auto; }
</style>
