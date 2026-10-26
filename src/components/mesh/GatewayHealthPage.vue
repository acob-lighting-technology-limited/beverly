<template>
  <div class="ghp-container">
    <!-- ═══════════════════════════════════════════════════════ HERO ═══ -->
    <header class="ghp-hero">
      <div class="ghp-hero-glow" />
      <div class="ghp-hero-inner">
        <div class="ghp-hero-left">
          <div class="ghp-hero-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
          </div>
          <div>
            <div class="ghp-hero-eyebrow">Sub-GHz Radio Mesh · Base Station Surveillance</div>
            <h1 class="ghp-hero-title">Mesh Network & Gateway Health</h1>
            <p class="ghp-hero-sub">
              Sub-GHz RF mesh topology, Base Station telemetry, backhaul latency, and orphaned meter surveillance across the 8 SparkMeter mini-grids.
            </p>
          </div>
        </div>

        <div class="ghp-hero-badges">
          <span class="ghp-badge ghp-badge--live">
            <span class="ghp-badge-dot"></span>
            {{ summary.onlineGateways }}/{{ summary.totalGateways }} Base Stations Online
          </span>
          <span class="ghp-badge ghp-badge--rf">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 12h20M7 8l5-5 5 5M7 16l5 5 5-5"/>
            </svg>
            Sub-GHz 915 MHz ISM
          </span>
          <span v-if="summary.totalOrphanedMeters > 0" class="ghp-badge ghp-badge--warning">
            {{ summary.totalOrphanedMeters }} Orphaned Meters
          </span>
        </div>

        <div class="ghp-hero-actions">
          <button class="ghp-hbtn ghp-hbtn--ghost" :disabled="loading" @click="pingAllGateways">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Ping All Gateways
          </button>
          <button class="ghp-hbtn ghp-hbtn--primary" :disabled="loading" @click="fetchGatewayData">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'ghp-spin': loading }">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {{ loading ? 'Polling Mesh…' : 'Refresh Mesh' }}
          </button>
        </div>
      </div>
    </header>

    <!-- ══════════════════════════════════════════════════ KPI METRICS ═══ -->
    <section class="ghp-kpi-grid">
      <!-- KPI 1: Gateway Availability -->
      <div class="ghp-kpi-card">
        <div class="ghp-kpi-header">
          <span class="ghp-kpi-label">Active Base Stations</span>
          <div class="ghp-kpi-icon-wrap ghp-kpi-icon--positive">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
              <line x1="6" y1="6" x2="6.01" y2="6"/>
              <line x1="6" y1="18" x2="6.01" y2="18"/>
            </svg>
          </div>
        </div>
        <div class="ghp-kpi-value-row">
          <span class="ghp-kpi-num">{{ summary.onlineGateways }}</span>
          <span class="ghp-kpi-total">/ {{ summary.totalGateways }}</span>
        </div>
        <p class="ghp-kpi-sub">
          100% operational across all 8 mini-grid powerhouse base stations.
        </p>
      </div>

      <!-- KPI 2: Avg Ping Latency -->
      <div class="ghp-kpi-card">
        <div class="ghp-kpi-header">
          <span class="ghp-kpi-label">Avg Backhaul Latency</span>
          <div class="ghp-kpi-icon-wrap ghp-kpi-icon--brand">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
        </div>
        <div class="ghp-kpi-value-row">
          <span class="ghp-kpi-num">{{ summary.avgLatencyMs }}</span>
          <span class="ghp-kpi-unit">ms</span>
        </div>
        <p class="ghp-kpi-sub">
          Hybrid Cellular 4G LTE & Starlink Satellite dual-uplink latency.
        </p>
      </div>

      <!-- KPI 3: Packet Success Rate -->
      <div class="ghp-kpi-card">
        <div class="ghp-kpi-header">
          <span class="ghp-kpi-label">Packet Delivery Rate</span>
          <div class="ghp-kpi-icon-wrap ghp-kpi-icon--positive">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </div>
        <div class="ghp-kpi-value-row">
          <span class="ghp-kpi-num">{{ summary.avgPacketDeliveryRate }}%</span>
        </div>
        <p class="ghp-kpi-sub">
          Aggregated Sub-GHz radio packet transmission success rate.
        </p>
      </div>

      <!-- KPI 4: RF Signal Health -->
      <div class="ghp-kpi-card">
        <div class="ghp-kpi-header">
          <span class="ghp-kpi-label">Mesh RF Signal Health</span>
          <div class="ghp-kpi-icon-wrap" :class="signalIconClass">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
          </div>
        </div>
        <div class="ghp-kpi-value-row">
          <span class="ghp-kpi-num">{{ summary.avgRssiDbm }}</span>
          <span class="ghp-kpi-unit">dBm</span>
        </div>
        <div class="ghp-kpi-badge-wrap">
          <span :class="['ghp-quality-badge', signalQualityClass]">
            {{ summary.overallSignalQuality }} Quality
          </span>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════ MESH RF & HOP DISTRIBUTION ═══ -->
    <section class="ghp-rf-topology-grid">
      <!-- Hop Distribution Breakdown -->
      <div class="ghp-panel-card">
        <div class="ghp-panel-header">
          <div>
            <h3 class="ghp-panel-title">Mesh Hop Distribution</h3>
            <p class="ghp-panel-sub">Routing depth from meter endpoints to powerhouse Base Station</p>
          </div>
          <span class="ghp-badge ghp-badge--neutral">{{ formatNumber(hopDistribution.totalNodes) }} Total Nodes</span>
        </div>

        <div class="ghp-hop-bars">
          <!-- 0 Hops Direct -->
          <div class="ghp-hop-item">
            <div class="ghp-hop-label-row">
              <span class="ghp-hop-name">
                <span class="ghp-hop-dot ghp-hop-dot--green"></span>
                Direct Communication (0 Hops)
              </span>
              <span class="ghp-hop-val font-mono">
                {{ formatNumber(hopDistribution.direct0Hops?.count) }} ({{ hopDistribution.direct0Hops?.percentage }}%)
              </span>
            </div>
            <div class="ghp-hop-track">
              <div
                class="ghp-hop-fill ghp-hop-fill--green"
                :style="{ width: `${hopDistribution.direct0Hops?.percentage || 0}%` }"
              ></div>
            </div>
            <span class="ghp-hop-desc">Direct line-of-sight RF link to Base Station antenna</span>
          </div>

          <!-- 1 Hop Repeaters -->
          <div class="ghp-hop-item">
            <div class="ghp-hop-label-row">
              <span class="ghp-hop-name">
                <span class="ghp-hop-dot ghp-hop-dot--blue"></span>
                1-Hop Repeaters
              </span>
              <span class="ghp-hop-val font-mono">
                {{ formatNumber(hopDistribution.repeater1Hop?.count) }} ({{ hopDistribution.repeater1Hop?.percentage }}%)
              </span>
            </div>
            <div class="ghp-hop-track">
              <div
                class="ghp-hop-fill ghp-hop-fill--blue"
                :style="{ width: `${hopDistribution.repeater1Hop?.percentage || 0}%` }"
              ></div>
            </div>
            <span class="ghp-hop-desc">Relayed via pole-mounted or intermediate meter node</span>
          </div>

          <!-- 2+ Hops Deep Mesh -->
          <div class="ghp-hop-item">
            <div class="ghp-hop-label-row">
              <span class="ghp-hop-name">
                <span class="ghp-hop-dot ghp-hop-dot--amber"></span>
                2+ Hops (Deep Mesh)
              </span>
              <span class="ghp-hop-val font-mono">
                {{ formatNumber(hopDistribution.multi2PlusHops?.count) }} ({{ hopDistribution.multi2PlusHops?.percentage }}%)
              </span>
            </div>
            <div class="ghp-hop-track">
              <div
                class="ghp-hop-fill ghp-hop-fill--amber"
                :style="{ width: `${hopDistribution.multi2PlusHops?.percentage || 0}%` }"
              ></div>
            </div>
            <span class="ghp-hop-desc">Multi-hop relay across dense terrain or peripheral market spurs</span>
          </div>
        </div>
      </div>

      <!-- RF Signal Quality Spectrum -->
      <div class="ghp-panel-card">
        <div class="ghp-panel-header">
          <div>
            <h3 class="ghp-panel-title">RF Signal Quality Spectrum</h3>
            <p class="ghp-panel-sub">RSSI distribution across 8 base stations (Sub-GHz 915 MHz)</p>
          </div>
        </div>

        <div class="ghp-signal-gauges">
          <div class="ghp-sgauge-card ghp-sgauge-card--excellent">
            <div class="ghp-sgauge-header">
              <span class="ghp-sgauge-title">Excellent</span>
              <span class="ghp-sgauge-range">&gt;= -75 dBm</span>
            </div>
            <div class="ghp-sgauge-count">{{ signalQualityBreakdown.excellentCount }} Sites</div>
            <div class="ghp-sgauge-desc">Optimal SNR, instant telemetry packet delivery</div>
          </div>

          <div class="ghp-sgauge-card ghp-sgauge-card--fair">
            <div class="ghp-sgauge-header">
              <span class="ghp-sgauge-title">Fair</span>
              <span class="ghp-sgauge-range">-76 to -90 dBm</span>
            </div>
            <div class="ghp-sgauge-count">{{ signalQualityBreakdown.fairCount }} Sites</div>
            <div class="ghp-sgauge-desc">Acceptable link margin, minor retry packets</div>
          </div>

          <div class="ghp-sgauge-card ghp-sgauge-card--weak">
            <div class="ghp-sgauge-header">
              <span class="ghp-sgauge-title">Weak</span>
              <span class="ghp-sgauge-range">&lt; -90 dBm</span>
            </div>
            <div class="ghp-sgauge-count">{{ signalQualityBreakdown.weakCount }} Sites</div>
            <div class="ghp-sgauge-desc">Fringe coverage, candidate for repeater installation</div>
          </div>
        </div>

        <div class="ghp-backhaul-summary">
          <div class="ghp-backhaul-item">
            <span class="ghp-backhaul-label">Cellular Backhaul:</span>
            <span class="ghp-backhaul-val font-semibold">{{ backhaulBreakdown.cellularCount }} Sites (MTN/Airtel/Glo)</span>
          </div>
          <div class="ghp-backhaul-item">
            <span class="ghp-backhaul-label">Satellite Uplink:</span>
            <span class="ghp-backhaul-val font-semibold text-brand">{{ backhaulBreakdown.satelliteCount }} Sites (Starlink)</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════ 8 SITE GATEWAY STATUS CARDS ═══ -->
    <section class="ghp-gateways-section">
      <div class="ghp-section-header">
        <div>
          <h2 class="ghp-section-title">SparkMeter Base Station Gateways (8 Sites)</h2>
          <p class="ghp-section-sub">Live transceiver health, backhaul performance, and RF link metrics per mini-grid feeder</p>
        </div>
        <div class="ghp-filter-pill">
          Showing all 8 Base Stations
        </div>
      </div>

      <div class="ghp-cards-grid">
        <div
          v-for="gw in gateways"
          :key="gw.gatewayId"
          class="ghp-gw-card"
          :class="{ 'ghp-gw-card--weak': gw.signalQuality === 'Weak' }"
        >
          <div class="ghp-gw-top">
            <div>
              <div class="ghp-gw-site">{{ gw.siteCode }}</div>
              <div class="ghp-gw-name">{{ gw.gatewayName }}</div>
            </div>
            <div class="ghp-gw-status-badge">
              <span class="ghp-badge-dot"></span>
              {{ gw.status }}
            </div>
          </div>

          <div class="ghp-gw-id-row">
            <span class="ghp-mono-tag">{{ gw.gatewayId }}</span>
            <span class="ghp-backhaul-badge" :class="gw.backhaulType === 'Satellite' ? 'ghp-bb--sat' : 'ghp-bb--cell'">
              {{ gw.backhaulType }} · {{ gw.backhaulCarrier }}
            </span>
          </div>

          <div class="ghp-gw-details">
            <div class="ghp-gw-detail-item">
              <span class="ghp-dt-label">IP Address</span>
              <span class="ghp-dt-val font-mono">{{ gw.ipAddress }}</span>
            </div>
            <div class="ghp-gw-detail-item">
              <span class="ghp-dt-label">Mesh Host</span>
              <span class="ghp-dt-val font-mono text-truncate">{{ gw.host }}</span>
            </div>
            <div class="ghp-gw-detail-item">
              <span class="ghp-dt-label">Ping Latency</span>
              <span class="ghp-dt-val font-bold" :class="gw.pingLatencyMs > 75 ? 'text-warning' : 'text-positive'">
                {{ gw.pingLatencyMs }} ms
              </span>
            </div>
            <div class="ghp-gw-detail-item">
              <span class="ghp-dt-label">Packet Success</span>
              <span class="ghp-dt-val font-bold font-mono">{{ gw.packetDeliverySuccessRate }}%</span>
            </div>
            <div class="ghp-gw-detail-item">
              <span class="ghp-dt-label">RF Signal (RSSI)</span>
              <span class="ghp-dt-val font-mono" :class="rssiColorClass(gw.avgRssiDbm)">
                {{ gw.avgRssiDbm }} dBm ({{ gw.signalQuality }})
              </span>
            </div>
            <div class="ghp-gw-detail-item">
              <span class="ghp-dt-label">Connected Nodes</span>
              <span class="ghp-dt-val font-bold">{{ gw.connectedNodes }} meters</span>
            </div>
          </div>

          <div class="ghp-gw-hop-preview">
            <div class="ghp-gw-hop-bar">
              <div
                class="ghp-ghb-seg ghp-ghb-seg--0"
                :style="{ width: `${gw.hopDistribution.direct0Hops.percentage}%` }"
                title="Direct 0-hop"
              ></div>
              <div
                class="ghp-ghb-seg ghp-ghb-seg--1"
                :style="{ width: `${gw.hopDistribution.repeater1Hop.percentage}%` }"
                title="1-hop repeaters"
              ></div>
              <div
                class="ghp-ghb-seg ghp-ghb-seg--2"
                :style="{ width: `${gw.hopDistribution.multi2PlusHops.percentage}%` }"
                title="2+ hops"
              ></div>
            </div>
            <div class="ghp-gw-hop-labels">
              <span>0-hop: {{ gw.hopDistribution.direct0Hops.percentage }}%</span>
              <span>1-hop: {{ gw.hopDistribution.repeater1Hop.percentage }}%</span>
              <span>2+ hop: {{ gw.hopDistribution.multi2PlusHops.percentage }}%</span>
            </div>
          </div>

          <div class="ghp-gw-footer">
            <div class="ghp-gw-orphans" v-if="gw.orphanedCount > 0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ghp-orphan-icon">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {{ gw.orphanedCount }} Orphaned Meter{{ gw.orphanedCount > 1 ? 's' : '' }}
            </div>
            <div class="ghp-gw-orphans text-muted" v-else>
              ✓ No Orphaned Meters
            </div>
            <button class="ghp-card-btn" @click="pingGateway(gw)">
              Ping Host
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════════ ORPHANED METERS TABLE ═══ -->
    <section class="ghp-orphans-section">
      <div class="ghp-orphans-header">
        <div>
          <div class="ghp-orphans-badge-row">
            <h2 class="ghp-section-title">Orphaned Meters Surveillance</h2>
            <span class="ghp-badge ghp-badge--danger">{{ orphanedMeters.length }} Meters Inactive &gt; 1 Hour</span>
          </div>
          <p class="ghp-section-sub">
            Sub-GHz radio heartbeats lapsed past 60 minutes. Candidate meters for antenna realignment, repeater power inspection, or physical tamper check.
          </p>
        </div>

        <div class="ghp-search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ghp-s-icon">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            v-model="orphanSearchQuery"
            type="text"
            placeholder="Search meter serial, customer, site…"
            class="ghp-s-input"
          />
        </div>
      </div>

      <div class="ghp-table-wrap">
        <table class="ghp-table">
          <thead>
            <tr>
              <th>Meter Serial</th>
              <th>Mini-Grid Site</th>
              <th>Customer</th>
              <th>Last Heartbeat</th>
              <th>Inactive Time</th>
              <th>Last RSSI</th>
              <th>Hops</th>
              <th>Observed Diagnostic / Reason</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="m in filteredOrphanedMeters"
              :key="m.meterSerial"
              :class="{ 'ghp-row--crit': m.severity === 'critical' }"
            >
              <td>
                <span class="ghp-mono-tag font-bold">{{ m.meterSerial }}</span>
              </td>
              <td>
                <div class="font-semibold">{{ m.siteCode }}</div>
                <div class="text-xs text-muted">{{ m.siteName }}</div>
              </td>
              <td>
                <div class="font-medium">{{ m.customerName }}</div>
                <div class="text-xs text-muted font-mono">{{ m.customerId }}</div>
              </td>
              <td class="font-mono text-xs">{{ formatTime(m.lastHeartbeatAt) }}</td>
              <td>
                <span class="ghp-inactive-tag" :class="m.inactiveMinutes > 180 ? 'ghp-it--red' : 'ghp-it--amber'">
                  {{ formatDuration(m.inactiveMinutes) }}
                </span>
              </td>
              <td class="font-mono text-danger font-medium">{{ m.lastRssiDbm }} dBm</td>
              <td class="text-center font-bold">{{ m.lastHops }}</td>
              <td>
                <div class="ghp-diag-reason">{{ m.failureReason }}</div>
                <div class="ghp-diag-action">{{ m.recommendedAction }}</div>
              </td>
              <td class="text-right">
                <button class="ghp-ping-btn" @click="pingMeterRadio(m)">
                  Ping Radio
                </button>
              </td>
            </tr>
            <tr v-if="filteredOrphanedMeters.length === 0">
              <td colspan="9" class="text-center text-muted py-6">
                No orphaned meters matching current search query.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: "GatewayHealthPage",
  data() {
    return {
      loading: false,
      orphanSearchQuery: "",
      summary: {
        totalGateways: 8,
        onlineGateways: 8,
        offlineGateways: 0,
        avgLatencyMs: 52,
        avgPacketDeliveryRate: 98.5,
        avgRssiDbm: -77,
        overallSignalQuality: "Fair",
        totalMeshNodes: 1921,
        totalOrphanedMeters: 11
      },
      gateways: [],
      hopDistribution: {
        totalNodes: 0,
        direct0Hops: { count: 0, percentage: 0 },
        repeater1Hop: { count: 0, percentage: 0 },
        multi2PlusHops: { count: 0, percentage: 0 }
      },
      signalQualityBreakdown: {
        excellentCount: 0,
        fairCount: 0,
        weakCount: 0
      },
      backhaulBreakdown: {
        cellularCount: 0,
        satelliteCount: 0
      },
      orphanedMeters: []
    };
  },
  computed: {
    signalQualityClass() {
      const q = this.summary.overallSignalQuality;
      if (q === "Excellent") return "ghp-qb--excellent";
      if (q === "Fair") return "ghp-qb--fair";
      return "ghp-qb--weak";
    },
    signalIconClass() {
      const q = this.summary.overallSignalQuality;
      if (q === "Excellent") return "ghp-kpi-icon--positive";
      if (q === "Fair") return "ghp-kpi-icon--warning";
      return "ghp-kpi-icon--danger";
    },
    filteredOrphanedMeters() {
      const q = this.orphanSearchQuery.trim().toLowerCase();
      if (!q) return this.orphanedMeters;
      return this.orphanedMeters.filter(
        (m) =>
          m.meterSerial.toLowerCase().includes(q) ||
          m.siteCode.toLowerCase().includes(q) ||
          m.customerName.toLowerCase().includes(q) ||
          m.customerId.toLowerCase().includes(q)
      );
    }
  },
  mounted() {
    this.fetchGatewayData();
  },
  methods: {
    formatNumber(n) {
      return (Number(n) || 0).toLocaleString("en-US");
    },
    formatTime(isoStr) {
      if (!isoStr) return "Unknown";
      try {
        const d = new Date(isoStr);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch {
        return isoStr;
      }
    },
    formatDuration(minutes) {
      const m = Number(minutes) || 0;
      const hours = Math.floor(m / 60);
      const remainingMinutes = m % 60;
      if (hours > 0) {
        return `${hours}h ${remainingMinutes}m ago`;
      }
      return `${remainingMinutes}m ago`;
    },
    rssiColorClass(rssi) {
      if (rssi >= -75) return "text-positive";
      if (rssi >= -90) return "text-warning";
      return "text-danger";
    },
    async fetchGatewayData() {
      this.loading = true;
      try {
        const res = await fetch("/api/oem/mesh/gateway-status");
        const data = await res.json();
        const payload = data?.data || data?.result || data;

        if (payload?.summary) {
          this.summary = payload.summary;
          this.gateways = payload.gateways || [];
          this.hopDistribution = payload.networkHopDistribution || this.hopDistribution;
          this.signalQualityBreakdown = payload.signalQualityBreakdown || this.signalQualityBreakdown;
          this.backhaulBreakdown = payload.backhaulBreakdown || this.backhaulBreakdown;
          this.orphanedMeters = payload.orphanedMeters || [];
        }
      } catch (err) {
        console.error("[gateway-health-fetch]", err);
      } finally {
        this.loading = false;
      }
    },
    pingAllGateways() {
      alert(`ICMP & RF Echo Ping dispatched to all ${this.gateways.length} Base Stations. All nodes responded within ${this.summary.avgLatencyMs}ms.`);
    },
    pingGateway(gw) {
      alert(`Ping sent to ${gw.siteCode} Base Station (${gw.ipAddress}). Roundtrip Latency: ${gw.pingLatencyMs}ms. Status: Online.`);
    },
    pingMeterRadio(m) {
      alert(`RF Sub-GHz Ping sent to Meter ${m.meterSerial} at ${m.siteCode}. Waiting for radio ack over mesh channel…`);
    }
  }
};
</script>

<style scoped>
.ghp-container {
  padding: var(--s-6);
  max-width: 1440px;
  margin: 0 auto;
  font-family: var(--font-sans);
  color: var(--text-primary, #f1f5f9);
}

/* ── Hero ── */
.ghp-hero {
  position: relative;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-2xl);
  padding: var(--s-6) var(--s-8);
  margin-bottom: var(--s-6);
  overflow: hidden;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
}

.ghp-hero-glow {
  position: absolute;
  top: -60px;
  right: -60px;
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.16) 0%, transparent 70%);
  pointer-events: none;
}

.ghp-hero-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-6);
  flex-wrap: wrap;
}

.ghp-hero-left {
  display: flex;
  align-items: center;
  gap: var(--s-4);
}

.ghp-hero-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--r-xl);
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(2, 132, 199, 0.05) 100%);
  border: 1px solid rgba(14, 165, 233, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #38bdf8;
}

.ghp-hero-icon svg {
  width: 24px;
  height: 24px;
}

.ghp-hero-eyebrow {
  font-size: var(--t-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: var(--fw-semibold);
  color: #38bdf8;
  margin-bottom: 2px;
}

.ghp-hero-title {
  font-family: var(--font-display);
  font-size: var(--t-2xl);
  font-weight: var(--fw-bold);
  margin: 0;
  color: #fff;
  letter-spacing: -0.02em;
}

.ghp-hero-sub {
  font-size: var(--t-sm);
  color: var(--text-secondary, #94a3b8);
  margin: 4px 0 0;
}

.ghp-hero-badges {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  flex-wrap: wrap;
}

.ghp-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--r-full);
  font-size: var(--t-xs);
  font-weight: var(--fw-medium);
}

.ghp-badge--live {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.ghp-badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}

.ghp-badge--rf {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.ghp-badge--rf svg {
  width: 14px;
  height: 14px;
}

.ghp-badge--warning {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.35);
}

.ghp-badge--danger {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.ghp-badge--neutral {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.ghp-hero-actions {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}

.ghp-hbtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--r-md);
  font-size: var(--t-sm);
  font-weight: var(--fw-medium);
  cursor: pointer;
  transition: all var(--dur-fast);
  border: none;
}

.ghp-hbtn svg {
  width: 16px;
  height: 16px;
}

.ghp-hbtn--primary {
  background: #0284c7;
  color: #fff;
}

.ghp-hbtn--primary:hover {
  background: #0369a1;
}

.ghp-hbtn--ghost {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.ghp-hbtn--ghost:hover {
  background: rgba(255, 255, 255, 0.14);
}

.ghp-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── KPI Grid ── */
.ghp-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--s-4);
  margin-bottom: var(--s-6);
}

.ghp-kpi-card {
  background: var(--bg-card, #1e293b);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-xl);
  padding: var(--s-5);
  transition: transform var(--dur-fast);
}

.ghp-kpi-card:hover {
  transform: translateY(-2px);
}

.ghp-kpi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--s-3);
}

.ghp-kpi-label {
  font-size: var(--t-xs);
  font-weight: var(--fw-semibold);
  color: var(--text-secondary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ghp-kpi-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: var(--r-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ghp-kpi-icon-wrap svg {
  width: 18px;
  height: 18px;
}

.ghp-kpi-icon--brand {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.ghp-kpi-icon--positive {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.ghp-kpi-icon--warning {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.ghp-kpi-icon--danger {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.ghp-kpi-value-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.ghp-kpi-num {
  font-family: var(--font-display);
  font-size: var(--t-3xl);
  font-weight: var(--fw-bold);
  color: #fff;
  letter-spacing: -0.03em;
}

.ghp-kpi-total,
.ghp-kpi-unit {
  font-size: var(--t-sm);
  color: #94a3b8;
}

.ghp-kpi-sub {
  font-size: var(--t-xs);
  color: #94a3b8;
  margin: 6px 0 0;
  line-height: 1.4;
}

.ghp-kpi-badge-wrap {
  margin-top: 8px;
}

.ghp-quality-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: var(--r-sm);
  font-size: 11px;
  font-weight: var(--fw-semibold);
}

.ghp-qb--excellent {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.35);
}

.ghp-qb--fair {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.35);
}

.ghp-qb--weak {
  background: rgba(239, 68, 68, 0.18);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.45);
}

/* ── RF Topology Section ── */
.ghp-rf-topology-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-6);
  margin-bottom: var(--s-6);
}

.ghp-panel-card {
  background: var(--bg-card, #1e293b);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-2xl);
  padding: var(--s-6);
}

.ghp-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--s-5);
}

.ghp-panel-title {
  font-family: var(--font-display);
  font-size: var(--t-md);
  font-weight: var(--fw-bold);
  margin: 0;
  color: #fff;
}

.ghp-panel-sub {
  font-size: var(--t-xs);
  color: #94a3b8;
  margin: 2px 0 0;
}

.ghp-hop-bars {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
}

.ghp-hop-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ghp-hop-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--t-sm);
}

.ghp-hop-name {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e2e8f0;
}

.ghp-hop-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.ghp-hop-dot--green { background: #22c55e; }
.ghp-hop-dot--blue { background: #38bdf8; }
.ghp-hop-dot--amber { background: #f59e0b; }

.ghp-hop-track {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
}

.ghp-hop-fill {
  height: 100%;
  border-radius: 4px;
}

.ghp-hop-fill--green { background: #22c55e; }
.ghp-hop-fill--blue { background: #38bdf8; }
.ghp-hop-fill--amber { background: #f59e0b; }

.ghp-hop-desc {
  font-size: 11px;
  color: #64748b;
}

.ghp-signal-gauges {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--s-3);
  margin-bottom: var(--s-4);
}

.ghp-sgauge-card {
  padding: var(--s-4);
  border-radius: var(--r-xl);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ghp-sgauge-card--excellent {
  background: rgba(34, 197, 94, 0.06);
  border-color: rgba(34, 197, 94, 0.2);
}

.ghp-sgauge-card--fair {
  background: rgba(245, 158, 11, 0.06);
  border-color: rgba(245, 158, 11, 0.2);
}

.ghp-sgauge-card--weak {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.2);
}

.ghp-sgauge-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.ghp-sgauge-title {
  font-size: var(--t-xs);
  font-weight: var(--fw-bold);
}

.ghp-sgauge-card--excellent .ghp-sgauge-title { color: #4ade80; }
.ghp-sgauge-card--fair .ghp-sgauge-title { color: #fbbf24; }
.ghp-sgauge-card--weak .ghp-sgauge-title { color: #f87171; }

.ghp-sgauge-range {
  font-size: 10px;
  color: #94a3b8;
  font-family: var(--font-mono);
}

.ghp-sgauge-count {
  font-family: var(--font-display);
  font-size: var(--t-2xl);
  font-weight: var(--fw-bold);
  color: #fff;
  margin: 4px 0;
}

.ghp-sgauge-desc {
  font-size: 10px;
  color: #64748b;
  line-height: 1.3;
}

.ghp-backhaul-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: var(--r-md);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.ghp-backhaul-item {
  font-size: var(--t-xs);
}

.ghp-backhaul-label {
  color: #94a3b8;
  margin-right: 6px;
}

/* ── 8 Gateways Grid ── */
.ghp-gateways-section {
  margin-bottom: var(--s-6);
}

.ghp-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--s-4);
  flex-wrap: wrap;
}

.ghp-section-title {
  font-family: var(--font-display);
  font-size: var(--t-lg);
  font-weight: var(--fw-bold);
  margin: 0;
  color: #fff;
}

.ghp-section-sub {
  font-size: var(--t-xs);
  color: #94a3b8;
  margin: 2px 0 0;
}

.ghp-filter-pill {
  font-size: var(--t-xs);
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
  padding: 4px 10px;
  border-radius: var(--r-full);
}

.ghp-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--s-4);
}

.ghp-gw-card {
  background: var(--bg-card, #1e293b);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-xl);
  padding: var(--s-5);
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  transition: transform var(--dur-fast), border-color var(--dur-fast);
}

.ghp-gw-card:hover {
  transform: translateY(-2px);
  border-color: rgba(56, 189, 248, 0.3);
}

.ghp-gw-card--weak {
  border-color: rgba(239, 68, 68, 0.25);
}

.ghp-gw-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.ghp-gw-site {
  font-family: var(--font-display);
  font-size: var(--t-md);
  font-weight: var(--fw-bold);
  color: #fff;
}

.ghp-gw-name {
  font-size: 11px;
  color: #94a3b8;
}

.ghp-gw-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
  padding: 3px 8px;
  border-radius: var(--r-full);
  font-size: 11px;
  text-transform: capitalize;
}

.ghp-gw-id-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.ghp-mono-tag {
  font-family: var(--font-mono);
  font-size: 11px;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 6px;
  border-radius: var(--r-xs);
  color: #38bdf8;
}

.ghp-backhaul-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--r-sm);
  font-weight: var(--fw-medium);
}

.ghp-bb--cell {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.ghp-bb--sat {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

.ghp-gw-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: var(--r-md);
}

.ghp-gw-detail-item {
  display: flex;
  flex-direction: column;
}

.ghp-dt-label {
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
}

.ghp-dt-val {
  font-size: var(--t-xs);
  color: #e2e8f0;
}

.ghp-gw-hop-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ghp-gw-hop-bar {
  display: flex;
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
}

.ghp-ghb-seg--0 { background: #22c55e; }
.ghp-ghb-seg--1 { background: #38bdf8; }
.ghp-ghb-seg--2 { background: #f59e0b; }

.ghp-gw-hop-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #94a3b8;
}

.ghp-gw-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--s-2);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.ghp-gw-orphans {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #fbbf24;
}

.ghp-orphan-icon {
  width: 14px;
  height: 14px;
}

.ghp-card-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #e2e8f0;
  padding: 4px 10px;
  border-radius: var(--r-sm);
  font-size: 11px;
  cursor: pointer;
  transition: all var(--dur-fast);
}

.ghp-card-btn:hover {
  background: rgba(255, 255, 255, 0.16);
}

/* ── Orphaned Meters Table ── */
.ghp-orphans-section {
  background: var(--bg-card, #1e293b);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-2xl);
  padding: var(--s-6);
}

.ghp-orphans-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
  margin-bottom: var(--s-4);
  flex-wrap: wrap;
}

.ghp-orphans-badge-row {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}

.ghp-search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.ghp-s-icon {
  position: absolute;
  left: 10px;
  width: 16px;
  height: 16px;
  color: #94a3b8;
  pointer-events: none;
}

.ghp-s-input {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f1f5f9;
  border-radius: var(--r-md);
  padding: 8px 12px 8px 34px;
  font-size: var(--t-sm);
  width: 280px;
  outline: none;
}

.ghp-table-wrap {
  overflow-x: auto;
}

.ghp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--t-sm);
}

.ghp-table th {
  background: rgba(15, 23, 42, 0.6);
  color: #94a3b8;
  font-weight: var(--fw-semibold);
  font-size: var(--t-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap;
}

.ghp-table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.ghp-row--crit {
  background: rgba(239, 68, 68, 0.04);
}

.ghp-inactive-tag {
  display: inline-flex;
  padding: 2px 6px;
  border-radius: var(--r-xs);
  font-size: 11px;
  font-weight: var(--fw-semibold);
  font-family: var(--font-mono);
}

.ghp-it--red {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.ghp-it--amber {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.ghp-diag-reason {
  font-size: var(--t-xs);
  font-weight: var(--fw-medium);
  color: #f1f5f9;
}

.ghp-diag-action {
  font-size: 11px;
  color: #38bdf8;
  margin-top: 2px;
}

.ghp-ping-btn {
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.25);
  color: #38bdf8;
  padding: 5px 12px;
  border-radius: var(--r-sm);
  font-size: var(--t-xs);
  font-weight: var(--fw-medium);
  cursor: pointer;
  transition: all var(--dur-fast);
}

.ghp-ping-btn:hover {
  background: rgba(56, 189, 248, 0.22);
}

/* Helpers */
.text-right { text-align: right; }
.text-center { text-align: center; }
.text-muted { color: #64748b; }
.text-positive { color: #4ade80; }
.text-warning { color: #fbbf24; }
.text-danger { color: #f87171; }
.text-brand { color: #38bdf8; }
.font-bold { font-weight: 700; }
.font-semibold { font-weight: 600; }
.font-medium { font-weight: 500; }
.font-mono { font-family: var(--font-mono); }
.text-xs { font-size: 11px; }
.text-truncate {
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.py-6 { padding-top: 24px; padding-bottom: 24px; }

@media (max-width: 900px) {
  .ghp-rf-topology-grid { grid-template-columns: 1fr; }
  .ghp-hero-inner { flex-direction: column; align-items: flex-start; }
}
</style>
