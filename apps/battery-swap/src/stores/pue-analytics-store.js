/**
 * PUE analytics store (Pinia): swap and appliance analytics for a chosen period.
 * The server is the only source. A failed load leaves nothing on screen and says why; nothing is cached in
 * the browser, and no number is ever filled in on the server's behalf.
 */
import { defineStore } from "pinia";
import { pueApi } from "../services/pue-api.js";

export const PERIODS = [7, 30, 90];

export const usePueAnalyticsStore = defineStore("pue-analytics", {
  state: () => ({
    days: 30,
    swaps: null,
    swapsLoading: false,
    swapsError: null,
    appliances: null,
    appliancesLoading: false,
    appliancesError: null
  }),

  actions: {
    async loadSwaps(days = this.days) {
      this.days = days;
      this.swapsLoading = true;
      this.swapsError = null;
      try {
        this.swaps = await pueApi.getSwapAnalytics(days);
      } catch (error) {
        this.swaps = null;
        this.swapsError = error.message;
      } finally {
        this.swapsLoading = false;
      }
    },

    async loadAppliances(days = this.days) {
      this.days = days;
      this.appliancesLoading = true;
      this.appliancesError = null;
      try {
        this.appliances = await pueApi.getApplianceAnalytics(days);
      } catch (error) {
        this.appliances = null;
        this.appliancesError = error.message;
      } finally {
        this.appliancesLoading = false;
      }
    }
  }
});
