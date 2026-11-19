<template>
  <div class="battery-swap-app-host" :data-theme="theme" :data-palette="palette">
    <!-- The green field the glass floats over -->
    <div class="ambient" aria-hidden="true"><i /><i /><i /></div>

    <!-- Standalone Login Route View -->
    <div v-if="isLoginRoute" class="stage">
      <router-view />
    </div>

    <!-- Portal layout: floating glass rail, glass section tabs, the shared Beverly account menu -->
    <div v-else class="app">
      <a class="skip" href="#main">Skip to content</a>

      <header class="tbar">
        <div class="br">
          <img class="bmark" :src="theme === 'dark' ? brandMarkDark : brandMarkLight" alt="" width="30" height="30" @error="onImgError" />
          <span class="br-name">Beverly PUE</span>
          <span class="br-crumb" aria-hidden="true">{{ areaLabel }} <i>/</i> {{ pageTitle }}</span>
        </div>
        <AccountMenu />
      </header>

      <nav class="sidebar--battery-swap glass" aria-label="Main">
        <img class="bmark rail-logo" :src="brandMarkDark" alt="Beverly" @error="onImgError" />
        <div class="rail-items">
          <router-link
            v-for="(g, n) in groups"
            :key="g.id"
            class="rail-item"
            :class="{ on: g.id === currentGroupId }"
            :style="{ '--i': n }"
            :to="g.screens[0].to"
            :aria-label="g.label"
            :aria-current="g.id === currentGroupId ? 'page' : undefined"
            :data-tip="g.label"
            :data-testid="`nav-${g.id}`"
          >
            <svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path v-for="(d, i) in g.icon" :key="i" :d="d" /></svg>
            <span class="rail-label">{{ g.label }}</span>
            <i v-if="g.id === 'live' && liveBikesCount" class="rbadge" aria-label="Online">{{ liveBikesCount }}</i>
          </router-link>
        </div>
      </nav>

      <div ref="subnavEl" class="subnav glass-pill" :class="{ on: subnav.length > 1 }" role="navigation" aria-label="Section">
        <span class="lens" :class="{ 'lens--live': lensLive }" :style="lensStyle" aria-hidden="true" />
        <router-link
          v-for="s in subnav"
          :key="s.to"
          :to="s.to"
          :class="{ on: currentPath === s.to }"
          :aria-current="currentPath === s.to ? 'page' : undefined"
          :data-testid="`subnav-${s.key}`"
        >{{ s.label }}</router-link>
      </div>

      <main id="main" class="views" tabindex="-1">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AccountMenu from './shell/AccountMenu.vue';
import { usePueLiveStore } from './stores/pue-live-store.js';
import { useBatterySwapAuthStore } from './stores/auth';
import { SESSION_EXPIRED_EVENT } from './services/pue-api.js';
import { SESSION_REFRESHED_EVENT, startSessionKeeper, stopSessionKeeper } from './lib/session.js';
import { loadTheme, palette, theme } from './lib/theme.js';

const route = useRoute();
const router = useRouter();
const live = usePueLiveStore();
const auth = useBatterySwapAuthStore();

// Full-screen routes without the workspace shell: sign-in pages and the PUE Hub.
const isLoginRoute = computed(() => Boolean(route.meta?.public) || Boolean(route.meta?.standalone) || route.path === '/login' || route.path === '/forgot-password' || route.path === '/reset-password');

// Assets with base path
const base = import.meta.env.BASE_URL || '/';
const brandMarkDark = `${base}brand/beverly-mark-light.png`;
const brandMarkLight = `${base}brand/beverly-mark.png`;

interface Screen { key: string; to: string; label: string }
interface Group { id: string; label: string; area: 'all' | 'battery' | 'appliances'; icon: string[]; screens: Screen[] }

/*
 * The rail holds sections, and a section with more than one screen shows those screens as tabs
 * under the top bar. Registry screens read the Beverly database; Live map and Diagnostics read
 * the battery platform.
 */
const GROUPS: Group[] = [
  { id: 'hub', label: 'Hub', area: 'all', icon: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'], screens: [{ key: 'hub', to: '/hub', label: 'Hub' }] },
  { id: 'dashboard', label: 'Insights', area: 'battery', icon: ['M3 3v18h18', 'M7 15l4-5 3 3 5-7'], screens: [
    { key: 'dashboard', to: '/dashboard', label: 'Dashboard' },
    { key: 'analytics', to: '/analytics', label: 'Analytics' }
  ] },
  { id: 'swaps', label: 'Swaps', area: 'battery', icon: ['M17 1l4 4-4 4', 'M3 11V9a4 4 0 0 1 4-4h14', 'M7 23l-4-4 4-4', 'M21 13v2a4 4 0 0 1-4 4H3'], screens: [{ key: 'swaps', to: '/swaps', label: 'Swaps' }] },
  { id: 'registry', label: 'Registry', area: 'battery', icon: ['M2 7h20v14H2z', 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'], screens: [
    { key: 'sites', to: '/sites', label: 'Sites' },
    { key: 'swap-stations', to: '/swap-stations', label: 'Stations' },
    { key: 'bikes', to: '/bikes', label: 'Bikes' },
    { key: 'batteries', to: '/batteries', label: 'Batteries' },
    { key: 'riders', to: '/riders', label: 'Riders' },
    { key: 'sales', to: '/sales', label: 'Bike sales' }
  ] },
  { id: 'live', label: 'Live', area: 'battery', icon: ['M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z', 'M8 2v16', 'M16 6v16'], screens: [
    { key: 'map', to: '/map', label: 'Live map' },
    { key: 'diagnostics', to: '/diagnostics', label: 'Diagnostics' }
  ] },
  { id: 'appliances', label: 'Insights', area: 'appliances', icon: ['M3 3v18h18', 'M7 15l4-5 3 3 5-7'], screens: [
    { key: 'appliances', to: '/appliances', label: 'Dashboard' },
    { key: 'appliance-analytics', to: '/appliance-analytics', label: 'Analytics' }
  ] },
  { id: 'stock', label: 'Stock', area: 'appliances', icon: ['M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'], screens: [
    { key: 'appliance-types', to: '/appliance-types', label: 'Catalogue' },
    { key: 'appliance-units', to: '/appliance-units', label: 'Units' }
  ] },
  { id: 'appliance-sales', label: 'Sales', area: 'appliances', icon: ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'], screens: [{ key: 'appliance-sales', to: '/appliance-sales', label: 'Sales' }] },
  { id: 'service', label: 'Service', area: 'appliances', icon: ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'], screens: [{ key: 'appliance-faults', to: '/appliance-faults', label: 'Faults' }] }
];

// Hub is always shown; the rest follows the workspace being used (battery swap or appliances).
const currentArea = computed(() => String(route.meta?.area || 'battery'));
const groups = computed(() => GROUPS.filter((g) => g.area === 'all' || g.area === currentArea.value));
const currentPath = computed(() => route.path);
const currentGroupId = computed(() => GROUPS.find((g) => g.screens.some((s) => s.to === currentPath.value))?.id);
const subnav = computed(() => GROUPS.find((g) => g.id === currentGroupId.value)?.screens ?? []);
const liveBikesCount = computed(() => live.counts.online);
const areaLabel = computed(() => (currentArea.value === 'appliances' ? 'Appliances' : 'Battery swap'));
const pageTitle = computed(() => String(route.meta?.title || 'Beverly PUE'));

/* The sliding lens under the active section tab. */
const subnavEl = ref<HTMLElement | null>(null);
const lensStyle = ref<Record<string, string>>({ opacity: '0' });
// The lens only glides once it has been placed: the first placement snaps, so it never swims in from the corner on load.
const lensLive = ref(false);
function placeLens() {
  const active = subnavEl.value?.querySelector<HTMLElement>('a.on');
  if (!active || !active.offsetWidth) { lensStyle.value = { opacity: '0' }; return; }
  lensStyle.value = { opacity: '1', width: `${active.offsetWidth}px`, transform: `translateX(${active.offsetLeft}px)` };
  // On a narrow screen the tab row scrolls: keep the active tab centred in view.
  const box = subnavEl.value as HTMLElement;
  if (box.scrollWidth > box.clientWidth) box.scrollTo({ left: active.offsetLeft - (box.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' });
}
watch([currentPath, subnav], () => void nextTick(placeLens));

function onSessionRefreshed(event: Event) {
  const detail = (event as CustomEvent).detail as { accessToken: string; user: Record<string, unknown> | null };
  auth.applyRefreshed(detail.accessToken, detail.user as never);
}

function onSessionExpired() {
  stopSessionKeeper();
  if (route.path === '/login') return;
  auth.logout();
  auth.sessionExpired = true;
  void router.push({ path: '/login', query: { expired: '1', redirect: route.fullPath } });
}

/* Alt+1..9 jumps to a section. */
function onKey(event: KeyboardEvent) {
  if (event.altKey && /^[1-9]$/.test(event.key)) {
    const target = groups.value[Number(event.key) - 1];
    if (target) { event.preventDefault(); void router.push(target.screens[0].to); }
  }
}

function onImgError(e: Event) {
  const target = e.target as HTMLImageElement;
  if (target) target.style.display = 'none';
}

onBeforeUnmount(() => {
  window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  window.removeEventListener(SESSION_REFRESHED_EVENT, onSessionRefreshed);
  stopSessionKeeper();
  window.removeEventListener('resize', placeLens);
  document.removeEventListener('keydown', onKey);
});

onMounted(() => {
  window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  window.addEventListener(SESSION_REFRESHED_EVENT, onSessionRefreshed);
  window.addEventListener('resize', placeLens);
  document.addEventListener('keydown', onKey);
  auth.hydrate();
  if (auth.isAuthenticated) startSessionKeeper();
  loadTheme();
  void nextTick(placeLens);
  document.fonts?.ready?.then(placeLens);
  window.setTimeout(() => { lensLive.value = true; }, 600);
});
</script>

<style>
@import './styles/acob-battery-swap-tokens.css';
@import './styles/glass.css';
@import './styles/dashboard.css';

html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: var(--acob-font-sans);
  background: var(--acob-field-base);
  color: var(--acob-text);
  -webkit-font-smoothing: antialiased;
}

.battery-swap-app-host {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--acob-field-base);
  color: var(--acob-text);
  font-family: var(--acob-font-sans);
}
.stage { position: relative; z-index: 1; height: 100%; overflow-y: auto; }

/* ═══ Shell. Mobile first: top bar, section tabs, content, glass bar at the bottom ═══ */
.app { position: relative; z-index: 1; height: 100dvh; display: flex; flex-direction: column; padding-top: env(safe-area-inset-top, 0px); }
.tbar { order: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; flex: none; position: relative; z-index: 30; }
.subnav { order: 1; }
.views { order: 2; flex: 1; min-height: 0; position: relative; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; }
.sidebar--battery-swap { order: 3; }
.skip { position: absolute; left: 8px; top: -48px; z-index: 100; background: var(--acob-nav-dark); color: var(--acob-menu-bg); padding: 8px 14px; border-radius: 99px; }
.skip:focus { top: 8px; }

.br { display: flex; align-items: center; gap: 10px; min-width: 0; white-space: nowrap; }
.bmark { display: block; object-fit: contain; }
.br .bmark { width: 30px; height: 30px; }
.br-name { font-size: 20px; font-weight: 700; letter-spacing: -.02em; }
.br-crumb { display: none; color: var(--acob-muted); font-size: 14px; font-weight: 500; }
.br-crumb i { font-style: normal; opacity: .5; padding: 0 4px; }

.i { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; flex: none; }

/* Bottom glass bar (mobile) */
.sidebar--battery-swap {
  display: flex; flex: none; gap: 2px; padding: 5px; margin: 6px 10px calc(10px + env(safe-area-inset-bottom, 0px));
  border-radius: 26px; z-index: 12;
}
.rail-logo { display: none; }
.rail-items { display: flex; flex: 1; min-width: 0; gap: inherit; flex-direction: inherit; overflow-x: auto; scrollbar-width: none; }
.rail-items::-webkit-scrollbar { display: none; }
.rail-item {
  position: relative; flex: 1 0 60px; height: 48px; display: grid; place-items: center; align-content: center; gap: 1px;
  border-radius: 26px; color: var(--acob-muted); text-decoration: none;
  transition: background .2s ease, color .2s ease, box-shadow .25s ease;
}
.rail-label { font-size: 12px; line-height: 1.1; font-weight: 600; }
.rail-item.on {
  color: var(--on-gel);
  background: var(--gel-mid);
  box-shadow: none;
}
.rbadge { position: absolute; top: 3px; right: 6px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 99px; background: var(--on-gel); color: var(--gel-mid); font: 700 11px/16px var(--acob-font-sans); text-align: center; font-style: normal; }

/* Section tabs: a glass capsule with a lens that slides to the active tab */
.subnav { display: none; position: relative; gap: 2px; margin: 2px 12px 8px; padding: 4px; flex: none; z-index: 11; overflow-x: auto; scrollbar-width: none; border-radius: 999px; }
.subnav::-webkit-scrollbar { display: none; }
.subnav.on { display: flex; }
.subnav a { position: relative; z-index: 1; flex: 1 0 auto; display: grid; place-items: center; height: 36px; padding: 0 16px; border-radius: 99px; color: var(--acob-soft); text-decoration: none; font-size: 13px; font-weight: 600; white-space: nowrap; transition: color .2s ease; }
.subnav a.on { color: var(--on-gel); }
.lens {
  position: absolute; z-index: 0; left: 0; top: 4px; bottom: 4px; width: 0; border-radius: 99px; pointer-events: none;
  background: var(--gel-mid);
  box-shadow: none;
  transition: opacity .2s ease;
}
.lens--live { transition: transform .5s cubic-bezier(.16, 1, .3, 1), width .5s cubic-bezier(.16, 1, .3, 1), opacity .2s ease; }

/* Desktop: a floating glass rail on the left with round beads */
@media (min-width: 640px) {
  .app { display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto auto auto minmax(0, 1fr); }
  .sidebar--battery-swap {
    grid-column: 1; grid-row: 1 / 5; align-self: center; flex-direction: column; justify-content: flex-start;
    width: 68px; margin: 0 0 0 16px; padding: 14px 10px 12px; gap: 10px; border-radius: 34px;
  }
  .rail-logo { display: block; width: 36px; height: 36px; margin: 2px auto 6px; }
  .rail-items { flex-direction: column; flex: 0 0 auto; overflow: visible; }
  .rail-item { flex: none; width: 48px; height: 48px; margin: 0 auto; border-radius: 50%; transition: background .2s ease, color .2s ease, box-shadow .25s ease, transform .4s cubic-bezier(.16, 1, .3, 1); }
  .rail-item:hover { background: var(--lg-fill-strong); color: var(--acob-text); transform: scale(1.1); }
  .rail-item.on, .rail-item.on:hover { color: var(--on-gel); transform: none; }
  .rail-label { position: absolute; left: calc(100% + 16px); top: 50%; z-index: 50; transform: translate(-6px, -50%); padding: 7px 12px; border-radius: 99px; white-space: nowrap; font-size: 12px; color: var(--acob-text); background: var(--lg-fill-strong); border: 1px solid var(--lg-border); box-shadow: var(--lg-shadow); -webkit-backdrop-filter: var(--lg-blur); backdrop-filter: var(--lg-blur); opacity: 0; pointer-events: none; transition: opacity .15s ease, transform .2s ease; }
  .rail-item:hover .rail-label, .rail-item:focus-visible .rail-label { opacity: 1; transform: translate(0, -50%); }
  .rbadge { top: -4px; right: -4px; }
  .tbar { grid-column: 2; grid-row: 1; padding: 10px 24px 6px 18px; }
  .subnav { grid-column: 2; grid-row: 3; justify-self: start; max-width: calc(100% - 42px); margin: 2px 24px 8px 18px; }
  .views { grid-column: 2; grid-row: 4; }
}
@media (min-width: 900px) { .br-crumb { display: inline; } }
@media (prefers-reduced-motion: reduce) {
  .rail-item, .rail-label, .lens, .subnav a { transition: none; }
}
</style>
