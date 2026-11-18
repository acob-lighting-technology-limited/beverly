/**
 * Swaps store (Pinia). The server is the only source of truth: nothing is cached in the browser.
 * Payments and handover are done by the server and reported back; this store never assumes a
 * step worked. A failed call throws PueApiError with the server's reason.
 */
import { defineStore } from "pinia";
import { pueApi } from "../services/pue-api.js";

const PAGE_SIZE = 25;

export const usePueSwapsStore = defineStore("pue-swaps", {
  state: () => ({
    pageSize: PAGE_SIZE,
    swaps: { items: [], total: 0 },
    loading: false,
    error: null,
    settings: null,
    settingsError: null
  }),

  actions: {
    async load({ page = 1, status = "" } = {}) {
      this.loading = true;
      this.error = null;
      try {
        this.swaps = await pueApi.listSwaps({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, status });
      } catch (error) {
        this.swaps = { items: [], total: 0 };
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },

    async loadSettings() {
      this.settingsError = null;
      try {
        this.settings = await pueApi.getSwapSettings();
      } catch (error) {
        this.settings = null;
        this.settingsError = error.message;
      }
    },

    updateSettings: (body) => pueApi.updateSwapSettings(body),
    get: (id) => pueApi.getSwap(id),
    reserve: (body, key) => pueApi.reserveSwap(body, key),
    recordPayment: (id, body, key) => pueApi.recordSwapPayment(id, body, key),
    startPaystack: (id) => pueApi.startSwapPaystack(id),
    verifyPaystack: (id) => pueApi.verifySwapPaystack(id),
    complete: (id, body) => pueApi.completeSwap(id, body),
    cancel: (id, body) => pueApi.cancelSwap(id, body)
  }
});
