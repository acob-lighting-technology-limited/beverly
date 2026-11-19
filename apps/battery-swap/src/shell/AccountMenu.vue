<template>
  <div class="acct" ref="wrap">
    <button
      type="button"
      class="acct-chip"
      :aria-label="`Account menu for ${auth.displayName}`"
      aria-haspopup="menu"
      :aria-expanded="open"
      data-testid="account-menu"
      @click.stop="open = !open"
    >
      <span class="acct-avatar">{{ auth.userInitials }}</span>
      <span class="acct-meta"><strong>{{ firstName }}</strong><small>{{ auth.roleLabel }}</small></span>
    </button>

    <!-- Same menu as Beverly Call: who you are, then Profile, Settings, Shortcuts, Sign out -->
    <Transition name="acct-pop">
      <div v-show="open" class="acct-menu glass" role="menu" aria-label="Account menu" @click.stop>
        <div class="acct-head">
          <span class="acct-avatar acct-avatar--lg">{{ auth.userInitials }}</span>
          <span class="acct-who"><strong>{{ auth.displayName }}</strong><small>{{ auth.roleLabel }}</small></span>
        </div>
        <button type="button" class="acct-item" role="menuitem" data-testid="menu-profile" @click="show('profile')">
          <svg class="acct-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>Profile
        </button>
        <button type="button" class="acct-item" role="menuitem" data-testid="menu-settings" @click="show('settings')">
          <svg class="acct-ico" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></svg>Settings
        </button>
        <button type="button" class="acct-item" role="menuitem" data-testid="menu-shortcuts" @click="show('shortcuts')">
          <svg class="acct-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="3" /><line x1="6" y1="10" x2="6.01" y2="10" /><line x1="10" y1="10" x2="10.01" y2="10" /><line x1="14" y1="10" x2="14.01" y2="10" /><line x1="18" y1="10" x2="18.01" y2="10" /><line x1="7" y1="14" x2="17" y2="14" /></svg>Shortcuts
        </button>
        <button type="button" class="acct-item acct-item--danger" role="menuitem" data-testid="menu-signout" @click="signOut">
          <svg class="acct-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>Sign out
        </button>
      </div>
    </Transition>

    <!-- Panels -->
    <Teleport to="body">
      <div v-if="panel" class="reg-overlay" data-testid="acct-panel" @click.self="panel = null" @keydown.esc="panel = null">
        <div class="reg-dialog acct-panel" role="dialog" aria-modal="true" :aria-label="panelTitle">
          <h2 class="reg-dialog-title">{{ panelTitle }}</h2>

          <dl v-if="panel === 'profile'" class="acct-rows">
            <div><dt>Name</dt><dd>{{ auth.user?.full_name || '—' }}</dd></div>
            <div><dt>Email</dt><dd>{{ auth.user?.email || '—' }}</dd></div>
            <div><dt>Role</dt><dd>{{ auth.roleLabel }}</dd></div>
            <div><dt>Portals you can open</dt><dd>{{ portalList }}</dd></div>
          </dl>

          <div v-else-if="panel === 'settings'">
            <section class="acct-group">
              <h3>Mode</h3>
              <div class="acct-seg" role="radiogroup" aria-label="Mode">
                <button v-for="m in MODES" :key="m.id" type="button" role="radio" :aria-checked="theme === m.id" :class="{ on: theme === m.id }" :data-testid="`mode-${m.id}`" @click="setTheme(m.id)">{{ m.label }}</button>
              </div>
            </section>
            <section class="acct-group">
              <h3>Colours</h3>
              <div class="acct-palettes" role="radiogroup" aria-label="Colour palette">
                <button v-for="p in PALETTES" :key="p.id" type="button" role="radio" :aria-checked="palette === p.id" :class="['acct-pal', { on: palette === p.id }]" :data-testid="`palette-${p.id}`" @click="setPalette(p.id)">
                  <span class="acct-swatch" aria-hidden="true"><i v-for="c in p.swatch" :key="c" :style="{ background: c }" /></span>
                  <span class="acct-pal-text"><strong>{{ p.label }}</strong><small>{{ p.note }}</small></span>
                </button>
              </div>
            </section>
            <section class="acct-group">
              <h3>Session</h3>
              <p class="acct-note">{{ sessionNote }}</p>
            </section>
          </div>

          <ul v-else class="acct-keys">
            <li><kbd>Alt</kbd> <kbd>1</kbd> to <kbd>9</kbd><span>Jump to a section on the rail</span></li>
            <li><kbd>Esc</kbd><span>Close a menu or dialog</span></li>
            <li><kbd>Tab</kbd><span>Move between controls</span></li>
          </ul>

          <div class="reg-dialog-actions"><button type="button" class="reg-btn" @click="panel = null">Close</button></div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
/**
 * The account menu, laid out as in Beverly Call: Profile, Settings, Shortcuts, Sign out.
 * Profile and Shortcuts are read-only panels; Settings holds the mode and colour palette and tells you when
 * your session renews. Nothing here links to another portal.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useBatterySwapAuthStore } from "../stores/auth";
import { PALETTES, palette, setPalette, setTheme, theme } from "../lib/theme.js";
import { tokenExpiryMs } from "../lib/session.js";

const MODES = [{ id: "light", label: "Light" }, { id: "dark", label: "Dark" }];
const PORTAL_NAMES = { crm: "CRM", staff_wallet: "Staff wallet", call: "Beverly Call", pue: "Beverly PUE" };

const auth = useBatterySwapAuthStore();
const router = useRouter();
const open = ref(false);
const panel = ref(null);
const wrap = ref(null);

const firstName = computed(() => {
  const raw = auth.user?.full_name || auth.user?.email || "Beverly";
  const word = raw.split(/[\s@.]+/)[0] || "Beverly";
  return word.charAt(0).toUpperCase() + word.slice(1);
});
const panelTitle = computed(() => ({ profile: "Profile", settings: "Settings", shortcuts: "Shortcuts" })[panel.value] ?? "");
const portalList = computed(() => {
  if (auth.user?.role === "super-admin") return "All portals";
  const names = (auth.user?.portal_access ?? []).map((key) => PORTAL_NAMES[key] ?? key);
  return names.length ? names.join(", ") : "—";
});
const sessionNote = computed(() => {
  const ends = tokenExpiryMs(auth.accessToken);
  const when = ends ? new Date(ends).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  return when
    ? `Your sign-in renews itself in the background. The current one runs to ${when}.`
    : "Your sign-in renews itself in the background.";
});

function show(name) {
  open.value = false;
  panel.value = name;
}
function signOut() {
  open.value = false;
  auth.logout();
  router.push("/login");
}

function onPointerDown(event) {
  if (wrap.value && !wrap.value.contains(event.target)) open.value = false;
}
function onKey(event) {
  if (event.key !== "Escape") return;
  open.value = false;
  panel.value = null;
}
onMounted(() => {
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onPointerDown);
  document.removeEventListener("keydown", onKey);
});
</script>

<style>
.acct { position: relative; }
.acct-chip {
  display: flex; align-items: center; gap: 10px; height: 46px; padding: 4px 14px 4px 4px; cursor: pointer;
  background: var(--surface-bg); border: 1px solid var(--surface-border); border-radius: 999px;
  color: var(--acob-text); font: inherit;
}
.acct-avatar {
  display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 50%;
  background: var(--gel-mid);
  box-shadow: none;
  color: var(--on-gel); font-size: 13px; font-weight: 700; letter-spacing: .02em;
}
.acct-avatar--lg { width: 44px; height: 44px; font-size: 15px; }
.acct-meta { display: none; text-align: left; line-height: 1.15; }
.acct-meta strong { display: block; font-size: 13px; font-weight: 650; }
.acct-meta small { display: block; font-size: 12px; color: var(--acob-muted); }
@media (min-width: 900px) { .acct-meta { display: block; } }

.acct .acct-menu { background: linear-gradient(135deg, color-mix(in srgb, var(--acob-menu-bg) 90%, transparent), color-mix(in srgb, var(--acob-menu-bg) 80%, transparent)); position: absolute; right: 0; top: calc(100% + 10px); z-index: 60; width: 248px; padding: 8px; border-radius: 26px; transform-origin: top right; }
.acct-head { display: flex; align-items: center; gap: 12px; padding: 8px 8px 12px; margin-bottom: 4px; border-bottom: 1px solid var(--acob-line); }
.acct-who { min-width: 0; line-height: 1.2; }
.acct-who strong { display: block; font-size: 15px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acct-who small { display: block; font-size: 12px; color: var(--acob-muted); }
.acct-item {
  width: 100%; display: flex; align-items: center; gap: 12px; padding: 11px 12px; border: 0; border-radius: 18px;
  background: transparent; color: var(--acob-text); font: inherit; font-size: 14px; text-align: left; cursor: pointer;
  transition: background .15s ease;
}
.acct-item:hover, .acct-item:focus-visible { background: color-mix(in srgb, var(--acob-accent-solid) 22%, transparent); }
.acct-item--danger { color: var(--danger); }
.acct-item--danger:hover { background: var(--color-danger-soft); }
.acct-ico { width: 19px; height: 19px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }

.acct-panel { max-width: 460px; }
.acct-rows { margin: 0 0 12px; display: grid; gap: 4px; }
.acct-rows div { display: grid; grid-template-columns: 150px 1fr; gap: 12px; padding: 12px 14px; border-radius: 18px; background: var(--lg-fill-inset); }
.acct-rows dt { color: var(--acob-muted); font-size: 13px; font-weight: 600; }
.acct-rows dd { margin: 0; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.acct-group { margin-bottom: 18px; }
.acct-group h3 { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: var(--acob-muted); }
.acct-note { margin: 0; font-size: 14px; line-height: 1.5; color: var(--acob-soft); }
.acct-seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 999px; background: var(--lg-fill-inset); border: 1px solid var(--lg-border); }
.acct-seg button { min-height: 38px; padding: 0 20px; border: 0; border-radius: 999px; background: transparent; color: var(--acob-text); font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
.acct-seg button.on { background: var(--gel-mid); color: var(--on-gel); box-shadow: none; }
.acct-palettes { display: grid; gap: 8px; }
.acct-pal { display: flex; align-items: center; gap: 14px; padding: 12px 14px; text-align: left; border: 1px solid var(--lg-border); border-radius: 26px; background: var(--lg-fill-inset); color: var(--acob-text); font: inherit; cursor: pointer; transition: box-shadow .2s ease; }
.acct-pal.on { box-shadow: 0 0 0 3px color-mix(in srgb, var(--acob-focus) 55%, transparent); }
.acct-swatch { display: flex; flex: none; }
.acct-swatch i { width: 22px; height: 34px; }
.acct-swatch i:first-child { border-radius: 99px 0 0 99px; }
.acct-swatch i:last-child { border-radius: 0 99px 99px 0; }
.acct-pal-text strong { display: block; font-size: 14px; }
.acct-pal-text small { display: block; font-size: 12px; color: var(--acob-muted); }
.acct-keys { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 8px; }
.acct-keys li { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 18px; background: var(--lg-fill-inset); font-size: 14px; }
.acct-keys li span { margin-left: auto; color: var(--acob-muted); font-size: 13px; text-align: right; }
.acct-keys kbd { padding: 2px 8px; border-radius: 12px; border: 1px solid var(--lg-border); background: var(--lg-fill-strong); font: 600 12px var(--acob-font-sans); }

.acct-pop-enter-active { transition: opacity .18s ease-out, transform .28s cubic-bezier(.16, 1, .3, 1); }
.acct-pop-leave-active { transition: opacity .12s ease-in, transform .12s ease-in; }
.acct-pop-enter-from, .acct-pop-leave-to { opacity: 0; transform: translateY(-6px) scale(.97); }
@media (prefers-reduced-motion: reduce) { .acct-pop-enter-active, .acct-pop-leave-active, .acct-pal { transition: opacity .1s linear; } .acct-pop-enter-from, .acct-pop-leave-to { transform: none; } }
</style>
