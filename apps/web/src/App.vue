<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import NotificationsPanel from '@/components/panels/NotificationsPanel.vue'
import SearchPanel from '@/components/panels/SearchPanel.vue'
import SettingsPanel from '@/components/panels/SettingsPanel.vue'
import InboxPanels from '@/components/panels/InboxPanels.vue'
import { useSession } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { useInbox } from '@/stores/inbox'
import { usePresence } from '@/stores/presence'
import { useToast } from '@/stores/toast'
import { useUi } from '@/stores/ui'
import { DEFAULT_SCREEN, GROUPS } from '@/lib/roles'
import { groupLabel, screenTitle } from '@/lib/i18n'
import { clock } from '@/lib/format'
import { api } from '@/lib/api'
import type { Role, ScreenId } from '@/types'
import type { PresenceStatus } from '@beverly-call/shared'

const route = useRoute()
const router = useRouter()
const session = useSession()
const settings = useSettings()
const inbox = useInbox()
const presence = usePresence()
const toast = useToast()
const ui = useUi()

const showShell = computed(() => !route.meta.public && !!session.user)
const current = computed(() => route.meta.screen as ScreenId | undefined)
const inCall = computed(() => current.value === 'call')
const groupIdx = computed(() => GROUPS.findIndex((g) => current.value && g.screens.includes(current.value)))
const groups = computed(() => GROUPS.map((g, i) => ({ ...g, i, reachable: g.screens.filter((s) => session.screens.includes(s)) })).filter((g) => g.reachable.length))
const subnav = computed(() => (groupIdx.value > 0 ? GROUPS[groupIdx.value]!.screens.filter((s) => session.screens.includes(s)) : []))
/** Agents have only their own cases under Monitor, so the tab says so. */
const navLabel = (i: number): string => (session.role === 'agent' && GROUPS[i]?.label === 'Monitor' ? 'Cases' : groupLabel(settings.p.lang, i))
const themeIcon = computed(() => ({ light: 'sun', dark: 'moon', auto: 'auto' })[settings.p.theme])
const mark = computed(() => (settings.isDark() ? '/brand/beverly-mark-light.png' : '/brand/beverly-mark.png'))
const initials = computed(() => (session.user?.name ?? '').split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase())
const STATUS: { id: PresenceStatus; label: string }[] = [{ id: 'available', label: 'Available' }, { id: 'break', label: 'Break' }, { id: 'away', label: 'Away' }]
const takesCalls = computed(() => session.role === 'agent' || session.role === 'supervisor')

/* ---- Real session lifecycle: presence heartbeat and inbox polling only while signed in ---- */
watch(() => session.user?.id, (id) => {
  if (id) { inbox.start(session.user?.role); if (takesCalls.value) presence.start() } else { inbox.stop(); presence.stop() }
}, { immediate: true })

/* ---- Call pill: shown on every screen except the call screen while a call is live ---- */
const live = ref<{ name: string; startedAt: string } | null>(null)
const pillSecs = ref(0)
let pillTimer = 0
async function checkLive(): Promise<void> {
  if (!session.user || !takesCalls.value || document.hidden) return
  try { live.value = await api<{ name: string; startedAt: string } | null>('/calls/active') } catch { /* keep last */ }
}
onMounted(() => {
  void checkLive()
  pillTimer = window.setInterval(() => {
    if (live.value) pillSecs.value = Math.max(0, Math.floor((Date.now() - Date.parse(live.value.startedAt)) / 1000))
  }, 1000)
  window.setInterval(checkLive, 10_000)
})
watch(() => route.fullPath, () => void checkLive())

/* ---- Offline banner ---- */
const offline = ref(!navigator.onLine)
const goOffline = () => { offline.value = true }
const goOnline = () => { offline.value = false; toast.show('Back online') }
window.addEventListener('offline', goOffline)
window.addEventListener('online', goOnline)

/* ---- Session timeout lock ---- */
const locked = ref(false)
let lastActive = Date.now()
const touch = () => { lastActive = Date.now() }
for (const ev of ['pointerdown', 'keydown', 'touchstart']) document.addEventListener(ev, touch, true)
const lockTimer = window.setInterval(() => {
  const m = settings.p.sessionTimeoutMin
  // never lock in the middle of a call
  if (m && session.user && !locked.value && !live.value && Date.now() - lastActive > m * 60000) locked.value = true
}, 10_000)
function unlock(): void { lastActive = Date.now(); locked.value = false }

/* ---- Keyboard shortcuts ---- */
function onKey(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ui.open('search'); return }
  if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); router.back(); return }
  if (e.key === 'Escape') { ui.close(); return }
  if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName) || e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === '?') ui.open('shortcuts')
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline)
  clearInterval(pillTimer); clearInterval(lockTimer)
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) document.removeEventListener(ev, touch, true)
})

function viewAs(r: Role): void {
  session.setViewAs(r)
  ui.close()
  void router.push(`/${DEFAULT_SCREEN[session.role ?? 'agent']}`)
  toast.show(r === session.user?.role ? 'Back to your own view' : `Viewing as ${r}`)
}
async function setStatus(s: PresenceStatus): Promise<void> { await presence.set(s) }
async function signOut(): Promise<void> {
  ui.close()
  try { await api('/presence', { method: 'DELETE' }) } catch { /* not a call taker */ }
  await session.logout()
  inbox.stop(); presence.stop()
  void router.push('/login')
}
const toggleMenu = () => ui.toggle('menu')
</script>

<template>
  <RouterView v-if="!showShell" />
  <div v-else class="app" :class="{ incall: inCall }" @click="ui.panel === 'menu' || ui.panel === 'notifications' ? ui.close() : undefined">
    <header class="tbar">
      <div class="br">
        <img class="bmark" :src="mark" alt="" width="30" height="30" />
        <span>Beverly Call</span>
        <b v-if="session.viewAs && !inCall" class="chip" id="act" style="font-weight: 400">Viewing as {{ session.viewAs }}</b>
      </div>
      <button class="ib" :aria-label="`Theme: ${settings.p.theme}. Click to change`" :title="`Theme: ${settings.p.theme}`" @click.stop="settings.cycleTheme"><Icon :name="themeIcon" /></button>
      <button class="ib" aria-label="Search" title="Search (Ctrl K)" @click.stop="ui.open('search')"><Icon name="search" /></button>
      <button class="ib" aria-label="Notifications" title="Notifications" :aria-expanded="ui.panel === 'notifications'" @click.stop="ui.toggle('notifications')">
        <Icon name="bell" /><i v-if="inbox.unread" class="bd">{{ inbox.unread }}</i></button>
      <button class="avb" :data-st="presence.status" aria-haspopup="true" :aria-expanded="ui.panel === 'menu'" aria-label="Account menu" @click.stop="toggleMenu">
        <span class="avw"><span class="avi">{{ initials }}</span><i class="sd" aria-hidden="true"></i></span>
        <span><b style="font-weight: 400">{{ session.user?.name }}</b><small style="display: block; color: var(--mut); font-size: 10px">{{ takesCalls ? STATUS.find((x) => x.id === presence.status)?.label : session.user?.role }}</small></span>
      </button>

      <NotificationsPanel />
      <div v-if="ui.panel === 'menu'" class="menu on" @click.stop>
        <div class="mh"><div><b style="font-weight: 400">{{ session.user?.name }}</b>
          <div style="color: var(--mut); font-size: 11px">{{ session.user?.role }}{{ session.viewAs ? `, viewing as ${session.viewAs}` : '' }}</div></div></div>
        <div v-if="session.user?.role === 'admin'" class="vw"><small>Switch view, using your own login</small>
          <div class="ss"><button v-for="r in (['agent', 'supervisor', 'admin'] as Role[])" :key="r" :class="{ on: session.role === r }" @click="viewAs(r)">{{ r }}</button></div></div>
        <div v-if="takesCalls" class="ss" id="ss">
          <button v-for="s in STATUS" :key="s.id" :data-s="s.id" :class="{ on: presence.status === s.id }" @click="setStatus(s.id)">{{ s.label }}</button></div>
        <button class="mi" @click="ui.open('profile')"><Icon name="user" />Profile</button>
        <button class="mi" @click="ui.open('settings')"><Icon name="sliders" />Settings</button>
        <button class="mi" @click="ui.open('handover')"><Icon name="note" />Shift handover</button>
        <button class="mi" @click="ui.open('shortcuts')"><Icon name="keys" />Shortcuts</button>
        <button class="mi" @click="ui.open('replies')"><Icon name="help" />Help and replies</button>
        <button class="mi" @click="signOut"><Icon name="out" />Sign out</button>
      </div>
    </header>
    <div class="mscrim" :class="{ on: ui.panel === 'menu' }" @click="ui.close"></div>
    <div v-if="offline" class="net on" role="status">You are offline. Showing the last known data.</div>

    <nav aria-label="Main">
      <img class="bmark rail-logo" :src="mark" alt="Beverly" />
      <RouterLink v-for="g in groups" :key="g.label" :to="`/${g.reachable[0]}`" :class="{ on: g.i === groupIdx }" :title="navLabel(g.i)" :aria-label="navLabel(g.i)">
        <Icon :name="g.icon" /><span>{{ navLabel(g.i) }}</span>
      </RouterLink>
    </nav>
    <div class="subnav" :class="{ on: subnav.length > 1 }" aria-label="Section">
      <RouterLink v-for="s in subnav" :key="s" :to="`/${s}`" :class="{ on: s === current }">{{ screenTitle(settings.p.lang, s) }}</RouterLink>
    </div>
    <div class="views"><RouterView v-slot="{ Component }"><component :is="Component" class="view on" /></RouterView></div>

    <button v-if="live && !inCall" id="pin" class="on" @click="router.push('/call')"><Icon name="phone" /><span>On call {{ clock(pillSecs) }}, {{ live.name }}</span></button>
  </div>

  <SearchPanel /><SettingsPanel /><InboxPanels />
  <div class="tt" :class="{ on: !!toast.message }" role="status">{{ toast.message }}</div>

  <div v-if="locked" id="lockov" class="on" role="alertdialog" aria-label="Session timed out">
    <div class="lkc"><Icon name="lock" /><h2>Session timed out</h2><p>You were away for a while. Continue to pick up where you left off.</p>
      <div class="btns"><button class="y" autofocus @click="unlock">Continue</button><button @click="signOut">Sign out</button></div></div>
  </div>
</template>

<style>
.avi { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: var(--yel); color: var(--on-accent); font-size: 13px; line-height: 1; }
.avw { position: relative; display: inline-grid; }
.avb[data-st=available] .sd { background: var(--st-on); }
.avb[data-st=break] .sd { background: var(--st-break); }
.avb[data-st=away] .sd { background: var(--st-away); }
.avb .avw { line-height: 0; }
</style>
