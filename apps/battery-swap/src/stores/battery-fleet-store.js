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
  const batteries = [];

  // Generate 200 EV Bikes, Rider Profiles, and Yunhe Batteries
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

    // Telemetry & Battery Identity matching Yunhe OEM Screenshots 1, 2, 3, 4
    let batteryNumber, batterySn, imsi;
    if (i === 1) {
      batteryNumber = "BT104802512EST0250911001";
      batterySn = "B100072509010001";
      imsi = "460240085271115";
    } else if (i === 2) {
      batteryNumber = "BT107204512YHZN251111002";
      batterySn = "B100112510270002";
      imsi = "621208531980042";
    } else {
      batteryNumber = `BT104802512EST025091${String(1000 + i)}`;
      batterySn = `B1000725090${1000 + i}`;
      imsi = `460240085${String(200000 + i)}`;
    }

    // Varied SOC (charge levels)
    let soc;
    if (i === 1) soc = 100;
    else if (i === 2) soc = 81;
    else if (i % 12 === 0) soc = 14; // low, needs swap!
    else if (i % 7 === 0) soc = 22; // low warning
    else if (i % 5 === 0) soc = 48;
    else soc = Math.min(99, 55 + (i * 3) % 44);

    let voltage = i === 1 ? 49.90 : (i === 2 ? 76.19 : Number((48.0 + (soc / 100) * 28.5).toFixed(2)));
    let speed = i === 1 ? 0 : (i === 2 ? 20.65 : (soc < 15 ? 0 : Number(((i * 7) % 38).toFixed(1))));
    let current = i === 1 ? 0.00 : (i === 2 ? -5.63 : (speed > 0 ? -12.4 : 0));
    let mileage = i === 1 ? 238.71 : (i === 2 ? 596.51 : Number((120 + i * 23.4).toFixed(2)));
    let online = i === 2 ? 0 : (i % 25 === 0 ? 0 : 1);
    let motorPowerAllowed = i % 30 !== 0; // FET discharge enabled
    let capacityAh = i === 1 ? 20.93 : (i === 2 ? 32.64 : Number((20.0 + (i % 14) * 0.95).toFixed(2)));
    let loopCount = i === 1 ? 54 : (i === 2 ? 70 : 45 + (i % 60));
    let signal = i === 1 ? 18 : (i === 2 ? 14 : 12 + (i % 19));

    // Cell voltages (15 series cells)
    const cellVoltages = i === 1 ? 
      [3.329, 3.326, 3.328, 3.327, 3.326, 3.326, 3.327, 3.328, 3.326, 3.326, 3.327, 3.328, 3.326, 3.327, 3.329] :
      generate15CellVoltages(voltage, 4);

    const maxCellV = Math.max(...cellVoltages);
    const minCellV = Math.min(...cellVoltages);
    const diffV = Number((maxCellV - minCellV).toFixed(3));

    // Purchase & Payment structure
    const isInstallment = i % 7 !== 0;
    const totalCostMinor = 145000000;
    const downPaymentMinor = 30000000;
    const weeklyInstallmentMinor = 2500000;
    
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
      batteryId: batteryNumber,
      assignedCustomerId: customerId,
      riderName,
      riderPhone: phone,
      telemetry: {
        soc,
        voltage,
        current,
        speed,
        mileage,
        lat,
        lng,
        city: loc.city,
        temp: Number((27.0 + (i % 8)).toFixed(1)),
        online,
        d_fet: motorPowerAllowed ? 1 : 0,
        c_fet: 1,
        cellSum: 15,
        loopSum: loopCount,
        signal,
        imsi,
        capacityAh,
        lastHeartbeat: new Date(Date.now() - (i % 15) * 60000).toISOString()
      }
    });

    // Yunhe Battery Record (Merchant Battery)
    batteries.push({
      batteryNumber,
      sn: batterySn,
      signal,
      distanceKm: mileage,
      voltage,
      current,
      soc,
      capacityAh,
      loopCount,
      imsi,
      state: speed > 0 ? "move" : "static",
      onlineStatus: online ? "Online" : "Offline",
      updateTime: new Date(Date.now() - (i % 20) * 45000).toISOString().replace("T", " ").substring(0, 19),
      pcdTemp: i === 1 ? 36.0 : Number((31.0 + (i % 7)).toFixed(1)),
      casingTemp: i === 1 ? 28.0 : Number((26.0 + (i % 5)).toFixed(1)),
      cellTemp: i === 1 ? 28.0 : Number((26.0 + (i % 5)).toFixed(1)),
      cellCount: 15,
      cellVoltages,
      maxCellV,
      minCellV,
      diffV,
      hardwareVersion: "2.3",
      softwareVersion: "90760122",
      protocolVersion: "V2",
      d_fet: motorPowerAllowed ? 1 : 0,
      c_fet: 1,
      assignedBikeId: bikeId,
      assignedRiderName: riderName,
      assignedRiderPhone: phone,
      assignedStationId: null,
      assignedStationName: null,
      lat,
      lng,
      speed,
      city: loc.city,
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
        }
      ],
      swaps: []
    });

    // Recent swaps seed
    if (i <= 20) {
      const station = stations[i % stations.length];
      initialSwaps.push({
        id: `SWP-${String(i).padStart(4, "0")}`,
        timestamp: `2026-10-${20 + (i % 10)} 14:${String(10 + (i * 2)).padStart(2, "0")}`,
        bikeId,
        riderName,
        plateNumber,
        stationId: station.id,
        stationName: station.name,
        batteryInSn: `B100072509${9000 + i}`,
        batteryInSoc: 12 + (i % 8),
        batteryOutSn: batterySn,
        batteryOutSoc: 98 - (i % 5),
        operatorName: station.operatorName,
        feeMinor: 80000,
        paymentMethod: i % 3 === 0 ? "Cash / POS" : "Beverly Wallet"
      });
    }
  }

  // Also seed station locker batteries into batteries collection
  stations.forEach((st) => {
    st.activeBatteries.forEach((sb, sIdx) => {
      batteries.push({
        batteryNumber: sb.id,
        sn: sb.sn,
        signal: 22,
        distanceKm: Number((100 + sIdx * 45).toFixed(2)),
        voltage: sb.v,
        current: sb.status === "charging" ? 10.5 : 0.0,
        soc: sb.soc,
        capacityAh: 20.93,
        loopCount: 30 + sIdx * 5,
        imsi: `4602400859${String(1000 + sIdx)}`,
        state: sb.status === "charging" ? "charge" : "static",
        onlineStatus: "Online",
        updateTime: new Date().toISOString().replace("T", " ").substring(0, 19),
        pcdTemp: sb.temp + 4,
        casingTemp: sb.temp,
        cellTemp: sb.temp,
        cellCount: 15,
        cellVoltages: generate15CellVoltages(sb.v, 3),
        maxCellV: Number(((sb.v / 15) + 0.003).toFixed(3)),
        minCellV: Number((sb.v / 15).toFixed(3)),
        diffV: 0.003,
        hardwareVersion: "2.3",
        softwareVersion: "90760122",
        protocolVersion: "V2",
        d_fet: 0,
        c_fet: 1,
        assignedBikeId: null,
        assignedRiderName: null,
        assignedRiderPhone: null,
        assignedStationId: st.id,
        assignedStationName: st.name,
        lat: st.lat,
        lng: st.lng,
        speed: 0,
        city: st.city,
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
      });
    });
  });

  return { bikes, customers, stations, swaps: initialSwaps, batteries };
}

export const useBatteryFleetStore = defineStore("batteryFleet", {
  state: () => {
    let bikes = null;
    let customers = null;
    let stations = null;
    let swaps = null;
    let batteries = null;

    try {
      const b = localStorage.getItem(STORAGE_KEY_BIKES);
      const c = localStorage.getItem(STORAGE_KEY_CUSTOMERS);
      const s = localStorage.getItem(STORAGE_KEY_STATIONS);
      const sw = localStorage.getItem(STORAGE_KEY_SWAPS);
      const bat = localStorage.getItem(STORAGE_KEY_BATTERIES);
      if (b && c && s && sw && bat) {
        bikes = JSON.parse(b);
        customers = JSON.parse(c);
        stations = JSON.parse(s);
        swaps = JSON.parse(sw);
        batteries = JSON.parse(bat);
      }
    } catch (_) {}

    if (!bikes || bikes.length < 200 || !batteries) {
      const seeded = seedFleetData();
      bikes = seeded.bikes;
      customers = seeded.customers;
      stations = seeded.stations;
      swaps = seeded.swaps;
      batteries = seeded.batteries;
    }

    return {
      bikes,
      customers,
      stations,
      swaps,
      batteries,
      selectedBikeId: "EVB-001",
      selectedBatterySn: "B100072509010001",
      activeTab: "map",
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
    saveToStorage() {
      try {
        localStorage.setItem(STORAGE_KEY_BIKES, JSON.stringify(this.bikes));
        localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(this.customers));
        localStorage.setItem(STORAGE_KEY_STATIONS, JSON.stringify(this.stations));
        localStorage.setItem(STORAGE_KEY_SWAPS, JSON.stringify(this.swaps));
        localStorage.setItem(STORAGE_KEY_BATTERIES, JSON.stringify(this.batteries));
      } catch (_) {}
    },

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
        if (Array.isArray(liveBatteries) && liveBatteries.length > 0) {
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
          try {
            await rebootBatteryDTU(bat.batteryNumber);
          } catch (_) {}
          bat.updateTime = new Date().toISOString().replace("T", " ").substring(0, 19);
          bat.onlineStatus = "Online";
          this.saveToStorage();
          return { success: true, message: `DTU for battery ${batterySn} rebooted successfully. Heartbeat refreshed.` };

        case "restart_bms":
          bat.pcdTemp = 28.0;
          bat.updateTime = new Date().toISOString().replace("T", " ").substring(0, 19);
          this.saveToStorage();
          return { success: true, message: `BMS (MBS) restarted for battery ${batterySn}. Status normalized.` };

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
          bat.c_fet = 0;
          bat.d_fet = 0;
          if (bike) {
            bike.telemetry.d_fet = 0;
            bike.telemetry.c_fet = 0;
            bike.telemetry.speed = 0;
          }
          this.saveToStorage();
          return { success: true, message: `Charge & Discharge FET disabled for ${batterySn}. Power isolated.` };

        case "turn_off_c_fet":
          bat.c_fet = 0;
          if (bike) bike.telemetry.c_fet = 0;
          this.saveToStorage();
          return { success: true, message: `Charge FET disabled for ${batterySn}.` };

        case "turn_off_d_fet":
          bat.d_fet = 0;
          if (bike) {
            bike.telemetry.d_fet = 0;
            bike.telemetry.speed = 0;
          }
          this.saveToStorage();
          return { success: true, message: `Discharge FET disabled for ${batterySn}. Motor power immobilized.` };

        case "enable_cd_fet":
          bat.c_fet = 1;
          bat.d_fet = 1;
          if (bike) {
            bike.telemetry.d_fet = 1;
            bike.telemetry.c_fet = 1;
          }
          this.saveToStorage();
          return { success: true, message: `Charge & Discharge FET enabled for ${batterySn}. Normal driving restored.` };

        case "get_mos_state":
          return {
            success: true,
            c_fet: bat.c_fet,
            d_fet: bat.d_fet,
            statusText: `C-MOS: ${bat.c_fet ? 'ON' : 'OFF'} | D-MOS: ${bat.d_fet ? 'ON' : 'OFF'}`
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

      try {
        await toggleBatteryDischarge(bike.batteryId, allowPower);
      } catch (e) {
        console.warn("[BatteryFleetStore] Remote FET command warning:", e);
      }

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

      try {
        await rebootBatteryDTU(bike.batteryId);
      } catch (e) {
        console.warn("[BatteryFleetStore] Remote DTU reboot warning:", e);
      }

      bike.telemetry.lastHeartbeat = new Date().toISOString();
      const bat = this.batteries.find((b) => b.sn === bike.batterySn);
      if (bat) {
        bat.updateTime = new Date().toISOString().replace("T", " ").substring(0, 19);
      }
      this.saveToStorage();
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
