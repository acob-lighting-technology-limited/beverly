<template>
  <div class="pue-hub" data-testid="pue-hub">
    <header class="pue-hub-bar">
      <a :href="portalUrls.landing" class="pue-hub-brand" title="Beverly">
        <img :src="brandLockup" alt="Beverly" class="pue-hub-lockup" @error="hideImage" />
      </a>
      <button
        type="button"
        class="pue-hub-signout"
        data-testid="btn-pue-hub-signout"
        aria-label="Sign out of Beverly PUE"
        title="Sign out of Beverly PUE"
        @click="signOut"
      >
        Sign out
      </button>
    </header>

    <main class="pue-hub-main">
      <span class="pue-hub-pill">Beverly PUE</span>
      <h1 class="pue-hub-title">Where to?</h1>
      <p class="pue-hub-sub">Signed in as {{ auth.displayName }}</p>

      <div class="pue-hub-grid">
        <button
          v-for="space in workspaces"
          :key="space.key"
          type="button"
          :class="['pue-hub-card', space.available ? 'is-ready' : 'is-unavailable']"
          :disabled="!space.available"
          :aria-disabled="!space.available"
          :aria-label="space.available ? space.title : `${space.title}, not set up yet`"
          :data-testid="`btn-pue-workspace-${space.key}`"
          @click="open(space)"
        >
          <svg class="pue-hub-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path v-for="(d, i) in space.icon" :key="i" :d="d" />
          </svg>
          <span class="pue-hub-card-title">{{ space.shortTitle }}</span>
          <span class="pue-hub-card-note">{{ space.available ? space.description : 'Not set up yet' }}</span>
        </button>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * PUE Hub — first screen after signing in to Beverly PUE.
 * Battery Swap Stations opens the existing swap workspace (/stations).
 * Electronic Appliances has no module or data source yet, so it is shown as
 * not set up instead of linking to an empty or invented page.
 */
import { useRouter } from 'vue-router';
import { useBatterySwapAuthStore } from '../stores/auth';

interface Workspace {
  key: string;
  title: string;
  shortTitle: string;
  description: string;
  /** Route to open; null while the workspace does not exist yet. */
  to: string | null;
  available: boolean;
  icon: string[];
}

const router = useRouter();
const auth = useBatterySwapAuthStore();

const base = import.meta.env.BASE_URL || '/';
/* App.vue owns the theme and mirrors it on <html data-theme>. */
const isLight = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light';
const brandLockup = `${base}brand/${isLight ? 'beverly-lockup.png' : 'beverly-lockup-white.png'}`;
const portalUrls = {
  landing: import.meta.env.DEV ? 'http://localhost:5176/' : '/wallet/',
};

const workspaces: Workspace[] = [
  {
    key: 'battery-swap',
    title: 'Battery Swap Stations',
    shortTitle: 'Battery swap',
    description: 'Sites, bikes, batteries, riders, and sales',
    to: '/sites',
    available: true,
    icon: ['M6 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', 'M21 11v2', 'M8 10v4', 'M12 10v4'],
  },
  {
    key: 'appliances',
    title: 'Electronic Appliances',
    shortTitle: 'Appliances',
    description: 'Not connected to any data yet',
    to: null,
    available: false,
    icon: ['M4 5h16v11H4z', 'M8 20h8', 'M12 16v4'],
  },
];

function open(space: Workspace) {
  if (!space.available || !space.to) return;
  void router.push(space.to);
}

function signOut() {
  auth.logout();
  void router.push('/login');
}

function hideImage(event: Event) {
  const target = event.target as HTMLImageElement | null;
  if (target) target.style.display = 'none';
}
</script>

<style scoped>
.pue-hub {
  flex: 1 1 auto;
  width: 100%;
  min-height: 100vh;
  height: 100vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: var(--acob-bg);
  color: var(--acob-text);
  font-family: var(--acob-font-sans);
}
.pue-hub-bar { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; }
.pue-hub-brand { display: inline-flex; }
.pue-hub-lockup { height: 28px; width: auto; }
.pue-hub-signout {
  padding: 8px 14px;
  border: 1px solid var(--acob-line-strong);
  border-radius: 8px;
  background: transparent;
  color: var(--acob-text);
  font: inherit; font-size: 14px; font-weight: 600;
  cursor: pointer;
}
.pue-hub-signout:hover { background: var(--acob-surface-hover); }
.pue-hub-signout:focus-visible,
.pue-hub-card:focus-visible { outline: 2px solid var(--acob-brand-bright); outline-offset: 3px; }

.pue-hub-main {
  flex: 1;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 8vh 24px 64px;
  box-sizing: border-box;
  text-align: center;
}
.pue-hub-pill {
  display: inline-block;
  padding: 4px 12px;
  border: 1px solid var(--acob-line-strong);
  border-radius: 999px;
  color: var(--acob-brand-bright);
  font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
}
.pue-hub-title { margin: 16px 0 6px; font-size: 40px; font-weight: 800; letter-spacing: -.03em; }
.pue-hub-sub { margin: 0 0 36px; color: var(--acob-muted); font-size: 15px; }

.pue-hub-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.pue-hub-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
  border-radius: 16px;
  background: var(--acob-panel);
  color: var(--acob-text);
  font: inherit;
  transition: border-color .15s ease, transform .15s ease;
}
.pue-hub-card.is-ready { border: 2px solid var(--acob-brand-bright); cursor: pointer; }
.pue-hub-card.is-ready:hover { transform: translateY(-2px); }
.pue-hub-card.is-unavailable { border: 1px dashed var(--acob-line-strong); cursor: not-allowed; }
.pue-hub-icon { width: 32px; height: 32px; color: var(--acob-brand-bright); }
.is-unavailable .pue-hub-icon { color: var(--acob-muted); }
.pue-hub-card-title { font-size: 18px; font-weight: 800; }
.pue-hub-card-note { color: var(--acob-muted); font-size: 13px; line-height: 1.4; }

@media (max-width: 560px) {
  .pue-hub-bar { padding: 12px 16px; }
  .pue-hub-main { padding: 5vh 16px 48px; }
  .pue-hub-title { font-size: 32px; }
  .pue-hub-grid { grid-template-columns: 1fr; }
  .pue-hub-card { padding: 24px 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .pue-hub-card { transition: none; }
  .pue-hub-card.is-ready:hover { transform: none; }
}
</style>
