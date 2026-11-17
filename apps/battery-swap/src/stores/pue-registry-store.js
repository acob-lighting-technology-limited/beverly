/**
 * PUE registry store (Pinia). The server is the only source of truth: rows are
 * never seeded, cached across sessions, or written to localStorage. If the
 * server cannot answer, `errors[resource]` says so and `lists[resource]` stays empty.
 */
import { defineStore } from "pinia";
import { pueApi } from "../services/pue-api.js";
import { recordLabel } from "../services/registry-config.js";

const PAGE_SIZE = 25;

const emptyList = () => ({ items: [], total: 0 });

export const usePueRegistryStore = defineStore("pue-registry", {
  state: () => ({
    pageSize: PAGE_SIZE,
    lists: {},
    loading: {},
    errors: {},
    // Small full lists used to fill dropdowns and show names instead of ids.
    options: {},
    sales: emptyList(),
    salesLoading: false,
    salesError: null
  }),

  getters: {
    list: (state) => (resource) => state.lists[resource] ?? emptyList(),
    /** Dropdown entries: [{ id, label }] for a lookup registry. */
    optionList: (state) => (resource) =>
      (state.options[resource] ?? []).map((record) => ({ id: record.id, label: recordLabel(resource, record) })),
    /** Name for an id, or a dash when the record is not loaded or the id is empty. */
    labelFor: (state) => (resource, id) => {
      if (!id) return "—";
      const record = (state.options[resource] ?? []).find((item) => item.id === id);
      return record ? recordLabel(resource, record) : "—";
    }
  },

  actions: {
    async load(resource, { page = 1, q = "" } = {}) {
      this.loading[resource] = true;
      this.errors[resource] = null;
      try {
        this.lists[resource] = await pueApi.list(resource, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, q });
      } catch (error) {
        this.lists[resource] = emptyList();
        this.errors[resource] = error.message;
      } finally {
        this.loading[resource] = false;
      }
    },

    /** Loads up to 200 records of a registry for dropdowns. Failure leaves the dropdown empty, with the error shown by the page. */
    async loadOptions(resource, extra = {}) {
      try {
        this.options[resource] = (await pueApi.list(resource, { limit: 200, ...extra })).items;
      } catch (error) {
        this.options[resource] = [];
        this.errors[`options:${resource}`] = error.message;
      }
    },

    /** Resolves the saved record; throws PueApiError so the form can show the reason. */
    async save(resource, body, id = null) {
      const record = id ? await pueApi.update(resource, id, body) : await pueApi.create(resource, body);
      // Refresh the dropdown copy so new records appear in forms straight away.
      if (this.options[resource]) await this.loadOptions(resource);
      return record;
    },

    async loadSales({ page = 1, status = "" } = {}) {
      this.salesLoading = true;
      this.salesError = null;
      try {
        this.sales = await pueApi.listSales({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, status });
      } catch (error) {
        this.sales = emptyList();
        this.salesError = error.message;
      } finally {
        this.salesLoading = false;
      }
    },

    async sell(body) {
      return pueApi.sell(body);
    },

    async endSale(id, body) {
      return pueApi.endSale(id, body);
    }
  }
});
