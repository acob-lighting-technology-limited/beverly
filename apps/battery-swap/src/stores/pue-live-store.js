/**
 * Live battery store (Pinia). Joins our registry batteries with Yunhe's live
 * readings. Nothing is cached in the browser and nothing is invented:
 *   - if Yunhe cannot be reached, `status` is "unavailable", `error` says why,
 *     and `lastSyncAt` keeps the time of the last REAL sync (or null);
 *   - hardware commands go through the server gateway and resolve only on a
 *     Yunhe receipt. Local state is never changed by a command; the next
 *     refresh reads the truth back from the platform.
 */
import { defineStore } from "pinia";
import { pueApi } from "../services/pue-api.js";
import { fetchYunheBatteries, rebootBatteryDTU, setBatteryFets } from "../services/yunhe-battery-service.js";
import { ALERT_DEFAULTS, joinBatteries } from "../services/yunhe-normalize.js";

export const usePueLiveStore = defineStore("pue-live", {
  state: () => ({
    registry: [],
    liveRecords: [],
    status: "idle", // idle | loading | ok | unavailable
    error: null,
    registryError: null,
    lastSyncAt: null,
    thresholds: { ...ALERT_DEFAULTS },
    selectedKey: null
  }),

  getters: {
    rows: (state) => joinBatteries(state.registry, state.liveRecords, state.thresholds),
    selected() {
      return this.rows.find((row) => row.key === this.selectedKey) ?? null;
    },
    mappable() {
      return this.rows.filter((row) => row.live && row.live.lat !== null && row.live.lng !== null);
    },
    counts() {
      const live = this.rows.filter((row) => row.live);
      return {
        total: this.rows.length,
        online: live.filter((row) => row.live.online === true).length,
        offline: live.filter((row) => row.live.online === false).length,
        attention: this.rows.filter((row) => row.level !== "ok").length,
        lowCharge: live.filter((row) => row.alerts.some((a) => a.code === "low_soc" || a.code === "critical_soc")).length,
        unregistered: this.rows.filter((row) => !row.registered).length,
        noReading: this.rows.filter((row) => !row.live).length
      };
    }
  },

  actions: {
    /** Loads the registry and the live list together. Either may fail on its own. */
    async refresh() {
      this.status = "loading";
      const [registry, live] = await Promise.allSettled([pueApi.list("batteries", { limit: 200 }), fetchYunheBatteries()]);

      if (registry.status === "fulfilled") {
        this.registry = registry.value.items;
        this.registryError = null;
      } else {
        this.registry = [];
        this.registryError = registry.reason?.message ?? "The battery register could not be loaded.";
      }

      if (live.status === "fulfilled") {
        this.liveRecords = live.value;
        this.error = null;
        this.status = "ok";
        this.lastSyncAt = new Date().toISOString();
      } else {
        // Keep nothing from before: stale readings must not look current.
        this.liveRecords = [];
        this.error = live.reason?.message ?? "Live battery data is unavailable.";
        this.status = "unavailable";
      }
    },

    select(key) {
      this.selectedKey = key;
    },

    /** Switches the discharge switch (motor power). Throws unless Yunhe confirms. */
    async setMotorPower(row, allow, reason) {
      const id = row.registry?.battery_number ?? row.live?.batteryNumber;
      if (!id) throw new Error("This battery has no battery number.");
      const receipt = await setBatteryFets(id, { allowCharge: true, allowDischarge: allow, reason });
      await this.refresh();
      return receipt;
    },

    /** Reboots the battery's communication unit. Throws unless Yunhe confirms. */
    async reboot(row, reason) {
      const id = row.registry?.battery_number ?? row.live?.batteryNumber;
      if (!id) throw new Error("This battery has no battery number.");
      const receipt = await rebootBatteryDTU(id, reason);
      await this.refresh();
      return receipt;
    }
  }
});
