import { INTERFACE_LOCALES, type InterfaceLocale } from '@beverly-call/shared'

/** Same storage key Beverly uses, so one choice carries over wherever both apps share an origin. */
export const LOCALE_STORAGE_KEY = 'beverly.locale'

let current: InterfaceLocale = 'en'

/** Unknown or retired codes (including the old "pcm" interface option) fall back to English. */
export function resolveLocale(v: unknown): InterfaceLocale {
  return INTERFACE_LOCALES.some((l) => l.code === v) ? (v as InterfaceLocale) : 'en'
}

export function storedLocale(): InterfaceLocale | null {
  try { const v = localStorage.getItem(LOCALE_STORAGE_KEY); return v ? resolveLocale(v) : null } catch { return null }
}

export function setLocale(l: InterfaceLocale): void {
  current = l
  try { localStorage.setItem(LOCALE_STORAGE_KEY, l) } catch { /* storage blocked */ }
}

/** BCP 47 tag for dates and numbers: en-NG, yo-NG, ha-NG or ig-NG, as Beverly formats them. */
export const intl = (): string => INTERFACE_LOCALES.find((l) => l.code === current)?.intl ?? 'en-NG'
