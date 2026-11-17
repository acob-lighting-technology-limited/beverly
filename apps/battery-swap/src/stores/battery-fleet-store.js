import { defineStore } from "pinia";
import {
  fetchYunheBatteries,
  fetchYunheStations,
  setBatteryFets,
  rebootBatteryDTU
} from "../services/yunhe-battery-service.js";

const STORAGE_KEY_BIKES = "beverly.battery_fleet.bikes_v1";
const STORAGE_KEY_CUSTOMERS = "beverly.battery_fleet.customers_v1";
const STORAGE_KEY_SWAPS = "beverly.battery_fleet.swaps_v1";
const STORAGE_KEY_STATIONS = "beverly.battery_fleet.stations_v1";
const STORAGE_KEY_BATTERIES = "beverly.battery_fleet.batteries_v2";

// Helper for Nigerian names
const FIRST_NAMES = ["Babatunde", "Emeka", "Amina", "Folake", "Yusuf", "Chidi", "Taiwo", "Kehinde", "Ngozi", "Oluwaseun", "Ibrahim", "Blessing", "Damilola", "Zainab", "Obinna", "Funmilayo", "Tunde", "Fatima", "Kelechi", "Adeola"];
const LAST_NAMES = ["Adeleke", "Okafor", "Bello", "Balogun", "Danjuma", "Nwosu", "Ogundipe", "Eze", "Suleiman", "Adewale", "Okoro", "Aliyu", "Adeyemi", "Mohammed", "Ojo", "Abubakar", "Chukwu", "Lawal", "Ajayi", "Sanusi"];

// Nigerian cities & corridors for the 200 bikes
const LOCATIONS = [
  { city: "Lagos (Ikeja)", lat: 6.5965, lng: 3.3421, radius: 0.05 },
  { city: "Lagos (Victoria Island)", lat: 6.4281, lng: 3.4219, radius: 0.04 },
  { city: "Lagos (Yaba & Surulere)", lat: 6.5173, lng: 3.3712, radius: 0.04 },
  { city: "Lagos (Lekki Phase 1)", lat: 6.4474, lng: 3.4844, radius: 0.05 },
  { city: "Lagos (Oshodi & Mushin)", lat: 6.5385, lng: 3.3486, radius: 0.04 },
  { city: "Abuja (Wuse & Central)", lat: 9.0601, lng: 7.4898, radius: 0.05 },
  { city: "Abuja (Garki & Area 11)", lat: 9.0322, lng: 7.4851, radius: 0.04 },
  { city: "Ibadan (Bodija & Ring Rd)", lat: 7.4121, lng: 3.9056, radius: 0.05 },
  { city: "Akure Delivery Corridor", lat: 7.345775, lng: 5.178008, radius: 0.02 }
];

function generate15CellVoltages(nominalV, diffMv = 3) {
  // Generates 15 cell voltages matching Yunhe screenshot 3
  const base = Number((nominalV / 15).toFixed(3));
  const result = [];
  for (let c = 1; c <= 15; c++) {
    const jitter = ((c * 7) % (diffMv + 1)) * 0.001;
    result.push(Number((base + jitter).toFixed(3)));
  }
  return result;
}

/* Demo seed data was removed. Riders, bikes, batteries, sites and stations now live in the Beverly database (see pue-registry-store.js). */

export const useBatteryFleetStore = defineStore("batteryFleet", {
  state: () => {
    // Old demo data used to be kept in localStorage. Remove it so it can never reappear.
    try {
      for (const key of [STORAGE_KEY_BIKES, STORAGE_KEY_CUSTOMERS, STORAGE_KEY_STATIONS, STORAGE_KEY_SWAPS, STORAGE_KEY_BATTERIES]) {
        localStorage.removeItem(key);
      }
    } catch (_) {}

    return {
      bikes: [],
      customers: [],
      stations: [],
      swaps: [],
      batteries: [],
      selectedBikeId: null,
      selectedBatterySn: null,
      activeTab: "map",
      searchQuery: "",
      filterStatus: "all",
      filterSoc: "all",
      loading: false,
      // null until a real sync succeeds; liveStatus is "idle" | "ok" | "unavailable".
      lastSyncTime: null,
      liveStatus: "idle",
      liveError: null
    };
  },

  getters: {
    selectedBike(state) {
      return state.bikes.find((b) => b.id === state.selectedBikeId) || state.bikes[0];
    },
    selectedCustomer(state) {
      if (!this.selectedBike) return null;
      return state.customers.find((c) => c.id === this.selectedBike.assignedCustomerId) || null;
    },
    selectedBattery(state) {
      return state.batteries.find((b) => b.sn === state.selectedBatterySn) || state.batteries[0];
    },
    totalBikes(state) {
      return state.bikes.length;
    },
    totalBatteries(state) {
      return state.batteries.length;
    },
    onlineBikesCount(state) {
      return state.bikes.filter((b) => b.telemetry.online === 1).length;
    },
    onlineBatteriesCount(state) {
      return state.batteries.filter((b) => b.onlineStatus === "Online").length;
    },
    movingBatteriesCount(state) {
      return state.batteries.filter((b) => b.state === "move").length;
    },
    chargingBatteriesCount(state) {
      return state.batteries.filter((b) => b.state === "charge").length;
    },
    lowBatteryCount(state) {
      return state.bikes.filter((b) => b.telemetry.soc <= 20).length;
    },
    averageSoc(state) {
      if (!state.bikes.length) return 0;
      const total = state.bikes.reduce((acc, b) => acc + (b.telemetry.soc || 0), 0);
      return Math.round(total / state.bikes.length);
    },
    overdueCustomers(state) {
      return state.customers.filter((c) => c.status === "overdue");
    },
    allBatteries(state) {
      return state.batteries;
    },
    filteredBikes(state) {
      let list = state.bikes;
      if (state.filterStatus !== "all") {
        list = list.filter((b) => b.status === state.filterStatus);
      }
      if (state.filterSoc === "low") {
        list = list.filter((b) => b.telemetry.soc <= 20);
      } else if (state.filterSoc === "medium") {
        list = list.filter((b) => b.telemetry.soc > 20 && b.telemetry.soc <= 60);
      } else if (state.filterSoc === "high") {
        list = list.filter((b) => b.telemetry.soc > 60);
      }
      if (state.searchQuery.trim()) {
        const q = state.searchQuery.toLowerCase().trim();
        list = list.filter((b) =>
          b.id.toLowerCase().includes(q) ||
          b.plateNumber.toLowerCase().includes(q) ||
          b.riderName.toLowerCase().includes(q) ||
          b.batterySn.toLowerCase().includes(q) ||
          b.telemetry.city.toLowerCase().includes(q)
        );
      }
      return list;
    }
  },

  actions: {
    /** Kept so older callers keep working. Nothing is persisted in the browser any more. */
    saveToStorage() {},

    selectBike(bikeId) {
      this.selectedBikeId = bikeId;
      const bike = this.bikes.find((b) => b.id === bikeId);
      if (bike && bike.batterySn) {
        this.selectedBatterySn = bike.batterySn;
      }
    },

    selectBattery(batterySn) {
      this.selectedBatterySn = batterySn;
      const bat = this.batteries.find((b) => b.sn === batterySn);
      if (bat && bat.assignedBikeId) {
        this.selectedBikeId = bat.assignedBikeId;
      }
    },

    async syncLiveYunheTelemetry() {
      this.loading = true;
      try {
        const liveBatteries = await fetchYunheBatteries();
        // Match each live battery to a local bike by serial number. A live battery
        // with no match is ignored: it must never be written onto another bike.
        for (const live of liveBatteries) {
          const bike = this.bikes.find((b) => b.batterySn === live.sn);
          if (!bike) continue;
          const t = bike.telemetry;
          if (live.soc != null) t.soc = Number(live.soc);
          if (live.v != null) t.voltage = Number(live.v);
          if (live.i != null) t.current = Number(live.i);
          if (live.speed != null) t.speed = Number(live.speed);
          if (live.mileage != null) t.mileage = Number(live.mileage);
          if (live.lat != null) t.lat = Number(live.lat);
          if (live.lng != null) t.lng = Number(live.lng);
          if (live.online != null) t.online = Number(live.online);
          if (live.c_fet != null) t.c_fet = Number(live.c_fet);
          if (live.d_fet != null) t.d_fet = Number(live.d_fet);
          t.lastHeartbeat = live.last_time || t.lastHeartbeat;
        }
        this.liveStatus = "ok";
        this.liveError = null;
        this.lastSyncTime = new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos" });
        this.saveToStorage();
        return { ok: true };
      } catch (err) {
        // Keep the last known values, but say plainly that they are not live.
        this.liveStatus = "unavailable";
        this.liveError = err && err.message ? err.message : "Live battery data is unavailable.";
        return { ok: false, error: this.liveError };
      } finally {
        this.loading = false;
      }
    },

    /**
     * Swap a depleted battery with a fully charged battery at a station
     */
    executeSwap({ bikeId, stationId, batteryOutSn, newBatterySn, operatorName = "Station Operator", feeMinor = 80000 }) {
      const targetSn = newBatterySn || batteryOutSn;
      const bike = this.bikes.find((b) => b.id === bikeId);
      const station = this.stations.find((s) => s.id === stationId);
      if (!bike || !station) {
        throw new Error("Invalid bike or station selected for swap");
      }

      const freshBattery = station.activeBatteries.find((b) => b.sn === targetSn)
        || station.activeBatteries.find((b) => b.status === "ready" && b.soc >= 80);
      if (!freshBattery) {
        throw new Error("Selected replacement battery is not available in station inventory");
      }

      const depletedBatterySn = bike.batterySn;
      const depletedSoc = bike.telemetry.soc;

      // Swap out the battery in the bike
      bike.batterySn = freshBattery.sn;
      bike.batteryId = freshBattery.id || `BAT-${freshBattery.sn}`;
      bike.telemetry.soc = freshBattery.soc;
      bike.telemetry.voltage = freshBattery.v || 76.8;
      bike.telemetry.lastHeartbeat = new Date().toISOString();

      // Place depleted battery into station charging bay
      station.activeBatteries = station.activeBatteries.filter((b) => b.sn !== freshBattery.sn);
      station.activeBatteries.push({
        sn: depletedBatterySn,
        id: `BT-DEP-${depletedBatterySn}`,
        soc: depletedSoc,
        v: 68.2,
        temp: 31.5,
        status: "charging"
      });

      // Update merchant battery records
      const batOut = this.batteries.find((b) => b.sn === freshBattery.sn);
      if (batOut) {
        batOut.assignedBikeId = bike.id;
        batOut.assignedRiderName = bike.riderName;
        batOut.assignedRiderPhone = bike.riderPhone;
        batOut.assignedStationId = null;
        batOut.assignedStationName = null;
        batOut.state = "move";
      }

      const batIn = this.batteries.find((b) => b.sn === depletedBatterySn);
      if (batIn) {
        batIn.assignedBikeId = null;
        batIn.assignedRiderName = null;
        batIn.assignedRiderPhone = null;
        batIn.assignedStationId = station.id;
        batIn.assignedStationName = station.name;
        batIn.state = "charge";
        batIn.soc = depletedSoc;
      }

      // Record swap log
      const swapRecord = {
        id: `SWP-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toLocaleString("en-GB", { timeZone: "Africa/Lagos" }),
        bikeId: bike.id,
        riderName: bike.riderName,
        plateNumber: bike.plateNumber,
        stationId: station.id,
        stationName: station.name,
        batteryInSn: depletedBatterySn,
        batteryInSoc: depletedSoc,
        batteryOutSn: freshBattery.sn,
        batteryOutSoc: freshBattery.soc,
        operatorName,
        feeMinor: Number(feeMinor) || 80000,
        paymentMethod: "Beverly Wallet"
      };

      this.swaps.unshift(swapRecord);

      // Add to customer's swap history
      const customer = this.customers.find((c) => c.id === bike.assignedCustomerId);
      if (customer) {
        customer.batterySn = freshBattery.sn;
        if (!Array.isArray(customer.swaps)) customer.swaps = [];
        customer.swaps.unshift({
          id: swapRecord.id,
          date: swapRecord.timestamp,
          stationName: station.name,
          batteryInSn: depletedBatterySn,
          batteryInSoc: depletedSoc,
          batteryOutSn: freshBattery.sn,
          batteryOutSoc: freshBattery.soc,
          feeMinor: swapRecord.feeMinor
        });
      }

      this.saveToStorage();
      return { success: true, swap: swapRecord, ...swapRecord };
    },

    /**
     * Register a new customer / rider and issue EV Bike
     */
    registerCustomer(payload) {
      const nextIndex = this.customers.length + 1;
      const customerId = `CUST-${String(nextIndex).padStart(3, "0")}`;

      const {
        name,
        phone,
        email,
        nin,
        city = "Lagos",
        address = "",
        guarantorName = "",
        guarantorPhone = "",
        guarantorRelationship = "Guarantor",
        bikeId,
        purchaseType = "installment",
        totalCostMinor = 145000000,
        downPaymentMinor = 30000000,
        weeklyInstallmentMinor = 2500000,
        preferredMethod = "Beverly Wallet"
      } = payload;

      let bike = null;
      if (bikeId) {
        bike = this.bikes.find((b) => b.id === bikeId);
      }
      if (!bike) {
        bike = this.bikes.find((b) => !b.assignedCustomerId || b.status === "idle");
      }

      const assignedBikeId = bike ? bike.id : `EVB-${String(nextIndex).padStart(3, "0")}`;
      const batterySn = bike ? bike.batterySn : `B100112510${270200 + nextIndex}`;

      const isInstallment = purchaseType === "installment";
      const totalMinor = Number(totalCostMinor) || 145000000;
      const downMinor = isInstallment ? (Number(downPaymentMinor) || 0) : totalMinor;
      const paidMinor = downMinor;
      const balanceMinor = Math.max(0, totalMinor - paidMinor);
      const isPaidOff = balanceMinor === 0;

      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 7);

      const initialPayments = [];
      if (paidMinor > 0) {
        initialPayments.push({
          id: `PAY-${Date.now().toString(36).toUpperCase()}`,
          date: new Date().toISOString().split("T")[0],
          amountMinor: paidMinor,
          channel: preferredMethod,
          reference: `reg_${Date.now().toString(36)}_${nextIndex}`,
          notes: isInstallment ? "Initial Lease Down Payment & Registration" : "Full Outright Purchase Payment",
          status: "confirmed"
        });
      }

      const newCustomer = {
        id: customerId,
        name: (name || "").trim(),
        phone: (phone || "").trim(),
        email: email ? email.trim() : `${(name || "rider").toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
        nin: nin ? nin.trim() : `59203819${String(100 + nextIndex)}`,
        city: city || "Lagos",
        address: address ? address.trim() : "",
        guarantorName: guarantorName ? guarantorName.trim() : "None Provided",
        guarantorPhone: guarantorPhone ? guarantorPhone.trim() : "N/A",
        guarantorRelationship,
        bikeId: assignedBikeId,
        batterySn,
        purchaseType,
        totalCostMinor: totalMinor,
        downPaymentMinor: downMinor,
        paidMinor,
        balanceMinor,
        weeklyInstallmentMinor: isInstallment ? (Number(weeklyInstallmentMinor) || 2500000) : 0,
        frequency: "weekly",
        nextDueDate: isPaidOff ? "" : nextDueDate.toISOString().split("T")[0],
        daysOverdue: 0,
        status: isPaidOff ? "paid_off" : "current",
        preferredMethod,
        payments: initialPayments,
        swaps: [],
        createdAt: new Date().toISOString()
      };

      this.customers.unshift(newCustomer);

      if (bike) {
        bike.assignedCustomerId = customerId;
        bike.riderName = newCustomer.name;
        bike.riderPhone = newCustomer.phone;
        bike.status = "active";
        if (bike.telemetry) {
          bike.telemetry.d_fet = 1;
          if (city) bike.telemetry.city = city;
        }
      }

      this.saveToStorage();
      return newCustomer;
    },

    /**
     * Add single battery (Merchants Add Batteries)
     */
    addBattery(payload) {
      const {
        batteryNumber,
        sn,
        imsi,
        capacityAh = 20.93,
        cellCount = 15,
        assignedStationId = null,
        assignedBikeId = null
      } = payload;

      const existing = this.batteries.find((b) => b.sn === sn);
      if (existing) {
        throw new Error(`Battery with SN ${sn} already exists in inventory`);
      }

      const station = assignedStationId ? this.stations.find((s) => s.id === assignedStationId) : null;
      const bike = assignedBikeId ? this.bikes.find((b) => b.id === assignedBikeId) : null;

      const newBattery = {
        batteryNumber: batteryNumber || `BT104802512EST025091${Math.floor(1000 + Math.random() * 9000)}`,
        sn: sn.trim(),
        signal: 24,
        distanceKm: 0.0,
        voltage: 76.8,
        current: 0.0,
        soc: 100,
        capacityAh: Number(capacityAh) || 20.93,
        loopCount: 0,
        imsi: imsi || `460240085${Math.floor(100000 + Math.random() * 900000)}`,
        state: station ? "charge" : (bike ? "move" : "static"),
        onlineStatus: "Online",
        updateTime: new Date().toISOString().replace("T", " ").substring(0, 19),
        pcdTemp: 29.5,
        casingTemp: 26.0,
        cellTemp: 26.0,
        cellCount: Number(cellCount) || 15,
        cellVoltages: generate15CellVoltages(76.8, 2),
        maxCellV: 5.12,
        minCellV: 5.118,
        diffV: 0.002,
        hardwareVersion: "2.3",
        softwareVersion: "90760122",
        protocolVersion: "V2",
        d_fet: 1,
        c_fet: 1,
        assignedBikeId: bike ? bike.id : null,
        assignedRiderName: bike ? bike.riderName : null,
        assignedRiderPhone: bike ? bike.riderPhone : null,
        assignedStationId: station ? station.id : null,
        assignedStationName: station ? station.name : null,
        lat: station ? station.lat : (bike ? bike.telemetry?.lat : 6.5982),
        lng: station ? station.lng : (bike ? bike.telemetry?.lng : 3.3445),
        speed: 0,
        city: station ? station.city : "Lagos",
        alarms: {
          singleLowV: "normal",
          singleHighV: "normal",
          cellLowTemp: "normal",
          cellHighTemp: "normal",
          totalHighV: "normal",
          totalLowV: "normal",
          singleDiffV: "normal",
          mosHighTemp: "normal",
          lowTemp: "normal",
          highTempAlert: "normal"
        },
        protections: {
          totalUnderV: "normal",
          diffPressure: "normal",
          shortCircuit: "normal",
          singleUnderV: "normal",
          singleOverV: "normal",
          dischargeOvercurrent: "normal",
          chargeOvercurrent: "normal",
          lowTempProt: "normal",
          overTempProt: "normal",
          statusAnomaly: "normal",
          mosAnomaly: "normal",
          totalOverV: "normal"
        },
        failures: {
          gpsSignal: "normal",
          gsmSignal: "normal"
        }
      };

      this.batteries.unshift(newBattery);

      if (station) {
        station.activeBatteries.push({
          sn: newBattery.sn,
          id: newBattery.batteryNumber,
          soc: newBattery.soc,
          v: newBattery.voltage,
          temp: newBattery.cellTemp,
          status: "ready"
        });
      }

      if (bike) {
        bike.batterySn = newBattery.sn;
        bike.batteryId = newBattery.batteryNumber;
      }

      this.saveToStorage();
      return newBattery;
    },

    /**
     * Batch import merchant batteries from CSV / list
     */
    batchImportBatteries(items) {
      if (!Array.isArray(items) || !items.length) return 0;
      let count = 0;
      for (const item of items) {
        if (!item.sn) continue;
        if (this.batteries.some((b) => b.sn === item.sn.trim())) continue;
        try {
          this.addBattery(item);
          count++;
        } catch (_) {}
      }
      return count;
    },

    /**
     * Remove or retire batteries
     */
    removeBattery(sn) {
      this.batteries = this.batteries.filter((b) => b.sn !== sn);
      this.stations.forEach((st) => {
        st.activeBatteries = st.activeBatteries.filter((b) => b.sn !== sn);
      });
      this.bikes.forEach((bk) => {
        if (bk.batterySn === sn) {
          bk.batterySn = "UNASSIGNED";
        }
      });
      this.saveToStorage();
    },

    batchRemoveBatteries(sns) {
      const snSet = new Set(sns);
      this.batteries = this.batteries.filter((b) => !snSet.has(b.sn));
      this.saveToStorage();
    },

    /**
     * Add new swap station (Site Management)
     */
    addStation(payload) {
      const {
        name,
        address,
        city = "Lagos",
        lat = 6.45,
        lng = 3.50,
        totalSlots = 12,
        operatorName = "Hub Attendant",
        operatorPhone = "+234 800 000 0000"
      } = payload;

      const newStation = {
        id: `ST-${Date.now().toString(36).toUpperCase()}`,
        name: name.trim(),
        address: address.trim(),
        city,
        lat: Number(lat) || 6.45,
        lng: Number(lng) || 3.50,
        totalSlots: Number(totalSlots) || 12,
        operatorName: operatorName.trim(),
        operatorPhone: operatorPhone.trim(),
        activeBatteries: []
      };

      this.stations.push(newStation);
      this.saveToStorage();
      return newStation;
    },

    /**
     * Batch distribute batteries to a swap station's locker cabinet
     */
    distributeBatteries({ stationId, batterySns }) {
      const station = this.stations.find((s) => s.id === stationId);
      if (!station) throw new Error("Station not found");

      let count = 0;
      for (const sn of batterySns) {
        const bat = this.batteries.find((b) => b.sn === sn);
        if (!bat) continue;
        bat.assignedStationId = station.id;
        bat.assignedStationName = station.name;
        bat.assignedBikeId = null;
        bat.assignedRiderName = null;
        bat.assignedRiderPhone = null;
        bat.state = bat.soc >= 90 ? "static" : "charge";

        // Add to station locker bay if not present
        if (!station.activeBatteries.some((b) => b.sn === sn)) {
          station.activeBatteries.push({
            sn: bat.sn,
            id: bat.batteryNumber,
            soc: bat.soc,
            v: bat.voltage,
            temp: bat.cellTemp,
            status: bat.soc >= 85 ? "ready" : "charging"
          });
          count++;
        }
      }
      this.saveToStorage();
      return count;
    },

    /**
     * Execute remote command on a battery matching Yunhe OEM Operate dropdown:
     * Details, Unbind battery, Reboot DTU, Restart MBS, Turn off C/D FET, Turn off C FET, Turn off D FET, Enable C/D FET, MOS state
     */
    async executeYunheCommand(batterySn, command) {
      const bat = this.batteries.find((b) => b.sn === batterySn);
      if (!bat) throw new Error(`Battery with SN ${batterySn} not found`);

      const bike = bat.assignedBikeId ? this.bikes.find((b) => b.id === bat.assignedBikeId) : null;

      switch (command) {
        case "reboot_dtu":
          // Throws unless Yunhe confirms. Online status is NOT assumed: the next live sync decides it.
          await rebootBatteryDTU(bat.batteryNumber, `Reboot DTU for ${batterySn} from Beverly PUE`);
          return { success: true, message: `Reboot confirmed by Yunhe for battery ${batterySn}. Sync to see its new status.` };

        case "restart_bms":
          throw new Error("Restarting the BMS is not supported by the battery platform integration.");

        case "unbind_battery":
          if (bike) {
            bike.batterySn = "UNBOUND";
          }
          bat.assignedBikeId = null;
          bat.assignedRiderName = null;
          bat.assignedRiderPhone = null;
          bat.state = "static";
          this.saveToStorage();
          return { success: true, message: `Battery ${batterySn} unbound from vehicle.` };

        case "turn_off_cd_fet":
          // Confirm with Yunhe first; local state changes only after a receipt.
          await setBatteryFets(bat.batteryNumber, { allowCharge: false, allowDischarge: false, reason: `turn_off_cd_fet for ${batterySn} from Beverly PUE` });
          bat.c_fet = 0;
          bat.d_fet = 0;
          if (bike) {
            bike.telemetry.c_fet = bat.c_fet;
            bike.telemetry.d_fet = bat.d_fet;
            if (!bat.d_fet) bike.telemetry.speed = 0;
          }
          this.saveToStorage();
          return { success: true, message: `Charge and discharge switched off on ${batterySn}, confirmed by Yunhe.` };

        case "turn_off_c_fet":
          // Confirm with Yunhe first; local state changes only after a receipt.
          await setBatteryFets(bat.batteryNumber, { allowCharge: false, allowDischarge: bat.d_fet === 1, reason: `turn_off_c_fet for ${batterySn} from Beverly PUE` });
          bat.c_fet = 0;
          bat.d_fet = bat.d_fet;
          if (bike) {
            bike.telemetry.c_fet = bat.c_fet;
            bike.telemetry.d_fet = bat.d_fet;
            if (!bat.d_fet) bike.telemetry.speed = 0;
          }
          this.saveToStorage();
          return { success: true, message: `Charge switched off on ${batterySn}, confirmed by Yunhe.` };

        case "turn_off_d_fet":
          // Confirm with Yunhe first; local state changes only after a receipt.
          await setBatteryFets(bat.batteryNumber, { allowCharge: bat.c_fet === 1, allowDischarge: false, reason: `turn_off_d_fet for ${batterySn} from Beverly PUE` });
          bat.c_fet = bat.c_fet;
          bat.d_fet = 0;
          if (bike) {
            bike.telemetry.c_fet = bat.c_fet;
            bike.telemetry.d_fet = bat.d_fet;
            if (!bat.d_fet) bike.telemetry.speed = 0;
          }
          this.saveToStorage();
          return { success: true, message: `Discharge switched off (motor power cut) on ${batterySn}, confirmed by Yunhe.` };

        case "enable_cd_fet":
          // Confirm with Yunhe first; local state changes only after a receipt.
          await setBatteryFets(bat.batteryNumber, { allowCharge: true, allowDischarge: true, reason: `enable_cd_fet for ${batterySn} from Beverly PUE` });
          bat.c_fet = 1;
          bat.d_fet = 1;
          if (bike) {
            bike.telemetry.c_fet = bat.c_fet;
            bike.telemetry.d_fet = bat.d_fet;
            if (!bat.d_fet) bike.telemetry.speed = 0;
          }
          this.saveToStorage();
          return { success: true, message: `Charge and discharge switched on on ${batterySn}, confirmed by Yunhe.` };

        case "get_mos_state":
          return {
            success: true,
            c_fet: bat.c_fet,
            d_fet: bat.d_fet,
            statusText: `Last known: C-MOS ${bat.c_fet ? 'ON' : 'OFF'} | D-MOS ${bat.d_fet ? 'ON' : 'OFF'}`
          };

        default:
          throw new Error(`Unknown command: ${command}`);
      }
    },

    /**
     * Record a customer payment via Paystack or Bank Transfer
     */
    recordPayment(customerId, { amountMinor, channel = "Paystack", reference, notes = "" }) {
      const customer = this.customers.find((c) => c.id === customerId);
      if (!customer) {
        throw new Error("Customer record not found");
      }

      const payment = {
        id: `PAY-${Date.now().toString(36).toUpperCase()}`,
        date: new Date().toISOString().split("T")[0],
        amountMinor: Number(amountMinor),
        channel,
        reference: reference || `${channel === "Paystack" ? "pstk" : "bank"}_${Date.now()}`,
        notes,
        status: "confirmed"
      };

      customer.payments.unshift(payment);
      customer.paidMinor += payment.amountMinor;
      customer.balanceMinor = Math.max(0, customer.totalCostMinor - customer.paidMinor);

      if (customer.balanceMinor === 0) {
        customer.status = "paid_off";
        customer.daysOverdue = 0;
      } else {
        customer.status = "current";
        customer.daysOverdue = 0;
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 7);
        customer.nextDueDate = nextDate.toISOString().split("T")[0];
      }

      const bike = this.bikes.find((b) => b.id === customer.bikeId);
      if (bike) {
        if (bike.status === "impounded") {
          bike.status = "active";
        }
        bike.telemetry.d_fet = 1;
      }

      const bat = this.batteries.find((b) => b.sn === customer.batterySn);
      if (bat) {
        bat.d_fet = 1;
        bat.c_fet = 1;
      }

      this.saveToStorage();
      return payment;
    },

    /**
     * Remotely toggle motor power via Yunhe battery discharge FET
     */
    async toggleBikeMotorPower(bikeId, allowPower) {
      const bike = this.bikes.find((b) => b.id === bikeId);
      if (!bike) return;

      // Throws unless Yunhe confirms; the bike's state below changes only after a receipt.
      await setBatteryFets(bike.batteryId, {
        allowCharge: true,
        allowDischarge: allowPower,
        reason: allowPower ? "Motor power enabled from Beverly PUE" : "Motor power cut from Beverly PUE"
      });

      bike.telemetry.d_fet = allowPower ? 1 : 0;
      if (!allowPower) {
        bike.telemetry.speed = 0;
      }

      const bat = this.batteries.find((b) => b.sn === bike.batterySn);
      if (bat) {
        bat.d_fet = allowPower ? 1 : 0;
      }

      this.saveToStorage();
      return bike.telemetry.d_fet;
    },

    async disableMotor(bikeId) {
      return this.toggleBikeMotorPower(bikeId, false);
    },

    async enableMotor(bikeId) {
      return this.toggleBikeMotorPower(bikeId, true);
    },

    async rebootBikeDTU(bikeId) {
      const bike = this.bikes.find((b) => b.id === bikeId);
      if (!bike) return;

      // Throws unless Yunhe confirms. A reboot receipt does not prove a fresh heartbeat,
      // so the heartbeat time is left alone; the next live sync updates it.
      await rebootBatteryDTU(bike.batteryId, "Reboot DTU from Beverly PUE");
    },

    async rebootDtu(bikeId) {
      return this.rebootBikeDTU(bikeId);
    },

    setBikeStatus(bikeId, status) {
      const bike = this.bikes.find((b) => b.id === bikeId);
      if (bike) {
        bike.status = status;
        this.saveToStorage();
      }
    }
  }
});
