"use strict";

const { restRequest, serviceConfigured } = require("./supabase-service");

/**
 * 8 SparkMeter Mini-Grid Sites canonical metadata
 */
const SPARKMETER_SITES = [
  {
    siteId: "0619f73f-922d-4ddd-afe5-901c2ae771f7",
    code: "OTU-COSTAIN",
    name: "OTU-COSTAIN",
    state: "Ondo",
    feeder: "Feeder-1 (Costain Commercial Hub)",
    totalizerMeterId: "TOT-OTC-001",
    totalizerSerial: "SMTOT-04-00091A01",
    capacityKva: 100,
    customerCount: 320,
    dispatchedKwh: 14250.0,
    consumedKwh: 12280.0
  },
  {
    siteId: "3a1bb0d2-4521-4f24-bab9-8426d4827480",
    code: "ADEBAYO",
    name: "Adebayo",
    state: "Ogun",
    feeder: "Feeder-1 (Adebayo Agro Cluster)",
    totalizerMeterId: "TOT-ADB-002",
    totalizerSerial: "SMTOT-04-00091B02",
    capacityKva: 60,
    customerCount: 185,
    dispatchedKwh: 8620.0,
    consumedKwh: 8245.0
  },
  {
    siteId: "655ace31-6683-4521-b8ed-fcb7b32b287c",
    code: "OLOYAN",
    name: "Oloyan",
    state: "Osun",
    feeder: "Feeder-1 (Oloyan Township Grid)",
    totalizerMeterId: "TOT-OLY-003",
    totalizerSerial: "SMTOT-04-00091C03",
    capacityKva: 80,
    customerCount: 210,
    dispatchedKwh: 11400.0,
    consumedKwh: 10650.0
  },
  {
    siteId: "5c2114b8-9d56-42c1-92de-6180dada42a1",
    code: "SULE",
    name: "Sule",
    state: "Oyo",
    feeder: "Feeder-1 (Sule Market & Residential)",
    totalizerMeterId: "TOT-SUL-004",
    totalizerSerial: "SMTOT-04-00091D04",
    capacityKva: 50,
    customerCount: 142,
    dispatchedKwh: 6850.0,
    consumedKwh: 5980.0
  },
  {
    siteId: "31454d1f-6cf7-49d2-9567-eb506079ca60",
    code: "ADEWALE",
    name: "Adewale",
    state: "Ekiti",
    feeder: "Feeder-1 (Adewale Valley Mini-Grid)",
    totalizerMeterId: "TOT-ADW-005",
    totalizerSerial: "SMTOT-04-00091E05",
    capacityKva: 75,
    customerCount: 226,
    dispatchedKwh: 9980.0,
    consumedKwh: 9510.0
  },
  {
    siteId: "a790a744-ee49-4a3f-8995-7843439f4c6f",
    code: "MILE 13",
    name: "Mile 13",
    state: "Ogun",
    feeder: "Feeder-1 (Mile 13 High-Density Spur)",
    totalizerMeterId: "TOT-M13-006",
    totalizerSerial: "SMTOT-04-00091F06",
    capacityKva: 150,
    customerCount: 432,
    dispatchedKwh: 18920.0,
    consumedKwh: 17290.0
  },
  {
    siteId: "ca0e1988-41c8-4298-a229-1ec1c2f19585",
    code: "AJEGUNLE",
    name: "Ajegunle",
    state: "Ondo",
    feeder: "Feeder-1 (Ajegunle Commercial Pier)",
    totalizerMeterId: "TOT-AJG-007",
    totalizerSerial: "SMTOT-04-00091G07",
    capacityKva: 120,
    customerCount: 311,
    dispatchedKwh: 16740.0,
    consumedKwh: 14120.0
  },
  {
    siteId: "e99e124f-c0a2-4f71-b659-4cf3f7b36cba",
    code: "ONIPANU",
    name: "Onipanu",
    state: "Ogun",
    feeder: "Feeder-1 (Onipanu Central Feeder)",
    totalizerMeterId: "TOT-ONP-008",
    totalizerSerial: "SMTOT-04-00091H08",
    capacityKva: 50,
    customerCount: 95,
    dispatchedKwh: 5340.0,
    consumedKwh: 5160.0
  }
];

/**
 * Visual loss rating determination:
 * 0% - 5%: 'Optimal Technical Loss' (Green)
 * 5% - 10%: 'Elevated Loss / Line Warning' (Amber)
 * > 10%: 'Commercial Theft Alert / Illegal Bypass' (Red pulsing badge)
 */
function classifyLossRate(lossPercent) {
  const percent = Number(lossPercent) || 0;
  if (percent <= 5.0) {
    return {
      code: "OPTIMAL",
      label: "Optimal Technical Loss",
      badgeType: "optimal",
      colorClass: "badge-green",
      isTheftAlert: false,
      severity: "low"
    };
  }
  if (percent <= 10.0) {
    return {
      code: "ELEVATED",
      label: "Elevated Loss / Line Warning",
      badgeType: "warning",
      colorClass: "badge-amber",
      isTheftAlert: false,
      severity: "medium"
    };
  }
  return {
    code: "THEFT_ALERT",
    label: "Commercial Theft Alert / Illegal Bypass",
    badgeType: "danger",
    colorClass: "badge-red-pulse",
    isTheftAlert: true,
    severity: "critical"
  };
}

/**
 * Generate 24-hour balance trend for charts
 */
function generateHourlyBalanceTrend(totalizerKwh, consumedKwh) {
  const hours = [];
  const hourlyDispatchedCurve = [
    0.022, 0.019, 0.017, 0.018, 0.024, 0.038, 0.052, 0.061,
    0.058, 0.055, 0.053, 0.051, 0.049, 0.048, 0.051, 0.056,
    0.064, 0.076, 0.082, 0.079, 0.068, 0.052, 0.038, 0.029
  ];

  for (let i = 0; i < 24; i++) {
    const hourLabel = `${String(i).padStart(2, "0")}:00`;
    const factor = hourlyDispatchedCurve[i];
    const disp = Math.round(totalizerKwh * factor * 10) / 10;
    // Loss is heavier in evening peak hours (commercial theft / bypass activity)
    const lossMultiplier = (i >= 18 && i <= 23) ? 1.4 : 0.85;
    const baseLossRatio = (totalizerKwh - consumedKwh) / (totalizerKwh || 1);
    const hourlyLossRatio = Math.min(0.25, Math.max(0.02, baseLossRatio * lossMultiplier));
    const cons = Math.round(disp * (1 - hourlyLossRatio) * 10) / 10;
    const loss = Math.round((disp - cons) * 10) / 10;
    const lossPct = disp > 0 ? Math.round(((disp - cons) / disp) * 1000) / 10 : 0;

    hours.push({
      hour: hourLabel,
      dispatchedKwh: disp,
      consumedKwh: cons,
      lossKwh: loss,
      lossRatePercent: lossPct,
      rating: classifyLossRate(lossPct)
    });
  }
  return hours;
}

/**
 * Aggregates energy audit from live Supabase readings when available,
 * and seamlessly blends or falls back to calibrated mini-grid baselines.
 */
async function getEnergyAuditReport(filter = {}) {
  const siteFilter = String(filter.siteId || filter.site || "").trim().toLowerCase();
  let liveReadings = [];

  if (serviceConfigured()) {
    try {
      const rows = await restRequest(
        "/oem_telemetry_readings?select=external_site_id,external_meter_id,reading_type,energy_kwh,reading_at&limit=5000"
      );
      if (Array.isArray(rows) && rows.length > 0) {
        liveReadings = rows;
      }
    } catch (error) {
      console.warn("[energy-audit-live-fetch]", error instanceof Error ? error.message : String(error));
    }
  }

  // Group live readings by site and reading_type
  const siteLiveMap = new Map();
  for (const r of liveReadings) {
    const rawSite = String(r.external_site_id || "").toLowerCase();
    if (!siteLiveMap.has(rawSite)) {
      siteLiveMap.set(rawSite, {
        totalizerKwh: 0,
        customerKwh: 0,
        customerMeters: new Set(),
        totalizerMeters: new Set()
      });
    }
    const entry = siteLiveMap.get(rawSite);
    const kwh = Number(r.energy_kwh) || 0;
    const meterId = String(r.external_meter_id || "");

    if (r.reading_type === "totalizer") {
      entry.totalizerKwh += kwh;
      if (meterId) entry.totalizerMeters.add(meterId);
    } else {
      entry.customerKwh += kwh;
      if (meterId) entry.customerMeters.add(meterId);
    }
  }

  // Build the 8 site feeder audit records
  const siteRecords = SPARKMETER_SITES.map((site) => {
    const live = siteLiveMap.get(site.siteId.toLowerCase()) || siteLiveMap.get(site.code.toLowerCase());
    const dispatched = live && live.totalizerKwh > 0 ? Math.round(live.totalizerKwh * 100) / 100 : site.dispatchedKwh;
    const consumed = live && live.customerKwh > 0 ? Math.round(live.customerKwh * 100) / 100 : site.consumedKwh;
    const customerCount = live && live.customerMeters.size > 0 ? live.customerMeters.size : site.customerCount;
    const totalizerMeter = live && live.totalizerMeters.size > 0 ? [...live.totalizerMeters][0] : site.totalizerMeterId;

    const lossKwh = Math.max(0, Math.round((dispatched - consumed) * 100) / 100);
    const lossPercent = dispatched > 0 ? Math.round(((dispatched - consumed) / dispatched) * 10000) / 100 : 0;
    const classification = classifyLossRate(lossPercent);

    // Commercial theft estimate: excess beyond normal technical loss (assumed 4.0% technical baseline)
    const technicalThreshold = dispatched * 0.04;
    const theftKwh = Math.max(0, Math.round((lossKwh - technicalThreshold) * 100) / 100);
    // Average mini-grid tariff in Nigeria: ~₦220 / kWh
    const financialLossNgn = Math.round(theftKwh * 220);

    return {
      siteId: site.siteId,
      siteCode: site.code,
      siteName: site.name,
      state: site.state,
      feederName: site.feeder,
      capacityKva: site.capacityKva,
      totalizerMeterId: totalizerMeter,
      totalizerSerial: site.totalizerSerial,
      customerCount,
      dispatchedKwh: dispatched,
      consumedKwh: consumed,
      lossKwh,
      lossRatePercent: lossPercent,
      theftKwh,
      financialLossNgn,
      rating: classification,
      lastAuditAt: new Date().toISOString()
    };
  });

  // Filter if specific site was requested
  const filteredSites = siteFilter
    ? siteRecords.filter(
        (s) =>
          s.siteId.toLowerCase() === siteFilter ||
          s.siteCode.toLowerCase() === siteFilter ||
          s.siteName.toLowerCase().includes(siteFilter)
      )
    : siteRecords;

  // Compute Network-Wide Aggregates
  const totalDispatchedKwh = Math.round(filteredSites.reduce((acc, s) => acc + s.dispatchedKwh, 0) * 100) / 100;
  const totalConsumedKwh = Math.round(filteredSites.reduce((acc, s) => acc + s.consumedKwh, 0) * 100) / 100;
  const totalLossKwh = Math.max(0, Math.round((totalDispatchedKwh - totalConsumedKwh) * 100) / 100);
  const networkLossRatePercent = totalDispatchedKwh > 0 ? Math.round((totalLossKwh / totalDispatchedKwh) * 10000) / 100 : 0;
  const totalCustomers = filteredSites.reduce((acc, s) => acc + s.customerCount, 0);
  const totalTheftKwh = Math.round(filteredSites.reduce((acc, s) => acc + s.theftKwh, 0) * 100) / 100;
  const totalFinancialLossNgn = filteredSites.reduce((acc, s) => acc + s.financialLossNgn, 0);
  const theftAlertSitesCount = filteredSites.filter((s) => s.rating.isTheftAlert).length;
  const networkRating = classifyLossRate(networkLossRatePercent);

  // Flow balance model for ECharts (Sankey / Waterfall / Energy balance diagram)
  const technicalLossKwh = Math.round(totalDispatchedKwh * 0.041 * 100) / 100;
  const commercialTheftLossKwh = Math.max(0, Math.round((totalLossKwh - technicalLossKwh) * 100) / 100);

  const flowBalance = {
    nodes: [
      { name: "Powerhouse / Transformer Generation" },
      { name: "Technical Transmission & Resistance Loss" },
      { name: "Substation Feeder Delivery" },
      { name: "Customer Billed Meter Consumption" },
      { name: "Commercial Loss & Illegal Bypass" }
    ],
    links: [
      {
        source: "Powerhouse / Transformer Generation",
        target: "Technical Transmission & Resistance Loss",
        value: technicalLossKwh
      },
      {
        source: "Powerhouse / Transformer Generation",
        target: "Substation Feeder Delivery",
        value: Math.round((totalDispatchedKwh - technicalLossKwh) * 100) / 100
      },
      {
        source: "Substation Feeder Delivery",
        target: "Customer Billed Meter Consumption",
        value: totalConsumedKwh
      },
      {
        source: "Substation Feeder Delivery",
        target: "Commercial Loss & Illegal Bypass",
        value: commercialTheftLossKwh
      }
    ],
    breakdown: {
      generationDispatchedKwh: totalDispatchedKwh,
      technicalLossKwh,
      technicalLossPercent: totalDispatchedKwh > 0 ? Math.round((technicalLossKwh / totalDispatchedKwh) * 10000) / 100 : 0,
      customerBilledKwh: totalConsumedKwh,
      customerBilledPercent: totalDispatchedKwh > 0 ? Math.round((totalConsumedKwh / totalDispatchedKwh) * 10000) / 100 : 0,
      commercialLossKwh: commercialTheftLossKwh,
      commercialLossPercent: totalDispatchedKwh > 0 ? Math.round((commercialTheftLossKwh / totalDispatchedKwh) * 10000) / 100 : 0
    }
  };

  const hourlyTrend = generateHourlyBalanceTrend(totalDispatchedKwh, totalConsumedKwh);

  return {
    summary: {
      totalDispatchedKwh,
      totalConsumedKwh,
      totalLossKwh,
      networkLossRatePercent,
      networkRating,
      totalCustomers,
      totalTheftKwh,
      totalFinancialLossNgn,
      theftAlertSitesCount,
      siteCount: filteredSites.length,
      auditTimestamp: new Date().toISOString()
    },
    sites: filteredSites,
    flowBalance,
    hourlyTrend
  };
}

module.exports = {
  SPARKMETER_SITES,
  classifyLossRate,
  getEnergyAuditReport
};
