import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { InterfaceLocale } from '@beverly-call/shared'
import { resolveLocale, setLocale, storedLocale } from '@/lib/locale'
import type { ThemeMode } from '@/types'

const KEY = 'bc.prefs'

export interface Prefs {
  theme: ThemeMode
  pal: string                 // '' = default yellow, or brand | emerald | lime | forest
  surface: 'frost' | 'glass'
  dense: boolean
  mask: boolean
  textSize: number
  highContrast: boolean
  reduceMotion: boolean
  lang: InterfaceLocale        // interface language only. Pidgin is a spoken (call) language, not an interface one.
  sounds: boolean
  sessionTimeoutMin: number   // 0 = off
  mute: { esc: boolean; cb: boolean; sys: boolean }
}

const DEFAULTS: Prefs = {
  theme: 'auto', pal: '', surface: 'frost', dense: false, mask: true, textSize: 100, highContrast: false, reduceMotion: false,
  lang: 'en', sounds: true, sessionTimeoutMin: 15, mute: { esc: false, cb: false, sys: false },
}

function load(): Prefs {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>
    // Retired or unknown languages (such as the old 'pcm' interface option) become English; Beverly's own choice wins when present.
    return { ...DEFAULTS, ...s, lang: storedLocale() ?? resolveLocale((s as { lang?: unknown }).lang), mute: { ...DEFAULTS.mute, ...(s.mute ?? {}) } }
  } catch { return { ...DEFAULTS, mute: { ...DEFAULTS.mute } } }
}

/** UI preferences only. Roles, identity and audit data never live in browser storage. */
export const useSettings = defineStore('settings', () => {
  const p = ref<Prefs>(load())
  const isDark = () => {
    const h = new Date().getHours()
    return p.value.theme === 'dark' || (p.value.theme === 'auto' && (h >= 19 || h < 6))
  }
  function apply(): void {
    const r = document.documentElement
    r.dataset.theme = isDark() ? 'dark' : 'light'
    if (p.value.pal) r.dataset.pal = p.value.pal; else delete r.dataset.pal
    r.dataset.surf = p.value.surface === 'glass' ? 'glass' : 'frost'
    r.dataset.dens = p.value.dense ? 'compact' : 'comfy'
    if (p.value.highContrast) r.setAttribute('data-hc', ''); else r.removeAttribute('data-hc')
    if (p.value.reduceMotion) r.setAttribute('data-rm', ''); else r.removeAttribute('data-rm')
    r.style.setProperty('--tx', String(p.value.textSize / 100))
    r.lang = p.value.lang
    setLocale(p.value.lang)
  }
  watch(p, () => {
    apply()
    try { localStorage.setItem(KEY, JSON.stringify(p.value)) } catch { /* storage blocked */ }
  }, { deep: true })
  const cycleTheme = (): void => { p.value.theme = ({ light: 'dark', dark: 'auto', auto: 'light' } as const)[p.value.theme] }
  return { p, apply, cycleTheme, isDark }
})
