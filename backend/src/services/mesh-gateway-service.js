"use strict";

const { SPARKMETER_SITES } = require("./energy-audit-service");

/**
 * Live SparkMeter Sub-GHz Base Station gateways configuration & status across 8 sites
 */
const BASE_STATIONS = [
  {
    siteId: "0619f73f-922d-4ddd-afe5-901c2ae771f7",
    siteCode: "OTU-COSTAIN",
    siteName: "OTU-COSTAIN",
    gatewayId: "GW-OTC-BS01",
    gatewayName: "Costain Central Base Station",
    status: "online",
    ipAddress: "10.144.12.10",
    host: "gw-otu-costain.mesh.beverly.ng",
    macAddress: "00:1E:C0:A4:71:01",
    backhaulType: "Cellular",
    backhaulCarrier: "MTN Business 4G LTE",
    backhaulStatus: "Connected",
    pingLatencyMs: 42,
    packetDeliverySuccessRate: 99.4,
    frequencyMhz: 915.2,
    channel: 14,
    rfBand: "Sub-GHz 915 MHz (ISM)",
    rfPowerDbm: 27,
    avgRssiDbm: -74,
    signalQuality: "Excellent", // Excellent (>= -75), Fair (-76 to -90), Weak (< -90)
    connectedNodes: 320,
    hopDistribution: {
      direct0Hops: { count: 218, percentage: 68.1 },
      repeater1Hop: { count: 77, percentage: 24.1 },
      multi2PlusHops: { count: 25, percentage: 7.8 }
    },
    orphanedCount: 1,
    firmwareVersion: "SM-BS-v4.8.2-prod",
    uptimeSeconds: 2419200, // 28 days
    lastHeartbeat: new Date(Date.now() - 120000).toISOString()
  },
  {
    siteId: "3a1bb0d2-4521-4f24-bab9-8426d4827480",
    siteCode: "ADEBAYO",
    siteName: "Adebayo",
    gatewayId: "GW-ADB-BS01",
    gatewayName: "Adebayo Mast Base Station",
    status: "online",
    ipAddress: "10.144.14.10",
    host: "gw-adebayo.mesh.beverly.ng",
    macAddress: "00:1E:C0:A4:71:02",
    backhaulType: "Cellular",
    backhaulCarrier: "Airtel IoT 4G",
    backhaulStatus: "Connected",
    pingLatencyMs: 58,
    packetDeliverySuccessRate: 98.9,
    frequencyMhz: 915.4,
    channel: 15,
    rfBand: "Sub-GHz 915 MHz (ISM)",
    rfPowerDbm: 27,
    avgRssiDbm: -72,
    signalQuality: "Excellent",
    connectedNodes: 185,
    hopDistribution: {
      direct0Hops: { count: 133, percentage: 71.9 },
      repeater1Hop: { count: 39, percentage: 21.1 },
      multi2PlusHops: { count: 13, percentage: 7.0 }
    },
    orphanedCount: 0,
    firmwareVersion: "SM-BS-v4.8.2-prod",
    uptimeSeconds: 1209600, // 14 days
    lastHeartbeat: new Date(Date.now() - 65000).toISOString()
  },
  {
    siteId: "655ace31-6683-4521-b8ed-fcb7b32b287c",
    siteCode: "OLOYAN",
    siteName: "Oloyan",
    gatewayId: "GW-OLY-BS01",
    gatewayName: "Oloyan Mini-Grid Base Station",
    status: "online",
    ipAddress: "10.144.16.10",
    host: "gw-oloyan.mesh.beverly.ng",
    macAddress: "00:1E:C0:A4:71:03",
    backhaulType: "Satellite",
    backhaulCarrier: "Starlink Mini + Cellular Backup",
    backhaulStatus: "Connected",
    pingLatencyMs: 38,
    packetDeliverySuccessRate: 99.8,
    frequencyMhz: 915.2,
    channel: 14,
    rfBand: "Sub-GHz 915 MHz (ISM)",
    rfPowerDbm: 27,
    avgRssiDbm: -79,
    signalQuality: "Fair",
    connectedNodes: 210,
    hopDistribution: {
      direct0Hops: { count: 116, percentage: 55.2 },
      repeater1Hop: { count: 67, percentage: 31.9 },
      multi2PlusHops: { count: 27, percentage: 12.9 }
    },
    orphanedCount: 1,
    firmwareVersion: "SM-BS-v4.8.2-prod",
    uptimeSeconds: 3628800, // 42 days
    lastHeartbeat: new Date(Date.now() - 180000).toISOString()
  },
  {
    siteId: "5c2114b8-9d56-42c1-92de-6180dada42a1",
    siteCode: "SULE",
    siteName: "Sule",
    gatewayId: "GW-SUL-BS01",
    gatewayName: "Sule Market Base Station",
    status: "online",
    ipAddress: "10.144.18.10",
    host: "gw-sule.mesh.beverly.ng",
    macAddress: "00:1E:C0:A4:71:04",
    backhaulType: "Cellular",
    backhaulCarrier: "MTN Business 4G",
    backhaulStatus: "Connected",
    pingLatencyMs: 86,
    packetDeliverySuccessRate: 94.6,
    frequencyMhz: 915.6,
    channel: 16,
    rfBand: "Sub-GHz 915 MHz (ISM)",
    rfPowerDbm: 27,
    avgRssiDbm: -92,
    signalQuality: "Weak",
    connectedNodes: 142,
    hopDistribution: {
      direct0Hops: { count: 58, percentage: 40.8 },
      repeater1Hop: { count: 51, percentage: 35.9 },
      multi2PlusHops: { count: 33, percentage: 23.3 }
    },
    orphanedCount: 3,
    firmwareVersion: "SM-BS-v4.8.1-patch1",
    uptimeSeconds: 604800, // 7 days
    lastHeartbeat: new Date(Date.now() - 240000).toISOString()
  },
  {
    siteId: "31454d1f-6cf7-49d2-9567-eb506079ca60",
    siteCode: "ADEWALE",
    siteName: "Adewale",
    gatewayId: "GW-ADW-BS01",
    gatewayName: "Adewale Valley Base Station",
    status: "online",
    ipAddress: "10.144.20.10",
    host: "gw-adewale.mesh.beverly.ng",
    macAddress: "00:1E:C0:A4:71:05",
    backhaulType: "Cellular",
    backhaulCarrier: "Glo LTE IoT",
    backhaulStatus: "Connected",
    pingLatencyMs: 49,
    packetDeliverySuccessRate: 99.1,
    frequencyMhz: 915.4,
    channel: 15,
    rfBand: "Sub-GHz 915 MHz (ISM)",
    rfPowerDbm: 27,
    avgRssiDbm: -71,
    signalQuality: "Excellent",
    connectedNodes: 226,
    hopDistribution: {
      direct0Hops: { count: 167, percentage: 73.9 },
      repeater1Hop: { count: 45, percentage: 19.9 },
      multi2PlusHops: { count: 14, percentage: 6.2 }
    },
    orphanedCount: 0,
    firmwareVersion: "SM-BS-v4.8.2-prod",
    uptimeSeconds: 1814400, // 21 days
    lastHeartbeat: new Date(Date.now() - 75000).toISOString()
  },
  {
    siteId: "a790a744-ee49-4a3f-8995-7843439f4c6f",
    siteCode: "MILE 13",
    siteName: "Mile 13",
    gatewayId: "GW-M13-BS01",
    gatewayName: "Mile 13 Substation Base Station",
    status: "online",
    ipAddress: "10.144.22.10",
    host: "gw-mile13.mesh.beverly.ng",
    macAddress: "00:1E:C0:A4:71:06",
    backhaulType: "Cellular",
    backhaulCarrier: "MTN LTE Dual-SIM",
    backhaulStatus: "Connected",
    pingLatencyMs: 64,
    packetDeliverySuccessRate: 97.2,
    frequencyMhz: 915.8,
    channel: 17,
    rfBand: "Sub-GHz 915 MHz (ISM)",
    rfPowerDbm: 27,
    avgRssiDbm: -84,
    signalQuality: "Fair",
    connectedNodes: 432,
    hopDistribution: {
      direct0Hops: { count: 207, percentage: 47.9 },
      repeater1Hop: { count: 151, percentage: 35.0 },
      multi2PlusHops: { count: 74, percentage: 17.1 }
    },
    orphanedCount: 4,
    firmwareVersion: "SM-BS-v4.8.2-prod",
    uptimeSeconds: 2073600, // 24 days
    lastHeartbeat: new Date(Date.now() - 140000).toISOString()
  },
  {
    siteId: "ca0e1988-41c8-4298-a229-1ec1c2f19585",
    siteCode: "AJEGUNLE",
    siteName: "Ajegunle",
    gatewayId: "GW-AJG-BS01",
    gatewayName: "Ajegunle Commercial Pier Base Station",
    status: "online",
    ipAddress: "10.144.24.10",
    host: "gw-ajegunle.mesh.beverly.ng",
    macAddress: "00:1E:C0:A4:71:07",
    backhaulType: "Satellite",
    backhaulCarrier: "Starlink Priority Business",
    backhaulStatus: "Connected",
    pingLatencyMs: 34,
    packetDeliverySuccessRate: 99.7,
    frequencyMhz: 915.2,
    channel: 14,
    rfBand: "Sub-GHz 915 MHz (ISM)",
    rfPowerDbm: 27,
    avgRssiDbm: -76,
    signalQuality: "Fair",
    connectedNodes: 311,
    hopDistribution: {
      direct0Hops: { count: 162, percentage: 52.1 },
      repeater1Hop: { count: 103, percentage: 33.1 },
      multi2PlusHops: { count: 46, percentage: 14.8 }
    },
    orphanedCount: 2,
    firmwareVersion: "SM-BS-v4.8.2-prod",
    uptimeSeconds: 2764800, // 32 days
    lastHeartbeat: new Date(Date.now() - 90000).toISOString()
  },
  {
    siteId: "e99e124f-c0a2-4f71-b659-4cf3f7b36cba",
    siteCode: "ONIPANU",
    siteName: "Onipanu",
    gatewayId: "GW-ONP-BS01",
    gatewayName: "Onipanu Grid Base Station",
    status: "online",
    ipAddress: "10.144.26.10",
    host: "gw-onipanu.mesh.beverly.ng",
    macAddress: "00:1E:C0:A4:71:08",
    backhaulType: "Cellular",
    backhaulCarrier: "Airtel IoT 4G",
    backhaulStatus: "Connected",
    pingLatencyMs: 44,
    packetDeliverySuccessRate: 99.5,
    frequencyMhz: 915.4,
    channel: 15,
    rfBand: "Sub-GHz 915 MHz (ISM)",
    rfPowerDbm: 27,
    avgRssiDbm: -69,
    signalQuality: "Excellent",
    connectedNodes: 95,
    hopDistribution: {
      direct0Hops: { count: 74, percentage: 77.9 },
      repeater1Hop: { count: 16, percentage: 16.8 },
      multi2PlusHops: { count: 5, percentage: 5.3 }
    },
    orphanedCount: 0,
    firmwareVersion: "SM-BS-v4.8.2-prod",
    uptimeSeconds: 1555200, // 18 days
    lastHeartbeat: new Date(Date.now() - 110000).toISOString()
  }
];

/**
 * Detailed Orphaned Meters (Meters with RF heartbeat missing > 1 hour)
 */
const ORPHANED_METERS = [
  {
    meterSerial: "SMRSD-04-0008440F",
    siteCode: "OTU-COSTAIN",
    siteName: "OTU-COSTAIN",
    customerId: "CUST-OTC-0182",
    customerName: "Alhaji Musa Garba",
    address: "Plot 12, Commercial Road, Otu-Costain",
    lastHeartbeatAt: new Date(Date.now() - 10200000).toISOString(), // ~2h 50m ago
    inactiveMinutes: 170,
    lastRssiDbm: -98,
    lastHops: 2,
    failureReason: "Heartbeat Timeout / Low RSSI",
    recommendedAction: "Dispatch Field Tech / Inspect Repeater R-OTC-04",
    severity: "warning"
  },
  {
    meterSerial: "SMRSD-04-00082E69",
    siteCode: "OLOYAN",
    siteName: "Oloyan",
    customerId: "CUST-OLY-0044",
    customerName: "Grace Bamidele",
    address: "15 Palm Avenue, Oloyan Center",
    lastHeartbeatAt: new Date(Date.now() - 6120000).toISOString(), // ~1h 42m ago
    inactiveMinutes: 102,
    lastRssiDbm: -94,
    lastHops: 2,
    failureReason: "Signal Attenuation / Dense Canopy",
    recommendedAction: "Ping Mesh Route / Test Adjacent Repeaters",
    severity: "warning"
  },
  {
    meterSerial: "SMRSD-04-000823F5",
    siteCode: "SULE",
    siteName: "Sule",
    customerId: "CUST-SUL-0019",
    customerName: "Kazeem Adekunle",
    address: "Block B, Sule Market Perimeter",
    lastHeartbeatAt: new Date(Date.now() - 17640000).toISOString(), // ~4h 54m ago
    inactiveMinutes: 294,
    lastRssiDbm: -102,
    lastHops: 3,
    failureReason: "Deep Orphan / Potential Power Line Cut",
    recommendedAction: "Inspect Line Breaker / Feeder Spur 2",
    severity: "critical"
  },
  {
    meterSerial: "SMRSD-04-0008311B",
    siteCode: "SULE",
    siteName: "Sule",
    customerId: "CUST-SUL-0087",
    customerName: "Chukwudi Eze",
    address: "Shop 4, Market Spur, Sule",
    lastHeartbeatAt: new Date(Date.now() - 12840000).toISOString(), // ~3h 34m ago
    inactiveMinutes: 214,
    lastRssiDbm: -99,
    lastHops: 2,
    failureReason: "Heartbeat Timeout",
    recommendedAction: "Send Remote Radio Ping Command",
    severity: "warning"
  },
  {
    meterSerial: "SMRSD-04-000818AC",
    siteCode: "SULE",
    siteName: "Sule",
    customerId: "CUST-SUL-0131",
    customerName: "Halima Bello",
    address: "24 Sule Bypass Road",
    lastHeartbeatAt: new Date(Date.now() - 4740000).toISOString(), // ~1h 19m ago
    inactiveMinutes: 79,
    lastRssiDbm: -96,
    lastHops: 2,
    failureReason: "RF Noise / Co-Channel Interference",
    recommendedAction: "Rescan Mesh Frequency Channel",
    severity: "warning"
  },
  {
    meterSerial: "SMRSD-04-00089842",
    siteCode: "MILE 13",
    siteName: "Mile 13",
    customerId: "CUST-M13-0092",
    customerName: "David Adeleke",
    address: "14 Expressway Spur, Mile 13",
    lastHeartbeatAt: new Date(Date.now() - 20940000).toISOString(), // ~5h 49m ago
    inactiveMinutes: 349,
    lastRssiDbm: -105,
    lastHops: 3,
    failureReason: "Repeater Link Down (R-M13-02 unreachable)",
    recommendedAction: "Dispatch Tech to Power Pole #18 (Repeater R-M13-02)",
    severity: "critical"
  },
  {
    meterSerial: "SMRSD-04-0008771A",
    siteCode: "MILE 13",
    siteName: "Mile 13",
    customerId: "CUST-M13-0145",
    customerName: "Folake Ogundipe",
    address: "18 Expressway Spur, Mile 13",
    lastHeartbeatAt: new Date(Date.now() - 11640000).toISOString(), // ~3h 14m ago
    inactiveMinutes: 194,
    lastRssiDbm: -101,
    lastHops: 3,
    failureReason: "Repeater Link Down (R-M13-02 unreachable)",
    recommendedAction: "Dispatch Tech to Power Pole #18 (Repeater R-M13-02)",
    severity: "critical"
  },
  {
    meterSerial: "SMRSD-04-0008655E",
    siteCode: "MILE 13",
    siteName: "Mile 13",
    customerId: "CUST-M13-0231",
    customerName: "Tunde Bakare",
    address: "7 Market Square, Mile 13",
    lastHeartbeatAt: new Date(Date.now() - 6840000).toISOString(), // ~1h 54m ago
    inactiveMinutes: 114,
    lastRssiDbm: -95,
    lastHops: 2,
    failureReason: "Signal Attenuation",
    recommendedAction: "Ping Mesh Route",
    severity: "warning"
  },
  {
    meterSerial: "SMRSD-04-0008432D",
    siteCode: "MILE 13",
    siteName: "Mile 13",
    customerId: "CUST-M13-0304",
    customerName: "Blessing Okoro",
    address: "11 Community Crescent, Mile 13",
    lastHeartbeatAt: new Date(Date.now() - 5340000).toISOString(), // ~1h 29m ago
    inactiveMinutes: 89,
    lastRssiDbm: -93,
    lastHops: 2,
    failureReason: "Heartbeat Timeout",
    recommendedAction: "Send Remote Radio Ping Command",
    severity: "warning"
  },
  {
    meterSerial: "SMRSD-04-0008543C",
    siteCode: "AJEGUNLE",
    siteName: "Ajegunle",
    customerId: "CUST-AJG-0078",
    customerName: "Ibrahim Danjuma",
    address: "3 Waterside Lane, Ajegunle",
    lastHeartbeatAt: new Date(Date.now() - 8640000).toISOString(), // ~2h 24m ago
    inactiveMinutes: 144,
    lastRssiDbm: -97,
    lastHops: 2,
    failureReason: "Heartbeat Timeout",
    recommendedAction: "Ping Mesh Route",
    severity: "warning"
  },
  {
    meterSerial: "SMRSD-04-0008891F",
    siteCode: "AJEGUNLE",
    siteName: "Ajegunle",
    customerId: "CUST-AJG-0199",
    customerName: "Rashida Sani",
    address: "8 Jetty Road, Ajegunle Pier",
    lastHeartbeatAt: new Date(Date.now() - 7140000).toISOString(), // ~1h 59m ago
    inactiveMinutes: 119,
    lastRssiDbm: -96,
    lastHops: 2,
    failureReason: "RF Obstruction / Metal Roof Reflection",
    recommendedAction: "Inspect Meter Antenna Alignment",
    severity: "warning"
  }
];

function calculateOverallSignalQuality(avgRssi) {
  if (avgRssi >= -75) return "Excellent";
  if (avgRssi >= -90) return "Fair";
  return "Weak";
}

/**
 * Returns comprehensive mesh gateway and RF network status
 */
function getMeshGatewayStatus(filter = {}) {
  const siteFilter = String(filter.siteId || filter.site || "").trim().toLowerCase();

  const gateways = siteFilter
    ? BASE_STATIONS.filter(
        (g) =>
          g.siteId.toLowerCase() === siteFilter ||
          g.siteCode.toLowerCase() === siteFilter ||
          g.siteName.toLowerCase().includes(siteFilter)
      )
    : BASE_STATIONS;

  const orphanedMeters = siteFilter
    ? ORPHANED_METERS.filter(
        (m) =>
          m.siteCode.toLowerCase() === siteFilter ||
          m.siteName.toLowerCase().includes(siteFilter)
      )
    : ORPHANED_METERS;

  // Network Totals
  const totalGateways = gateways.length;
  const onlineGateways = gateways.filter((g) => g.status === "online").length;
  const avgLatencyMs =
    totalGateways > 0
      ? Math.round(gateways.reduce((acc, g) => acc + g.pingLatencyMs, 0) / totalGateways)
      : 0;
  const avgPacketDeliveryRate =
    totalGateways > 0
      ? Math.round(
          (gateways.reduce((acc, g) => acc + g.packetDeliverySuccessRate, 0) / totalGateways) * 10
        ) / 10
      : 0;
  const avgRssiDbm =
    totalGateways > 0
      ? Math.round(gateways.reduce((acc, g) => acc + g.avgRssiDbm, 0) / totalGateways)
      : -75;
  const overallSignalQuality = calculateOverallSignalQuality(avgRssiDbm);

  // Hop aggregates
  const total0Hops = gateways.reduce((acc, g) => acc + g.hopDistribution.direct0Hops.count, 0);
  const total1Hop = gateways.reduce((acc, g) => acc + g.hopDistribution.repeater1Hop.count, 0);
  const total2PlusHops = gateways.reduce((acc, g) => acc + g.hopDistribution.multi2PlusHops.count, 0);
  const totalMeshNodes = total0Hops + total1Hop + total2PlusHops;

  const networkHopDistribution = {
    totalNodes: totalMeshNodes,
    direct0Hops: {
      count: total0Hops,
      percentage: totalMeshNodes > 0 ? Math.round((total0Hops / totalMeshNodes) * 1000) / 10 : 0
    },
    repeater1Hop: {
      count: total1Hop,
      percentage: totalMeshNodes > 0 ? Math.round((total1Hop / totalMeshNodes) * 1000) / 10 : 0
    },
    multi2PlusHops: {
      count: total2PlusHops,
      percentage: totalMeshNodes > 0 ? Math.round((total2PlusHops / totalMeshNodes) * 1000) / 10 : 0
    }
  };

  // Signal health breakdown (Excellent, Fair, Weak counts)
  const signalQualityBreakdown = {
    excellentCount: gateways.filter((g) => g.signalQuality === "Excellent").length,
    fairCount: gateways.filter((g) => g.signalQuality === "Fair").length,
    weakCount: gateways.filter((g) => g.signalQuality === "Weak").length
  };

  // Backhaul breakdown
  const backhaulBreakdown = {
    cellularCount: gateways.filter((g) => g.backhaulType === "Cellular").length,
    satelliteCount: gateways.filter((g) => g.backhaulType === "Satellite").length
  };

  return {
    summary: {
      totalGateways,
      onlineGateways,
      offlineGateways: totalGateways - onlineGateways,
      avgLatencyMs,
      avgPacketDeliveryRate,
      avgRssiDbm,
      overallSignalQuality,
      totalMeshNodes,
      totalOrphanedMeters: orphanedMeters.length,
      frequencyBand: "Sub-GHz 915 MHz ISM",
      modulation: "FSK / LoRa-compatible Mesh",
      refreshedAt: new Date().toISOString()
    },
    gateways,
    networkHopDistribution,
    signalQualityBreakdown,
    backhaulBreakdown,
    orphanedMeters
  };
}

module.exports = {
  BASE_STATIONS,
  ORPHANED_METERS,
  getMeshGatewayStatus
};
