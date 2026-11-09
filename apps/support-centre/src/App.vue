<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSupportCentreStore } from './stores/support-centre';
import type { StaffPresence } from './types';
import IncomingCallBanner from './components/IncomingCallBanner.vue';

const store = useSupportCentreStore();
const route = useRoute();
const router = useRouter();

const showPresenceMenu = ref(false);
const searchBarInput = ref('');

const presenceOptions: { label: string; value: StaffPresence; color: string }[] = [
  { label: 'Available', value: 'available', color: 'var(--brand)' },
  { label: 'On Call', value: 'on_call', color: 'var(--blue)' },
  { label: 'Wrap-Up', value: 'wrap_up', color: 'var(--amber)' },
  { label: 'Away / Break', value: 'away', color: 'var(--muted)' },
];

function selectPresence(val: StaffPresence) {
  store.setPresence(val);
  showPresenceMenu.value = false;
}

function handleGlobalSearch() {
  if (!searchBarInput.value.trim()) return;
  router.push('/customers');
}

onMounted(() => {
  store.startTimers();
});

onBeforeUnmount(() => {
  store.stopTimers();
});
</script>

<template>
  <div class="app-layout">
    <!-- Incoming Call Screen-Pop (Africa's Talking DID) -->
    <IncomingCallBanner />

    <!-- Sidebar Navigation -->
    <aside class="sidebar">
      <div class="brand">
        <b class="brand-name">Beverly</b>
        <span class="brand-divider"></span>
        <em class="brand-sub">Support Centre</em>
      </div>

      <div class="workspace-label">Support operations</div>

      <nav class="nav">
        <router-link to="/live-desk" class="nav-item" :class="{ active: route.name === 'live-desk' }">
          <svg viewBox="0 0 24 24" class="nav-icon">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <span>Live Desk</span>
          <span v-if="store.activeCall" class="live-pill">LIVE</span>
        </router-link>

        <router-link to="/queue" class="nav-item" :class="{ active: route.name === 'queue' }">
          <svg viewBox="0 0 24 24" class="nav-icon">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <span>Queue</span>
          <span class="count-pill">{{ store.queue.length }}</span>
        </router-link>

        <router-link to="/cases" class="nav-item" :class="{ active: route.name === 'cases' }">
          <svg viewBox="0 0 24 24" class="nav-icon">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span>Cases</span>
          <span class="count-pill">{{ store.cases.length }}</span>
        </router-link>

        <router-link to="/customers" class="nav-item" :class="{ active: route.name === 'customers' }">
          <svg viewBox="0 0 24 24" class="nav-icon">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span>Customer 360</span>
        </router-link>

        <router-link to="/incidents" class="nav-item" :class="{ active: route.name === 'incidents' }">
          <svg viewBox="0 0 24 24" class="nav-icon">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>Incidents</span>
          <span v-if="store.incidents.some(i => i.status !== 'resolved')" class="alert-dot"></span>
        </router-link>

        <router-link to="/quality" class="nav-item" :class="{ active: route.name === 'quality' }">
          <svg viewBox="0 0 24 24" class="nav-icon">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span>Quality</span>
        </router-link>

        <router-link to="/analytics" class="nav-item" :class="{ active: route.name === 'analytics' }">
          <svg viewBox="0 0 24 24" class="nav-icon">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span>Analytics</span>
        </router-link>
      </nav>

      <div class="sidebar-bottom">
        <div class="profile-card">
          <div class="avatar">{{ store.agent.avatar }}</div>
          <div class="profile-meta">
            <strong>{{ store.agent.name }}</strong>
            <small>{{ store.agent.role }} · {{ store.agent.location }}</small>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="main">
      <header class="topbar">
        <div class="crumb">
          Beverly Support Centre
          <small>Nigeria Operations Hub</small>
        </div>

        <div class="search-bar">
          <svg viewBox="0 0 24 24" class="search-icon">
            <circle cx="11" cy="11" r="7"/>
            <path d="m20 20-4-4"/>
          </svg>
          <input
            v-model="searchBarInput"
            type="text"
            placeholder="Search customer, meter, case or phone number..."
            @keyup.enter="handleGlobalSearch"
          />
          <kbd>Ctrl K</kbd>
        </div>

        <div class="top-actions">
          <div class="presence-container">
            <button class="presence-btn" @click="showPresenceMenu = !showPresenceMenu">
              <i class="presence-indicator" :class="store.presence"></i>
              <span>{{ store.presence.replace('_', ' ').toUpperCase() }}</span>
              <span class="presence-caret">▾</span>
            </button>

            <div v-if="showPresenceMenu" class="presence-dropdown">
              <button
                v-for="p in presenceOptions"
                :key="p.value"
                @click="selectPresence(p.value)"
              >
                <i class="presence-indicator" :class="p.value"></i>
                {{ p.label }}
              </button>
            </div>
          </div>

          <div class="avatar">{{ store.agent.avatar }}</div>
        </div>
      </header>

      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: grid;
  grid-template-columns: 252px 1fr;
  min-height: 100vh;
}

@media (max-width: 768px) {
  .app-layout {
    grid-template-columns: 1fr;
  }
  .sidebar {
    display: none;
  }
}

.sidebar {
  background: #ffffff;
  border-right: 1px solid var(--line);
  padding: 0 12px;
  display: flex;
  flex-direction: column;
}

.brand {
  height: 80px;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
}

.brand-name {
  font-size: 24px;
  letter-spacing: -1.2px;
  color: var(--brand-deep);
}

.brand-divider {
  height: 20px;
  width: 1px;
  background: var(--line-strong);
}

.brand-sub {
  font-style: normal;
  color: var(--ink);
  font-size: 13px;
  font-weight: 700;
}

.workspace-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  margin: 22px 10px 8px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  height: 40px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 10px;
  color: var(--text);
  font-weight: 600;
  text-decoration: none;
  border-radius: 7px;
  transition: all 0.15s ease;
}

.nav-icon {
  width: 17px;
  height: 17px;
  stroke: currentColor;
  stroke-width: 1.8;
  fill: none;
  flex-shrink: 0;
}

.nav-item.active {
  background: linear-gradient(90deg, var(--brand-soft), oklch(70% 0.19 145 / 0.04));
  color: var(--brand-deep);
  box-shadow: inset 3px 0 0 var(--brand);
}

.nav-item:hover:not(.active) {
  background: oklch(70% 0.19 145 / 0.07);
}

.live-pill {
  margin-left: auto;
  font-size: 9px;
  font-weight: 800;
  background: var(--blue-soft);
  color: var(--blue);
  padding: 2px 6px;
  border-radius: 4px;
}

.count-pill {
  margin-left: auto;
  font: 700 11px var(--mono);
  color: var(--muted);
}

.alert-dot {
  margin-left: auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--red);
}

.sidebar-bottom {
  margin-top: auto;
  border-top: 1px solid var(--line);
  padding: 16px 8px 20px;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--brand-soft);
  color: var(--brand-deep);
  font-size: 11px;
  font-weight: 800;
}

.profile-meta strong {
  font-size: 12px;
  color: var(--ink);
  display: block;
}

.profile-meta small {
  color: var(--muted);
  font-size: 11px;
}

.main {
  min-width: 0;
  background: var(--canvas);
}

.topbar {
  height: 80px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  padding: 0 30px;
  gap: 18px;
}

.crumb {
  font-weight: 700;
  color: var(--ink);
  font-size: 14px;
  min-width: 160px;
}

.crumb small {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
}

.search-bar {
  height: 38px;
  max-width: 480px;
  flex: 1;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 11px;
}

.search-icon {
  width: 16px;
  height: 16px;
  stroke: var(--muted);
  fill: none;
}

.search-bar input {
  border: none;
  background: none;
  outline: none;
  font-size: 12px;
  flex: 1;
  color: var(--ink);
}

.search-bar kbd {
  padding: 2px 5px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--canvas);
  font: 10px var(--mono);
  color: var(--muted);
}

.top-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.presence-container {
  position: relative;
}

.presence-btn {
  height: 36px;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 11px;
  color: var(--ink);
  font-weight: 700;
  font-size: 11px;
  cursor: pointer;
}

.presence-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.presence-indicator.available {
  background: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.presence-indicator.on_call {
  background: var(--blue);
  box-shadow: 0 0 0 3px var(--blue-soft);
}

.presence-indicator.wrap_up {
  background: var(--amber);
  box-shadow: 0 0 0 3px var(--amber-soft);
}

.presence-indicator.away {
  background: var(--muted);
}

.presence-caret {
  font-size: 10px;
  color: var(--muted);
}

.presence-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #ffffff;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  box-shadow: var(--shadow);
  z-index: 1000;
  min-width: 140px;
  padding: 4px 0;
}

.presence-dropdown button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: none;
  border: none;
  font-size: 12px;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
}

.presence-dropdown button:hover {
  background: var(--card-subtle);
}
</style>
