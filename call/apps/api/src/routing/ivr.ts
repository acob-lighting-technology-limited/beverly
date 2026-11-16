import type { LanguageCode } from '@beverly-call/shared'

const XML = '<?xml version="1.0" encoding="UTF-8"?>'
const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!)

/** Digit -> language for the IVR language menu. Matches the prototype call flow: EN HA YO IG PCM. */
export const LANGUAGE_DIGITS: Record<string, LanguageCode> = { '1': 'en', '2': 'ha', '3': 'yo', '4': 'ig', '5': 'pcm' }

export const emptyResponse = (): string => `${XML}<Response></Response>`

/** Welcome, recording notice and language menu. The carrier posts the pressed digit back to callbackUrl. */
export function languageMenu(callbackUrl: string): string {
  return `${XML}<Response><GetDigits timeout="10" numDigits="1" callbackUrl="${esc(callbackUrl)}"><Say>Welcome to Beverly. This call is recorded. For English press 1. Hausa, 2. Yoruba, 3. Igbo, 4. Pidgin, 5.</Say></GetDigits><Say>We did not get your choice. Goodbye.</Say></Response>`
}

/** Connect the caller to the chosen agent's browser softphone, recording the call. */
export function dialAgent(clientName: string, callerId?: string): string {
  return `${XML}<Response><Say>Please hold while we connect you.</Say><Dial phoneNumbers="${esc(clientName)}" record="true"${callerId ? ` callerId="${esc(callerId)}"` : ''}/></Response>`
}

/** Nobody free: apologise and promise a callback (the route creates the callback row). */
export function noAgentCallback(): string {
  return `${XML}<Response><Say>All of our agents are busy. We have saved your number and will call you back shortly. Thank you for calling Beverly.</Say><Reject/></Response>`
}
