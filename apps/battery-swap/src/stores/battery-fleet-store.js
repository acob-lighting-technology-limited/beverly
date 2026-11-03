import { defineStore } from "pinia";
import {
  fetchYunheBatteries,
  fetchYunheStations,
  toggleBatteryDischarge,
  rebootBatteryDTU
} from "../services/yunhe-battery-service.js";

const STORAGE_KEY_BIKES = "beverly.battery_fleet.bikes_v1";
const STORAGE_KEY_CUSTOMERS = "beverly.battery_fleet.customers_v1";
const STORAGE_KEY_SWAPS = "beverly.battery_fleet.swaps_v1";
const STORAGE_KEY_STATIONS = "beverly.battery_fleet.stations_v1";

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

function seedFleetData() {
  const stations = [
    {
      id: "E26ED07909B6459A8036C24836035D19",
      name: "Station 1 - Ikeja Central Swap Hub",
      address: "Plot 12 Commercial Avenue, Ikeja, Lagos",
      city: "Lagos",
      lat: 6.5982,
      lng: 3.3445,
      totalSlots: 12,
      operatorName: "Chidi O.",
      operatorPhone: "+234 803 111 2233",
      activeBatteries: [
        { sn: "B100072509010001", id: "BT104802512EST0250911001", soc: 98, v: 76.8, temp: 27.2, status: "ready" },
        { sn: "B100072509010002", id: "BT104802512EST0250911002", soc: 95, v: 76.5, temp: 26.8, status: "ready" },
        { sn: "B100072509010003", id: "BT104802512EST0250911003", soc: 92, v: 76.1, temp: 28.0, status: "ready" },
        { sn: "B100072509010004", id: "BT104802512EST0250911004", soc: 88, v: 75.8, temp: 27.5, status: "ready" },
        { sn: "B100072509010005", id: "BT104802512EST0250911005", soc: 42, v: 70.2, temp: 31.0, status: "charging" },
        { sn: "B100072509010006", id: "BT104802512EST0250911006", soc: 28, v: 68.5, temp: 32.4, status: "charging" }
      ]
    },
    {
      id: "ST-VI-02",
      name: "Station 2 - Victoria Island Commercial Hub",
      address: "14 Adeola Odeku Street, Victoria Island, Lagos",
      city: "Lagos",
      lat: 6.4298,
      lng: 3.4241,
      totalSlots: 10,
      operatorName: "Taiwo A.",
      operatorPhone: "+234 802 445 6677",
      activeBatteries: [
        { sn: "B100072509010007", id: "BT104802512EST0250911007", soc: 100, v: 77.2, temp: 26.5, status: "ready" },
        { sn: "B100072509010008", id: "BT104802512EST0250911008", soc: 96, v: 76.6, temp: 27.0, status: "ready" },
        { sn: "B100072509010009", id: "BT104802512EST0250911009", soc: 91, v: 76.0, temp: 27.8, status: "ready" },
        { sn: "B100072509010010", id: "BT104802512EST0250911010", soc: 35, v: 69.4, temp: 30.5, status: "charging" }
      ]
    },
    {
      id: "ST-YB-03",
      name: "Station 3 - Yaba Tech Swap Station",
      address: "Herbert Macaulay Way by Commercial Ave, Yaba, Lagos",
      city: "Lagos",
      lat: 6.5185,
      lng: 3.3725,
      totalSlots: 8,
      operatorName: "Ibrahim M.",
      operatorPhone: "+234 809 778 9900",
      activeBatteries: [
        { sn: "B100072509010011", id: "BT104802512EST0250911011", soc: 99, v: 77.0, temp: 26.8, status: "ready" },
        { sn: "B100072509010012", id: "BT104802512EST0250911012", soc: 94, v: 76.3, temp: 27.1, status: "ready" },
        { sn: "B100072509010013", id: "BT104802512EST0250911013", soc: 22, v: 67.8, temp: 33.1, status: "charging" }
      ]
    },
    {
      id: "ST-ABJ-04",
      name: "Station 4 - Abuja Wuse 2 Depot",
      address: "Aminu Kano Crescent, Wuse 2, Abuja",
      city: "Abuja",
      lat: 9.0655,
      lng: 7.4812,
      totalSlots: 12,
      operatorName: "Yusuf D.",
      operatorPhone: "+234 805 334 5566",
      activeBatteries: [
        { sn: "B100072509010014", id: "BT104802512EST0250911014", soc: 97, v: 76.7, temp: 26.9, status: "ready" },
        { sn: "B100072509010015", id: "BT104802512EST0250911015", soc: 90, v: 75.9, temp: 27.4, status: "ready" },
        { sn: "B100072509010016", id: "BT104802512EST0250911016", soc: 86, v: 75.4, temp: 28.1, status: "ready" }
      ]
    },
    {
      id: "ST-IBD-05",
      name: "Station 5 - Ibadan Bodija Hub",
      address: "Old Bodija Road, near University of Ibadan, Oyo State",
      city: "Ibadan",
      lat: 7.4188,
      lng: 3.9082,
      totalSlots: 8,
      operatorName: "Folake B.",
      operatorPhone: "+234 818 223 4455",
      activeBatteries: [
        { sn: "B100072509010017", id: "BT104802512EST0250911017", soc: 95, v: 76.4, temp: 27.0, status: "ready" },
        { sn: "B100072509010018", id: "BT104802512EST0250911018", soc: 89, v: 75.7, temp: 27.6, status: "ready" }
      ]
    }
  ];

  const bikes = [];
  const customers = [];
  const initialSwaps = [];

  // Generate 200 EV Bikes and Rider Profiles
  for (let i = 1; i <= 200; i++) {
    const bikeIndexStr = String(i).padStart(3, "0");
    const bikeId = `EVB-${bikeIndexStr}`;
    const customerId = `CUST-${bikeIndexStr}`;
    
    // Pick name deterministically
    const fName = FIRST_NAMES[(i * 7) % FIRST_NAMES.length];
    const lName = LAST_NAMES[(i * 11) % LAST_NAMES.length];
    const riderName = `${fName} ${lName}`;
    const phone = `+234 80${(i % 9) + 1} ${String(100 + (i * 17) % 900)} ${String(1000 + (i * 43) % 9000)}`;
    const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${i}@gmail.com`;
    const plateNumber = `LAG-${100 + i}-EV`;
    
    // Deterministic location corridor
    const loc = i === 1 ? LOCATIONS[8] : LOCATIONS[(i - 1) % (LOCATIONS.length - 1)];
    const angle = (i * 137.5 * Math.PI) / 180;
    const distance = ((i * 31) % 100) / 100 * loc.radius;
    const lat = i === 1 ? 7.345775 : Number((loc.lat + Math.cos(angle) * distance).toFixed(6));
    const lng = i === 1 ? 5.178008 : Number((loc.lng + Math.sin(angle) * distance).toFixed(6));

    // Telemetry
    // Bike 1 matches real live Yunhe battery BT107204512YHZN251111002 (sn: B100112510270002)
    const batterySn = i === 1 ? "B100112510270002" : `B100112510${270002 + i}`;
    const batteryId = i === 1 ? "BT107204512YHZN251111002" : `BT107204512YHZN251${String(10000 + i)}`;
    
    // Varied SOC (charge levels): some high, some low needing swap
    let soc;
    if (i === 1) soc = 81;
    else if (i % 12 === 0) soc = 14; // low, needs swap!
    else if (i % 7 === 0) soc = 22; // low warning
    else if (i % 5 === 0) soc = 48;
    else soc = Math.min(99, 55 + (i * 3) % 44);

    const voltage = Number((68.0 + (soc / 100) * 9.2).toFixed(1)); // 68V to 77.2V
    const speed = i === 1 ? 20.65 : (soc < 15 ? 0 : Number(((i * 7) % 38).toFixed(1)));
    const mileage = i === 1 ? 596.51 : Number((120 + i * 23.4).toFixed(1));
    const online = i % 25 === 0 ? 0 : 1;
    const motorPowerAllowed = i % 30 !== 0; // FET discharge enabled (unless immobilised for severe overdue)

    // Purchase & Payment structure: 85% on installment, 15% outright
    const isInstallment = i % 7 !== 0;
    const totalCostMinor = 145000000; // ₦1,450,000
    const downPaymentMinor = 30000000; // ₦300,000
    const weeklyInstallmentMinor = 2500000; // ₦25,000 per week (~46 weeks total)
    
    let paidWeeks = Math.min(46, (i * 3) % 40 + 4);
    let paidMinor = downPaymentMinor + paidWeeks * weeklyInstallmentMinor;
    let balanceMinor = Math.max(0, totalCostMinor - paidMinor);

    let paymentStatus = "current";
    let daysOverdue = 0;
    if (!isInstallment) {
      paymentStatus = "paid_off";
      paidMinor = totalCostMinor;
      balanceMinor = 0;
    } else if (balanceMinor === 0) {
      paymentStatus = "paid_off";
    } else if (i % 15 === 0) {
      paymentStatus = "overdue";
      daysOverdue = 7 + (i % 14);
    } else if (i % 9 === 0) {
      paymentStatus = "grace_period";
      daysOverdue = 2;
    }

    const preferredMethod = i % 2 === 0 ? "Paystack" : "Bank Transfer";

    // Bike Record
    bikes.push({
      id: bikeId,
      model: i % 4 === 0 ? "Beverly Cargo 3.0kW" : "Beverly Bolt 2.5kW",
      plateNumber,
      status: paymentStatus === "overdue" && daysOverdue > 10 ? "impounded" : (online ? "active" : "idle"),
      batterySn,
      batteryId,
      assignedCustomerId: customerId,
      riderName,
      riderPhone: phone,
      // Battery Telemetry (the bike has no GPS; battery provides it)
      telemetry: {
        soc,
        voltage,
        current: speed > 0 ? -12.4 : 0,
        speed,
        mileage,
        lat,
        lng,
        city: loc.city,
        temp: Number((27.0 + (i % 8)).toFixed(1)),
        online,
        d_fet: motorPowerAllowed ? 1 : 0,
        c_fet: 1,
        cellSum: 23,
        loopSum: 70 + (i % 50),
        lastHeartbeat: new Date(Date.now() - (i % 15) * 60000).toISOString()
      }
    });

    // Customer Record
    customers.push({
      id: customerId,
      name: riderName,
      phone,
      email,
      nin: `59203819${String(100 + i)}`,
      guarantorName: `${FIRST_NAMES[(i * 3) % FIRST_NAMES.length]} ${LAST_NAMES[(i * 5) % LAST_NAMES.length]}`,
      guarantorPhone: `+234 802 ${String(200 + (i * 19) % 800)} ${String(2000 + (i * 37) % 7000)}`,
      bikeId,
      batterySn,
      purchaseType: isInstallment ? "installment" : "outright",
      totalCostMinor,
      downPaymentMinor,
      paidMinor,
      balanceMinor,
      weeklyInstallmentMinor,
      frequency: "weekly",
      nextDueDate: paymentStatus === "overdue" ? "2026-10-22" : "2026-11-05",
      daysOverdue,
      status: paymentStatus,
      preferredMethod,
      payments: [
        {
          id: `PAY-${1000 + i}`,
          date: "2026-10-22",
          amountMinor: isInstallment ? weeklyInstallmentMinor : totalCostMinor,
          channel: preferredMethod,
          reference: `${preferredMethod === "Paystack" ? "pstk_" : "trf_"}${Date.now().toString(36)}_${i}`,
          status: "confirmed"
        },
        {
          id: `PAY-${900 + i}`,
          date: "2026-10-15",
          amountMinor: weeklyInstallmentMinor,
          channel: preferredMethod,
          reference: `${preferredMethod === "Paystack" ? "pstk_" : "trf_"}prior_${i}`,
          status: "confirmed"
        }
      ],
      swaps: [
        {
          id: `SWP-${500 + i}`,
          date: "2026-10-27 14:32",
          stationName: "Station 1 - Ikeja Central Swap Hub",
          batteryInSn: `B100112510${270002 + i - 1}`,
          batteryInSoc: 16,
          batteryOutSn: batterySn,
          batteryOutSoc: 98,
          feeMinor: 80000 // ₦800
        }
      ]
    });
  }

  // Pre-seed 10 recent fleet swaps
  for (let s = 1; s <= 10; s++) {
    initialSwaps.push({
      id: `SWP-LOG-00${s}`,
      timestamp: new Date(Date.now() - s * 3600000 * 2.5).toLocaleString("en-GB", { timeZone: "Africa/Lagos" }),
      bikeId: `EVB-00${s}`,
      riderName: bikes[s - 1].riderName,
      stationId: stations[s % stations.length].id,
      stationName: stations[s % stations.length].name,
      batteryInSn: `B100112510${270500 + s}`,
      batteryInSoc: 12 + (s % 8),
      batteryOutSn: bikes[s - 1].batterySn,
      batteryOutSoc: 96 + (s % 4),
      operatorName: stations[s % stations.length].operatorName,
      feeMinor: 80000,
      paymentMethod: s % 2 === 0 ? "Beverly Wallet" : "Cash / POS"
    });
  }

  return { bikes, customers, stations, swaps: initialSwaps };
}

export const useBatteryFleetStore = defineStore("batteryFleet", {
  state: () => {
    // Attempt local persistence
    let bikes = null;
    let customers = null;
    let stations = null;
    let swaps = null;

    try {
      const b = localStorage.getItem(STORAGE_KEY_BIKES);
      const c = localStorage.getItem(STORAGE_KEY_CUSTOMERS);
      const s = localStorage.getItem(STORAGE_KEY_STATIONS);
      const sw = localStorage.getItem(STORAGE_KEY_SWAPS);
      if (b && c && s && sw) {
        bikes = JSON.parse(b);
        customers = JSON.parse(c);
        stations = JSON.parse(s);
        swaps = JSON.parse(sw);
      }
    } catch (_) {}

    if (!bikes || bikes.length < 200) {
      const seeded = seedFleetData();
      bikes = seeded.bikes;
      customers = seeded.customers;
      stations = seeded.stations;
      swaps = seeded.swaps;
    }

    return {
      bikes,
      customers,
      stations,
      swaps,
      selectedBikeId: "EVB-001",
      activeTab: "map", // map | fleet | crm | stations | health
      searchQuery: "",
      filterStatus: "all",
      filterSoc: "all",
      loading: false,
      lastSyncTime: new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos" })
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
    totalBikes(state) {
      return state.bikes.length;
    },
    onlineBikesCount(state) {
      return state.bikes.filter((b) => b.telemetry.online === 1).length;
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
    saveToStorage() {
      try {
        localStorage.setItem(STORAGE_KEY_BIKES, JSON.stringify(this.bikes));
        localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(this.customers));
        localStorage.setItem(STORAGE_KEY_STATIONS, JSON.stringify(this.stations));
        localStorage.setItem(STORAGE_KEY_SWAPS, JSON.stringify(this.swaps));
      } catch (_) {}
    },

    selectBike(bikeId) {
      this.selectedBikeId = bikeId;
    },

    async syncLiveYunheTelemetry() {
      this.loading = true;
      try {
        const liveBatteries = await fetchYunheBatteries();
        if (Array.isArray(liveBatteries) && liveBatteries.length > 0) {
          // Update the first bike with live battery 1 data
          const b1 = liveBatteries.find((b) => b.sn === "B100112510270002" || b.id === "BT107204512YHZN251111002") || liveBatteries[0];
          if (b1 && this.bikes[0]) {
            this.bikes[0].batterySn = b1.sn || this.bikes[0].batterySn;
            this.bikes[0].telemetry.soc = Number(b1.soc ?? this.bikes[0].telemetry.soc);
            this.bikes[0].telemetry.voltage = Number(b1.v ?? this.bikes[0].telemetry.voltage);
            this.bikes[0].telemetry.current = Number(b1.i ?? this.bikes[0].telemetry.current);
            this.bikes[0].telemetry.speed = Number(b1.speed ?? this.bikes[0].telemetry.speed);
            this.bikes[0].telemetry.mileage = Number(b1.mileage ?? this.bikes[0].telemetry.mileage);
            this.bikes[0].telemetry.lat = Number(b1.lat ?? this.bikes[0].telemetry.lat);
            this.bikes[0].telemetry.lng = Number(b1.lng ?? this.bikes[0].telemetry.lng);
            this.bikes[0].telemetry.online = Number(b1.online ?? 1);
            this.bikes[0].telemetry.lastHeartbeat = new Date().toISOString();
          }
        }
        this.lastSyncTime = new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos" });
        this.saveToStorage();
      } catch (err) {
        console.warn("[BatteryFleetStore] Telemetry sync error:", err);
      } finally {
        this.loading = false;
      }
    },

    /**
     * Swap a depleted battery with a fully charged battery at a station
     */
    executeSwap({ bikeId, stationId, batteryOutSn, operatorName = "Station Operator" }) {
      const bike = this.bikes.find((b) => b.id === bikeId);
      const station = this.stations.find((s) => s.id === stationId);
      if (!bike || !station) {
        throw new Error("Invalid bike or station selected for swap");
      }

      const freshBattery = station.activeBatteries.find((b) => b.sn === batteryOutSn);
      if (!freshBattery) {
        throw new Error("Selected replacement battery is not available in station inventory");
      }

      const depletedBatterySn = bike.batterySn;
      const depletedSoc = bike.telemetry.soc;

      // Swap out the battery in the bike
      bike.batterySn = freshBattery.sn;
      bike.batteryId = freshBattery.id;
      bike.telemetry.soc = freshBattery.soc;
      bike.telemetry.voltage = freshBattery.v;
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

      // Record swap log
      const swapRecord = {
        id: `SWP-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toLocaleString("en-GB", { timeZone: "Africa/Lagos" }),
        bikeId: bike.id,
        riderName: bike.riderName,
        stationId: station.id,
        stationName: station.name,
        batteryInSn: depletedBatterySn,
        batteryInSoc: depletedSoc,
        batteryOutSn: freshBattery.sn,
        batteryOutSoc: freshBattery.soc,
        operatorName,
        feeMinor: 80000,
        paymentMethod: "Beverly Wallet"
      };

      this.swaps.unshift(swapRecord);

      // Add to customer's swap history
      const customer = this.customers.find((c) => c.id === bike.assignedCustomerId);
      if (customer) {
        customer.batterySn = freshBattery.sn;
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
      return swapRecord;
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

      // Update installment status
      if (customer.balanceMinor === 0) {
        customer.status = "paid_off";
        customer.daysOverdue = 0;
      } else {
        customer.status = "current";
        customer.daysOverdue = 0;
        // Bump next due date by 7 days
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 7);
        customer.nextDueDate = nextDate.toISOString().split("T")[0];
      }

      // If bike was impounded or disabled due to overdue payments, restore it
      const bike = this.bikes.find((b) => b.id === customer.bikeId);
      if (bike) {
        if (bike.status === "impounded") {
          bike.status = "active";
        }
        bike.telemetry.d_fet = 1;
      }

      this.saveToStorage();
      return payment;
    },

    /**
     * Remotely toggle motor power via Yunhe battery discharge FET
     * (e.g. for lease overdue enforcement or reported theft)
     */
    async toggleBikeMotorPower(bikeId, allowPower) {
      const bike = this.bikes.find((b) => b.id === bikeId);
      if (!bike) return;

      try {
        await toggleBatteryDischarge(bike.batteryId, allowPower);
      } catch (e) {
        console.warn("[BatteryFleetStore] Remote FET command warning:", e);
      }

      bike.telemetry.d_fet = allowPower ? 1 : 0;
      if (!allowPower) {
        bike.telemetry.speed = 0;
      }
      this.saveToStorage();
      return bike.telemetry.d_fet;
    },

    async disableMotor(bikeId) {
      console.log("[BatteryFleetStore] disableMotor action invoked for", bikeId);
      return this.toggleBikeMotorPower(bikeId, false);
    },

    async enableMotor(bikeId) {
      console.log("[BatteryFleetStore] enableMotor action invoked for", bikeId);
      return this.toggleBikeMotorPower(bikeId, true);
    },

    /**
     * Send remote reboot to battery communication DTU
     */
    async rebootBikeDTU(bikeId) {
      const bike = this.bikes.find((b) => b.id === bikeId);
      if (!bike) return;

      try {
        await rebootBatteryDTU(bike.batteryId);
      } catch (e) {
        console.warn("[BatteryFleetStore] Remote DTU reboot warning:", e);
      }

      bike.telemetry.lastHeartbeat = new Date().toISOString();
      this.saveToStorage();
    },

    async rebootDtu(bikeId) {
      console.log("[BatteryFleetStore] rebootDtu action invoked for", bikeId);
      return this.rebootBikeDTU(bikeId);
    },

    /**
     * Update bike operational status
     */
    setBikeStatus(bikeId, status) {
      const bike = this.bikes.find((b) => b.id === bikeId);
      if (bike) {
        bike.status = status;
        this.saveToStorage();
      }
    }
  }
});
