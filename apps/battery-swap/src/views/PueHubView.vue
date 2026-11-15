<template>
  <div class="pue-hub" data-testid="pue-hub">
    <header class="pue-hub-bar">
      <a :href="portalUrls.landing" class="pue-hub-brand" title="Beverly">
        <img :src="brandLockup" alt="Beverly" class="pue-hub-lockup" @error="hideImage" />
        <span class="pue-hub-tag">PUE</span>
      </a>
      <div class="pue-hub-user">
        <span class="pue-hub-avatar" aria-hidden="true">{{ auth.userInitials }}</span>
        <span class="pue-hub-name">{{ auth.displayName }}</span>
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
      </div>
    </header>

    <main class="pue-hub-main">
      <p class="pue-hub-overline">Beverly PUE</p>
      <h1 class="pue-hub-title">Choose a workspace</h1>
      <p class="pue-hub-sub">Productive Use of Energy operations. Pick where you want to work.</p>

      <div class="pue-hub-grid">
        <button
          v-for="space in workspaces"
          :key="space.key"
          type="button"
          :class="['pue-hub-card', !space.available && 'is-unavailable']"
          :disabled="!space.available"
          :aria-disabled="!space.available"
          :data-testid="`btn-pue-workspace-${space.key}`"
          @click="open(space)"
        >
          <span class="pue-hub-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path v-for="(d, i) in space.icon" :key="i" :d="d" />
            </svg>
          </span>
          <span class="pue-hub-card-title">{{ space.title }}</span>
          <span class="pue-hub-card-desc">{{ space.description }}</span>
          <span :class="['pue-hub-status', space.available ? 'is-ready' : 'is-pending']">
            {{ space.available ? 'Open workspace' : 'Not set up yet' }}
          </span>
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
    description: 'Swap stations and racks, bike and battery fleet, rider leases, live GPS, and battery diagnostics.',
    to: '/stations',
    available: true,
    icon: ['M6 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', 'M21 11v2', 'M8 10v4', 'M12 10v4'],
  },
  {
    key: 'appliances',
    title: 'Electronic Appliances',
    description: 'PUE electronic appliances. This workspace is not connected to any data yet.',
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
  /* App host is a flex row; take the full width. */
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
.pue-hub-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--acob-line);
}
.pue-hub-brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; }
.pue-hub-lockup { height: 28px; width: auto; }
.pue-hub-tag {
  padding: 2px 8px;
  border: 1px solid var(--acob-line-strong);
  border-radius: 999px;
  color: var(--acob-brand-bright);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .08em;
}
.pue-hub-user { display: flex; align-items: center; gap: 10px; min-width: 0; }
.pue-hub-avatar {
  width: 32px; height: 32px; flex: none;
  display: grid; place-items: center;
  border-radius: 50%;
  background: var(--acob-chip);
  color: var(--acob-text);
  font-size: 12px; font-weight: 800;
}
.pue-hub-name { color: var(--acob-muted); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pue-hub-signout {
  padding: 6px 12px;
  border: 1px solid var(--acob-line-strong);
  border-radius: 8px;
  background: transparent;
  color: var(--acob-text);
  font: inherit; font-size: 13px; font-weight: 600;
  cursor: pointer;
}
.pue-hub-signout:hover { background: var(--acob-surface-hover); }
.pue-hub-signout:focus-visible,
.pue-hub-card:focus-visible { outline: 2px solid var(--acob-brand-bright); outline-offset: 2px; }

.pue-hub-main {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 48px 24px 64px;
  box-sizing: border-box;
}
.pue-hub-overline {
  margin: 0 0 8px;
  color: var(--acob-brand-bright);
  font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
}
.pue-hub-title { margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -.02em; }
.pue-hub-sub { margin: 8px 0 32px; color: var(--acob-muted); font-size: 15px; }

.pue-hub-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.pue-hub-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 24px;
  text-align: left;
  border: 1px solid var(--acob-card-border);
  border-radius: 16px;
  background: var(--acob-panel);
  box-shadow: var(--acob-panel-shadow);
  color: var(--acob-text);
  font: inherit;
  cursor: pointer;
  transition: border-color .15s ease, transform .15s ease;
}
.pue-hub-card:hover:not(:disabled) { border-color: var(--acob-brand-bright); transform: translateY(-2px); }
.pue-hub-card.is-unavailable { cursor: not-allowed; opacity: .8; }
.pue-hub-icon {
  width: 44px; height: 44px;
  display: grid; place-items: center;
  border-radius: 12px;
  background: var(--acob-accent-muted);
  color: var(--acob-brand-bright);
}
.pue-hub-icon svg { width: 22px; height: 22px; }
.pue-hub-card-title { font-size: 18px; font-weight: 800; }
.pue-hub-card-desc { color: var(--acob-muted); font-size: 14px; line-height: 1.5; }
.pue-hub-status { margin-top: auto; padding-top: 6px; font-size: 13px; font-weight: 700; }
.pue-hub-status.is-ready { color: var(--acob-brand-bright); }
.pue-hub-status.is-pending { color: var(--acob-muted); }

@media (max-width: 640px) {
  .pue-hub-bar { padding: 12px 16px; }
  .pue-hub-name { display: none; }
  .pue-hub-main { padding: 32px 16px 48px; }
  .pue-hub-title { font-size: 26px; }
}
@media (prefers-reduced-motion: reduce) {
  .pue-hub-card { transition: none; }
  .pue-hub-card:hover:not(:disabled) { transform: none; }
}
</style>
