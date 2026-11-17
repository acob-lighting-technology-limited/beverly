<template>
  <section class="live" aria-label="Live battery map" data-testid="live-map-page">
    <header class="reg-head">
      <div>
        <h1 class="reg-title">Live map</h1>
        <p class="reg-blurb">Where each battery is now. A bike is where its battery is, because only the battery carries a tracker. Positions can be approximate: the platform may locate a battery from the mobile network, not GPS.</p>
      </div>
      <button type="button" class="reg-btn" :disabled="live.status === 'loading'" data-testid="live-refresh" @click="live.refresh()">
        {{ live.status === 'loading' ? 'Refreshing…' : 'Refresh' }}
      </button>
    </header>

    <div v-if="live.error" class="reg-alert" role="alert" data-testid="live-error">
      <span>Live battery data is unavailable: {{ live.error }}</span>
      <button type="button" class="reg-btn" @click="live.refresh()">Try again</button>
    </div>
    <div v-if="live.registryError" class="reg-alert" role="alert" data-testid="live-registry-error">
      <span>The battery register could not be loaded: {{ live.registryError }}</span>
    </div>

    <ul class="live-stats" aria-label="Fleet summary">
      <li><span class="live-stat-num">{{ live.counts.online }}</span> online</li>
      <li><span class="live-stat-num">{{ live.counts.offline }}</span> offline</li>
      <li><span class="live-stat-num">{{ live.counts.lowCharge }}</span> low charge</li>
      <li><span class="live-stat-num">{{ live.counts.attention }}</span> need attention</li>
      <li class="live-stat-time">{{ live.lastSyncAt ? `Updated ${timeText(live.lastSyncAt)}` : 'Not updated yet' }}</li>
    </ul>

    <div class="live-split">
      <div ref="mapRoot" class="live-map" role="application" aria-label="Map of battery positions" data-testid="live-map" />

      <aside class="live-list" aria-label="Batteries">
        <p v-if="!live.rows.length && live.status !== 'loading'" class="reg-empty-note" data-testid="live-empty">No batteries yet. Add them in the Batteries register.</p>
        <button
          v-for="row in live.rows"
          :key="row.key"
          type="button"
          :class="['live-item', `live-item--${row.level}`, live.selectedKey === row.key && 'is-selected']"
          :data-testid="`live-item-${row.key}`"
          @click="choose(row)"
        >
          <span class="live-item-name">{{ nameOf(row) }}</span>
          <span class="live-item-meta">
            <template v-if="row.live">{{ row.live.soc === null ? '—' : `${row.live.soc}%` }} · {{ onlineText(row.live.online) }}</template>
            <template v-else>No live reading</template>
            <template v-if="row.live && row.live.lat === null"> · no position</template>
            <template v-if="!row.registered"> · not registered</template>
          </span>
          <span v-for="alert in row.alerts" :key="alert.code" :class="['reg-badge', alert.level === 'critical' ? 'reg-badge--lost' : 'reg-badge--maintenance']">{{ alert.text }}</span>
        </button>
      </aside>
    </div>
  </section>
</template>

<script setup>
/** Live map: one marker per battery that has a valid position. Data from stores/pue-live-store.js. */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { usePueLiveStore } from "../stores/pue-live-store.js";

const live = usePueLiveStore();
const mapRoot = ref(null);
let map = null;
let markers = new Map();
let timer = null;
let colors = {};

const REFRESH_MS = 60000;

const nameOf = (row) => row.registry?.battery_number ?? row.live?.batteryNumber ?? row.live?.serialNumber ?? "Unknown battery";
const onlineText = (online) => (online === true ? "Online" : online === false ? "Offline" : "Status unknown");
const timeText = (iso) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos" });

function levelColor(level) {
  return level === "critical" ? colors.danger : level === "warning" ? colors.warn : colors.ok;
}

function render() {
  if (!map) return;
  const wanted = new Set(live.mappable.map((row) => row.key));
  for (const [key, marker] of markers) {
    if (!wanted.has(key)) { marker.remove(); markers.delete(key); }
  }
  for (const row of live.mappable) {
    const latlng = [row.live.lat, row.live.lng];
    const style = { radius: 9, weight: live.selectedKey === row.key ? 4 : 2, color: levelColor(row.level), fillColor: levelColor(row.level), fillOpacity: 0.55 };
    let marker = markers.get(row.key);
    if (marker) { marker.setLatLng(latlng); marker.setStyle(style); }
    else {
      marker = L.circleMarker(latlng, style).addTo(map).on("click", () => choose(row));
      markers.set(row.key, marker);
    }
    marker.bindTooltip(`${nameOf(row)} · ${row.live.soc === null ? '—' : `${row.live.soc}%`}`);
  }
}

function fitAll() {
  if (!map || !live.mappable.length) return;
  map.fitBounds(L.latLngBounds(live.mappable.map((row) => [row.live.lat, row.live.lng])), { padding: [40, 40], maxZoom: 14 });
}

function choose(row) {
  live.select(row.key);
  render();
  if (row.live && row.live.lat !== null && map) map.flyTo([row.live.lat, row.live.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
}

onMounted(async () => {
  const css = getComputedStyle(document.documentElement);
  colors = {
    ok: css.getPropertyValue("--acob-brand-bright").trim() || "#2fb344",
    warn: css.getPropertyValue("--acob-gold").trim() || "#d97706",
    danger: css.getPropertyValue("--danger").trim() || "#dc2626"
  };
  // Default view only: Nigeria. Real markers re-centre the map as soon as there are any.
  map = L.map(mapRoot.value, { center: [9.082, 8.6753], zoom: 6, zoomControl: true });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
  await live.refresh();
  render();
  fitAll();
  timer = setInterval(() => live.refresh(), REFRESH_MS);
});

watch(() => live.rows, render);

onBeforeUnmount(() => {
  clearInterval(timer);
  if (map) { map.remove(); map = null; }
  markers = new Map();
});
</script>
