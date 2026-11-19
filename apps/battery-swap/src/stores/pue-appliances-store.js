/**
 * PUE appliances store (Pinia): sales, faults, Beverly CRM customer lookup and the overview counts.
 * The server is the only source of truth. Nothing is seeded, cached across sessions or written to
 * browser storage; a failed load leaves the list empty and says why. Catalogue and unit lists use the
 * registry store (resources "appliance-types" and "appliance-units").
 */
import { defineStore } from "pinia";
import { pueApi } from "../services/pue-api.js";

const PAGE_SIZE = 25;
const emptyList = () => ({ items: [], total: 0 });

export const usePueAppliancesStore = defineStore("pue-appliances", {
  state: () => ({
    sales: emptyList(),
    salesLoading: false,
    salesError: null,
    faults: emptyList(),
    faultsLoading: false,
    faultsError: null,
    customers: [],
    customersError: null,
    // Overview: each count is a real server total, or null when it could not be read.
    overview: { units: null, inStock: null, sold: null, faulty: null, activeSales: null, openFaults: null, outstandingMinor: null, outstandingComplete: true },
    overviewLoading: false,
    overviewError: null
  }),

  actions: {
    async loadSales({ page = 1, status = "" } = {}) {
      this.salesLoading = true;
      this.salesError = null;
      try {
        this.sales = await pueApi.listApplianceSales({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, status });
      } catch (error) {
        this.sales = emptyList();
        this.salesError = error.message;
      } finally {
        this.salesLoading = false;
      }
    },

    /** Full sale with its recorded payments. Throws PueApiError. */
    getSale(id) {
      return pueApi.getApplianceSale(id);
    },

    sell(body) {
      return pueApi.sellAppliance(body);
    },

    /** Same idempotencyKey on every retry of one payment attempt. */
    recordPayment(id, body, idempotencyKey) {
      return pueApi.recordAppliancePayment(id, body, idempotencyKey);
    },

    endSale(id, body) {
      return pueApi.endApplianceSale(id, body);
    },

    async searchCustomers(q) {
      this.customersError = null;
      if (String(q).trim().length < 2) {
        this.customers = [];
        return;
      }
      try {
        this.customers = await pueApi.searchCustomers(q.trim());
      } catch (error) {
        this.customers = [];
        this.customersError = error.message;
      }
    },

    async loadFaults({ page = 1, status = "" } = {}) {
      this.faultsLoading = true;
      this.faultsError = null;
      try {
        this.faults = await pueApi.listApplianceFaults({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, status });
      } catch (error) {
        this.faults = emptyList();
        this.faultsError = error.message;
      } finally {
        this.faultsLoading = false;
      }
    },

    reportFault(body) {
      return pueApi.reportApplianceFault(body);
    },

    updateFault(id, body) {
      return pueApi.updateApplianceFault(id, body);
    },

    /**
     * Overview numbers come from server totals only. The outstanding balance adds up active sales, so it is
     * shown only when every active sale was read (up to 200); otherwise it stays null rather than guess.
     */
    async loadOverview() {
      this.overviewLoading = true;
      this.overviewError = null;
      const count = async (resource, status) => (await pueApi.list(resource, { limit: 1, status })).total;
      try {
        const [units, inStock, sold, faulty, activeSales, openFaults] = await Promise.all([
          count("appliance-units", ""), count("appliance-units", "in_stock"), count("appliance-units", "sold"), count("appliance-units", "faulty"),
          pueApi.listApplianceSales({ limit: 200, offset: 0, status: "active" }),
          pueApi.listApplianceFaults({ limit: 1, offset: 0, status: "open" })
        ]);
        const complete = activeSales.items.length === activeSales.total;
        this.overview = {
          units, inStock, sold, faulty,
          activeSales: activeSales.total,
          openFaults: openFaults.total,
          outstandingMinor: complete ? activeSales.items.reduce((sum, sale) => sum + Number(sale.balanceMinor ?? 0), 0) : null,
          outstandingComplete: complete
        };
      } catch (error) {
        this.overview = { units: null, inStock: null, sold: null, faulty: null, activeSales: null, openFaults: null, outstandingMinor: null, outstandingComplete: true };
        this.overviewError = error.message;
      } finally {
        this.overviewLoading = false;
      }
    }
  }
});
