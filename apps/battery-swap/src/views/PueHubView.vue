<template>
  <div class="pue-hub" data-testid="pue-hub">
    <header class="pue-hub-bar">
      <a :href="portalUrls.landing" class="pue-hub-brand" title="Beverly">
        <img :src="theme === 'dark' ? brandLockupDark : brandLockupLight" alt="Beverly" class="pue-hub-lockup" @error="hideImage" />
      </a>
      <AccountMenu />
    </header>

    <main class="pue-hub-main">
      <h1 class="pue-hub-title">Where to?</h1>
      <p class="pue-hub-sub">Pick a workspace. Your Beverly sign-in works in both.</p>

      <div class="pue-hub-grid">
        <button
          v-for="space in workspaces"
          :key="space.key"
          type="button"
          :class="['pue-hub-card', 'surface', space.available ? 'is-ready' : 'is-unavailable']"
          :disabled="!space.available"
          :aria-disabled="!space.available"
          :aria-label="space.available ? space.title : `${space.title}, not set up yet`"
          :data-testid="`btn-pue-workspace-${space.key}`"
          @click="open(space)"
        >
          <span class="pue-art" aria-hidden="true">
            <!-- A battery taking charge: cells light one after another -->
            <svg v-if="space.key === 'battery-swap'" viewBox="0 0 160 96" fill="none">
              <rect x="6" y="14" width="136" height="68" rx="20" class="art-line" />
              <rect x="146" y="38" width="8" height="20" rx="4" class="art-line" />
              <rect v-for="n in 5" :key="n" :x="18 + (n - 1) * 24" y="26" width="18" height="44" rx="9" class="art-cell" :style="{ '--n': n }" />
            </svg>
            <!-- A fridge: door, handle and a pilot light -->
            <svg v-else viewBox="0 0 160 96" fill="none">
              <rect x="44" y="4" width="72" height="88" rx="18" class="art-line" />
              <line x1="44" y1="38" x2="116" y2="38" class="art-line" />
              <line x1="58" y1="20" x2="58" y2="28" class="art-line art-handle" />
              <line x1="58" y1="50" x2="58" y2="66" class="art-line art-handle" />
              <circle cx="100" cy="21" r="4.5" class="art-pilot" />
            </svg>
          </span>
          <span class="pue-hub-text">
            <span class="pue-hub-card-title">{{ space.shortTitle }}</span>
            <span class="pue-hub-card-note">{{ space.available ? space.description : 'Not set up yet' }}</span>
          </span>
          <span class="pue-hub-go" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
          </span>
        </button>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * PUE Hub: first screen after signing in to Beverly PUE.
 * Battery Swap Stations opens the swap workspace; Electronic Appliances opens the appliances workspace.
 */
import { useRouter } from 'vue-router';
import AccountMenu from '../shell/AccountMenu.vue';
import { theme } from '../lib/theme.js';

interface Workspace {
  key: string;
  title: string;
  shortTitle: string;
  description: string;
  /** Route to open; null while the workspace does not exist yet. */
  to: string | null;
  available: boolean;
}

const router = useRouter();

const base = import.meta.env.BASE_URL || '/';
const brandLockupDark = `${base}brand/beverly-lockup-white.png`;
const brandLockupLight = `${base}brand/beverly-lockup.png`;
const portalUrls = {
  landing: import.meta.env.DEV ? 'http://localhost:5176/' : '/wallet/',
};

const workspaces: Workspace[] = [
  {
    key: 'battery-swap',
    title: 'Battery Swap Stations',
    shortTitle: 'Battery swap',
    description: 'Swaps, sites, bikes, batteries, riders and the live map',
    to: '/dashboard',
    available: true,
  },
  {
    key: 'appliances',
    title: 'Electronic Appliances',
    shortTitle: 'Appliances',
    description: 'Catalogue, units, sales to customers, and faults',
    to: '/appliances',
    available: true,
  },
];

function open(space: Workspace) {
  if (!space.available || !space.to) return;
  void router.push(space.to);
}

function hideImage(event: Event) {
  const target = event.target as HTMLImageElement | null;
  if (target) target.style.display = 'none';
}
</script>

<style scoped>
.pue-hub { min-height: 100%; display: flex; flex-direction: column; color: var(--acob-text); font-family: var(--acob-font-sans); }
.pue-hub-bar { display: flex; align-items: center; justify-content: space-between; padding: 18px 28px; }
.pue-hub-brand { display: inline-flex; }
.pue-hub-lockup { height: 30px; width: auto; }

.pue-hub-main { flex: 1; width: 100%; max-width: 1040px; margin: 0 auto; padding: 5vh 24px 64px; box-sizing: border-box; }
.pue-hub-title { margin: 0; font-size: clamp(44px, 7vw, 76px); line-height: 1; font-weight: 750; letter-spacing: -.045em; text-wrap: balance; }
.pue-hub-sub { margin: 14px 0 40px; color: var(--acob-muted); font-size: 15px; max-width: 46ch; }

.pue-hub-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; }
.pue-hub-card {
  display: grid; grid-template-rows: auto 1fr; gap: 28px; align-content: start; padding: 32px 32px 30px; min-height: 340px;
  border-radius: 34px; color: var(--acob-text); font: inherit; text-align: left; cursor: pointer;
  transition: transform .5s cubic-bezier(.16, 1, .3, 1), box-shadow .3s ease;
}
.pue-hub-card.is-ready:hover { transform: translateY(-6px); }
.pue-hub-card.is-ready:active { transform: translateY(-2px) scale(.99); }
.pue-hub-card.is-unavailable { cursor: not-allowed; opacity: .7; }
.pue-hub-card:focus-visible { outline: 3px solid var(--acob-focus); outline-offset: 4px; }

.pue-art { display: grid; place-items: center start; height: 120px; }
.pue-art svg { width: 190px; height: 114px; overflow: visible; }
.art-line { stroke: var(--acob-text); stroke-opacity: .72; stroke-width: 2.5; fill: color-mix(in srgb, var(--surface-rim) 22%, transparent); stroke-linecap: round; }
.art-handle { fill: none; stroke-width: 4; stroke: var(--acob-accent-solid); stroke-opacity: 1; }
.art-cell { fill: var(--acob-accent-solid); opacity: .18; animation: charge 3.6s ease-in-out infinite; animation-delay: calc(var(--n) * .35s); }
.art-pilot { fill: var(--acob-accent-solid); filter: drop-shadow(0 0 7px var(--acob-accent-solid)); animation: pilot 2.6s ease-in-out infinite; }
@keyframes charge { 0%, 12% { opacity: .16; } 30%, 78% { opacity: 1; filter: drop-shadow(0 0 8px color-mix(in srgb, var(--acob-accent-solid) 80%, transparent)); } 100% { opacity: .16; } }
@keyframes pilot { 50% { opacity: .35; } }

.pue-hub-text { display: grid; gap: 8px; align-content: end; }
.pue-hub-card-title { font-size: clamp(28px, 3.4vw, 38px); font-weight: 750; letter-spacing: -.035em; line-height: 1.05; }
.pue-hub-card-note { color: var(--acob-muted); font-size: 15px; line-height: 1.45; max-width: 34ch; }

.pue-hub-go {
  position: absolute; right: 26px; bottom: 26px; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%;
  color: var(--on-gel); background: var(--gel-mid);
  box-shadow: none;
  transition: transform .45s cubic-bezier(.16, 1, .3, 1);
}
.pue-hub-go svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.pue-hub-card.is-ready:hover .pue-hub-go { transform: translateX(4px) scale(1.08); }

@media (max-width: 760px) {
  .pue-hub-bar { padding: 12px 16px; }
  .pue-hub-main { padding: 3vh 16px 40px; }
  .pue-hub-grid { grid-template-columns: 1fr; gap: 16px; }
  .pue-hub-card { min-height: 260px; border-radius: 34px; padding: 26px; }
}
@media (prefers-reduced-motion: reduce) {
  .art-cell, .art-pilot { animation: none; opacity: 1; }
  .pue-hub-card, .pue-hub-go { transition: none; }
}
</style>
