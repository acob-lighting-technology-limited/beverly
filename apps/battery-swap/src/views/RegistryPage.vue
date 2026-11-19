<template>
  <section class="reg" :aria-label="config.title" data-testid="registry-page">
    <header class="reg-head">
      <div>
        <h1 class="reg-title">{{ config.title }}</h1>
        <p class="reg-blurb">{{ config.blurb }}</p>
      </div>
      <button
        v-if="canEdit"
        type="button"
        class="reg-btn reg-btn--primary"
        data-testid="registry-add"
        @click="openForm(null)"
      >
        Add {{ config.singular }}
      </button>
    </header>

    <div class="reg-tools">
      <label class="reg-search">
        <span class="reg-sr">Search {{ config.title }}</span>
        <input
          v-model="search"
          type="search"
          class="reg-input"
          :placeholder="`Search ${config.title.toLowerCase()}`"
          data-testid="registry-search"
          @input="onSearch"
        />
      </label>
      <span class="reg-count" aria-live="polite">{{ list.total }} {{ list.total === 1 ? 'record' : 'records' }}</span>
    </div>

    <p v-if="toast" class="reg-toast" role="status" data-testid="registry-toast">{{ toast }}</p>

    <div v-if="error" class="reg-alert" role="alert" data-testid="registry-error">
      <span>{{ error }}</span>
      <button type="button" class="reg-btn" @click="reload">Try again</button>
    </div>

    <div class="reg-table-wrap">
      <table class="reg-table">
        <thead>
          <tr>
            <th v-for="column in config.columns" :key="column.key" scope="col">{{ column.label }}</th>
            <th v-if="canEdit" scope="col"><span class="reg-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody v-if="loading">
          <tr v-for="n in 5" :key="n" class="reg-skeleton-row" aria-hidden="true">
            <td v-for="column in config.columns" :key="column.key"><span class="reg-skeleton" /></td>
            <td v-if="canEdit"><span class="reg-skeleton" /></td>
          </tr>
        </tbody>
        <tbody v-else-if="list.items.length">
          <tr v-for="row in list.items" :key="row.id" :data-testid="`registry-row-${row.id}`">
            <td v-for="column in config.columns" :key="column.key" :data-label="column.label">
              <span v-if="column.badge" :class="['reg-badge', `reg-badge--${row[column.key]}`]">{{ statusText(row[column.key]) }}</span>
              <template v-else>{{ cell(column, row) }}</template>
            </td>
            <td v-if="canEdit" class="reg-actions">
              <button
                type="button"
                class="reg-btn"
                :aria-label="`Edit ${rowName(row)}`"
                :data-testid="`registry-edit-${row.id}`"
                @click="openForm(row)"
              >
                Edit
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!loading && !list.items.length && !error" class="reg-empty" data-testid="registry-empty">
        <p class="reg-empty-title">{{ search ? 'No matches' : `No ${config.title.toLowerCase()} yet` }}</p>
        <p class="reg-empty-note">{{ search ? 'Try a different search.' : `Add the first ${config.singular} to get started.` }}</p>
        <button v-if="canEdit && !search" type="button" class="reg-btn reg-btn--primary" @click="openForm(null)">Add {{ config.singular }}</button>
      </div>
    </div>

    <nav v-if="pageCount > 1" class="reg-pager" aria-label="Pages">
      <button type="button" class="reg-btn" :disabled="page <= 1" @click="goTo(page - 1)">Previous</button>
      <span>Page {{ page }} of {{ pageCount }}</span>
      <button type="button" class="reg-btn" :disabled="page >= pageCount" @click="goTo(page + 1)">Next</button>
    </nav>

    <div v-if="formOpen" class="reg-overlay" @click.self="closeForm" @keydown.esc="closeForm">
      <form
        class="reg-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'reg-dialog-title'"
        data-testid="registry-form"
        novalidate
        @submit.prevent="submit"
      >
        <h2 id="reg-dialog-title" class="reg-dialog-title">{{ editingId ? `Edit ${config.singular}` : `Add ${config.singular}` }}</h2>

        <div v-for="field in config.fields" :key="field.key" class="reg-field">
          <label :for="`field-${field.key}`" class="reg-label">
            {{ field.label }}<span v-if="field.required" class="reg-req" aria-hidden="true"> *</span>
          </label>
          <select
            v-if="field.type === 'select'"
            :id="`field-${field.key}`"
            v-model="form[field.key]"
            class="reg-input"
            :data-testid="`field-${field.key}`"
          >
            <option value="">{{ field.required ? 'Choose…' : 'None' }}</option>
            <template v-if="field.lookup">
              <option v-for="option in store.optionList(field.lookup)" :key="option.id" :value="option.id">{{ option.label }}</option>
            </template>
            <template v-else>
              <option v-for="[value, label] in field.options" :key="value" :value="value">{{ label }}</option>
            </template>
          </select>
          <input
            v-else
            :id="`field-${field.key}`"
            v-model="form[field.key]"
            class="reg-input"
            :type="field.type === 'number' ? 'number' : field.type === 'naira' ? 'text' : field.type"
            :inputmode="field.type === 'naira' ? 'decimal' : undefined"
            :min="field.type === 'number' ? 0 : undefined"
            :required="field.required"
            :data-testid="`field-${field.key}`"
            autocomplete="off"
          />
          <p v-if="field.help" class="reg-help">{{ field.help }}</p>
        </div>

        <ul v-if="problems.length" class="reg-problems" role="alert" data-testid="registry-form-problems">
          <li v-for="problem in problems" :key="problem">{{ problem }}</li>
        </ul>

        <div class="reg-dialog-actions">
          <button type="button" class="reg-btn" @click="closeForm">Cancel</button>
          <button type="submit" class="reg-btn reg-btn--primary" :disabled="saving" data-testid="registry-save">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup>
/**
 * One table page for every PUE registry (sites, swap stations, bikes, batteries,
 * riders). The route's meta.resource picks the config in services/registry-config.js.
 * Data comes only from the Beverly API through the Pinia store; nothing is seeded.
 */
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { usePueRegistryStore } from "../stores/pue-registry-store.js";
import { useBatterySwapAuthStore } from "../stores/auth";
import { nairaFromMinor } from "../services/pue-api.js";
import { RESOURCES, formToBody, initialForm, validateForm } from "../services/registry-config.js";

const route = useRoute();
const store = usePueRegistryStore();
const auth = useBatterySwapAuthStore();

/** Mirrors backend PUE_OPERATOR_ROLES; the server enforces it regardless. */
const OPERATOR_ROLES = ["super-admin", "operations-manager", "operations-officer"];
const canEdit = computed(() => OPERATOR_ROLES.includes(auth.user?.role ?? ""));

const resource = computed(() => String(route.meta.resource));
const config = computed(() => RESOURCES[resource.value]);
const list = computed(() => store.list(resource.value));
const loading = computed(() => Boolean(store.loading[resource.value]));
const error = computed(() => store.errors[resource.value]);

const search = ref("");
const page = ref(1);
const pageCount = computed(() => Math.max(1, Math.ceil(list.value.total / store.pageSize)));
const toast = ref("");

const formOpen = ref(false);
const editingId = ref(null);
const form = reactive({});
const problems = ref([]);
const saving = ref(false);

let searchTimer = null;
let toastTimer = null;

function reload() {
  return store.load(resource.value, { page: page.value, q: search.value });
}
function onSearch() {
  clearTimeout(searchTimer);
  // 300 ms debounce per the table standard.
  searchTimer = setTimeout(() => { page.value = 1; reload(); }, 300);
}
function goTo(next) {
  page.value = next;
  reload();
}

function statusText(value) {
  return value ? String(value).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "—";
}
function cell(column, row) {
  const value = row[column.key];
  if (column.lookup) return store.labelFor(column.lookup, value);
  if (column.map) return column.map[value] ?? "—";
  if (column.money) return nairaFromMinor(value);
  return value === null || value === undefined || value === "" ? "—" : value;
}
function rowName(row) {
  return row.name ?? row.serial_number ?? row.battery_number ?? row.full_name ?? "record";
}

function lookupsNeeded() {
  return [...new Set(config.value.columns.concat(config.value.fields).map((item) => item.lookup).filter(Boolean))];
}

async function openForm(row) {
  editingId.value = row ? row.id : null;
  for (const key of Object.keys(form)) delete form[key];
  Object.assign(form, initialForm(config.value, row));
  problems.value = [];
  formOpen.value = true;
  await nextTick();
  document.getElementById(`field-${config.value.fields[0].key}`)?.focus();
}
function closeForm() {
  formOpen.value = false;
}

function flash(message) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = ""; }, 4000);
}

async function submit() {
  problems.value = validateForm(config.value, form);
  if (problems.value.length) return;
  saving.value = true;
  try {
    await store.save(resource.value, formToBody(config.value, form, { editing: Boolean(editingId.value) }), editingId.value);
    closeForm();
    flash(`${config.value.singular[0].toUpperCase()}${config.value.singular.slice(1)} saved.`);
    await reload();
  } catch (failure) {
    // The server's reason, e.g. a duplicate serial number. Nothing is saved.
    problems.value = [failure.message];
  } finally {
    saving.value = false;
  }
}

watch(
  resource,
  async () => {
    search.value = "";
    page.value = 1;
    formOpen.value = false;
    await Promise.all([reload(), ...lookupsNeeded().map((name) => store.loadOptions(name))]);
  },
  { immediate: true }
);

onBeforeUnmount(() => { clearTimeout(searchTimer); clearTimeout(toastTimer); });
</script>
