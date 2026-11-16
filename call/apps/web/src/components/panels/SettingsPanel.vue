<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { LANGUAGE_NAMES, type LanguageCode } from '@beverly-call/shared'
import SidePanel from '@/components/SidePanel.vue'
import { api } from '@/lib/api'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'
import { useUi } from '@/stores/ui'

const ui = useUi()
const s = useSettings()
const toast = useToast()
const pushOn = ref(false)
const pushNote = ref('')
let installPrompt: (Event & { prompt(): Promise<void> }) | null = null

const PALETTES = [{ id: '', n: 'Sunny', c: '#FCD95C' }, { id: 'brand', n: 'Brand', c: '#3BBC4A' }, { id: 'emerald', n: 'Emerald', c: '#00CA91' }, { id: 'lime', n: 'Lime', c: '#B3E635' }, { id: 'forest', n: 'Forest', c: '#4AA969' }]
const SOUND_KEY = 'bc.sounds'

onMounted(async () => {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e as never })
  try { pushOn.value = Boolean(await (await navigator.serviceWorker?.getRegistration('/'))?.pushManager.getSubscription()) } catch { pushOn.value = false }
})

const b64 = (k: string): Uint8Array => {
  const pad = '='.repeat((4 - (k.length % 4)) % 4)
  const raw = atob((k + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function togglePush(on: boolean): Promise<void> {
  pushNote.value = ''
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { pushNote.value = 'Push is not supported in this browser.'; pushOn.value = false; return }
    const reg = (await navigator.serviceWorker.getRegistration('/')) ?? (await navigator.serviceWorker.register('/sw.js'))
    if (!on) {
      const sub = await reg.pushManager.getSubscription()
      if (sub) { await api('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe() }
      pushOn.value = false; return
    }
    const { publicKey } = await api<{ publicKey: string | null }>('/push/key')
    if (!publicKey) { pushNote.value = 'Push alerts are not set up on the server yet.'; pushOn.value = false; return }
    if ((await Notification.requestPermission()) !== 'granted') { pushNote.value = 'Push alerts are blocked in your browser settings.'; pushOn.value = false; return }
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) as BufferSource })
    await api('/push/subscribe', { method: 'POST', body: JSON.stringify(sub.toJSON()) })
    pushOn.value = true; toast.show('Push alerts on')
  } catch { pushNote.value = 'Could not change push alerts.'; pushOn.value = false }
}
function install(): void { if (installPrompt) void installPrompt.prompt(); else toast.show('Use Add to Home Screen in your browser menu') }
function setSounds(v: boolean): void { s.p.sounds = v; try { localStorage.setItem(SOUND_KEY, v ? '1' : '0') } catch { /* storage blocked */ } }
</script>

<template>
  <SidePanel :open="ui.panel === 'settings'" title="Settings" @close="ui.close">
    <h3>Appearance</h3>
    <div class="ss"><button v-for="t in (['light', 'dark', 'auto'] as const)" :key="t" :class="{ on: s.p.theme === t }" @click="s.p.theme = t">{{ t === 'auto' ? 'Auto night' : t[0]!.toUpperCase() + t.slice(1) }}</button></div>
    <div class="pks">
      <button v-for="p in PALETTES" :key="p.id" class="pk" :class="{ on: s.p.pal === p.id }" :aria-label="`Use the ${p.n} palette`" @click="s.p.pal = p.id">
        <span class="sw5"><i :style="{ background: p.c }"></i></span><b>{{ p.n }}</b></button>
    </div>
    <h3>Surface</h3>
    <div class="ss"><button :class="{ on: s.p.surface === 'frost' }" @click="s.p.surface = 'frost'">Frost</button><button :class="{ on: s.p.surface === 'glass' }" @click="s.p.surface = 'glass'">Liquid glass</button></div>
    <h3>Density</h3>
    <div class="ss"><button :class="{ on: !s.p.dense }" @click="s.p.dense = false">Comfortable</button><button :class="{ on: s.p.dense }" @click="s.p.dense = true">Compact</button></div>

    <h3>Accessibility</h3>
    <div class="sw"><span>Text size</span><input v-model.number="s.p.textSize" type="range" min="90" max="130" step="5" aria-label="Text size" style="width: 55%" /></div>
    <label class="sw"><span>High contrast</span><input v-model="s.p.highContrast" type="checkbox" /></label>
    <label class="sw"><span>Reduce motion</span><input v-model="s.p.reduceMotion" type="checkbox" /></label>

    <h3>Language</h3>
    <select v-model="s.p.lang" aria-label="Language"><option v-for="(n, k) in LANGUAGE_NAMES" :key="k" :value="(k as LanguageCode)">{{ n }}</option></select>

    <h3>Privacy and security</h3>
    <label class="sw"><span>Mask phone numbers</span><input v-model="s.p.mask" type="checkbox" /></label>
    <div class="sw"><span>Session timeout</span>
      <select v-model.number="s.p.sessionTimeoutMin" aria-label="Session timeout" style="width: 55%"><option :value="0">Off</option><option :value="5">5 minutes</option><option :value="15">15 minutes</option><option :value="30">30 minutes</option></select></div>

    <h3>Notifications</h3>
    <label class="sw"><span>Alert sounds</span><input :checked="s.p.sounds" type="checkbox" @change="setSounds(($event.target as HTMLInputElement).checked)" /></label>
    <label class="sw"><span>Escalation alerts</span><input :checked="!s.p.mute.esc" type="checkbox" @change="s.p.mute.esc = !($event.target as HTMLInputElement).checked" /></label>
    <label class="sw"><span>Callback alerts</span><input :checked="!s.p.mute.cb" type="checkbox" @change="s.p.mute.cb = !($event.target as HTMLInputElement).checked" /></label>
    <label class="sw"><span>System alerts</span><input :checked="!s.p.mute.sys" type="checkbox" @change="s.p.mute.sys = !($event.target as HTMLInputElement).checked" /></label>
    <label class="sw"><span>Push alerts on this device</span><input :checked="pushOn" type="checkbox" @change="togglePush(($event.target as HTMLInputElement).checked)" /></label>
    <p v-if="pushNote" role="status" style="color: var(--mut); margin: 4px 0">{{ pushNote }}</p>
    <div class="btns"><button class="y" @click="install">Install app</button></div>
  </SidePanel>
</template>
