<template>
  <div class="gprs-map-root" aria-label="Live Battery GPS Map">
    <!-- ── Leaflet canvas (fills container) ── -->
    <div
      ref="mapRoot"
      class="leaflet-host"
      :class="{ 'leaflet-host--ready': mapLoaded }"
    />

    <!-- ── Graceful fallback if map tiles are initializing ── -->
    <transition name="fade">
      <div v-if="!mapLoaded" class="map-loading-overlay">
        <div class="map-loading-spinner" />
        <span class="map-loading-text">Connecting to Live IoT Fleet Telemetry…</span>
      </div>
    </transition>

    <!-- ── Floating Map Controls (Top Center & Top Right) ── -->
    <div class="map-floating-bar">
      <div class="map-status-pill">
        <span class="map-status-dot" :class="mapLoaded ? 'map-status-dot--live' : 'map-status-dot--syncing'" />
        <span class="map-status-label">{{ mapLoaded ? 'Live GPS · Yunhe IoT' : 'Connecting…' }}</span>
        <span class="map-status-count">{{ bikes.length }} bikes tracked</span>
      </div>
      <button class="map-action-pill" title="Fit all bikes into view" @click="fitBikes">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
        Fit All
      </button>
    </div>

    <!-- ── Legend pill (Bottom Left) ── -->
    <div class="map-legend">
      <span class="legend-item"><span class="legend-dot dot-green" /> &gt;60% Good</span>
      <span class="legend-item"><span class="legend-dot dot-amber" /> 20–60% Mid</span>
      <span class="legend-item"><span class="legend-dot dot-red" /> &lt;20% Low / Needs Swap</span>
    </div>

    <!-- ── Selected Bike Floating Drawer (Top Right Overlay) ── -->
    <transition name="slide-card">
      <div v-if="activeBike" class="bike-popup-card" role="region" :aria-label="`Telemetry for ${activeBike.id}`">
        <div class="card-header">
          <div class="card-id-block">
            <span class="card-bike-id">{{ activeBike.id }}</span>
            <span class="card-plate">{{ activeBike.plateNumber || 'EV-BIKE' }}</span>
          </div>
          <button class="card-close-btn" aria-label="Close details" @click="$emit('select-bike', '')">✕</button>
        </div>

        <!-- Rider info row -->
        <div class="card-rider-row">
          <div class="rider-avatar">👤</div>
          <div class="rider-meta">
            <div class="rider-name">{{ activeBike.riderName }}</div>
            <div class="rider-phone">{{ activeBike.riderPhone }}</div>
          </div>
          <span
            class="status-chip"
            :class="activeBike.telemetry.online ? 'status-chip--online' : 'status-chip--offline'"
          >
            {{ activeBike.telemetry.online ? '● Online' : '● Offline' }}
          </span>
        </div>

        <!-- Telemetry stat grid -->
        <div class="card-telemetry-grid">
          <div class="telemetry-box">
            <span class="telemetry-lbl">BATTERY LEVEL</span>
            <span class="telemetry-val" :style="{ color: pinColor(activeBike.telemetry.soc) }">
              {{ activeBike.telemetry.soc }}%
            </span>
          </div>
          <div class="telemetry-box">
            <span class="telemetry-lbl">SPEED</span>
            <span class="telemetry-val">{{ activeBike.telemetry.speed }} km/h</span>
          </div>
          <div class="telemetry-box">
            <span class="telemetry-lbl">PACK VOLTAGE</span>
            <span class="telemetry-val">{{ activeBike.telemetry.voltage }}V</span>
          </div>
          <div class="telemetry-box">
            <span class="telemetry-lbl">ODOMETER</span>
            <span class="telemetry-val">{{ activeBike.telemetry.mileage }} km</span>
          </div>
        </div>

        <!-- Hardware & Location info -->
        <div class="card-hardware-info">
          <div class="hw-row">
            <span class="hw-label">Battery SN</span>
            <code class="hw-code">{{ activeBike.batterySn }}</code>
          </div>
          <div class="hw-row">
            <span class="hw-label">Location</span>
            <span class="hw-val">{{ activeBike.telemetry.city }} ({{ activeBike.telemetry.lat.toFixed(4) }}, {{ activeBike.telemetry.lng.toFixed(4) }})</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="card-actions">
          <button
            class="btn-action btn-motor"
            :class="activeBike.telemetry.d_fet ? 'btn-motor--cut' : 'btn-motor--restore'"
            @click="$emit('toggle-power', activeBike.id, !activeBike.telemetry.d_fet)"
          >
            {{ activeBike.telemetry.d_fet ? '⚠ Cut Motor' : '✓ Restore Motor' }}
          </button>
          <button
            class="btn-action btn-swap"
            @click="$emit('swap-battery', activeBike.id)"
          >
            ⚡ Swap Battery
          </button>
          <button
            class="btn-action btn-crm"
            @click="$emit('open-crm', activeBike.assignedCustomerId)"
          >
            Rider CRM
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default {
  name: "BatteryGprsMap",
  props: {
    bikes: {
      type: Array,
      required: true
    },
    selectedBikeId: {
      type: String,
      default: ""
    }
  },
  emits: ["select-bike", "toggle-power", "open-crm", "swap-battery"],
  data() {
    return {
      mapLoaded: false,
      leafletMap: null,
      leafletMarkers: {}
    };
  },
  computed: {
    activeBike() {
      if (!this.selectedBikeId) return null;
      return this.bikes.find(b => b.id === this.selectedBikeId) || null;
    }
  },
  watch: {
    selectedBikeId(newId) {
      if (!this.leafletMap) return;
      if (newId && this.leafletMarkers[newId]) {
        const m = this.leafletMarkers[newId];
        this.leafletMap.panTo(m.getLatLng(), { animate: true, duration: 0.5 });
        m.openPopup();
      }
    },
    bikes: {
      handler() {
        if (this.mapLoaded) {
          this.renderMarkers();
        }
      },
      deep: false
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.initMap();
    });
  },
  beforeUnmount() {
    if (this.leafletMap) {
      try {
        this.leafletMap.remove();
      } catch (_) {}
      this.leafletMap = null;
    }
  },
  methods: {
    pinColor(soc) {
      if (soc <= 20) return "#ef4444";
      if (soc <= 60) return "#f59e0b";
      return "#22c55e";
    },

    initMap() {
      if (!this.$refs.mapRoot) return;

      try {
        // Destroy existing instance if any
        if (this.leafletMap) {
          try { this.leafletMap.remove(); } catch (_) {}
          this.leafletMap = null;
        }

        // Initialize Leaflet Map centered on Nigeria (Lagos Hub)
        this.leafletMap = L.map(this.$refs.mapRoot, {
          center: [6.5244, 3.3792],
          zoom: 11,
          zoomControl: false, // Custom position or cleaner look
          attributionControl: true
        });

        // Add Zoom Control to bottom-right
        L.control.zoom({ position: "bottomright" }).addTo(this.leafletMap);

        // OpenStreetMap tile layer (reliable, fast)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(this.leafletMap);

        this.mapLoaded = true;

        // Invalidate size once DOM layout is settled
        setTimeout(() => {
          if (this.leafletMap) {
            this.leafletMap.invalidateSize();
            this.renderMarkers();
            this.fitBikes();
          }
        }, 120);
      } catch (err) {
        console.error("[BatteryGprsMap] Failed to initialize Leaflet:", err);
      }
    },

    fitBikes() {
      if (!this.leafletMap || !Array.isArray(this.bikes) || !this.bikes.length) return;
      const validCoords = this.bikes
        .filter(b => b && b.telemetry && typeof b.telemetry.lat === "number" && typeof b.telemetry.lng === "number" && !isNaN(b.telemetry.lat) && !isNaN(b.telemetry.lng))
        .map(b => [b.telemetry.lat, b.telemetry.lng]);

      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        this.leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    },

    renderMarkers() {
      if (!this.leafletMap) return;

      // Clear existing markers
      Object.values(this.leafletMarkers).forEach(m => m.remove());
      this.leafletMarkers = {};

      if (!Array.isArray(this.bikes)) return;

      this.bikes.forEach(b => {
        if (!b || !b.telemetry || typeof b.telemetry.lat !== "number" || typeof b.telemetry.lng !== "number") return;
        const color = this.pinColor(b.telemetry.soc ?? 100);
        const isSelected = b.id === this.selectedBikeId;
        const isMoving = Number(b.telemetry.speed || 0) > 0;

        const pulseStyle = isMoving ? `box-shadow: 0 0 0 4px ${color}44, 0 2px 8px rgba(0,0,0,0.4);` : `box-shadow: 0 2px 6px rgba(0,0,0,0.35);`;

        const customIcon = L.divIcon({
          className: "custom-bike-marker",
          html: `
            <div style="
              position: relative;
              width: ${isSelected ? 20 : 14}px;
              height: ${isSelected ? 20 : 14}px;
              border-radius: 50%;
              background: ${color};
              border: ${isSelected ? '3px' : '2px'} solid #ffffff;
              ${pulseStyle}
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            ">
              ${isSelected ? '<div style="width: 4px; height: 4px; border-radius: 50%; background: #ffffff;"></div>' : ''}
            </div>
          `,
          iconSize: [isSelected ? 20 : 14, isSelected ? 20 : 14],
          iconAnchor: [isSelected ? 10 : 7, isSelected ? 10 : 7]
        });

        const marker = L.marker([b.telemetry.lat, b.telemetry.lng], { icon: customIcon });

        // Popup content matching Beverly Wallet styling
        marker.bindPopup(`
          <div style="font-family: inherit; font-size: 12.5px; min-width: 190px; line-height: 1.45; color: #0f172a; padding: 2px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
              <strong style="font-size: 13.5px; color: #022c22; font-family: monospace;">${b.id}</strong>
              <span style="font-size: 10px; padding: 1px 5px; border-radius: 4px; background: #ecfdf5; color: #047857; font-weight: 700;">${b.telemetry.online ? 'Online' : 'Offline'}</span>
            </div>
            <div><span style="color:#64748b; font-size:11px;">Rider:</span> <strong>${b.riderName}</strong></div>
            <div><span style="color:#64748b; font-size:11px;">Charge:</span> <b style="color: ${color};">${b.telemetry.soc}%</b> (${b.telemetry.voltage}V)</div>
            <div><span style="color:#64748b; font-size:11px;">Speed:</span> ${b.telemetry.speed} km/h</div>
            <div><span style="color:#64748b; font-size:11px;">Location:</span> ${b.telemetry.city}</div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 4px; font-family: monospace;">SN: ${b.batterySn}</div>
          </div>
        `, { maxWidth: 260, className: "beverly-map-popup" });

        marker.on("click", () => {
          this.$emit("select-bike", b.id);
        });

        marker.addTo(this.leafletMap);
        this.leafletMarkers[b.id] = marker;
      });
    }
  }
};
</script>

<style scoped>
.gprs-map-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--acob-bg);
  font-family: var(--acob-font-sans, inherit);
}

/* ── Leaflet Container ────────────────────────────────── */
.leaflet-host {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* ── Loading Overlay ──────────────────────────────────── */
.map-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--acob-bg);
  z-index: 10;
}
.map-loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(0, 128, 0, 0.15);
  border-top-color: var(--acob-brand);
  border-radius: 50%;
  animation: map-spin 0.8s linear infinite;
}
@keyframes map-spin {
  to { transform: rotate(360deg); }
}
.map-loading-text {
  font-size: 12.5px;
  color: var(--acob-muted);
  font-weight: 500;
}

/* ── Floating Bar (Top Left / Center) ─────────────────── */
.map-floating-bar {
  position: absolute;
  top: 14px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 500;
}

.map-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  background: var(--acob-panel);
  border: 1px solid var(--acob-line);
  border-radius: var(--bev-radius-pill, 999px);
  backdrop-filter: blur(16px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  font-size: 12px;
  color: var(--acob-text);
}

.map-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.map-status-dot--live {
  background: var(--acob-brand-bright);
  box-shadow: 0 0 8px var(--acob-brand-bright);
}
.map-status-dot--syncing {
  background: var(--acob-gold);
}
.map-status-label {
  font-weight: 700;
}
.map-status-count {
  font-size: 11px;
  color: var(--acob-muted);
  border-left: 1px solid var(--acob-line);
  padding-left: 7px;
  margin-left: 2px;
}

.map-action-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: var(--acob-panel);
  border: 1px solid var(--acob-line);
  border-radius: var(--bev-radius-pill, 999px);
  color: var(--acob-brand);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  backdrop-filter: blur(16px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  transition: all 0.15s ease;
}
.map-action-pill:hover {
  background: rgba(0, 128, 0, 0.12);
  border-color: var(--acob-brand);
}

/* ── Legend (Bottom Left) ─────────────────────────────── */
.map-legend {
  position: absolute;
  bottom: 14px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 14px;
  background: var(--acob-panel);
  border: 1px solid var(--acob-line);
  border-radius: var(--bev-radius-pill, 999px);
  backdrop-filter: blur(16px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  z-index: 500;
  font-size: 11px;
  color: var(--acob-muted);
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}
.legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.dot-green { background: var(--acob-brand-bright); }
.dot-amber { background: var(--acob-gold); }
.dot-red   { background: var(--color-danger); }

/* ── Selected Bike Floating Drawer ────────────────────── */
.bike-popup-card {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 320px;
  background: var(--acob-surface);
  border: 1px solid var(--acob-line-strong);
  border-radius: var(--bev-radius-lg, 14px);
  backdrop-filter: blur(24px) saturate(140%);
  box-shadow: var(--acob-panel-shadow, 0 16px 40px rgba(0, 0, 0, 0.45));
  z-index: 600;
  overflow: hidden;
  color: var(--acob-text);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--acob-line);
}
.card-id-block {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-bike-id {
  font-size: 15px;
  font-weight: 800;
  font-family: var(--acob-font-mono);
  color: var(--acob-text);
}
.card-plate {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: 4px;
  color: var(--acob-muted);
  font-family: var(--acob-font-mono);
}
.card-close-btn {
  background: none;
  border: none;
  color: var(--acob-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
  transition: color 0.15s ease;
}
.card-close-btn:hover {
  color: var(--acob-text);
}

.card-rider-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--acob-line);
}
.rider-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.rider-meta {
  flex: 1;
}
.rider-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--acob-text);
}
.rider-phone {
  font-size: 11px;
  color: var(--acob-muted);
}
.status-chip {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: var(--bev-radius-pill, 999px);
}
.status-chip--online {
  background: rgba(0, 128, 0, 0.12);
  color: var(--acob-brand);
}
.status-chip--offline {
  background: var(--acob-chip);
  color: var(--acob-muted);
}

.card-telemetry-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--acob-line);
}
.telemetry-box {
  background: var(--acob-chip);
  border: 1px solid var(--acob-line);
  border-radius: var(--bev-radius-xs, 6px);
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.telemetry-lbl {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--acob-muted);
  letter-spacing: 0.04em;
}
.telemetry-val {
  font-size: 13.5px;
  font-weight: 800;
  color: var(--acob-text);
}

.card-hardware-info {
  padding: 8px 14px;
  border-bottom: 1px solid var(--acob-line);
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 11px;
}
.hw-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}
.hw-label {
  color: var(--acob-muted);
  font-weight: 600;
  flex-shrink: 0;
}
.hw-code {
  font-family: var(--acob-font-mono);
  font-size: 10.5px;
  background: var(--acob-chip);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--acob-text);
}
.hw-val {
  color: var(--acob-muted);
  font-size: 10.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-actions {
  display: flex;
  gap: 8px;
  padding: 10px 14px 12px;
}
.btn-action {
  flex: 1;
  height: 34px;
  border-radius: var(--bev-radius-sm, 8px);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}
.btn-motor--cut {
  background: rgba(184, 134, 46, 0.12);
  border-color: rgba(184, 134, 46, 0.35);
  color: var(--acob-gold);
}
.btn-motor--cut:hover { background: rgba(184, 134, 46, 0.22); }
.btn-motor--restore {
  background: rgba(0, 128, 0, 0.12);
  border-color: rgba(0, 128, 0, 0.35);
  color: var(--acob-brand);
}
.btn-motor--restore:hover { background: rgba(0, 128, 0, 0.22); }
.btn-swap {
  background: var(--acob-brand);
  color: #ffffff;
  border-color: var(--acob-brand);
}
.btn-swap:hover { filter: brightness(1.08); }
.btn-crm {
  background: var(--acob-chip);
  border-color: var(--acob-line);
  color: var(--acob-text);
}
.btn-crm:hover {
  background: var(--acob-surface-hover);
}

/* Transitions */
.slide-card-enter-active { transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-card-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.slide-card-enter, .slide-card-leave-to { opacity: 0; transform: translateY(-10px) scale(0.97); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter, .fade-leave-to { opacity: 0; }
</style>
