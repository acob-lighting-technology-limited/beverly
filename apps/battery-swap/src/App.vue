<template>
  <div class="battery-swap-app-host" :data-theme="theme">
    <!-- Standalone Login Route View -->
    <template v-if="isLoginRoute">
      <router-view />
    </template>

    <!-- Standalone Portal Layout -->
    <template v-else>
      <!-- ── Mobile Overlay ────────────────────────────────────── -->
      <div
        v-if="mobileSidebarOpen"
        class="bsv-mobile-backdrop"
        @click="mobileSidebarOpen = false"
      />

      <!-- ── Detached Standalone Sidebar ────────────────────────── -->
      <aside
        class="sidebar--battery-swap"
        :class="{
          'sidebar--collapsed': collapsed,
          'sidebar--mobile-open': mobileSidebarOpen
        }"
        aria-label="Battery Swap Navigation"
      >
        <!-- Sidebar Brand Lockup -->
        <div class="bsv-sidebar-brand">
          <a :href="portalUrls.landing" class="bsv-brand-link" title="Beverly Power Ecosystem">
            <img
              v-if="!collapsed"
              :src="theme === 'dark' ? brandLockupDark : brandLockupLight"
              alt="Beverly"
              class="bsv-brand-img bsv-brand-lockup"
              @error="onImgError"
            />
            <img
              v-else
              :src="theme === 'dark' ? brandMarkDark : brandMarkLight"
              alt="Beverly"
              class="bsv-brand-img bsv-brand-mark"
              @error="onImgError"
            />
          </a>
          <div v-if="!collapsed" class="bsv-brand-meta">
            <span class="bsv-brand-tag">BATTERY SWAP PORTAL</span>
            <span class="bsv-brand-pill">
              <span class="bsv-live-dot" /> LIVE GPRS
            </span>
          </div>
        </div>

      <!-- Navigation Links -->
      <nav class="bsv-nav-scroller">
        <div class="bsv-nav-section">
          <span v-if="!collapsed" class="bsv-section-heading">OPERATIONS</span>
          <ul class="bsv-nav-list">
            <li>
              <router-link
                to="/map"
                class="bsv-nav-item"
                :class="{ 'bsv-nav-item--active': currentPath === '/map' }"
                @click="mobileSidebarOpen = false"
              >
                <span class="bsv-nav-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
                    <line x1="8" y1="2" x2="8" y2="18"/>
                    <line x1="16" y1="6" x2="16" y2="22"/>
                  </svg>
                </span>
                <span v-if="!collapsed" class="bsv-nav-label">Live GPS Tracker</span>
                <span v-if="!collapsed && liveBikesCount" class="bsv-nav-badge">{{ liveBikesCount }}</span>
              </router-link>
            </li>
            <li>
              <router-link
                to="/fleet"
                class="bsv-nav-item"
                :class="{ 'bsv-nav-item--active': currentPath === '/fleet' }"
                @click="mobileSidebarOpen = false"
              >
                <span class="bsv-nav-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="5.5" cy="17.5" r="3.5"/>
                    <circle cx="18.5" cy="17.5" r="3.5"/>
                    <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 9l3-4h3l2 4"/>
                    <path d="M19 17.5V14l-4-4"/>
                  </svg>
                </span>
                <span v-if="!collapsed" class="bsv-nav-label">Fleet Registry</span>
              </router-link>
            </li>
            <li>
              <router-link
                to="/crm"
                class="bsv-nav-item"
                :class="{ 'bsv-nav-item--active': currentPath === '/crm' }"
                @click="mobileSidebarOpen = false"
              >
                <span class="bsv-nav-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </span>
                <span v-if="!collapsed" class="bsv-nav-label">Rider Lease CRM</span>
              </router-link>
            </li>
          </ul>
        </div>

        <div class="bsv-nav-section">
          <span v-if="!collapsed" class="bsv-section-heading">INFRASTRUCTURE</span>
          <ul class="bsv-nav-list">
            <li>
              <router-link
                to="/stations"
                class="bsv-nav-item"
                :class="{ 'bsv-nav-item--active': currentPath === '/stations' }"
                @click="mobileSidebarOpen = false"
              >
                <span class="bsv-nav-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                </span>
                <span v-if="!collapsed" class="bsv-nav-label">Swap Stations</span>
                <span v-if="!collapsed" class="bsv-nav-badge bsv-nav-badge--accent">12 Bays</span>
              </router-link>
            </li>
            <li>
              <router-link
                to="/diagnostics"
                class="bsv-nav-item"
                :class="{ 'bsv-nav-item--active': currentPath === '/diagnostics' }"
                @click="mobileSidebarOpen = false"
              >
                <span class="bsv-nav-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                </span>
                <span v-if="!collapsed" class="bsv-nav-label">Diagnostics Lab</span>
              </router-link>
            </li>
          </ul>
        </div>
      </nav>

      <!-- Sidebar Footer -->
      <div class="bsv-sidebar-footer">
        <button
          class="bsv-collapse-btn"
          :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="collapsed = !collapsed"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polyline v-if="collapsed" points="9 18 15 12 9 6" />
            <polyline v-else points="15 18 9 12 15 6" />
          </svg>
          <span v-if="!collapsed" class="bsv-collapse-text">Collapse Menu</span>
        </button>
      </div>
    </aside>

    <!-- ── Main Workspace ─────────────────────────────────────── -->
    <div class="bsv-workspace">
      <!-- Portal Top Header -->
      <header class="bsv-header">
        <div class="bsv-header-left">
          <button
            class="bsv-hamburger-btn"
            aria-label="Toggle navigation"
            @click="mobileSidebarOpen = !mobileSidebarOpen"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div class="bsv-header-title-wrap">
            <h2 class="bsv-header-page-title">{{ currentRouteTitle }}</h2>
          </div>
        </div>

        <div class="bsv-header-right">
          <!-- Theme Toggle Button -->
          <button
            class="bsv-icon-btn"
            :title="theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'"
            @click="toggleTheme"
          >
            <svg v-if="theme === 'dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>

          <!-- User Profile Chip with Logout -->
          <div class="bsv-user-chip" :title="`Signed in as ${auth.displayName}`">
            <div class="bsv-avatar">{{ auth.userInitials }}</div>
            <div class="bsv-user-info">
              <span class="bsv-user-name">{{ auth.displayName }}</span>
              <span class="bsv-user-role">{{ auth.roleLabel }}</span>
            </div>
            <button
              class="bsv-logout-btn"
              title="Sign Out of Battery Swap"
              @click="handleLogout"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <!-- Viewport Router Host -->
      <main class="bsv-content-host">
        <router-view />
      </main>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBatteryFleetStore } from './stores/battery-fleet-store.js';
import { useBatterySwapAuthStore } from './stores/auth';

const route = useRoute();
const router = useRouter();
const fleetStore = useBatteryFleetStore();
const auth = useBatterySwapAuthStore();

const isLoginRoute = computed(() => Boolean(route.meta?.public) || route.path === '/login' || route.path === '/forgot-password' || route.path === '/reset-password');

// Assets with base path
const base = import.meta.env.BASE_URL || '/';
const brandLockupDark = `${base}brand/beverly-lockup-white.png`;
const brandLockupLight = `${base}brand/beverly-lockup.png`;
const brandMarkDark = `${base}brand/beverly-mark-light.png`;
const brandMarkLight = `${base}brand/beverly-mark.png`;

const collapsed = ref(false);
const mobileSidebarOpen = ref(false);
const theme = ref<'dark' | 'light'>('dark');

const currentPath = computed(() => route.path);
const currentRouteTitle = computed(() => String(route.meta?.title || 'Battery Swap Operations'));
const liveBikesCount = computed(() => fleetStore.onlineBikesCount || 0);

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme.value;
  try {
    localStorage.setItem('beverly.batterySwap.theme', theme.value);
  } catch {}
}

function handleLogout() {
  auth.logout();
  router.push('/login');
}

function onImgError(e: Event) {
  const target = e.target as HTMLImageElement;
  if (target) target.style.display = 'none';
}

onMounted(() => {
  auth.hydrate();
  try {
    const saved = localStorage.getItem('beverly.batterySwap.theme');
    if (saved === 'light' || saved === 'dark') {
      theme.value = saved;
    }
  } catch {}
  document.documentElement.dataset.theme = theme.value;

  // Initial live telemetry sync
  fleetStore.syncLiveYunheTelemetry();
});
</script>

<style>
@import './styles/acob-battery-swap-tokens.css';

/* Standalone Portal App Frame */
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: var(--acob-font-sans);
  background: var(--acob-bg);
  color: var(--acob-text);
}

.battery-swap-app-host {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--acob-bg);
  color: var(--acob-text);
}

/* Sidebar styling for Standalone App */
.sidebar--battery-swap {
  width: 260px;
  min-width: 260px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--acob-sidebar-bg, #07130c) !important;
  border-right: 1px solid var(--acob-sidebar-border, rgba(125, 252, 154, 0.14)) !important;
  box-shadow: 1px 0 0 rgba(255, 255, 255, 0.05), 12px 0 32px rgba(0, 0, 0, 0.35);
  transition: width 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s ease;
  z-index: 100;
  position: relative;
  flex-shrink: 0;
}

.sidebar--battery-swap.sidebar--collapsed {
  width: 72px;
  min-width: 72px;
}

.bsv-sidebar-brand {
  padding: 1.25rem 1.125rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-bottom: 1px solid var(--acob-sidebar-border);
}

.bsv-brand-link {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}

.bsv-brand-img {
  height: 28px;
  max-width: 100%;
  object-fit: contain;
}

.bsv-brand-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.bsv-brand-tag {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--acob-brand-mint);
  text-transform: uppercase;
}

.bsv-brand-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0.45rem;
  border-radius: 9999px;
  background: rgba(125, 252, 154, 0.12);
  border: 1px solid rgba(125, 252, 154, 0.3);
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--acob-brand-mint);
}

.bsv-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--acob-brand-mint);
  box-shadow: 0 0 6px var(--acob-brand-mint);
  animation: pulse-dot 1.8s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.bsv-nav-scroller {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.bsv-section-heading {
  display: block;
  padding: 0 0.5rem 0.5rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--acob-sidebar-muted);
}

.bsv-nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.bsv-nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--acob-radius-md);
  color: var(--acob-sidebar-text);
  text-decoration: none;
  font-size: 0.84rem;
  font-weight: 500;
  transition: all 0.15s ease;
  border-left: 3px solid transparent;
}

.bsv-nav-item:hover {
  background: var(--acob-sidebar-hover);
  color: var(--acob-text);
}

.bsv-nav-item--active {
  background: var(--acob-sidebar-active);
  color: var(--acob-brand-mint) !important;
  font-weight: 600;
  border-left-color: var(--acob-brand);
}

.bsv-nav-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.bsv-nav-icon svg {
  width: 18px;
  height: 18px;
}

.bsv-nav-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bsv-nav-badge {
  padding: 0.15rem 0.45rem;
  border-radius: 9999px;
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(125, 252, 154, 0.15);
  color: var(--acob-brand-mint);
}

.bsv-nav-badge--accent {
  background: rgba(184, 134, 46, 0.15);
  color: var(--acob-gold);
}

/* Sidebar Footer */
.bsv-sidebar-footer {
  padding: 0.75rem;
  border-top: 1px solid var(--acob-sidebar-border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
}

.bsv-collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.45rem;
  background: transparent;
  border: 1px solid var(--acob-sidebar-border);
  border-radius: var(--acob-radius-sm);
  color: var(--acob-sidebar-muted);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.bsv-collapse-btn:hover {
  color: var(--acob-text);
  border-color: var(--acob-sidebar-text);
}

/* Workspace Frame */
.bsv-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background: var(--acob-bg);
}

/* Header */
.bsv-header {
  height: 60px;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  background: var(--acob-card-bg);
  border-bottom: 1px solid var(--acob-border);
  gap: 1rem;
}

.bsv-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.bsv-hamburger-btn {
  display: none;
  background: transparent;
  border: none;
  color: var(--acob-text);
  cursor: pointer;
  padding: 0.35rem;
}

.bsv-header-title-wrap {
  display: flex;
  flex-direction: column;
}

.bsv-portal-badge {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--acob-brand-mint);
}

.bsv-header-page-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--acob-text);
}

.bsv-header-center {
  display: flex;
  align-items: center;
}

.bsv-telemetry-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.75rem;
  background: rgba(125, 252, 154, 0.08);
  border: 1px solid rgba(125, 252, 154, 0.25);
  border-radius: 9999px;
  font-size: 0.76rem;
}

.bsv-chip-pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--acob-brand-mint);
  box-shadow: 0 0 8px var(--acob-brand-mint);
  animation: pulse-dot 1.5s infinite;
}

.bsv-chip-label {
  color: var(--acob-text-muted);
}

.bsv-chip-status {
  color: var(--acob-brand-mint);
  font-weight: 700;
}

.bsv-chip-latency {
  color: var(--acob-text-dim);
  font-size: 0.7rem;
}

.bsv-header-right {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.bsv-header-kpis {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.bsv-hkpi {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 0.2rem 0.5rem;
  border-radius: var(--acob-radius-sm);
  background: var(--acob-surface);
  border: 1px solid var(--acob-border);
}

.bsv-hkpi-val {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--acob-text);
  line-height: 1;
}

.bsv-hkpi-lbl {
  font-size: 0.6rem;
  color: var(--acob-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bsv-hkpi--green .bsv-hkpi-val { color: var(--acob-brand-mint); }
.bsv-hkpi--amber .bsv-hkpi-val { color: var(--acob-gold); }

.bsv-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--acob-radius-md);
  background: var(--acob-surface);
  border: 1px solid var(--acob-border);
  color: var(--acob-text);
  cursor: pointer;
  transition: all 0.15s;
}

.bsv-icon-btn:hover {
  background: var(--acob-hover);
  border-color: var(--acob-brand-mint);
}

.bsv-user-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.6rem 0.25rem 0.25rem;
  border-radius: 9999px;
  background: var(--acob-surface);
  border: 1px solid var(--acob-border);
}

.bsv-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--acob-brand);
  color: #fff;
  font-weight: 700;
  font-size: 0.72rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bsv-user-info {
  display: flex;
  flex-direction: column;
}

.bsv-user-name {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--acob-text);
  line-height: 1.1;
}

.bsv-user-role {
  font-size: 0.62rem;
  color: var(--acob-text-muted);
}

.bsv-logout-btn {
  background: none;
  border: none;
  color: var(--acob-muted, rgba(242, 247, 243, 0.6));
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s ease;
  margin-left: 2px;
}

.bsv-logout-btn:hover {
  color: var(--color-danger, #ef4444);
  background: rgba(239, 68, 68, 0.12);
}

/* Content Viewport */
.bsv-content-host {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
}

/* Responsive adjustments */
@media (max-width: 900px) {
  .bsv-hamburger-btn { display: flex; }
  .bsv-header-center { display: none; }
  .sidebar--battery-swap {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 1000 !important;
    background: var(--acob-sidebar-bg, #07130c) !important;
    box-shadow: 12px 0 40px rgba(0, 0, 0, 0.85);
    transform: translateX(-100%);
  }
  .sidebar--battery-swap.sidebar--mobile-open {
    transform: translateX(0);
  }
  .bsv-mobile-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 999;
  }
}
</style>
